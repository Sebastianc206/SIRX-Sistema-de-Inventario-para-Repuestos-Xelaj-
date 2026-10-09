const prisma = require("../../../utils/prismaClient");
const { ADMIN, OPERADOR, ID_TIPO_SALIDA_VENTA, filtroArticulo } = require("../comun");
const { redondear2 } = require("../formato");

// Reporte 7 — Mermas y ajustes. Todas las salidas que NO son venta (merma,
// uso interno, garantía, ajuste) no anuladas. Operador ve unidades y
// motivos; el valor perdido (unidades x costo) es dato de costo: solo
// Administrador. En el modelo actual un ajuste solo puede DISMINUIR stock
// (no existen ajustes positivos), por eso todo aquí son salidas.
async function ejecutar(filtros, ctx) {
  const { desde, hasta } = filtros.rango;
  const art = filtroArticulo(filtros);

  const [porMotivo, porUsuario, detalle] = await Promise.all([
    prisma.$queryRaw`
      SELECT t.descripcion AS motivo, COUNT(*)::int AS lineas, SUM(d.cantidad)::int AS unidades,
             SUM(d.cantidad * a.precio_costo)::float8 AS valor
      FROM salida_detalle d
      JOIN salida_maestro s ON s.id_venta = d.id_salida
      JOIN tipo_salida t ON t.id_tipo_salida = d.id_tipo_salida
      JOIN articulo a ON a.sku = d.sku
      WHERE d.id_tipo_salida <> ${ID_TIPO_SALIDA_VENTA} AND s.anulada = false
        AND s.fecha_salida >= ${desde} AND s.fecha_salida < ${hasta} ${art}
      GROUP BY t.descripcion ORDER BY unidades DESC, t.descripcion`,
    prisma.$queryRaw`
      SELECT TRIM(col.nombres || ' ' || col.primer_apel) AS usuario, COUNT(*)::int AS lineas,
             SUM(d.cantidad)::int AS unidades, SUM(d.cantidad * a.precio_costo)::float8 AS valor
      FROM salida_detalle d
      JOIN salida_maestro s ON s.id_venta = d.id_salida
      JOIN colaborador col ON col.id_colaborador = s.id_colaborador
      JOIN articulo a ON a.sku = d.sku
      WHERE d.id_tipo_salida <> ${ID_TIPO_SALIDA_VENTA} AND s.anulada = false
        AND s.fecha_salida >= ${desde} AND s.fecha_salida < ${hasta} ${art}
      GROUP BY col.nombres, col.primer_apel ORDER BY unidades DESC, usuario`,
    prisma.$queryRaw`
      SELECT s.fecha_salida AS fecha, d.sku, a.nombre, t.descripcion AS motivo, d.cantidad::int AS cantidad,
             (d.cantidad * a.precio_costo)::float8 AS valor,
             TRIM(col.nombres || ' ' || col.primer_apel) AS usuario, d.id_salida AS referencia
      FROM salida_detalle d
      JOIN salida_maestro s ON s.id_venta = d.id_salida
      JOIN tipo_salida t ON t.id_tipo_salida = d.id_tipo_salida
      JOIN colaborador col ON col.id_colaborador = s.id_colaborador
      JOIN articulo a ON a.sku = d.sku
      WHERE d.id_tipo_salida <> ${ID_TIPO_SALIDA_VENTA} AND s.anulada = false
        AND s.fecha_salida >= ${desde} AND s.fecha_salida < ${hasta} ${art}
      ORDER BY s.fecha_salida DESC, d.id_detalle_salida DESC
      LIMIT ${ctx.limite}`,
  ]);

  const totalUnidades = porMotivo.reduce((acc, m) => acc + m.unidades, 0);
  const totalLineas = porMotivo.reduce((acc, m) => acc + m.lineas, 0);
  const totalValor = porMotivo.reduce((acc, m) => acc + m.valor, 0);

  const filasMotivo = porMotivo.map((m) => ({
    motivo: m.motivo,
    lineas: m.lineas,
    unidades: m.unidades,
    valor: redondear2(m.valor),
  }));
  const filasUsuario = porUsuario.map((u) => ({
    usuario: u.usuario,
    lineas: u.lineas,
    unidades: u.unidades,
    valor: redondear2(u.valor),
  }));
  const filasDetalle = detalle.map((d) => ({
    fecha: d.fecha,
    referencia: `S-${d.referencia}`,
    sku: d.sku,
    nombre: d.nombre,
    motivo: d.motivo,
    cantidad: -d.cantidad,
    valor: redondear2(d.valor),
    usuario: d.usuario,
  }));

  return {
    kpis: [
      { etiqueta: "Unidades dadas de baja", valor: totalUnidades, tipo: "entero" },
      { etiqueta: "Valor perdido (a costo)", valor: redondear2(totalValor), tipo: "moneda", sensible: true },
      { etiqueta: "Registros", valor: totalLineas, tipo: "entero" },
      { etiqueta: "Motivo principal", valor: filasMotivo[0]?.motivo ?? "—", tipo: "texto" },
    ],
    tablas: [
      {
        id: "motivos",
        titulo: "Por motivo",
        columnas: [
          { clave: "motivo", etiqueta: "Motivo", tipo: "texto", ancho: 180 },
          { clave: "lineas", etiqueta: "Registros", tipo: "entero", ancho: 70 },
          { clave: "unidades", etiqueta: "Unidades", tipo: "entero", ancho: 70 },
          { clave: "valor", etiqueta: "Valor a costo", tipo: "moneda", ancho: 90, sensible: true },
        ],
        filas: filasMotivo,
        totalFilas: filasMotivo.length,
      },
      {
        id: "usuarios",
        titulo: "Por usuario",
        columnas: [
          { clave: "usuario", etiqueta: "Usuario", tipo: "texto", ancho: 180 },
          { clave: "lineas", etiqueta: "Registros", tipo: "entero", ancho: 70 },
          { clave: "unidades", etiqueta: "Unidades", tipo: "entero", ancho: 70 },
          { clave: "valor", etiqueta: "Valor a costo", tipo: "moneda", ancho: 90, sensible: true },
        ],
        filas: filasUsuario,
        totalFilas: filasUsuario.length,
      },
      {
        id: "detalle",
        titulo: "Detalle de bajas",
        principal: true,
        columnas: [
          { clave: "fecha", etiqueta: "Fecha", tipo: "fechaHora", ancho: 82 },
          { clave: "referencia", etiqueta: "Ref.", tipo: "texto", ancho: 36 },
          { clave: "sku", etiqueta: "SKU", tipo: "texto", ancho: 58 },
          { clave: "nombre", etiqueta: "Producto", tipo: "texto", ancho: 120 },
          { clave: "motivo", etiqueta: "Motivo", tipo: "texto", ancho: 62 },
          { clave: "cantidad", etiqueta: "Cant.", tipo: "entero", signo: true, ancho: 34 },
          { clave: "valor", etiqueta: "Valor", tipo: "moneda", ancho: 56, sensible: true },
          { clave: "usuario", etiqueta: "Usuario", tipo: "texto", ancho: 76 },
        ],
        filas: filasDetalle,
        totalFilas: totalLineas,
      },
    ],
    grafica: {
      tipo: "barras",
      titulo: "Unidades dadas de baja por motivo",
      formato: "entero",
      items: filasMotivo.map((m) => ({ etiqueta: m.motivo, valor: m.unidades })),
    },
    notas: [
      "Incluye merma, uso interno, garantía y ajuste; excluye ventas y registros anulados.",
      ctx.esAdmin
        ? "Valor a costo con el precioCosto actual del catálogo. Un ajuste manual solo puede disminuir stock; las correcciones por conteo físico están en el reporte «Conteo físico»."
        : "Un ajuste manual solo puede disminuir stock; las correcciones por conteo físico están en el reporte «Conteo físico».",
    ],
    vacio: totalLineas === 0 ? "No hay mermas ni ajustes en este rango. Prueba ampliando las fechas." : null,
  };
}

module.exports = {
  id: "mermas-ajustes",
  nombreCorto: "Mermas y ajustes",
  titulo: "Mermas y ajustes",
  descripcion: "Qué se perdió o se dio de baja: mermas, usos internos, garantías y ajustes por motivo y por usuario. Ayuda a detectar diferencias de inventario.",
  icono: "sliders",
  roles: [ADMIN, OPERADOR],
  filtros: ["rango", "idCategoria", "idMarca"],
  ejecutar,
};
