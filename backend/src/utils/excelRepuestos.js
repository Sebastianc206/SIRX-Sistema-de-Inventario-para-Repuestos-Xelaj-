const ExcelJS = require("exceljs");
const { ArticuloError } = require("../services/articuloService");

// HU-05: columnas de la plantilla de carga masiva. Las claves son el
// nombre interno de cada campo; los encabezados aceptados se comparan sin
// distinguir mayúsculas/acentos/guiones bajos vs espacios (una persona
// llenando el Excel a mano no necesariamente respeta el formato exacto).
const COLUMNAS = [
  { clave: "sku", encabezado: "SKU", requerida: true },
  { clave: "nombre", encabezado: "Nombre", requerida: true },
  { clave: "categoria", encabezado: "Categoria", requerida: true },
  { clave: "marca", encabezado: "Marca", requerida: false },
  { clave: "precioVenta", encabezado: "Precio Venta", requerida: true },
  { clave: "precioCosto", encabezado: "Precio Costo", requerida: true },
  { clave: "inventarioMinimo", encabezado: "Inventario Minimo", requerida: false },
  { clave: "ubicacion", encabezado: "Ubicacion", requerida: false },
  { clave: "proveedor", encabezado: "Proveedor", requerida: false },
];

const MAX_FILAS_CARGA_MASIVA = 1000;

// Regresión: la propia plantilla generada marca las columnas requeridas
// agregando " *" al encabezado (ver generarPlantillaRepuestos) — si acá
// solo se quitaran espacios/guion bajo, "SKU *" no calzaría con "SKU" y la
// plantilla que ofrecemos para descargar no se podría volver a subir tal
// cual. Por eso se descarta cualquier caracter que no sea letra o número,
// no solo espacios/guion bajo: cubre el asterisco y cualquier otra marca
// visual que se agregue a futuro sin tener que tocar este matching de nuevo.
function normalizarEncabezado(valor) {
  return String(valor ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos (á->a, í->i, ...)
    .replace(/[^a-z0-9]/g, ""); // "precio venta" / "precio_venta" / "SKU *" -> "precioventa" / "sku"
}

async function generarPlantillaRepuestos() {
  const workbook = new ExcelJS.Workbook();
  const hoja = workbook.addWorksheet("Repuestos");

  hoja.columns = COLUMNAS.map((columna) => ({
    header: columna.encabezado + (columna.requerida ? " *" : ""),
    key: columna.clave,
    width: 20,
  }));
  hoja.getRow(1).font = { bold: true };

  // Fila de ejemplo: si el administrador la deja tal cual y sube el
  // archivo, "Frenos" no existirá como categoría (a menos que coincida por
  // casualidad) y la fila simplemente se reporta como error — instructivo,
  // no destructivo.
  hoja.addRow({
    sku: "EJEMPLO-001",
    nombre: "Pastillas de freno delanteras",
    categoria: "Frenos",
    marca: "",
    precioVenta: 150.5,
    precioCosto: 90,
    // Vacío = usar el umbral general de stock bajo.
    inventarioMinimo: "",
    ubicacion: "Estante A1",
    proveedor: "",
  });
  hoja.getRow(2).font = { italic: true, color: { argb: "FF888888" } };

  return workbook.xlsx.writeBuffer();
}

// T-042/T-044: localiza cada columna esperada en la fila de encabezados
// (sin asumir un orden fijo) y valida que las requeridas estén presentes
// antes de intentar leer una sola fila de datos.
function mapearColumnas(filaEncabezados) {
  const indicePorClave = {};

  filaEncabezados.eachCell({ includeEmpty: false }, (celda, numeroColumna) => {
    const normalizado = normalizarEncabezado(celda.value);
    const columna = COLUMNAS.find((c) => normalizarEncabezado(c.encabezado) === normalizado);
    if (columna) {
      indicePorClave[columna.clave] = numeroColumna;
    }
  });

  const faltantes = COLUMNAS.filter((c) => c.requerida && !indicePorClave[c.clave]);
  if (faltantes.length > 0) {
    throw new ArticuloError(
      `El archivo debe tener las columnas: ${faltantes.map((c) => c.encabezado).join(", ")}`,
      400,
    );
  }

  return indicePorClave;
}

function valorCelda(fila, indice) {
  if (!indice) return undefined;
  const valor = fila.getCell(indice).value;
  if (valor === null || valor === undefined) return undefined;
  // ExcelJS puede envolver fórmulas/hipervínculos en un objeto; para una
  // plantilla de datos simples basta con su representación de texto.
  if (typeof valor === "object" && "text" in valor) {
    const texto = String(valor.text).trim();
    return texto === "" ? undefined : texto;
  }
  if (typeof valor === "string") {
    // Una celda "vacía pero tocada" puede serializarse como "" en vez de
    // null. Para un campo opcional (ubicacion, marca, proveedor) eso debe
    // significar "sin valor", igual que una celda realmente en blanco —
    // no un texto inválido de longitud 0.
    const texto = valor.trim();
    return texto === "" ? undefined : texto;
  }
  return valor;
}

async function extraerFilasDeExcel(buffer) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch (error) {
    throw new ArticuloError("El archivo no es un Excel (.xlsx) válido o está corrupto", 400);
  }

  const hoja = workbook.worksheets[0];
  if (!hoja) {
    throw new ArticuloError("El archivo no tiene hojas con datos", 400);
  }

  const indicePorClave = mapearColumnas(hoja.getRow(1));

  const filas = [];
  for (let numeroFila = 2; numeroFila <= hoja.rowCount; numeroFila += 1) {
    const filaExcel = hoja.getRow(numeroFila);

    const fila = {
      numeroFila,
      sku: valorCelda(filaExcel, indicePorClave.sku),
      nombre: valorCelda(filaExcel, indicePorClave.nombre),
      categoria: valorCelda(filaExcel, indicePorClave.categoria),
      marca: valorCelda(filaExcel, indicePorClave.marca),
      precioVenta: valorCelda(filaExcel, indicePorClave.precioVenta),
      precioCosto: valorCelda(filaExcel, indicePorClave.precioCosto),
      inventarioMinimo: valorCelda(filaExcel, indicePorClave.inventarioMinimo),
      ubicacion: valorCelda(filaExcel, indicePorClave.ubicacion),
      proveedor: valorCelda(filaExcel, indicePorClave.proveedor),
    };

    // Fila completamente vacía (hueco entre datos, o al final del rango
    // usado del sheet): se ignora, no es un error.
    const estaVacia = Object.entries(fila).every(
      ([clave, valor]) => clave === "numeroFila" || valor === undefined || valor === "",
    );
    if (estaVacia) continue;

    filas.push(fila);
  }

  if (filas.length === 0) {
    throw new ArticuloError("El archivo no tiene filas con datos para importar", 400);
  }

  if (filas.length > MAX_FILAS_CARGA_MASIVA) {
    throw new ArticuloError(
      `El archivo tiene demasiadas filas (máximo ${MAX_FILAS_CARGA_MASIVA} por carga)`,
      400,
    );
  }

  return filas;
}

module.exports = { generarPlantillaRepuestos, extraerFilasDeExcel, MAX_FILAS_CARGA_MASIVA };
