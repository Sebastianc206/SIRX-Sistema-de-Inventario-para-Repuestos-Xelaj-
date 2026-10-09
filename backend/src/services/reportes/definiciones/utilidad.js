const { Prisma } = require("@prisma/client");
const prisma = require("../../../utils/prismaClient");
const { ADMIN, baseVentas, pct, recortar } = require("../comun");
const { redondear2 } = require("../formato");

// Reporte 6b — Utilidad y margen (solo Administrador: costos y márgenes).
// Utilidad = ingreso de las ventas del rango - (unidades x costo ACTUAL del
// catálogo). El sistema no guarda el costo al momento de cada venta, así que
// es una estimación; se indica en el reporte.
async function ejecutar(filtros) {
  const base = baseVentas(filtros, filtros.rango);
  const porCategoria = filtros.agruparPor === "categoria";

  const agrupado = porCategoria
    ? Prisma.sql`GROUP BY c.descripcion`
    : Prisma.sql`GROUP BY d.sku, a.nombre`;
  const seleccion = porCategoria
    ? Prisma.sql`c.descripcion AS nombre, NULL::text AS sku`
    : Prisma.sql`a.nombre AS nombre, d.sku AS sku`;

  const [filas, [totales]] = await Promise.all([
    prisma.$queryRaw`
      SELECT ${seleccion},
             SUM(d.cantidad)::int AS unidades,
             SUM(d.cantidad * COALESCE(d.precio_venta, 0))::float8 AS ingreso,
             SUM(d.cantidad * a.precio_costo)::float8 AS costo
      ${base}
      ${agrupado}
      ORDER BY (SUM(d.cantidad * COALESCE(d.precio_venta, 0)) - SUM(d.cantidad * a.precio_costo)) DESC, nombre
      LIMIT ${filtros.top}`,
    prisma.$queryRaw`
      SELECT COALESCE(SUM(d.cantidad), 0)::int AS unidades,
             COALESCE(SUM(d.cantidad * COALESCE(d.precio_venta, 0)), 0)::float8 AS ingreso,
             COALESCE(SUM(d.cantidad * a.precio_costo), 0)::float8 AS costo
      ${base}`,
  ]);

  const ingreso = totales?.ingreso ?? 0;
  const costo = totales?.costo ?? 0;
  const utilidad = ingreso - costo;

  const filasTabla = filas.map((f) => ({
    sku: f.sku,
    nombre: f.nombre,
    unidades: f.unidades,
    ingreso: redondear2(f.ingreso),
    costo: redondear2(f.costo),
    utilidad: redondear2(f.ingreso - f.costo),
    margen: pct(f.ingreso - f.costo, f.ingreso),
  }));

  const columnas = [
    ...(porCategoria ? [] : [{ clave: "sku", etiqueta: "SKU", tipo: "texto", ancho: 62 }]),
    { clave: "nombre", etiqueta: porCategoria ? "Categoría" : "Producto", tipo: "texto", ancho: porCategoria ? 150 : 128 },
    { clave: "unidades", etiqueta: "Unidades", tipo: "entero", ancho: 50 },
    { clave: "ingreso", etiqueta: "Ingreso", tipo: "moneda", ancho: 72 },
    { clave: "costo", etiqueta: "Costo estimado", tipo: "moneda", ancho: 72 },
    { clave: "utilidad", etiqueta: "Utilidad", tipo: "moneda", ancho: 72 },
    { clave: "margen", etiqueta: "Margen", tipo: "porcentaje", ancho: 46 },
  ].map((c) => ({ ...c, sensible: true }));

  return {
    kpis: [
      { etiqueta: "Ingreso por ventas", valor: redondear2(ingreso), tipo: "moneda", sensible: true },
      { etiqueta: "Costo estimado", valor: redondear2(costo), tipo: "moneda", sensible: true },
      { etiqueta: "Utilidad bruta", valor: redondear2(utilidad), tipo: "moneda", sensible: true },
      { etiqueta: "Margen bruto", valor: pct(utilidad, ingreso), tipo: "porcentaje", sensible: true },
    ],
    tablas: [
      {
        id: "utilidad",
        titulo: porCategoria ? "Utilidad por categoría" : `Utilidad por producto (top ${filtros.top})`,
        principal: true,
        columnas,
        filas: filasTabla,
        totalFilas: filasTabla.length,
      },
    ],
    grafica: {
      tipo: "barras",
      titulo: "Utilidad estimada (mayor a menor)",
      formato: "moneda",
      sensible: true,
      items: filasTabla.slice(0, 10).map((f) => ({ etiqueta: recortar(f.nombre, 34), valor: f.utilidad })),
    },
    notas: [
      "Costo estimado con el costo actual del catálogo (precioCosto vigente): el sistema no guarda el costo al momento de cada venta.",
      "Utilidad bruta: no descuenta gastos operativos, impuestos ni descuentos ajenos al sistema.",
    ],
    vacio: (totales?.unidades ?? 0) === 0 ? "No hay ventas en este rango. Prueba ampliando las fechas." : null,
  };
}

module.exports = {
  id: "utilidad-margen",
  nombreCorto: "Utilidad",
  titulo: "Utilidad y margen",
  descripcion: "Cuánto se gana: utilidad y margen por producto o por categoría en un rango de fechas, con costo estimado.",
  icono: "trendUp",
  roles: [ADMIN],
  filtros: ["rango", "agruparPor", "top", "idCategoria", "idMarca"],
  ejecutar,
};
