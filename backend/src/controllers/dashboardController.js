const { obtenerResumenDashboard } = require("../services/dashboardService");

function manejarError(res, error) {
  console.error(error);
  return res.status(500).json({ message: "Error interno del servidor" });
}

function ocultarDatosSensibles(req) {
  return req.usuario.role !== "Administrador";
}

async function obtenerResumenController(req, res) {
  try {
    const resumen = await obtenerResumenDashboard({ ocultarDatosSensibles: ocultarDatosSensibles(req) });
    return res.json(resumen);
  } catch (error) {
    return manejarError(res, error);
  }
}

module.exports = { obtenerResumenController };
