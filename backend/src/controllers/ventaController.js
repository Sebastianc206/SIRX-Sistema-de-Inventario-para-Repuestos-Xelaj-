const {
  VentaError,
  crearVenta,
  obtenerVentaPorId,
  listarVentas,
  anularVenta,
} = require("../services/ventaService");

function manejarError(res, error) {
  if (error instanceof VentaError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  console.error(error);
  return res.status(500).json({ message: "Error interno del servidor" });
}

function parsePaginacion(req) {
  const pagina = Number(req.query.pagina);
  const porPagina = Number(req.query.porPagina);
  return {
    pagina: Number.isInteger(pagina) ? pagina : undefined,
    porPagina: Number.isInteger(porPagina) ? porPagina : undefined,
  };
}

async function listarController(req, res) {
  try {
    const { pagina, porPagina } = parsePaginacion(req);
    const { fechaDesde, fechaHasta } = req.query;
    const resultado = await listarVentas({ pagina, porPagina, fechaDesde, fechaHasta });
    return res.json(resultado);
  } catch (error) {
    return manejarError(res, error);
  }
}

async function obtenerController(req, res) {
  const idVenta = Number(req.params.id);
  if (!Number.isInteger(idVenta)) {
    return res.status(400).json({ message: "El id de venta debe ser un número entero" });
  }

  try {
    const venta = await obtenerVentaPorId(idVenta);
    return res.json({ venta });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function crearController(req, res) {
  try {
    const venta = await crearVenta(req.usuario.idColaborador, req.body);
    return res.status(201).json({ venta });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function anularController(req, res) {
  const idVenta = Number(req.params.id);
  if (!Number.isInteger(idVenta)) {
    return res.status(400).json({ message: "El id de venta debe ser un número entero" });
  }

  try {
    const venta = await anularVenta(idVenta);
    return res.json({ venta });
  } catch (error) {
    return manejarError(res, error);
  }
}

module.exports = { listarController, obtenerController, crearController, anularController };
