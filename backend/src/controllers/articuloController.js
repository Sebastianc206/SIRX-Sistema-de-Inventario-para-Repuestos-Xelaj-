const {
  ArticuloError,
  listarArticulos,
  obtenerArticuloPorSku,
  crearArticulo,
  editarArticulo,
  cambiarEstadoArticulo,
  crearArticulosEnLote,
} = require("../services/articuloService");
const { generarPlantillaRepuestos, extraerFilasDeExcel } = require("../utils/excelRepuestos");

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

// HU-06: idCategoria/idMarca/idModelo llegan como query string (texto) —
// un valor ausente o no numérico se traduce a undefined, que
// listarArticulos interpreta como "sin filtrar por ese campo" (no como 0).
function parseFiltroId(valor) {
  const numero = Number(valor);
  return Number.isInteger(numero) ? numero : undefined;
}

async function listarController(req, res) {
  try {
    const { pagina, porPagina } = parsePaginacion(req);
    const resultado = await listarArticulos({
      pagina,
      porPagina,
      busqueda: req.query.busqueda,
      estado: req.query.estado,
      idCategoria: parseFiltroId(req.query.idCategoria),
      idMarca: parseFiltroId(req.query.idMarca),
      idModelo: parseFiltroId(req.query.idModelo),
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

// T-042: plantilla descargable, siempre con las columnas y el formato
// esperado tal como hoy los valida crearArticulo/crearArticulosEnLote —
// si algún día cambian los campos requeridos, esta plantilla cambia con ellos.
async function descargarPlantillaController(_req, res) {
  try {
    const buffer = await generarPlantillaRepuestos();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", 'attachment; filename="plantilla-repuestos.xlsx"');
    return res.send(Buffer.from(buffer));
  } catch (error) {
    return manejarError(res, error);
  }
}

async function cargaMasivaController(req, res) {
  if (!req.file) {
    return res.status(400).json({ message: "Debes adjuntar un archivo Excel (.xlsx)" });
  }

  let filas;
  try {
    filas = await extraerFilasDeExcel(req.file.buffer);
  } catch (error) {
    return manejarError(res, error);
  }

  const resultado = await crearArticulosEnLote(filas);
  return res.json(resultado);
}

module.exports = {
  listarController,
  obtenerController,
  crearController,
  editarController,
  cambiarEstadoController,
  descargarPlantillaController,
  cargaMasivaController,
};
