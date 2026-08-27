const ExcelJS = require("exceljs");
const {
  CategoriaError,
  listarCategorias,
  crearCategoria,
  editarCategoria,
  eliminarCategoria,
  crearCategoriasEnLote,
} = require("../services/categoriaService");

// T-101: además del tipo/tamaño de archivo (validados en el middleware de
// subida), se limita cuántas filas se procesan por carga para no convertir
// un archivo "válido" pero enorme en cientos de escrituras a la base de
// datos en una sola petición.
const MAX_FILAS_CARGA_MASIVA = 500;

async function extraerDescripcionesDeExcel(buffer) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch (error) {
    throw new CategoriaError("El archivo no es un Excel (.xlsx) válido o está corrupto", 400);
  }

  const hoja = workbook.worksheets[0];
  if (!hoja) {
    throw new CategoriaError("El archivo no tiene hojas con datos", 400);
  }

  let columnaDescripcion = null;
  hoja.getRow(1).eachCell({ includeEmpty: false }, (celda, numeroColumna) => {
    const valor = String(celda.value ?? "").trim();
    if (/^descripci[oó]n$/i.test(valor)) {
      columnaDescripcion = numeroColumna;
    }
  });

  if (!columnaDescripcion) {
    throw new CategoriaError('El archivo debe tener una columna "descripcion" en la primera fila', 400);
  }

  const filas = [];
  for (let numeroFila = 2; numeroFila <= hoja.rowCount; numeroFila += 1) {
    const valorCelda = hoja.getRow(numeroFila).getCell(columnaDescripcion).value;
    const descripcion = valorCelda === null || valorCelda === undefined ? "" : String(valorCelda).trim();
    if (descripcion === "") continue; // fila vacía intermedia: se ignora, no es un error.
    filas.push({ numeroFila, descripcion });
  }

  if (filas.length === 0) {
    throw new CategoriaError("El archivo no tiene filas con descripción para importar", 400);
  }

  if (filas.length > MAX_FILAS_CARGA_MASIVA) {
    throw new CategoriaError(
      `El archivo tiene demasiadas filas (máximo ${MAX_FILAS_CARGA_MASIVA} por carga)`,
      400,
    );
  }

  return filas;
}

function manejarError(res, error) {
  if (error instanceof CategoriaError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  console.error(error);
  return res.status(500).json({ message: "Error interno del servidor" });
}

function parseIdCategoria(req, res) {
  const idCategoria = Number(req.params.id);
  if (!Number.isInteger(idCategoria)) {
    res.status(400).json({ message: "El id de categoría debe ser un número entero" });
    return null;
  }
  return idCategoria;
}

async function listarController(_req, res) {
  try {
    const categorias = await listarCategorias();
    return res.json({ categorias });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function crearController(req, res) {
  const { descripcion } = req.body;

  try {
    const categoria = await crearCategoria({ descripcion });
    return res.status(201).json({ categoria });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function editarController(req, res) {
  const idCategoria = parseIdCategoria(req, res);
  if (idCategoria === null) return;

  const { descripcion } = req.body;

  try {
    const categoria = await editarCategoria(idCategoria, { descripcion });
    return res.json({ categoria });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function eliminarController(req, res) {
  const idCategoria = parseIdCategoria(req, res);
  if (idCategoria === null) return;

  try {
    await eliminarCategoria(idCategoria);
    return res.status(204).send();
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
    filas = await extraerDescripcionesDeExcel(req.file.buffer);
  } catch (error) {
    return manejarError(res, error);
  }

  const resultado = await crearCategoriasEnLote(filas);
  return res.json(resultado);
}

module.exports = {
  listarController,
  crearController,
  editarController,
  eliminarController,
  cargaMasivaController,
};
