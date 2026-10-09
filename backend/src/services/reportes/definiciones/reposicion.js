const prisma = require("../../../utils/prismaClient");
const {
  ADMIN,
  OPERADOR,
  ID_TIPO_SALIDA_VENTA,
  filtroArticulo,
  recortar,
  celdaEstadoStock,
} = require("../comun");
const { redondear2 } = require("../formato");
const { calcularEstadoStock, obtenerUmbralGeneral } = require("../../umbralStockService");

// Reporte 4 — Reposición sugerida. Productos activos agotados o en stock bajo
// (misma regla de umbral efectivo que Repuestos y el tablero) y cuánto
// conviene comprar según su rotación reciente.
const DIAS_COBERTURA_OBJETIVO = 30;

// Cantidad sugerida a comprar (función pura, probada aparte):
//   demanda diaria = unidades vendidas en la ventana / días de la ventana
//   objetivo = umbral + demanda diaria x 30 días     (con ventas)
//   objetivo = umbral x 2                             (sin ventas recientes)
//   sugerido = max(objetivo - existencia, 1)
// Es decir: volver a superar el mínimo y cubrir ~30 días de venta.
function calcularSugerido({ cantidad, umbral, vendido, ventana }) {
  const demandaDiaria = vendido / ventana;
  const objetivo =
    vendido > 0 ? umbral + Math.ceil(demandaDiaria * DIAS_COBERTURA_OBJETIVO) : umbral * 2;
  return Math.max(objetivo - Math.max(cantidad, 0), 1);
}

async function ejecutar(filtros, ctx) {
  const umbralGeneral = await obtenerUmbralGeneral();
  const desde = new Date((ctx.ahora ?? new Date()).getTime() - filtros.ventana * 86_400_000);
  const art = filtroArticulo(filtros);

  const filas = await prisma.$queryRaw`
    SELECT a.sku, a.nombre, c.descripcion AS categoria,
           COALESCE(i.cantidad, 0)::int AS cantidad,
           COALESCE(a.inventario_minimo, ${umbralGeneral})::int AS umbral,
           COALESCE(v.unidades, 0)::int AS vendido,
           a.precio_costo::float8 AS costo,
           p.nombre AS proveedor
    FROM articulo a
    JOIN categoria c ON c.id_categoria = a.id_categoria
    LEFT JOIN inventario i ON i.sku = a.sku
    LEFT JOIN proveedor p ON p.id_proveedor = a.id_proveedor
    LEFT JOIN (
      SELECT d.sku, SUM(d.cantidad) AS unidades
      FROM salida_detalle d
      JOIN salida_maestro s ON s.id_venta = d.id_salida
      WHERE d.id_tipo_salida = ${ID_TIPO_SALIDA_VENTA} AND s.anulada = false AND s.fecha_salida >= ${desde}
      GROUP BY d.sku
    ) v ON v.sku = a.sku
    WHERE a.estado = true
      AND COALESCE(i.cantidad, 0) <= COALESCE(a.inventario_minimo, ${umbralGeneral})
      ${art}
    ORDER BY (COALESCE(i.cantidad, 0) > 0), COALESCE(v.unidades, 0) DESC, a.sku
    LIMIT 20000`;

  const calculadas = filas.map((f) => {
    const estado = calcularEstadoStock(f.cantidad, f.umbral);
    const sugerido = calcularSugerido({ cantidad: f.cantidad, umbral: f.umbral, vendido: f.vendido, ventana: filtros.ventana });
    return {
      sku: f.sku,
      nombre: f.nombre,
      categoria: f.categoria,
      cantidad: f.cantidad,
      umbral: f.umbral,
      estadoClave: estado,
      estado: celdaEstadoStock(estado),
      vendido: f.vendido,
      sugerido,
      proveedor: f.proveedor ?? null,
      costoEstimado: redondear2(sugerido * f.costo),
    };
  });

  const agotados = calculadas.filter((f) => f.estadoClave === "agotado").length;
  const bajos = calculadas.length - agotados;
  const unidadesSugeridas = calculadas.reduce((acc, f) => acc + f.sugerido, 0);
  const inversion = calculadas.reduce((acc, f) => acc + f.costoEstimado, 0);

  const filasTabla = calculadas.slice(0, ctx.limite).map((f) => {
    const copia = { ...f };
    delete copia.estadoClave;
    return copia;
  });

  return {
    kpis: [
      { etiqueta: "Agotados", valor: agotados, tipo: "entero" },
      { etiqueta: "Con stock bajo", valor: bajos, tipo: "entero" },
      { etiqueta: "Unidades sugeridas", valor: unidadesSugeridas, tipo: "entero", nota: `cubre ~${DIAS_COBERTURA_OBJETIVO} días de venta` },
      { etiqueta: "Inversión estimada", valor: redondear2(inversion), tipo: "moneda", sensible: true, nota: "a costo actual" },
    ],
    tablas: [
      {
        id: "reposicion",
        titulo: "Productos a reponer (agotados primero)",
        principal: true,
        columnas: [
          { clave: "sku", etiqueta: "SKU", tipo: "texto", ancho: 52 },
          { clave: "nombre", etiqueta: "Producto", tipo: "texto", ancho: 112 },
          { clave: "categoria", etiqueta: "Categoría", tipo: "texto", ancho: 62 },
          { clave: "cantidad", etiqueta: "Exist.", tipo: "entero", ancho: 34 },
          { clave: "umbral", etiqueta: "Mínimo", tipo: "entero", ancho: 36 },
          { clave: "estado", etiqueta: "Estado", tipo: "estado", ancho: 56 },
          { clave: "vendido", etiqueta: `Vend. ${filtros.ventana}d`, tipo: "entero", ancho: 42 },
          { clave: "sugerido", etiqueta: "Sugerido", tipo: "entero", ancho: 46 },
          { clave: "proveedor", etiqueta: "Proveedor", tipo: "texto", ancho: 80, sensible: true },
          { clave: "costoEstimado", etiqueta: "Costo estimado", tipo: "moneda", ancho: 62, sensible: true },
        ],
        filas: filasTabla,
        totalFilas: calculadas.length,
      },
    ],
    grafica: {
      tipo: "barras",
      titulo: "Unidades sugeridas a comprar (top 10)",
      formato: "entero",
      items: [...calculadas]
        .sort((a, b) => b.sugerido - a.sugerido)
        .slice(0, 10)
        .map((f) => ({ etiqueta: recortar(f.nombre, 34), valor: f.sugerido })),
    },
    notas: [
      `Cantidad sugerida = mínimo + ventas diarias de los últimos ${filtros.ventana} días x ${DIAS_COBERTURA_OBJETIVO} días, menos la existencia (mínimo 1). Sin ventas recientes se sugiere llegar al doble del mínimo.`,
      ctx.esAdmin
        ? "El proveedor es el proveedor preferido del repuesto en el catálogo. Es una sugerencia: confirma antes de comprar."
        : "Es una sugerencia: confirma con el administrador antes de comprar.",
    ],
    vacio: calculadas.length === 0 ? "Todo el inventario activo está por encima de su mínimo. No hace falta reponer." : null,
  };
}

module.exports = {
  id: "reposicion-sugerida",
  nombreCorto: "Reposicion",
  titulo: "Reposición sugerida",
  descripcion: "Qué se está acabando y cuánto conviene comprar, según el umbral de stock y la rotación de los últimos 30, 60 o 90 días.",
  icono: "alert",
  roles: [ADMIN, OPERADOR],
  filtros: ["ventana", "idCategoria", "idMarca"],
  orientacion: "horizontal",
  calcularSugerido,
  ejecutar,
};
