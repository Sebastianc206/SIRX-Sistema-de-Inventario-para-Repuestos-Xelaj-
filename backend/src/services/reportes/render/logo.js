const fs = require("fs");
const path = require("path");

// Logo oficial para los archivos descargables. Los PNG viven en
// backend/assets/brand (el backend no puede leer del frontend en producción).
// Lectura única y cacheada; si el archivo falta, devuelve null y el reporte se
// genera igual, sin logo.
const DIR = path.join(__dirname, "..", "..", "..", "..", "assets", "brand");
const PROPORCION = 1024 / 568; // ancho / alto del logo
const cache = new Map();

function cargarLogo(nombre) {
  if (!cache.has(nombre)) {
    let datos = null;
    try {
      datos = fs.readFileSync(path.join(DIR, nombre));
    } catch {
      datos = null;
    }
    cache.set(nombre, datos);
  }
  return cache.get(nombre);
}

module.exports = { cargarLogo, PROPORCION };
