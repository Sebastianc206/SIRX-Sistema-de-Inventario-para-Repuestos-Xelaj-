const { Prisma } = require("@prisma/client");
const prisma = require("../../../utils/prismaClient");
const { ReporteError } = require("../errores");
const { ADMIN, OPERADOR, baseVentas, pct, recortar } = require("../comun");
const { redondear2 } = require("../formato");

// Reporte 1 — Productos más vendidos. Ranking por unidades (o ingreso, solo
// Administrador) en un rango de fechas. El ingreso es dato financiero:
// el Operador recibe unidades y % de unidades, nunca importes.
async function ejecutar(filtros, ctx) {
  if (filtros.orden === "ingreso" && !ctx.esAdmin) {
    throw new ReporteError("Ordenar por ingreso no está disponible para tu rol", 403);
  }
  const base = baseVentas(filtros, filtros.rango);
  const orden = filtros.orden === "ingreso" ? Prisma.sql`ingreso DESC, unidades DESC` : Prisma.sql`unidades DESC, ingreso DESC`;

  const [filas, [totales]] = await Promise.all([
    prisma.$queryRaw`
      SELECT d.sku, a.nombre, c.descripcion AS categoria, m.nombre AS marca,
             SUM(d.cantidad)::int AS unidades,
             SUM(d.cantidad * COALESCE(d.precio_venta, 0))::float8 AS ingreso,
             COUNT(DISTINCT d.id_salida)::int AS ventas
      ${base}
      GROUP BY d.sku, a.nombre, c.descripcion, m.nombre
      ORDER BY ${orden}, d.sku
      LIMIT ${filtros.top}`,
    prisma.$queryRaw`
      SELECT COALESCE(SUM(d.cantidad), 0)::int AS unidades,
             COALESCE(SUM(d.cantidad * COALESCE(d.precio_venta, 0)), 0)::float8 AS ingreso,
             COUNT(DISTINCT d.sku)::int AS productos,
             COUNT(DISTINCT d.id_salida)::int AS ventas
      ${base}`,
  ]);

  const totalUnidades = totales?.unidades ?? 0;
  const totalIngreso = totales?.ingreso ?? 0;
  const enTop = filas.reduce((acc, f) => acc + f.unidades, 0);

  const filasTabla = filas.map((f, i) => ({
    posicion: i + 1,
    sku: f.sku,
    nombre: f.nombre,
    categoria: f.categoria,
    unidades: f.unidades,
    pctUnidades: pct(f.unidades, totalUnidades),
    ingreso: redondear2(f.ingreso),
    pctIngreso: pct(f.ingreso, totalIngreso),
    ventas: f.ventas,
  }));

  return {
    kpis: [
      { etiqueta: "Unidades vendidas", valor: totalUnidades, tipo: "entero" },
      { etiqueta: "Ingreso por ventas", valor: redondear2(totalIngreso), tipo: "moneda", sensible: true },
      { etiqueta: "Productos distintos", valor: totales?.productos ?? 0, tipo: "entero" },
      { etiqueta: "Ventas (tickets)", valor: totales?.ventas ?? 0, tipo: "entero" },
      {
        etiqueta: `Peso del top ${filtros.top}`,
        valor: pct(enTop, totalUnidades),
        tipo: "porcentaje",
        nota: "de las unidades vendidas",
      },
    ],
    tablas: [
      {
        id: "ranking",
        titulo: "Ranking de productos",
        principal: true,
        columnas: [
          { clave: "posicion", etiqueta: "#", tipo: "entero", ancho: 22 },
          { clave: "sku", etiqueta: "SKU", tipo: "texto", ancho: 58 },
          { clave: "nombre", etiqueta: "Producto", tipo: "texto", ancho: 140 },
          { clave: "categoria", etiqueta: "Categoría", tipo: "texto", ancho: 72 },
          { clave: "unidades", etiqueta: "Unidades", tipo: "entero", ancho: 48 },
          { clave: "pctUnidades", etiqueta: "% unid.", tipo: "porcentaje", ancho: 44 },
          { clave: "ingreso", etiqueta: "Ingreso", tipo: "moneda", ancho: 64, sensible: true },
          { clave: "pctIngreso", etiqueta: "% ingreso", tipo: "porcentaje", ancho: 48, sensible: true },
        ],
        filas: filasTabla,
        totalFilas: filasTabla.length,
      },
    ],
    grafica: {
      tipo: "barras",
      titulo: "Unidades vendidas por producto (top 10)",
      formato: "entero",
      items: filasTabla.slice(0, 10).map((f) => ({ etiqueta: recortar(f.nombre, 34), valor: f.unidades })),
    },
    notas: [
      "Solo cuenta ventas de mostrador no anuladas. Mermas, usos internos y garantías no se consideran ventas.",
    ],
    vacio: totalUnidades === 0 ? "No hay ventas en este rango. Prueba ampliando las fechas." : null,
  };
}

module.exports = {
  id: "mas-vendidos",
  nombreCorto: "Mas vendidos",
  titulo: "Productos más vendidos",
  descripcion: "Qué repuestos rotan más: ranking por unidades vendidas, con su peso en el total. Úsalo para decidir qué comprar primero.",
  icono: "trendUp",
  roles: [ADMIN, OPERADOR],
  filtros: ["rango", "idCategoria", "idMarca", "top", "orden"],
  ejecutar,
};
