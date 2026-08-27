const prisma = require("../utils/prismaClient");
const { siguienteId } = require("../utils/siguienteId");
const { esTextoValido } = require("../utils/validadores");

const DESCRIPCION_MAX_LENGTH = 100;

class CategoriaError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

// T-099: la validación vive en el servicio (no solo en el controlador) para
// que cualquier caller —incluida la carga masiva— quede protegido igual.
function validarDescripcion(descripcion) {
  if (!esTextoValido(descripcion, { max: DESCRIPCION_MAX_LENGTH })) {
    throw new CategoriaError(
      `descripcion es requerida (máximo ${DESCRIPCION_MAX_LENGTH} caracteres)`,
      400,
    );
  }
}

function formatearCategoria(categoria) {
  return {
    idCategoria: categoria.idCategoria,
    descripcion: categoria.descripcion,
  };
}

// Categoria no tiene columna "vigente" (a diferencia de Usuario/Proveedor):
// es un catálogo simple sin baja lógica. Por eso el DELETE es un borrado
// real, protegido solo por la restricción de negocio de abajo.
async function existeDescripcion(descripcion, excluirId) {
  const categoria = await prisma.categoria.findFirst({
    where: {
      descripcion: { equals: descripcion, mode: "insensitive" },
      ...(excluirId !== undefined ? { idCategoria: { not: excluirId } } : {}),
    },
  });
  return categoria !== null;
}

async function listarCategorias() {
  const categorias = await prisma.categoria.findMany({ orderBy: { descripcion: "asc" } });
  return categorias.map(formatearCategoria);
}

async function obtenerCategoriaPorId(idCategoria) {
  const categoria = await prisma.categoria.findUnique({ where: { idCategoria } });
  if (!categoria) {
    throw new CategoriaError("Categoría no encontrada", 404);
  }
  return formatearCategoria(categoria);
}

async function crearCategoria({ descripcion }) {
  validarDescripcion(descripcion);
  const descripcionLimpia = descripcion.trim();

  if (await existeDescripcion(descripcionLimpia)) {
    throw new CategoriaError("Ya existe una categoría con esa descripción", 409);
  }

  const categoria = await prisma.$transaction(async (tx) => {
    const idCategoria = await siguienteId(tx, "categoria", "idCategoria");
    return tx.categoria.create({ data: { idCategoria, descripcion: descripcionLimpia } });
  });

  return formatearCategoria(categoria);
}

async function editarCategoria(idCategoria, { descripcion }) {
  validarDescripcion(descripcion);

  const categoria = await prisma.categoria.findUnique({ where: { idCategoria } });
  if (!categoria) {
    throw new CategoriaError("Categoría no encontrada", 404);
  }

  const descripcionLimpia = descripcion.trim();
  if (await existeDescripcion(descripcionLimpia, idCategoria)) {
    throw new CategoriaError("Ya existe una categoría con esa descripción", 409);
  }

  const actualizada = await prisma.categoria.update({
    where: { idCategoria },
    data: { descripcion: descripcionLimpia },
  });

  return formatearCategoria(actualizada);
}

async function eliminarCategoria(idCategoria) {
  const categoria = await prisma.categoria.findUnique({ where: { idCategoria } });
  if (!categoria) {
    throw new CategoriaError("Categoría no encontrada", 404);
  }

  // Articulo.idCategoria es NOT NULL y no tiene ON DELETE CASCADE (ver
  // migration.sql): hay que bloquear el borrado en la app, no dejar que
  // reviente como error 500 de restricción de llave foránea.
  const articulosAsociados = await prisma.articulo.count({ where: { idCategoria } });
  if (articulosAsociados > 0) {
    throw new CategoriaError(
      "No se puede eliminar: hay repuestos asignados a esta categoría",
      409,
    );
  }

  await prisma.categoria.delete({ where: { idCategoria } });
}

// T-101: carga masiva. Cada fila se crea con la misma validación y las
// mismas reglas de negocio que crearCategoria (duplicados incluidos) — una
// fila inválida no aborta el resto del archivo, se reporta individualmente.
async function crearCategoriasEnLote(filas) {
  const creadas = [];
  const errores = [];

  for (const fila of filas) {
    try {
      // eslint-disable-next-line no-await-in-loop -- cada fila depende de
      // las anteriores (duplicados dentro del mismo archivo), no se puede
      // paralelizar sin volver a implementar la validación de existencia.
      const categoria = await crearCategoria({ descripcion: fila.descripcion });
      creadas.push(categoria);
    } catch (error) {
      errores.push({
        fila: fila.numeroFila,
        descripcion: fila.descripcion,
        motivo: error instanceof CategoriaError ? error.message : "Error interno del servidor",
      });
    }
  }

  return { creadas, errores };
}

module.exports = {
  CategoriaError,
  listarCategorias,
  obtenerCategoriaPorId,
  crearCategoria,
  editarCategoria,
  eliminarCategoria,
  crearCategoriasEnLote,
};
