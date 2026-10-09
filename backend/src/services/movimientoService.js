const prisma = require("../utils/prismaClient");
const { construirRangoFecha } = require("../utils/rangoFechas");

const ID_TIPO_SALIDA_VENTA = 1;
const ID_TIPO_SALIDA_MERMA = 2;
const PAGINA_POR_DEFECTO = 1;
const POR_PAGINA_POR_DEFECTO = 15;
const POR_PAGINA_MAXIMO = 100;
const MAX_SKUS_COMPARACION = 10;

class MovimientoError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

// HU-10: historial de movimientos — TODO lo que le pasó al stock, sin
// importar la causa (compra, venta, merma, ajuste...) ni el producto. Antes
// esta consulta pedía UN sku primero; se rediseñó a un panel de filtros
// (categoría, marca, productos, rango de fechas) que por defecto trae TODOS
// los productos del mes en curso — el frontend decide los defaults, este
// servicio solo filtra lo que recibe.
//
// `categoria` clasifica cada movimiento para el filtro de la UI
// (Todos/Compras/Ventas/Mermas/Ajustes): "ajuste" agrupa Uso interno y
// Garantía junto con Ajuste — el catálogo tipo_salida los distingue más
// fino, pero la UI no necesita esa granularidad.
// precioCompra/proveedor son datos de costo (igual que en Articulo/Compra):
// se ocultan a Operador. precioVenta no es sensible (ya es visible en el
// catálogo para ambos roles).
// `id` y `anulada` exponen el registro real detrás del movimiento (el
// idCompra/idVenta de CompraMaestro/SalidaMaestro, no el detalle) — el
// frontend los necesita para armar el botón "Anular" (qué endpoint llamar)
// y el texto de "Detalle" cuando ya está anulado, sin adivinar nada.
// `sku`/`nombreProducto` identifican a qué producto pertenece la fila — antes
// no hacía falta porque el historial era de un solo producto a la vez.
function formatearMovimiento(entrada, { ocultarDatosSensibles }) {
  // Ajuste aplicado por un conteo físico (conteo_detalle): positivo = entrada,
  // negativo = salida. No es una compra ni una salida, así que no se puede
  // anular desde aquí (`anulable: false`); se conserva como auditoría.
  if (entrada.tipo === "conteo") {
    return {
      tipo: entrada.ajuste > 0 ? "entrada" : "salida",
      categoria: "ajuste",
      id: entrada.idConteo,
      anulada: false,
      anulable: false,
      sku: entrada.sku,
      nombreProducto: entrada.articulo?.nombre,
      fecha: entrada.conteo?.fechaCierre ?? entrada.fecContado,
      cantidad: Math.abs(entrada.ajuste),
      motivo: "Conteo físico",
      referencia: `Conteo #${entrada.idConteo}`,
      cantidadAntes: entrada.cantidadAntes,
      cantidadDespues: entrada.cantidadDespues,
    };
  }

  if (entrada.tipo === "entrada") {
    const base = {
      tipo: "entrada",
      categoria: "compra",
      id: entrada.idCompra,
      anulada: entrada.compraMaestro?.anulada ?? false,
      sku: entrada.sku,
      nombreProducto: entrada.articulo?.nombre,
      fecha: entrada.fecCompra,
      cantidad: entrada.cantidad,
      referencia: `Compra #${entrada.idCompra}`,
    };
    if (ocultarDatosSensibles) return base;
    return {
      ...base,
      precioCompra: entrada.precioCompra,
      proveedor: entrada.compraMaestro?.proveedor?.nombre ?? null,
    };
  }

  const idTipoSalida = entrada.tipoSalida?.idTipoSalida;
  const categoria =
    idTipoSalida === ID_TIPO_SALIDA_VENTA
      ? "venta"
      : idTipoSalida === ID_TIPO_SALIDA_MERMA
        ? "merma"
        : "ajuste";

  const base = {
    tipo: "salida",
    categoria,
    id: entrada.idSalida,
    anulada: entrada.salidaMaestro?.anulada ?? false,
    sku: entrada.sku,
    nombreProducto: entrada.articulo?.nombre,
    fecha: entrada.fecCompra,
    cantidad: entrada.cantidad,
    motivo: entrada.tipoSalida?.descripcion ?? null,
    referencia: `${categoria === "venta" ? "Venta" : "Salida"} #${entrada.idSalida}`,
  };
  if (categoria === "venta" && entrada.precioVenta !== null && entrada.precioVenta !== undefined) {
    return { ...base, precioVenta: entrada.precioVenta };
  }
  return base;
}

// HU-10: historial de movimientos (compras + salidas de todos los tipos),
// filtrado por producto(s)/categoría/marca/rango de fechas y paginado — ya
// puede traer movimientos de muchos productos a la vez, no solo de uno.
// compraDetalle y salidaDetalle son dos tablas distintas (no hay UNION en
// Prisma), así que se traen ambas con el mismo filtro, se combinan en
// memoria y se pagina el resultado ya ordenado — a la escala de este
// proyecto (catálogo + historial acotado por fecha) es aceptable.
async function listarMovimientos({
  skus,
  idCategoria,
  idMarca,
  fechaDesde,
  fechaHasta,
  pagina,
  porPagina,
  ocultarDatosSensibles,
}) {
  const paginaActual = Number.isInteger(pagina) && pagina > 0 ? pagina : PAGINA_POR_DEFECTO;
  const tamanoPagina =
    Number.isInteger(porPagina) && porPagina > 0
      ? Math.min(porPagina, POR_PAGINA_MAXIMO)
      : POR_PAGINA_POR_DEFECTO;

  const fecCompra = construirRangoFecha(fechaDesde, fechaHasta, MovimientoError);

  const whereArticulo = {};
  if (Array.isArray(skus) && skus.length > 0) whereArticulo.sku = { in: skus };
  if (Number.isInteger(idCategoria)) whereArticulo.idCategoria = idCategoria;
  if (Number.isInteger(idMarca)) whereArticulo.idMarca = idMarca;
  const tieneFiltroArticulo = Object.keys(whereArticulo).length > 0;

  const whereComun = {
    ...(fecCompra ? { fecCompra } : {}),
    ...(tieneFiltroArticulo ? { articulo: whereArticulo } : {}),
  };

  // Ajustes de conteos físicos aplicados (filtra por la fecha de cierre).
  const whereConteo = {
    ajuste: { not: 0 },
    conteo: { estado: "aplicado", ...(fecCompra ? { fechaCierre: fecCompra } : {}) },
    ...(tieneFiltroArticulo ? { articulo: whereArticulo } : {}),
  };

  const [compras, salidas, conteos] = await Promise.all([
    prisma.compraDetalle.findMany({
      where: whereComun,
      include: { compraMaestro: { include: { proveedor: true } }, articulo: true },
      orderBy: { fecCompra: "desc" },
    }),
    prisma.salidaDetalle.findMany({
      where: whereComun,
      include: { tipoSalida: true, salidaMaestro: true, articulo: true },
      orderBy: { fecCompra: "desc" },
    }),
    prisma.conteoDetalle.findMany({
      where: whereConteo,
      include: { conteo: true, articulo: true },
    }),
  ]);

  const movimientos = [
    ...compras.map((c) => formatearMovimiento({ ...c, tipo: "entrada" }, { ocultarDatosSensibles })),
    ...salidas.map((s) => formatearMovimiento({ ...s, tipo: "salida" }, { ocultarDatosSensibles })),
    ...conteos
      .filter((c) => c.ajuste !== null && c.ajuste !== 0)
      .map((c) => formatearMovimiento({ ...c, tipo: "conteo" }, { ocultarDatosSensibles })),
  ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  const total = movimientos.length;
  const inicio = (paginaActual - 1) * tamanoPagina;

  return {
    movimientos: movimientos.slice(inicio, inicio + tamanoPagina),
    paginacion: {
      pagina: paginaActual,
      porPagina: tamanoPagina,
      total,
      totalPaginas: Math.max(1, Math.ceil(total / tamanoPagina)),
    },
  };
}

// Comparación de ventas entre productos: a diferencia de listarMovimientos
// (que incluye compras/ajustes/mermas), acá se filtra exactamente lo
// contrario — SOLO líneas con idTipoSalida = Venta, agregando cantidad
// vendida por SKU y por día. Es una consulta separada; no reemplaza el
// historial general. El orden de `series` en la respuesta sigue el orden de
// `skus` recibido (el frontend lo arma en orden de selección, no de
// catálogo) — el color de cada serie se asigna por esa posición.
async function obtenerComparacionVentas(skus, { fechaDesde, fechaHasta } = {}) {
  if (!Array.isArray(skus) || skus.length === 0) {
    throw new MovimientoError("Debes indicar al menos un sku", 400);
  }

  const skusLimpios = [...new Set(skus.map((s) => String(s).trim()).filter(Boolean))];
  if (skusLimpios.length === 0) {
    throw new MovimientoError("Debes indicar al menos un sku", 400);
  }
  if (skusLimpios.length > MAX_SKUS_COMPARACION) {
    throw new MovimientoError(`Puedes comparar hasta ${MAX_SKUS_COMPARACION} repuestos a la vez`, 400);
  }

  const articulos = await prisma.articulo.findMany({ where: { sku: { in: skusLimpios } } });
  if (articulos.length !== skusLimpios.length) {
    throw new MovimientoError("Uno o más repuestos indicados no existen", 400);
  }
  const nombrePorSku = new Map(articulos.map((a) => [a.sku, a.nombre]));

  const fechaSalida = construirRangoFecha(fechaDesde, fechaHasta, MovimientoError);

  const detalles = await prisma.salidaDetalle.findMany({
    where: {
      sku: { in: skusLimpios },
      idTipoSalida: ID_TIPO_SALIDA_VENTA,
      salidaMaestro: { anulada: false, ...(fechaSalida ? { fechaSalida } : {}) },
    },
    include: { salidaMaestro: true },
  });

  const puntosPorSku = new Map(skusLimpios.map((sku) => [sku, new Map()]));
  for (const detalle of detalles) {
    const fecha = detalle.salidaMaestro.fechaSalida.toISOString().slice(0, 10);
    const mapaFechas = puntosPorSku.get(detalle.sku);
    mapaFechas.set(fecha, (mapaFechas.get(fecha) ?? 0) + detalle.cantidad);
  }

  const series = skusLimpios.map((sku) => {
    const puntos = [...puntosPorSku.get(sku).entries()]
      .map(([fecha, cantidad]) => ({ fecha, cantidad }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    const total = puntos.reduce((acumulado, p) => acumulado + p.cantidad, 0);

    return { sku, nombre: nombrePorSku.get(sku), puntos, total };
  });

  return { series };
}

module.exports = { MovimientoError, listarMovimientos, obtenerComparacionVentas };
