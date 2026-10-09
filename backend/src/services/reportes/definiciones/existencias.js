const prisma = require("../../../utils/prismaClient");
const { ADMIN, filtroArticulo, pct, recortar, celdaEstadoStock } = require("../comun");
const { redondear2 } = require("../formato");
const { calcularEstadoStock, obtenerUmbralGeneral } = require("../../umbralStockService");

// Reporte 2 — Existencias valorizadas (solo Administrador: usa precioCosto).
// Foto del inventario ACTIVO al momento de generar el reporte: unidades x
// costo, unidades x precio de venta y margen potencial, por categoría y por
// producto. No usa rango de fechas.
async function ejecutar(filtros, ctx) {
  const umbralGeneral = await obtenerUmbralGeneral();
  const art = filtroArticulo(filtros);

  const [categorias, detalle] = await Promise.all([
    prisma.$queryRaw`
      SELECT c.descripcion AS categoria,
             COUNT(*)::int AS skus,
             COALESCE(SUM(COALESCE(i.cantidad, 0)), 0)::int AS unidades,
             COALESCE(SUM(COALESCE(i.cantidad, 0) * a.precio_costo), 0)::float8 AS valor_costo,
             COALESCE(SUM(COALESCE(i.cantidad, 0) * a.precio_venta), 0)::float8 AS valor_venta
      FROM articulo a
      JOIN categoria c ON c.id_categoria = a.id_categoria
      LEFT JOIN inventario i ON i.sku = a.sku
      WHERE a.estado = true ${art}
      GROUP BY c.descripcion
      ORDER BY valor_costo DESC, c.descripcion`,
    prisma.$queryRaw`
      SELECT a.sku, a.nombre, c.descripcion AS categoria,
             COALESCE(i.cantidad, 0)::int AS cantidad,
             a.inventario_minimo AS minimo_propio,
             a.precio_costo::float8 AS costo,
             a.precio_venta::float8 AS venta,
             (COALESCE(i.cantidad, 0) * a.precio_costo)::float8 AS valor_costo,
             (COALESCE(i.cantidad, 0) * a.precio_venta)::float8 AS valor_venta
      FROM articulo a
      JOIN categoria c ON c.id_categoria = a.id_categoria
      LEFT JOIN inventario i ON i.sku = a.sku
      WHERE a.estado = true ${art}
      ORDER BY valor_costo DESC, a.sku
      LIMIT ${ctx.limite}`,
  ]);

  const total = categorias.reduce(
    (acc, c) => ({
      skus: acc.skus + c.skus,
      unidades: acc.unidades + c.unidades,
      valorCosto: acc.valorCosto + c.valor_costo,
      valorVenta: acc.valorVenta + c.valor_venta,
    }),
    { skus: 0, unidades: 0, valorCosto: 0, valorVenta: 0 },
  );
  const margenPotencial = total.valorVenta - total.valorCosto;

  const filasCategoria = categorias.map((c) => ({
    categoria: c.categoria,
    skus: c.skus,
    unidades: c.unidades,
    valorCosto: redondear2(c.valor_costo),
    pctInventario: pct(c.valor_costo, total.valorCosto),
    valorVenta: redondear2(c.valor_venta),
    margen: redondear2(c.valor_venta - c.valor_costo),
  }));

  const filasDetalle = detalle.map((d) => {
    const umbral = d.minimo_propio ?? umbralGeneral;
    return {
      sku: d.sku,
      nombre: d.nombre,
      categoria: d.categoria,
      cantidad: d.cantidad,
      estado: celdaEstadoStock(calcularEstadoStock(d.cantidad, umbral)),
      costo: redondear2(d.costo),
      valorCosto: redondear2(d.valor_costo),
      valorVenta: redondear2(d.valor_venta),
      margen: redondear2(d.valor_venta - d.valor_costo),
    };
  });

  return {
    kpis: [
      { etiqueta: "Valor a costo", valor: redondear2(total.valorCosto), tipo: "moneda", sensible: true },
      { etiqueta: "Valor a precio de venta", valor: redondear2(total.valorVenta), tipo: "moneda", sensible: true },
      {
        etiqueta: "Margen potencial",
        valor: redondear2(margenPotencial),
        tipo: "moneda",
        nota: `${pct(margenPotencial, total.valorVenta).toFixed(1)}% sobre la venta`,
        sensible: true,
      },
      { etiqueta: "Unidades en existencia", valor: total.unidades, tipo: "entero", nota: `${total.skus} SKUs activos` },
    ],
    tablas: [
      {
        id: "categorias",
        titulo: "Resumen por categoría",
        columnas: [
          { clave: "categoria", etiqueta: "Categoría", tipo: "texto", ancho: 120 },
          { clave: "skus", etiqueta: "SKUs", tipo: "entero", ancho: 36 },
          { clave: "unidades", etiqueta: "Unidades", tipo: "entero", ancho: 52 },
          { clave: "valorCosto", etiqueta: "Valor a costo", tipo: "moneda", ancho: 76 },
          { clave: "pctInventario", etiqueta: "% del total", tipo: "porcentaje", ancho: 50 },
          { clave: "valorVenta", etiqueta: "Valor a venta", tipo: "moneda", ancho: 76 },
          { clave: "margen", etiqueta: "Margen potencial", tipo: "moneda", ancho: 76 },
        ],
        filas: filasCategoria,
        totalFilas: filasCategoria.length,
        totales: {
          categoria: "Total",
          skus: total.skus,
          unidades: total.unidades,
          valorCosto: redondear2(total.valorCosto),
          pctInventario: total.valorCosto > 0 ? 100 : 0,
          valorVenta: redondear2(total.valorVenta),
          margen: redondear2(margenPotencial),
        },
      },
      {
        id: "productos",
        titulo: "Detalle por producto (mayor valor primero)",
        principal: true,
        columnas: [
          { clave: "sku", etiqueta: "SKU", tipo: "texto", ancho: 56 },
          { clave: "nombre", etiqueta: "Producto", tipo: "texto", ancho: 128 },
          { clave: "categoria", etiqueta: "Categoría", tipo: "texto", ancho: 62 },
          { clave: "cantidad", etiqueta: "Exist.", tipo: "entero", ancho: 34 },
          { clave: "estado", etiqueta: "Estado", tipo: "estado", ancho: 56 },
          { clave: "costo", etiqueta: "Costo unit.", tipo: "moneda", ancho: 54 },
          { clave: "valorCosto", etiqueta: "Valor costo", tipo: "moneda", ancho: 64 },
          { clave: "valorVenta", etiqueta: "Valor venta", tipo: "moneda", ancho: 64 },
          { clave: "margen", etiqueta: "Margen", tipo: "moneda", ancho: 56 },
        ],
        filas: filasDetalle,
        totalFilas: total.skus,
      },
    ],
    grafica: {
      tipo: "barras",
      titulo: "Valor del inventario a costo por categoría",
      formato: "moneda",
      items: filasCategoria.slice(0, 10).map((c) => ({ etiqueta: recortar(c.categoria, 34), valor: c.valorCosto })),
    },
    notas: [
      "Valorización al costo actual del catálogo (precioCosto vigente), no al costo histórico de cada compra.",
      "Solo incluye repuestos activos. La existencia es el stock registrado en el sistema, no un conteo físico.",
    ],
    vacio: total.skus === 0 ? "No hay repuestos activos con esos filtros." : null,
  };
}

module.exports = {
  id: "existencias-valorizadas",
  nombreCorto: "Existencias",
  titulo: "Existencias valorizadas",
  descripcion: "Cuánto dinero hay en inventario: stock por costo y por precio de venta, por categoría, con el margen potencial.",
  icono: "box",
  roles: [ADMIN],
  filtros: ["idCategoria", "idMarca"],
  ejecutar,
};
