const { Prisma } = require("@prisma/client");
const prisma = require("../../../utils/prismaClient");
const { ADMIN, ID_TIPO_SALIDA_VENTA, filtroArticulo } = require("../comun");

// Reporte 3 — Movimientos de inventario por rango de fechas (solo
// Administrador: es el mismo alcance de auditoría que /api/movimientos y
// expone proveedor y usuario). UNION de compras + salidas (ventas y
// ajustes/mermas) en la propia base; el saldo corrido no se incluye porque
// el sistema solo guarda la existencia ACTUAL (Inventario), no un kardex.
const TIPO_SQL = { compras: "compra", ventas: "venta", ajustes: "ajuste" };

function unionMovimientos(filtros) {
  const { desde, hasta } = filtros.rango;
  const art = filtroArticulo(filtros);
  return Prisma.sql`
    SELECT mm.fecha_compra AS fecha, 'compra'::text AS tipo, 'Compra'::text AS etiqueta,
           pr.nombre AS motivo, d.id_compra AS referencia, d.sku, d.cantidad AS cantidad,
           mm.id_colaborador, mm.anulada
    FROM compra_detalle d
    JOIN compra_maestro mm ON mm.id_compra = d.id_compra
    JOIN proveedor pr ON pr.id_proveedor = mm.id_proveedor
    JOIN articulo a ON a.sku = d.sku
    WHERE mm.fecha_compra >= ${desde} AND mm.fecha_compra < ${hasta} ${art}
    UNION ALL
    SELECT s.fecha_salida, CASE WHEN d.id_tipo_salida = ${ID_TIPO_SALIDA_VENTA} THEN 'venta' ELSE 'ajuste' END,
           CASE WHEN d.id_tipo_salida = ${ID_TIPO_SALIDA_VENTA} THEN 'Venta' ELSE 'Ajuste' END,
           CASE WHEN d.id_tipo_salida = ${ID_TIPO_SALIDA_VENTA} THEN NULL ELSE t.descripcion END,
           d.id_salida, d.sku, -d.cantidad,
           s.id_colaborador, s.anulada
    FROM salida_detalle d
    JOIN salida_maestro s ON s.id_venta = d.id_salida
    JOIN tipo_salida t ON t.id_tipo_salida = d.id_tipo_salida
    JOIN articulo a ON a.sku = d.sku
    WHERE s.fecha_salida >= ${desde} AND s.fecha_salida < ${hasta} ${art}`;
}

async function ejecutar(filtros, ctx) {
  const union = unionMovimientos(filtros);
  const filtroTipo = filtros.tipo !== "todos" ? Prisma.sql`AND mv.tipo = ${TIPO_SQL[filtros.tipo]}` : Prisma.empty;

  const [filas, resumen] = await Promise.all([
    prisma.$queryRaw`
      SELECT mv.fecha, mv.tipo, mv.etiqueta, mv.motivo, mv.referencia, mv.sku, a.nombre,
             mv.cantidad::int AS cantidad,
             TRIM(col.nombres || ' ' || col.primer_apel) AS usuario, mv.anulada
      FROM (${union}) mv
      JOIN articulo a ON a.sku = mv.sku
      JOIN colaborador col ON col.id_colaborador = mv.id_colaborador
      WHERE true ${filtroTipo}
      ORDER BY mv.fecha DESC, mv.referencia DESC, mv.sku
      LIMIT ${ctx.limite}`,
    prisma.$queryRaw`
      SELECT mv.tipo, mv.anulada, COUNT(*)::int AS lineas, COALESCE(SUM(ABS(mv.cantidad)), 0)::int AS unidades
      FROM (${union}) mv
      WHERE true ${filtroTipo}
      GROUP BY mv.tipo, mv.anulada`,
  ]);

  const acum = { compra: 0, venta: 0, ajuste: 0 };
  let totalLineas = 0;
  let anuladas = 0;
  for (const r of resumen) {
    totalLineas += r.lineas;
    if (r.anulada) {
      anuladas += r.lineas;
    } else {
      acum[r.tipo] += r.unidades;
    }
  }
  const entradas = acum.compra;
  const salidas = acum.venta + acum.ajuste;

  const filasTabla = filas.map((f) => ({
    fecha: f.fecha,
    tipo: f.etiqueta,
    motivo: f.motivo,
    referencia: `${f.tipo === "compra" ? "C" : f.tipo === "venta" ? "V" : "S"}-${f.referencia}`,
    sku: f.sku,
    nombre: f.nombre,
    cantidad: f.cantidad,
    usuario: f.usuario,
    estado: f.anulada ? { texto: "Anulada", tono: "bad" } : { texto: "Vigente", tono: "ok" },
  }));

  return {
    kpis: [
      { etiqueta: "Movimientos (líneas)", valor: totalLineas, tipo: "entero", nota: anuladas ? `${anuladas} anulada${anuladas === 1 ? "" : "s"}` : undefined },
      { etiqueta: "Unidades que entraron", valor: entradas, tipo: "entero", nota: "compras vigentes" },
      { etiqueta: "Unidades que salieron", valor: salidas, tipo: "entero", nota: "ventas + ajustes vigentes" },
      { etiqueta: "Variación neta", valor: entradas - salidas, tipo: "entero" },
    ],
    tablas: [
      {
        id: "movimientos",
        titulo: "Detalle de movimientos",
        principal: true,
        columnas: [
          { clave: "fecha", etiqueta: "Fecha", tipo: "fechaHora", ancho: 62 },
          { clave: "tipo", etiqueta: "Tipo", tipo: "texto", ancho: 38 },
          { clave: "motivo", etiqueta: "Motivo / proveedor", tipo: "texto", ancho: 84 },
          { clave: "referencia", etiqueta: "Ref.", tipo: "texto", ancho: 38 },
          { clave: "sku", etiqueta: "SKU", tipo: "texto", ancho: 52 },
          { clave: "nombre", etiqueta: "Producto", tipo: "texto", ancho: 112 },
          { clave: "cantidad", etiqueta: "Cant.", tipo: "entero", signo: true, ancho: 34 },
          { clave: "usuario", etiqueta: "Usuario", tipo: "texto", ancho: 70 },
          { clave: "estado", etiqueta: "Estado", tipo: "estado", ancho: 42 },
        ],
        filas: filasTabla,
        totalFilas: totalLineas,
      },
    ],
    grafica: {
      tipo: "barras",
      titulo: "Unidades movidas por tipo (movimientos vigentes)",
      formato: "entero",
      items: [
        { etiqueta: "Compras (entradas)", valor: acum.compra },
        { etiqueta: "Ventas (salidas)", valor: acum.venta },
        { etiqueta: "Ajustes y mermas (salidas)", valor: acum.ajuste },
      ],
    },
    notas: [
      "Cantidad positiva = entrada de stock; negativa = salida. Los movimientos anulados se listan pero no suman en los totales.",
      "No incluye los ajustes de conteo físico (positivos o negativos): se consultan en Movimientos y en el reporte «Conteo físico».",
      "No incluye saldo por movimiento: el sistema guarda la existencia actual, no un kardex histórico.",
    ],
    vacio: totalLineas === 0 ? "No hay movimientos en este rango. Prueba ampliando las fechas." : null,
  };
}

module.exports = {
  id: "movimientos",
  nombreCorto: "Movimientos",
  titulo: "Movimientos de inventario",
  descripcion: "Todo lo que entró y salió del inventario en un período: compras, ventas y ajustes, con usuario y motivo. Sirve para auditar diferencias.",
  icono: "arrows",
  roles: [ADMIN],
  filtros: ["rango", "tipo", "idCategoria", "idMarca"],
  orientacion: "horizontal",
  ejecutar,
};
