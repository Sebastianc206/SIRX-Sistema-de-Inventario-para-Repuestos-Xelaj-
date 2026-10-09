const prisma = require("../utils/prismaClient");
const { esEnteroNoNegativo } = require("../utils/validadores");

// Umbral de "stock bajo" configurable por el Administrador.
//
// Regla efectiva (ÚNICO lugar donde vive): el umbral de un producto es su
// `inventarioMinimo` propio si está definido (no null); si no, el umbral
// general guardado en `Configuracion` (clave `umbral_stock_bajo`). El
// estado se deriva de ahí (CONTEXTO_SIRX.md §8):
//   cantidad <= 0            -> "agotado"
//   cantidad <= umbral       -> "bajo"
//   en otro caso             -> "en_stock"
// Listado de repuestos, dashboard/alertas e impacto reutilizan estas
// funciones; nada más en el backend vuelve a comparar contra el mínimo.

const CLAVE_UMBRAL_GENERAL = "umbral_stock_bajo";
const UMBRAL_GENERAL_POR_DEFECTO = 5;
const UMBRAL_MAXIMO = 10000;
const MAX_SKUS_MASIVO = 1000;

class UmbralStockError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Solo enteros reales (number) en [0, UMBRAL_MAXIMO]: se rechaza texto, NaN,
// decimales y negativos — a diferencia de los formularios del catálogo no
// se aceptan strings numéricos para esta configuración.
function esUmbralValido(valor) {
  return typeof valor === "number" && Number.isInteger(valor) && valor >= 0 && valor <= UMBRAL_MAXIMO;
}

// Para el mínimo propio de un producto: null/""/undefined = "usar el
// general" (devuelve null); si viene un valor debe ser entero válido (se
// aceptan strings numéricos porque llega de formularios y del Excel).
function normalizarUmbralPropio(valor) {
  if (valor === undefined || valor === null) return null;
  if (typeof valor === "string" && valor.trim() === "") return null;
  if (!esEnteroNoNegativo(valor) || Number(valor) > UMBRAL_MAXIMO) {
    throw new UmbralStockError(
      `inventarioMinimo debe ser un entero entre 0 y ${UMBRAL_MAXIMO} (o vacío para usar el umbral general)`,
      400,
    );
  }
  return Number(valor);
}

function umbralEfectivo(inventarioMinimoPropio, umbralGeneral) {
  return inventarioMinimoPropio ?? umbralGeneral;
}

function calcularEstadoStock(cantidad, umbral) {
  if (cantidad <= 0) return "agotado";
  if (cantidad <= umbral) return "bajo";
  return "en_stock";
}

async function obtenerUmbralGeneral(cliente = prisma) {
  const fila = await cliente.configuracion.findUnique({ where: { clave: CLAVE_UMBRAL_GENERAL } });
  const numero = fila ? Number(fila.valor) : NaN;
  return Number.isInteger(numero) && numero >= 0 ? numero : UMBRAL_GENERAL_POR_DEFECTO;
}

async function guardarUmbralGeneral(umbral) {
  if (!esUmbralValido(umbral)) {
    throw new UmbralStockError(
      `umbralGeneral debe ser un número entero entre 0 y ${UMBRAL_MAXIMO}`,
      400,
    );
  }
  await prisma.configuracion.upsert({
    where: { clave: CLAVE_UMBRAL_GENERAL },
    update: { valor: String(umbral) },
    create: { clave: CLAVE_UMBRAL_GENERAL, valor: String(umbral) },
  });
  return umbral;
}

// Impacto: cuántos productos ACTIVOS quedarían en "bajo"/"agotado" si el
// umbral general fuera `umbralGeneral` (los que tienen umbral propio no se
// ven afectados por el general). Carga solo 2 columnas por producto.
async function calcularImpacto(umbralGeneral) {
  const articulos = await prisma.articulo.findMany({
    where: { estado: true },
    select: { inventarioMinimo: true, inventario: { select: { cantidad: true } } },
  });

  const resultado = { totalActivos: articulos.length, enBajo: 0, agotados: 0, conUmbralPropio: 0 };
  for (const a of articulos) {
    if (a.inventarioMinimo !== null) resultado.conUmbralPropio += 1;
    const estado = calcularEstadoStock(
      a.inventario?.cantidad ?? 0,
      umbralEfectivo(a.inventarioMinimo, umbralGeneral),
    );
    if (estado === "bajo") resultado.enBajo += 1;
    if (estado === "agotado") resultado.agotados += 1;
  }
  return resultado;
}

async function obtenerConfiguracionStock() {
  const umbralGeneral = await obtenerUmbralGeneral();
  const impacto = await calcularImpacto(umbralGeneral);
  return { umbralGeneral, impacto };
}

async function previsualizarImpacto(umbralGeneral) {
  if (!esUmbralValido(umbralGeneral)) {
    throw new UmbralStockError(
      `umbral debe ser un número entero entre 0 y ${UMBRAL_MAXIMO}`,
      400,
    );
  }
  return calcularImpacto(umbralGeneral);
}

async function actualizarConfiguracionStock({ umbralGeneral }) {
  await guardarUmbralGeneral(umbralGeneral);
  return obtenerConfiguracionStock();
}

// Ajuste masivo del umbral PROPIO: por lista de SKUs o por categoría.
// umbral = null restablece (los productos vuelven a usar el general).
async function aplicarUmbralMasivo({ umbral, skus, idCategoria }) {
  if (umbral !== null && !esUmbralValido(umbral)) {
    throw new UmbralStockError(
      `umbral debe ser un entero entre 0 y ${UMBRAL_MAXIMO}, o null para usar el general`,
      400,
    );
  }

  const hayCategoria = idCategoria !== undefined && idCategoria !== null;
  const haySkus = skus !== undefined && skus !== null;
  if (hayCategoria === haySkus) {
    throw new UmbralStockError("Indica la categoría o la lista de SKUs (solo una de las dos)", 400);
  }

  const where = {};
  if (haySkus) {
    if (
      !Array.isArray(skus) ||
      skus.length === 0 ||
      skus.length > MAX_SKUS_MASIVO ||
      skus.some((s) => typeof s !== "string" || s.trim() === "")
    ) {
      throw new UmbralStockError(
        `skus debe ser una lista de 1 a ${MAX_SKUS_MASIVO} códigos no vacíos`,
        400,
      );
    }
    where.sku = { in: skus.map((s) => s.trim()) };
  } else {
    if (!Number.isInteger(idCategoria)) {
      throw new UmbralStockError("idCategoria debe ser un entero", 400);
    }
    const categoria = await prisma.categoria.findUnique({ where: { idCategoria } });
    if (!categoria) {
      throw new UmbralStockError("La categoría indicada no existe", 400);
    }
    where.idCategoria = idCategoria;
  }

  const { count } = await prisma.articulo.updateMany({ where, data: { inventarioMinimo: umbral } });
  return { actualizados: count };
}

module.exports = {
  UmbralStockError,
  UMBRAL_GENERAL_POR_DEFECTO,
  UMBRAL_MAXIMO,
  esUmbralValido,
  normalizarUmbralPropio,
  umbralEfectivo,
  calcularEstadoStock,
  obtenerUmbralGeneral,
  obtenerConfiguracionStock,
  previsualizarImpacto,
  actualizarConfiguracionStock,
  aplicarUmbralMasivo,
};
