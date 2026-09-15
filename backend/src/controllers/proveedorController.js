const {
  ProveedorError,
  listarProveedores,
  crearProveedor,
  editarProveedor,
  cambiarEstadoProveedor,
} = require("../services/proveedorService");

function manejarError(res, error) {
  if (error instanceof ProveedorError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  console.error(error);
  return res.status(500).json({ message: "Error interno del servidor" });
}

function parseIdProveedor(req, res) {
  const idProveedor = Number(req.params.id);
  if (!Number.isInteger(idProveedor)) {
    res.status(400).json({ message: "El id de proveedor debe ser un número entero" });
    return null;
  }
  return idProveedor;
}

async function listarController(req, res) {
  try {
    const vigente = req.query.vigente === "true" ? true : undefined;
    return res.json({ proveedores: await listarProveedores({ vigente }) });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function crearController(req, res) {
  try {
    const proveedor = await crearProveedor(req.body);
    return res.status(201).json({ proveedor });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function editarController(req, res) {
  const idProveedor = parseIdProveedor(req, res);
  if (idProveedor === null) return;

  try {
    const proveedor = await editarProveedor(idProveedor, req.body);
    return res.json({ proveedor });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function cambiarEstadoController(req, res) {
  const idProveedor = parseIdProveedor(req, res);
  if (idProveedor === null) return;

  const { vigente } = req.body;
  if (typeof vigente !== "boolean") {
    return res.status(400).json({ message: "vigente debe ser un valor booleano" });
  }

  try {
    const proveedor = await cambiarEstadoProveedor(idProveedor, vigente);
    return res.json({ proveedor });
  } catch (error) {
    return manejarError(res, error);
  }
}

module.exports = { listarController, crearController, editarController, cambiarEstadoController };
