const { listarMarcas, listarProveedores, listarModelos } = require("../services/catalogosAuxiliaresService");

function manejarError(res, error) {
  console.error(error);
  return res.status(500).json({ message: "Error interno del servidor" });
}

async function listarMarcasController(_req, res) {
  try {
    return res.json({ marcas: await listarMarcas() });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function listarProveedoresController(_req, res) {
  try {
    return res.json({ proveedores: await listarProveedores() });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function listarModelosController(_req, res) {
  try {
    return res.json({ modelos: await listarModelos() });
  } catch (error) {
    return manejarError(res, error);
  }
}

module.exports = { listarMarcasController, listarProveedoresController, listarModelosController };
