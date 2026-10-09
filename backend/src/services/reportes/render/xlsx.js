const ExcelJS = require("exceljs");
const { PALETA, argb } = require("./paleta");
const { formatoFechaHora } = require("../formato");
const { cargarLogo, PROPORCION } = require("./logo");

// Excel con formato de marca: hoja "Resumen" (filtros, KPIs y notas de cada
// reporte, pie legal) y una hoja por tabla con cabecera verde, filas zebra,
// anchos, formatos numéricos/moneda reales (las celdas son números, no
// texto), fila de encabezado congelada y autofiltro.
const LEYENDA = "Documento operativo, no constituye documento tributario.";
const FORMATO_MONEDA = '"Q" #,##0.00;[Red]-"Q" #,##0.00';
const OFFSET_GT_MS = 6 * 3_600_000;

const fuente = (opts = {}) => ({ name: "Calibri", size: 11, color: { argb: argb(PALETA.tinta) }, ...opts });
const relleno = (hex) => ({ type: "pattern", pattern: "solid", fgColor: { argb: argb(hex) } });

function nombreHoja(texto, usados) {
  const limpio = texto.replace(/[\\/*?:[\]]/g, " ").replace(/\s+/g, " ").trim();
  let nombre = limpio.slice(0, 31);
  let n = 2;
  while (usados.has(nombre.toLowerCase())) {
    const sufijo = ` (${n})`;
    nombre = `${limpio.slice(0, 31 - sufijo.length)}${sufijo}`;
    n += 1;
  }
  usados.add(nombre.toLowerCase());
  return nombre;
}

// Excel no maneja zonas horarias: se escribe la hora de Guatemala "como si"
// fuera UTC para que la celda muestre la hora local correcta.
function fechaParaExcel(valor) {
  return new Date(new Date(valor).getTime() - OFFSET_GT_MS);
}

function valorCelda(valor, columna) {
  if (valor === null || valor === undefined) return null;
  switch (columna.tipo) {
    case "moneda":
    case "entero":
    case "decimal":
      return Number(valor);
    case "porcentaje":
      return Number(valor) / 100;
    case "fecha":
    case "fechaHora":
      return fechaParaExcel(valor);
    case "estado":
      return typeof valor === "object" ? valor.texto : String(valor);
    default:
      return String(valor);
  }
}

function formatoNumero(columna) {
  switch (columna.tipo) {
    case "moneda":
      return FORMATO_MONEDA;
    case "entero":
      return columna.signo ? "+#,##0;-#,##0;0" : "#,##0";
    case "decimal":
      return "#,##0.0";
    case "porcentaje":
      return "0.0%";
    case "fecha":
      return "dd/mm/yyyy";
    case "fechaHora":
      return "dd/mm/yyyy hh:mm";
    default:
      return undefined;
  }
}

const esNumerica = (c) => ["moneda", "entero", "decimal", "porcentaje"].includes(c.tipo);

function hojaResumen(libro, reportes) {
  const hoja = libro.addWorksheet("Resumen", { views: [{ showGridLines: false }] });
  hoja.columns = [{ width: 34 }, { width: 46 }, { width: 40 }];

  hoja.mergeCells("A1:C1");
  hoja.getCell("A1").value = "Repuestos Xelajú · SIRX";
  // Logo verde a la derecha del encabezado (no toca filtros ni filas congeladas;
  // si falta el archivo se omite).
  const logo = cargarLogo("logo-rx.png");
  if (logo) {
    try {
      const idImagen = libro.addImage({ buffer: logo, extension: "png" });
      hoja.addImage(idImagen, { tl: { col: 2.5, row: 0.1 }, ext: { width: 46 * PROPORCION, height: 46 } });
    } catch {
      // sin logo
    }
  }
  hoja.getCell("A1").font = fuente({ size: 20, bold: true, color: { argb: argb(PALETA.pino700) } });
  hoja.getRow(1).height = 30;
  hoja.mergeCells("A2:C2");
  hoja.getCell("A2").value = "Sistema de inventario · Reportes";
  hoja.getCell("A2").font = fuente({ size: 11, color: { argb: argb(PALETA.neutro600) } });
  // Filete laton de marca.
  for (const col of ["A", "B", "C"]) {
    hoja.getCell(`${col}3`).border = { top: { style: "medium", color: { argb: argb(PALETA.laton) } } };
  }
  hoja.getCell("A4").value = "Generado";
  hoja.getCell("B4").value = `${formatoFechaHora(reportes[0].generadoEn)} (hora de Guatemala)`;
  hoja.getCell("A5").value = "Generado por";
  hoja.getCell("B5").value = reportes[0].generadoPor;
  for (const f of [4, 5]) hoja.getCell(`A${f}`).font = fuente({ bold: true, color: { argb: argb(PALETA.neutro600) } });

  let fila = 7;
  for (const r of reportes) {
    hoja.mergeCells(`A${fila}:C${fila}`);
    const titulo = hoja.getCell(`A${fila}`);
    titulo.value = r.titulo;
    titulo.font = fuente({ size: 13, bold: true, color: { argb: argb(PALETA.superficie) } });
    titulo.fill = relleno(PALETA.pino700);
    titulo.alignment = { vertical: "middle", indent: 1 };
    hoja.getRow(fila).height = 24;
    fila += 1;

    for (const f of r.filtrosAplicados) {
      hoja.getCell(`A${fila}`).value = f.etiqueta;
      hoja.getCell(`A${fila}`).font = fuente({ bold: true, color: { argb: argb(PALETA.neutro600) } });
      hoja.getCell(`B${fila}`).value = f.valor;
      fila += 1;
    }

    if (r.vacio) {
      hoja.getCell(`A${fila}`).value = r.vacio;
      hoja.getCell(`A${fila}`).font = fuente({ italic: true });
      fila += 1;
    }

    for (const k of r.kpis) {
      hoja.getCell(`A${fila}`).value = k.etiqueta;
      hoja.getCell(`A${fila}`).fill = relleno(PALETA.pino100);
      const celda = hoja.getCell(`B${fila}`);
      celda.fill = relleno(PALETA.pino100);
      if (k.tipo === "texto") {
        celda.value = String(k.valor);
      } else {
        celda.value = k.tipo === "porcentaje" ? Number(k.valor) / 100 : Number(k.valor);
        celda.numFmt = formatoNumero({ tipo: k.tipo });
      }
      celda.font = fuente({ bold: true, color: { argb: argb(PALETA.pino800) } });
      celda.alignment = { horizontal: "left" };
      if (k.nota || k.variacion !== undefined) {
        const extra = [k.nota, k.variacion != null ? `${k.variacion > 0 ? "+" : ""}${k.variacion.toFixed(1)}% vs período anterior` : null]
          .filter(Boolean)
          .join(" · ");
        hoja.getCell(`C${fila}`).value = extra;
        hoja.getCell(`C${fila}`).font = fuente({ size: 10, color: { argb: argb(PALETA.neutro600) } });
      }
      fila += 1;
    }

    for (const nota of r.notas ?? []) {
      hoja.mergeCells(`A${fila}:C${fila}`);
      hoja.getCell(`A${fila}`).value = nota;
      hoja.getCell(`A${fila}`).font = fuente({ size: 10, italic: true, color: { argb: argb(PALETA.neutro600) } });
      hoja.getCell(`A${fila}`).alignment = { wrapText: true, vertical: "top" };
      hoja.getRow(fila).height = nota.length > 110 ? 28 : 16;
      fila += 1;
    }
    fila += 1;
  }

  hoja.mergeCells(`A${fila}:C${fila}`);
  hoja.getCell(`A${fila}`).value = LEYENDA;
  hoja.getCell(`A${fila}`).font = fuente({ size: 10, bold: true, color: { argb: argb(PALETA.neutro600) } });
  return hoja;
}

function hojaTabla(libro, nombre, reporte, tabla) {
  const hoja = libro.addWorksheet(nombre, { views: [{ state: "frozen", ySplit: 1, showGridLines: false }] });
  hoja.properties.tabColor = { argb: argb(PALETA.pino600) };

  hoja.columns = tabla.columnas.map((c) => ({
    key: c.clave,
    width: Math.min(46, Math.max(10, Math.round((c.ancho ?? 60) / 5.2))),
  }));

  const cab = hoja.getRow(1);
  tabla.columnas.forEach((c, i) => {
    const celda = cab.getCell(i + 1);
    celda.value = c.etiqueta;
    celda.font = fuente({ bold: true, color: { argb: argb(PALETA.superficie) } });
    celda.fill = relleno(PALETA.pino700);
    celda.alignment = { vertical: "middle", horizontal: esNumerica(c) ? "right" : "left", wrapText: true };
    celda.border = { bottom: { style: "medium", color: { argb: argb(PALETA.laton) } } };
  });
  cab.height = 30;

  tabla.filas.forEach((fila, idx) => {
    const row = hoja.getRow(idx + 2);
    tabla.columnas.forEach((c, i) => {
      const celda = row.getCell(i + 1);
      celda.value = valorCelda(fila[c.clave], c);
      celda.font = fuente({ size: 10.5 });
      const fmt = formatoNumero(c);
      if (fmt) celda.numFmt = fmt;
      celda.alignment = { vertical: "middle", horizontal: esNumerica(c) ? "right" : "left" };
      if (idx % 2 === 1) celda.fill = relleno(PALETA.papel);
      if (c.tipo === "estado" && fila[c.clave] && typeof fila[c.clave] === "object") {
        const tono = PALETA[fila[c.clave].tono] ?? PALETA.neutral;
        celda.fill = relleno(tono.bg);
        celda.font = fuente({ size: 10.5, bold: true, color: { argb: argb(tono.text) } });
      }
    });
  });

  let ultima = tabla.filas.length + 1;
  if (tabla.totales) {
    ultima += 1;
    const row = hoja.getRow(ultima);
    tabla.columnas.forEach((c, i) => {
      const celda = row.getCell(i + 1);
      celda.value = valorCelda(tabla.totales[c.clave], c);
      celda.font = fuente({ bold: true, color: { argb: argb(PALETA.pino800) } });
      const fmt = formatoNumero(c);
      if (fmt) celda.numFmt = fmt;
      celda.fill = relleno(PALETA.pino100);
      celda.alignment = { horizontal: esNumerica(c) ? "right" : "left" };
      celda.border = { top: { style: "thin", color: { argb: argb(PALETA.pino600) } } };
    });
  }

  if (tabla.filas.length > 0) {
    hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: tabla.filas.length + 1, column: tabla.columnas.length } };
  }

  if (tabla.truncada) {
    const row = hoja.getRow(ultima + 2);
    row.getCell(1).value = `Se muestran ${tabla.filas.length} de ${tabla.totalFilas} filas (límite de exportación).`;
    row.getCell(1).font = fuente({ italic: true, size: 10, color: { argb: argb(PALETA.neutro600) } });
  }
  return hoja;
}

async function renderXlsx(reportes) {
  const libro = new ExcelJS.Workbook();
  libro.creator = "SIRX · Repuestos Xelajú";
  libro.created = new Date(reportes[0].generadoEn);
  libro.title = reportes.length === 1 ? reportes[0].titulo : "Reportes SIRX";

  hojaResumen(libro, reportes);

  const usados = new Set(["resumen"]);
  for (const r of reportes) {
    r.tablas.forEach((tabla) => {
      const nombre = tabla.principal && r.tablas.length === 1 ? r.nombreCorto : `${r.nombreCorto} - ${tabla.id}`;
      hojaTabla(libro, nombreHoja(nombre, usados), r, tabla);
    });
  }

  const salida = await libro.xlsx.writeBuffer();
  return Buffer.from(salida);
}

module.exports = { renderXlsx };
