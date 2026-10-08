const {
  CompraError,
  crearCompra,
  obtenerCompraPorId,
  listarCompras,
  anularCompra,
} = require("../services/compraService");

function manejarError(res, error) {
  if (error instanceof CompraError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  console.error(error);
  return res.status(500).json({ message: "Error interno del servidor" });
}

// Las compras son Administrador-only a nivel de rutas (ver compraRoutes.js),
// así que precioCompra/montoTotalCompra nunca se ocultan hoy — se deja el
// mismo patrón explícito de articuloController por si el acceso se amplía.
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

async function listarController(req, res) {
  try {
    const { pagina, porPagina } = parsePaginacion(req);
    const resultado = await listarCompras({
      pagina,
      porPagina,
      ocultarDatosSensibles: ocultarDatosSensibles(req),
    });
    return res.json(resultado);
  } catch (error) {
    return manejarError(res, error);
  }
}

async function obtenerController(req, res) {
  const idCompra = Number(req.params.id);
  if (!Number.isInteger(idCompra)) {
    return res.status(400).json({ message: "El id de compra debe ser un número entero" });
  }

  try {
    const compra = await obtenerCompraPorId(idCompra, { ocultarDatosSensibles: ocultarDatosSensibles(req) });
    return res.json({ compra });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function crearController(req, res) {
  try {
    const compra = await crearCompra(req.usuario.idColaborador, req.body);
    return res.status(201).json({ compra });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function anularController(req, res) {
  const idCompra = Number(req.params.id);
  if (!Number.isInteger(idCompra)) {
    return res.status(400).json({ message: "El id de compra debe ser un número entero" });
  }

  try {
    const compra = await anularCompra(idCompra);
    return res.json({ compra });
  } catch (error) {
    return manejarError(res, error);
  }
}

module.exports = { listarController, obtenerController, crearController, anularController };
