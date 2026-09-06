const {
  ArticuloError,
  listarArticulos,
  obtenerArticuloPorSku,
  crearArticulo,
  editarArticulo,
  cambiarEstadoArticulo,
} = require("../services/articuloService");

function manejarError(res, error) {
  if (error instanceof ArticuloError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  console.error(error);
  return res.status(500).json({ message: "Error interno del servidor" });
}

// T-031: quién puede ver precio_costo y proveedor se decide acá, a partir
// del rol que ya viene validado en el JWT (authMiddleware) — no depende de
// que el cliente pida o no esos campos.
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
    const resultado = await listarArticulos({
      pagina,
      porPagina,
      busqueda: req.query.busqueda,
      estado: req.query.estado,
      ocultarDatosSensibles: ocultarDatosSensibles(req),
    });
    return res.json(resultado);
  } catch (error) {
    return manejarError(res, error);
  }
}

async function obtenerController(req, res) {
  try {
    const articulo = await obtenerArticuloPorSku(req.params.sku, {
      ocultarDatosSensibles: ocultarDatosSensibles(req),
    });
    return res.json({ articulo });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function crearController(req, res) {
  try {
    const articulo = await crearArticulo(req.body);
    return res.status(201).json({ articulo });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function editarController(req, res) {
  try {
    const articulo = await editarArticulo(req.params.sku, req.body);
    return res.json({ articulo });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function cambiarEstadoController(req, res) {
  const { estado } = req.body;

  if (typeof estado !== "boolean") {
    return res.status(400).json({ message: "estado debe ser un valor booleano" });
  }

  try {
    const articulo = await cambiarEstadoArticulo(req.params.sku, estado);
    return res.json({ articulo });
  } catch (error) {
    return manejarError(res, error);
  }
}

module.exports = {
  listarController,
  obtenerController,
  crearController,
  editarController,
  cambiarEstadoController,
};
