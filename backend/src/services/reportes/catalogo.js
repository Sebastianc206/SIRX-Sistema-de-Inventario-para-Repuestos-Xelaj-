// Catálogo único de reportes. Cada definición declara: id (segmento de URL
// y nombre de archivo), roles que pueden verlo, filtros que acepta y cómo
// se calcula. Las rutas generan UN endpoint por reporte a partir de esta
// lista, cada uno con su `authorize(...definicion.roles)` explícito.
const REPORTES = [
  require("./definiciones/masVendidos"),
  require("./definiciones/existencias"),
  require("./definiciones/movimientos"),
  require("./definiciones/reposicion"),
  require("./definiciones/rotacion"),
  require("./definiciones/ventasPeriodo"),
  require("./definiciones/utilidad"),
  require("./definiciones/mermas"),
  require("./definiciones/conteoFisico"),
];

function obtenerDefinicion(id) {
  return REPORTES.find((r) => r.id === id);
}

function puedeVer(definicion, role) {
  return definicion.roles.includes(role);
}

// Lo que ve el frontend para armar la galería (sin la función ejecutar).
function listarCatalogo(role) {
  return REPORTES.filter((r) => puedeVer(r, role)).map((r) => ({
    id: r.id,
    titulo: r.titulo,
    descripcion: r.descripcion,
    icono: r.icono,
    filtros: r.filtros.flatMap((f) => (f === "rango" ? ["fechaDesde", "fechaHasta"] : [f])),
    soloAdministrador: !r.roles.includes("Operador"),
  }));
}

module.exports = { REPORTES, obtenerDefinicion, puedeVer, listarCatalogo };
