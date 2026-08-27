const {
  CategoriaError,
  listarCategorias,
  crearCategoria,
  editarCategoria,
  eliminarCategoria,
} = require("../services/categoriaService");

function manejarError(res, error) {
  if (error instanceof CategoriaError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  console.error(error);
  return res.status(500).json({ message: "Error interno del servidor" });
}

function parseIdCategoria(req, res) {
  const idCategoria = Number(req.params.id);
  if (!Number.isInteger(idCategoria)) {
    res.status(400).json({ message: "El id de categoría debe ser un número entero" });
    return null;
  }
  return idCategoria;
}

function validarDescripcion(descripcion, res) {
  if (typeof descripcion !== "string" || descripcion.trim().length === 0) {
    res.status(400).json({ message: "descripcion es requerida" });
    return false;
  }

  if (descripcion.trim().length > 100) {
    res.status(400).json({ message: "descripcion no puede superar 100 caracteres" });
    return false;
  }

  return true;
}

async function listarController(_req, res) {
  try {
    const categorias = await listarCategorias();
    return res.json({ categorias });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function crearController(req, res) {
  const { descripcion } = req.body;
  if (!validarDescripcion(descripcion, res)) return;

  try {
    const categoria = await crearCategoria({ descripcion });
    return res.status(201).json({ categoria });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function editarController(req, res) {
  const idCategoria = parseIdCategoria(req, res);
  if (idCategoria === null) return;

  const { descripcion } = req.body;
  if (!validarDescripcion(descripcion, res)) return;

  try {
    const categoria = await editarCategoria(idCategoria, { descripcion });
    return res.json({ categoria });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function eliminarController(req, res) {
  const idCategoria = parseIdCategoria(req, res);
  if (idCategoria === null) return;

  try {
    await eliminarCategoria(idCategoria);
    return res.status(204).send();
  } catch (error) {
    return manejarError(res, error);
  }
}

module.exports = { listarController, crearController, editarController, eliminarController };
