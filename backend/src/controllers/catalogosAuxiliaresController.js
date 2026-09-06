const {
  listarMarcas,
  listarModelos,
  listarPaises,
  listarDepartamentos,
  listarMunicipios,
} = require("../services/catalogosAuxiliaresService");

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

async function listarModelosController(_req, res) {
  try {
    return res.json({ modelos: await listarModelos() });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function listarPaisesController(_req, res) {
  try {
    return res.json({ paises: await listarPaises() });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function listarDepartamentosController(_req, res) {
  try {
    return res.json({ departamentos: await listarDepartamentos() });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function listarMunicipiosController(_req, res) {
  try {
    return res.json({ municipios: await listarMunicipios() });
  } catch (error) {
    return manejarError(res, error);
  }
}

module.exports = {
  listarMarcasController,
  listarModelosController,
  listarPaisesController,
  listarDepartamentosController,
  listarMunicipiosController,
};
