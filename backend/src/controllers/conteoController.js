const servicio = require("../services/conteoService");

// Nunca se devuelve el mensaje interno ni la traza de errores inesperados.
function manejarError(res, error) {
  if (error instanceof servicio.ConteoError) {
    return res.status(error.statusCode).json({ message: error.message, ...(error.extra ?? {}) });
  }

  console.error(error);
  return res.status(500).json({ message: "Error interno del servidor" });
}

function entero(valor) {
  const n = Number(valor);
  return valor !== undefined && valor !== "" && Number.isInteger(n) ? n : undefined;
}

async function listarController(req, res) {
  try {
    const { estado } = req.query;
    if (estado !== undefined && typeof estado !== "string") {
      return res.status(400).json({ message: "estado no es válido" });
    }
    return res.json(
      await servicio.listarConteos({ estado, pagina: entero(req.query.pagina), porPagina: entero(req.query.porPagina) }),
    );
  } catch (error) {
    return manejarError(res, error);
  }
}

async function crearController(req, res) {
  try {
    const conteo = await servicio.crearConteo(req.usuario.idColaborador, req.body);
    return res.status(201).json({ conteo });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function obtenerController(req, res) {
  try {
    return res.json({ conteo: await servicio.obtenerConteo(req.params.id) });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function guardarLineasController(req, res) {
  try {
    return res.json({ conteo: await servicio.guardarLineas(req.params.id, req.body?.lineas) });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function eliminarLineaController(req, res) {
  try {
    return res.json({ conteo: await servicio.eliminarLinea(req.params.id, req.params.sku) });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function cerrarController(req, res) {
  try {
    const conteo = await servicio.cerrarConteo(req.params.id, req.usuario.idColaborador, req.body ?? {});
    return res.json({ conteo });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function cancelarController(req, res) {
  try {
    return res.json({ conteo: await servicio.cancelarConteo(req.params.id, req.usuario.idColaborador) });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function eliminarController(req, res) {
  try {
    await servicio.eliminarConteo(req.params.id);
    return res.status(204).send();
  } catch (error) {
    return manejarError(res, error);
  }
}

module.exports = {
  listarController,
  crearController,
  obtenerController,
  guardarLineasController,
  eliminarLineaController,
  cerrarController,
  cancelarController,
  eliminarController,
};
