const prisma = require("../utils/prismaClient");
const { siguienteId } = require("../utils/siguienteId");

class CategoriaError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
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

module.exports = {
  CategoriaError,
  listarCategorias,
  obtenerCategoriaPorId,
  crearCategoria,
  editarCategoria,
  eliminarCategoria,
};
