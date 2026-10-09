// Formato compartido por los tres renderers (PDF/Excel/CSV) y las vistas
// previas: moneda en quetzales (Q 1,234.50), enteros con separador de miles
// y fechas/horas en hora de Guatemala (UTC-6, sin horario de verano).

const ZONA = "America/Guatemala";
const OFFSET_GT = "-06:00";

function redondear2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function conMiles(n, decimales) {
  return Number(n).toLocaleString("en-US", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

function formatoMoneda(n) {
  const v = redondear2(n);
  return `${v < 0 ? "-" : ""}Q ${conMiles(Math.abs(v), 2)}`;
}

function formatoEntero(n, { signo = false } = {}) {
  const v = Math.round(Number(n));
  return `${signo && v > 0 ? "+" : ""}${conMiles(v, 0)}`;
}

function formatoDecimal(n) {
  return conMiles(n, 1);
}

function formatoPorcentaje(n) {
  return `${conMiles(n, 1)}%`;
}

function partesGT(fecha) {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(fecha);
  const mapa = {};
  for (const p of partes) mapa[p.type] = p.value;
  return mapa;
}

// "YYYY-MM-DD" del día de Guatemala en que cae `fecha`.
function isoFechaGT(fecha = new Date()) {
  const p = partesGT(fecha);
  return `${p.year}-${p.month}-${p.day}`;
}

// "08/10/2026" desde un Date o un "YYYY-MM-DD".
function formatoFecha(valor) {
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [a, m, d] = valor.split("-");
    return `${d}/${m}/${a}`;
  }
  const p = partesGT(new Date(valor));
  return `${p.day}/${p.month}/${p.year}`;
}

// "08/10/2026 14:32" (hora de Guatemala).
function formatoFechaHora(valor) {
  const p = partesGT(new Date(valor));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

// "2026-10-08 14:32" para CSV (ordenable y sin ambigüedad de locale).
function isoFechaHoraGT(valor) {
  const p = partesGT(new Date(valor));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

function textoCelda(valor, tipo, { signo = false } = {}) {
  if (valor === null || valor === undefined || valor === "") return "—";
  switch (tipo) {
    case "moneda":
      return formatoMoneda(valor);
    case "entero":
      return formatoEntero(valor, { signo });
    case "decimal":
      return formatoDecimal(valor);
    case "porcentaje":
      return formatoPorcentaje(valor);
    case "fecha":
      return formatoFecha(valor);
    case "fechaHora":
      return formatoFechaHora(valor);
    case "estado":
      return typeof valor === "object" ? valor.texto : String(valor);
    default:
      return String(valor);
  }
}

// Nombre de archivo: <base>_<YYYY-MM-DD>.<ext> (fecha de Guatemala).
function nombreArchivo(base, extension, fecha = new Date()) {
  return `${base}_${isoFechaGT(fecha)}.${extension}`;
}

module.exports = {
  ZONA,
  OFFSET_GT,
  redondear2,
  formatoMoneda,
  formatoEntero,
  formatoDecimal,
  formatoPorcentaje,
  isoFechaGT,
  formatoFecha,
  formatoFechaHora,
  isoFechaHoraGT,
  textoCelda,
  nombreArchivo,
};
