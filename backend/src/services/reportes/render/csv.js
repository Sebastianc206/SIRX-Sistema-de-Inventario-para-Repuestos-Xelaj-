const JSZip = require("jszip");
const { isoFechaGT, isoFechaHoraGT, redondear2, nombreArchivo } = require("../formato");

// CSV simple: UTF-8 CON BOM (Excel en macOS/Windows lo abre con acentos
// correctos), separador coma, saltos CRLF, cifras SIN formato (punto decimal,
// sin "Q" ni separador de miles) para que Excel/Numbers las traten como
// números. Un CSV solo puede llevar una tabla: se exporta la tabla principal.
const BOM = "﻿";

function tablaPrincipal(reporte) {
  return reporte.tablas.find((t) => t.principal) ?? reporte.tablas[0];
}

// Evita inyección de fórmulas (=, +, -, @) en celdas de TEXTO.
function neutralizar(texto) {
  return /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
}

function escapar(valor) {
  const t = String(valor);
  return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

function valorCsv(valor, columna) {
  if (valor === null || valor === undefined) return "";
  switch (columna.tipo) {
    case "moneda":
      return redondear2(valor).toFixed(2);
    case "porcentaje":
      return Number(valor).toFixed(1);
    case "entero":
    case "decimal":
      return String(valor);
    case "fecha":
      return typeof valor === "string" ? valor.slice(0, 10) : isoFechaGT(new Date(valor));
    case "fechaHora":
      return isoFechaHoraGT(valor);
    case "estado":
      return neutralizar(typeof valor === "object" ? valor.texto : String(valor));
    default:
      return neutralizar(String(valor));
  }
}

function renderCsv(reporte) {
  const tabla = tablaPrincipal(reporte);
  const lineas = [tabla.columnas.map((c) => escapar(c.etiqueta)).join(",")];
  for (const fila of tabla.filas) {
    lineas.push(tabla.columnas.map((c) => escapar(valorCsv(fila[c.clave], c))).join(","));
  }
  return Buffer.from(`${BOM}${lineas.join("\r\n")}\r\n`, "utf8");
}

async function renderZipCsv(reportes, ahora = new Date()) {
  const zip = new JSZip();
  for (const r of reportes) {
    zip.file(nombreArchivo(`sirx_reporte-${r.id}`, "csv", ahora), renderCsv(r));
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

module.exports = { renderCsv, renderZipCsv, tablaPrincipal };
