const multer = require("multer");

// T-101: la carga masiva solo acepta Excel moderno (.xlsx). La librería que
// usamos para leerlo (exceljs) no soporta el formato binario legado .xls,
// así que restringirlo a .xlsx no es una limitación artificial: es lo que
// realmente podemos procesar de forma segura.
//
// El "mimetype" que llega en el multipart lo pone el cliente (header
// Content-Type de esa parte): no es un dato confiable para decidir nada de
// seguridad, y en la práctica muchos clientes que no son un navegador
// (curl, scripts) ni siquiera lo setean bien para .xlsx — mandan
// application/octet-stream. Por eso acá solo se filtra por extensión como
// primer descarte rápido; la validación real de contenido pasa después, al
// intentar parsear el archivo con ExcelJS (si no es un .xlsx genuino, esa
// carga falla y se rechaza con 400 desde el controlador).
const EXTENSION_XLSX = ".xlsx";
const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024; // 5 MB: de sobra para un listado de categorías.

function tieneExtensionValida(nombreArchivo) {
  return nombreArchivo.toLowerCase().endsWith(EXTENSION_XLSX);
}

// multer.memoryStorage(): el archivo nunca toca disco (no hay riesgo de que
// quede un temporal con contenido de terceros) y como límite de tamaño es
// chico, cargarlo completo en memoria para procesarlo es razonable.
const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAMANO_MAXIMO_BYTES, files: 1 },
  fileFilter(_req, file, cb) {
    if (!tieneExtensionValida(file.originalname)) {
      return cb(new Error("Solo se admiten archivos Excel en formato .xlsx"));
    }
    return cb(null, true);
  },
});

// Envuelve multer para traducir sus errores (tamaño excedido, tipo
// rechazado, campo equivocado) a una respuesta JSON consistente con el
// resto del API, en vez de dejar que Express los propague como HTML.
function cargarExcel(nombreCampo) {
  const middleware = uploadExcel.single(nombreCampo);

  return (req, res, next) => {
    middleware(req, res, (error) => {
      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({
            message: `El archivo supera el tamaño máximo permitido (${TAMANO_MAXIMO_BYTES / (1024 * 1024)} MB)`,
          });
        }
        return res.status(400).json({ message: error.message });
      }

      if (error) {
        return res.status(400).json({ message: error.message });
      }

      return next();
    });
  };
}

module.exports = { cargarExcel, TAMANO_MAXIMO_BYTES };
