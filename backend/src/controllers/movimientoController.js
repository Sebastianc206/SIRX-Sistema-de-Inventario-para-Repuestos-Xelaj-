const { MovimientoError, listarMovimientos, obtenerComparacionVentas } = require("../services/movimientoService");

function manejarError(res, error) {
  if (error instanceof MovimientoError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  console.error(error);
  return res.status(500).json({ message: "Error interno del servidor" });
}

function ocultarDatosSensibles(req) {
  return req.usuario.role !== "Administrador";
}

function parsePaginacion(req) {
  const pagina = Number(req.query.pagina);
  const porPagina = Number(req.query.porPagina);
  return {
    pagina: Number.isInteger(pagina) ? pagina : undefined,
    porPagina: Number.isInteger(porPagina) ? porPagina : undefined,
  };
}

// idCategoria/idMarca llegan como query string (texto) — un valor ausente o
// no numérico se traduce a undefined, que listarMovimientos interpreta como
// "sin filtrar por ese campo" (mismo patrón que articuloController).
function parseFiltroId(valor) {
  const numero = Number(valor);
  return Number.isInteger(numero) ? numero : undefined;
}

function parseSkus(valor) {
  return typeof valor === "string" && valor.length > 0 ? valor.split(",") : [];
}

async function listarController(req, res) {
  try {
    const { pagina, porPagina } = parsePaginacion(req);
    const { fechaDesde, fechaHasta } = req.query;
    const resultado = await listarMovimientos({
      skus: parseSkus(req.query.skus),
      idCategoria: parseFiltroId(req.query.idCategoria),
      idMarca: parseFiltroId(req.query.idMarca),
      fechaDesde,
      fechaHasta,
      pagina,
      porPagina,
      ocultarDatosSensibles: ocultarDatosSensibles(req),
    });
    return res.json(resultado);
  } catch (error) {
    return manejarError(res, error);
  }
}

async function obtenerComparacionVentasController(req, res) {
  const skus = parseSkus(req.query.skus);
  const { fechaDesde, fechaHasta } = req.query;

  try {
    const comparacion = await obtenerComparacionVentas(skus, { fechaDesde, fechaHasta });
    return res.json(comparacion);
  } catch (error) {
    return manejarError(res, error);
  }
}

module.exports = { listarController, obtenerComparacionVentasController };
