const prisma = require("../../../utils/prismaClient");
const { ADMIN, ID_TIPO_SALIDA_VENTA, filtroArticulo, pct, recortar } = require("../comun");
const { redondear2 } = require("../formato");

// Reporte 5 — Rotación y stock muerto (solo Administrador: capital
// inmovilizado = existencia x costo). Mide, para cada producto activo con
// existencia, cuánto vendió en la ventana elegida y para cuántos días le
// alcanza el stock al ritmo actual (días de cobertura).
const COBERTURA_LENTA_DIAS = 180;

// Clasificación (función pura, probada aparte).
function clasificarRotacion({ vendido, cobertura }) {
  if (vendido === 0) return "sin_rotacion";
  if (cobertura !== null && cobertura > COBERTURA_LENTA_DIAS) return "lenta";
  return "saludable";
}

const CELDAS = {
  sin_rotacion: { texto: "Sin rotación", tono: "bad" },
  lenta: { texto: "Rotación lenta", tono: "warn" },
  saludable: { texto: "Saludable", tono: "ok" },
};

async function ejecutar(filtros, ctx) {
  const desde = new Date((ctx.ahora ?? new Date()).getTime() - filtros.ventana * 86_400_000);
  const art = filtroArticulo(filtros);

  const filas = await prisma.$queryRaw`
    SELECT a.sku, a.nombre, c.descripcion AS categoria, i.cantidad::int AS cantidad,
           a.precio_costo::float8 AS costo,
           COALESCE(v.unidades, 0)::int AS vendido,
           u.ultima AS ultima_venta
    FROM articulo a
    JOIN categoria c ON c.id_categoria = a.id_categoria
    JOIN inventario i ON i.sku = a.sku AND i.cantidad > 0
    LEFT JOIN (
      SELECT d.sku, SUM(d.cantidad) AS unidades
      FROM salida_detalle d
      JOIN salida_maestro s ON s.id_venta = d.id_salida
      WHERE d.id_tipo_salida = ${ID_TIPO_SALIDA_VENTA} AND s.anulada = false AND s.fecha_salida >= ${desde}
      GROUP BY d.sku
    ) v ON v.sku = a.sku
    LEFT JOIN (
      SELECT d.sku, MAX(s.fecha_salida) AS ultima
      FROM salida_detalle d
      JOIN salida_maestro s ON s.id_venta = d.id_salida
      WHERE d.id_tipo_salida = ${ID_TIPO_SALIDA_VENTA} AND s.anulada = false
      GROUP BY d.sku
    ) u ON u.sku = a.sku
    WHERE a.estado = true ${art}
    LIMIT 20000`;

  const calculadas = filas.map((f) => {
    const demandaDiaria = f.vendido / filtros.ventana;
    const cobertura = f.vendido > 0 ? Math.round(f.cantidad / demandaDiaria) : null;
    const clave = clasificarRotacion({ vendido: f.vendido, cobertura });
    return {
      clave,
      sku: f.sku,
      nombre: f.nombre,
      categoria: f.categoria,
      cantidad: f.cantidad,
      vendido: f.vendido,
      cobertura,
      ultimaVenta: f.ultima_venta,
      capital: redondear2(f.cantidad * f.costo),
      estado: CELDAS[clave],
    };
  });

  const valorTotal = calculadas.reduce((acc, f) => acc + f.capital, 0);
  const muertos = calculadas.filter((f) => f.clave === "sin_rotacion");
  const lentos = calculadas.filter((f) => f.clave === "lenta");
  const capitalMuerto = muertos.reduce((acc, f) => acc + f.capital, 0);

  // Peor primero: sin rotación por capital, luego lentos por cobertura.
  const orden = { sin_rotacion: 0, lenta: 1, saludable: 2 };
  calculadas.sort(
    (a, b) =>
      orden[a.clave] - orden[b.clave] ||
      (a.clave === "lenta" ? (b.cobertura ?? 0) - (a.cobertura ?? 0) : b.capital - a.capital) ||
      a.sku.localeCompare(b.sku),
  );

  const porCategoria = new Map();
  for (const f of muertos) porCategoria.set(f.categoria, (porCategoria.get(f.categoria) ?? 0) + f.capital);
  const itemsGrafica = [...porCategoria.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([categoria, valor]) => ({ etiqueta: recortar(categoria, 34), valor: redondear2(valor) }));

  const filasTabla = calculadas.slice(0, ctx.limite).map((f) => ({
    sku: f.sku,
    nombre: f.nombre,
    categoria: f.categoria,
    cantidad: f.cantidad,
    vendido: f.vendido,
    cobertura: f.cobertura,
    ultimaVenta: f.ultimaVenta,
    capital: f.capital,
    estado: f.estado,
  }));

  return {
    kpis: [
      { etiqueta: "Productos con existencia", valor: calculadas.length, tipo: "entero" },
      { etiqueta: `Sin ventas en ${filtros.ventana} días`, valor: muertos.length, tipo: "entero", nota: `${lentos.length} con rotación lenta` },
      { etiqueta: "Capital inmovilizado", valor: redondear2(capitalMuerto), tipo: "moneda", sensible: true, nota: "a costo, productos sin ventas" },
      { etiqueta: "% del inventario valorizado", valor: pct(capitalMuerto, valorTotal), tipo: "porcentaje", sensible: true },
    ],
    tablas: [
      {
        id: "rotacion",
        titulo: "Rotación por producto (peor primero)",
        principal: true,
        columnas: [
          { clave: "sku", etiqueta: "SKU", tipo: "texto", ancho: 54 },
          { clave: "nombre", etiqueta: "Producto", tipo: "texto", ancho: 124 },
          { clave: "categoria", etiqueta: "Categoría", tipo: "texto", ancho: 66 },
          { clave: "cantidad", etiqueta: "Exist.", tipo: "entero", ancho: 36 },
          { clave: "vendido", etiqueta: `Vend. ${filtros.ventana}d`, tipo: "entero", ancho: 42 },
          { clave: "cobertura", etiqueta: "Días cobertura", tipo: "entero", ancho: 50 },
          { clave: "ultimaVenta", etiqueta: "Última venta", tipo: "fecha", ancho: 56 },
          { clave: "capital", etiqueta: "Capital (costo)", tipo: "moneda", ancho: 66, sensible: true },
          { clave: "estado", etiqueta: "Rotación", tipo: "estado", ancho: 66 },
        ],
        filas: filasTabla,
        totalFilas: calculadas.length,
      },
    ],
    grafica: {
      tipo: "barras",
      titulo: "Capital inmovilizado por categoría",
      formato: "moneda",
      sensible: true,
      items: itemsGrafica,
    },
    notas: [
      `Días de cobertura = existencia / ventas diarias de los últimos ${filtros.ventana} días. "Rotación lenta" = más de ${COBERTURA_LENTA_DIAS} días de cobertura.`,
      "Capital inmovilizado = existencia x costo actual de productos sin ninguna venta en la ventana elegida. \"Última venta\" considera todo el historial.",
    ],
    vacio: calculadas.length === 0 ? "No hay productos activos con existencia." : null,
  };
}

module.exports = {
  id: "rotacion-stock-muerto",
  nombreCorto: "Rotacion",
  titulo: "Rotación y stock muerto",
  descripcion: "Qué dinero está parado: productos sin ventas en 30, 60 o 90 días, días de cobertura y capital inmovilizado.",
  icono: "refresh",
  roles: [ADMIN],
  filtros: ["ventana", "idCategoria", "idMarca"],
  orientacion: "horizontal",
  clasificarRotacion,
  ejecutar,
};
