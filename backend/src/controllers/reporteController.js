const { ReporteError, listarCatalogo, generarVistaPrevia, generarDescarga } = require("../services/reportes/reporteService");

function manejarError(res, error) {
  if (error instanceof ReporteError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  // Nunca se devuelve el mensaje interno ni la traza al cliente.
  console.error(error);
  return res.status(500).json({ message: "Error interno del servidor" });
}

function catalogoController(req, res) {
  return res.json({ reportes: listarCatalogo(req.usuario.role) });
}

// Un controlador por reporte, generado desde el catálogo (ver reporteRoutes).
function vistaPreviaController(id) {
  return async (req, res) => {
    try {
      const reporte = await generarVistaPrevia(id, req.query, { usuario: req.usuario });
      return res.json(reporte);
    } catch (error) {
      return manejarError(res, error);
    }
  };
}

async function descargarController(req, res) {
  try {
    const { buffer, contentType, nombre } = await generarDescarga(req.body, { usuario: req.usuario });
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${nombre}"`);
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "no-store");
    return res.send(buffer);
  } catch (error) {
    return manejarError(res, error);
  }
}

module.exports = { catalogoController, vistaPreviaController, descargarController };
