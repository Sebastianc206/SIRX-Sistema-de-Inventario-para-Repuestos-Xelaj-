const {
  SalidaAjusteError,
  crearSalidaAjuste,
  obtenerSalidaAjustePorId,
  listarSalidasAjuste,
  listarTiposSalidaAjuste,
  anularSalidaAjuste,
} = require("../services/salidaAjusteService");

function manejarError(res, error) {
  if (error instanceof SalidaAjusteError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  console.error(error);
  return res.status(500).json({ message: "Error interno del servidor" });
}

async function listarController(req, res) {
  try {
    const { fechaDesde, fechaHasta } = req.query;
    return res.json({ salidas: await listarSalidasAjuste({ fechaDesde, fechaHasta }) });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function listarTiposController(_req, res) {
  try {
    return res.json({ tipos: await listarTiposSalidaAjuste() });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function obtenerController(req, res) {
  const idVenta = Number(req.params.id);
  if (!Number.isInteger(idVenta)) {
    return res.status(400).json({ message: "El id debe ser un número entero" });
  }

  try {
    const salida = await obtenerSalidaAjustePorId(idVenta);
    return res.json({ salida });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function crearController(req, res) {
  try {
    const salida = await crearSalidaAjuste(req.usuario.idColaborador, req.body);
    return res.status(201).json({ salida });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function anularController(req, res) {
  const idVenta = Number(req.params.id);
  if (!Number.isInteger(idVenta)) {
    return res.status(400).json({ message: "El id debe ser un número entero" });
  }

  try {
    const salida = await anularSalidaAjuste(idVenta);
    return res.json({ salida });
  } catch (error) {
    return manejarError(res, error);
  }
}

module.exports = {
  listarController,
  listarTiposController,
  obtenerController,
  crearController,
  anularController,
};
