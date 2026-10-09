const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { PALETA } = require("./paleta");
const { cargarLogo, PROPORCION } = require("./logo");
const {
  textoCelda,
  formatoMoneda,
  formatoEntero,
  formatoPorcentaje,
  formatoFechaHora,
} = require("../formato");

// PDF de marca generado en el servidor con pdfkit (JS puro, sin navegador
// headless ni binarios). Tamaño carta (Guatemala), Barlow para títulos y
// cifras e Inter para texto y tablas, ambas incrustadas desde @fontsource
// (subconjunto latino: cubre español). Todo es vectorial: tablas, tarjetas
// KPI y gráficas, sin imágenes.
const LEYENDA = "Documento operativo, no constituye documento tributario.";
const NUM = { features: ["tnum"] };

const FUENTES = {
  Inter: ["inter", "inter-latin-400-normal.woff"],
  "Inter-SB": ["inter", "inter-latin-600-normal.woff"],
  "Inter-B": ["inter", "inter-latin-700-normal.woff"],
  "Barlow-M": ["barlow", "barlow-latin-500-normal.woff"],
  "Barlow-SB": ["barlow", "barlow-latin-600-normal.woff"],
  "Barlow-B": ["barlow", "barlow-latin-700-normal.woff"],
};

const cacheFuentes = new Map();
function cargarFuente(clave) {
  if (!cacheFuentes.has(clave)) {
    const [paquete, archivo] = FUENTES[clave];
    const raiz = path.dirname(require.resolve(`@fontsource/${paquete}/package.json`));
    cacheFuentes.set(clave, fs.readFileSync(path.join(raiz, "files", archivo)));
  }
  return cacheFuentes.get(clave);
}

// Geometría (puntos PDF; 1 pt = 1/72 in).
const MARGEN_V = { top: 62, bottom: 54 };
const BANDA_ALTO = 76;
const ALTO_CONT = 62; // y inicial del contenido en páginas de continuación

function crearContexto(doc) {
  return { doc, y: 0, pagina: null, paginas: [] };
}

function geometria(orientacion) {
  const horizontal = orientacion === "horizontal";
  const lados = horizontal ? 36 : 40;
  return {
    layout: horizontal ? "landscape" : "portrait",
    margins: { top: MARGEN_V.top, bottom: MARGEN_V.bottom, left: lados, right: lados },
    lados,
  };
}

function nuevaPagina(ctx, reporte, primera) {
  const g = geometria(reporte.orientacion);
  ctx.doc.addPage({ size: "LETTER", layout: g.layout, margins: g.margins });
  ctx.W = ctx.doc.page.width;
  ctx.H = ctx.doc.page.height;
  ctx.x = g.lados;
  ctx.ancho = ctx.W - g.lados * 2;
  ctx.limiteY = ctx.H - MARGEN_V.bottom - 2;
  ctx.y = primera ? 0 : ALTO_CONT;
  ctx.paginas.push({ cont: !primera, titulo: reporte.titulo, lados: g.lados });
}

function asegurarEspacio(ctx, reporte, alto) {
  if (ctx.y + alto > ctx.limiteY) nuevaPagina(ctx, reporte, false);
}

// Reduce el cuerpo de letra hasta que `texto` quepa en `ancho`.
function ajustar(doc, texto, fuente, max, min, ancho, opts = {}) {
  let size = max;
  doc.font(fuente);
  while (size > min && doc.fontSize(size).widthOfString(texto, opts) > ancho) size -= 0.5;
  return size;
}

// ---------------------------------------------------------------------
// Encabezado de la primera página de cada reporte
// ---------------------------------------------------------------------
function dibujarEncabezado(ctx, reporte) {
  const { doc, W, x, ancho } = ctx;

  doc.rect(0, 0, W, BANDA_ALTO).fill(PALETA.pino800);
  // Detalle de marca: filete latón (único acento).
  doc.rect(0, BANDA_ALTO, W, 2.5).fill(PALETA.laton);
  doc.rect(x, 17, 26, 3).fill(PALETA.laton);

  // Logo blanco sobre la banda verde, a la derecha (si falta el archivo, se omite).
  let anchoLogo = 0;
  const logo = cargarLogo("logo-rx-blanco.png");
  if (logo) {
    const altoLogo = 46;
    anchoLogo = altoLogo * PROPORCION;
    try {
      doc.image(logo, x + ancho - anchoLogo, (BANDA_ALTO - altoLogo) / 2, { width: anchoLogo, height: altoLogo });
    } catch {
      anchoLogo = 0;
    }
  }
  const anchoTitulo = ancho - (anchoLogo ? anchoLogo + 14 : 0);

  doc.font("Barlow-SB").fontSize(9.5).fillColor(PALETA.pino200);
  doc.text("REPUESTOS XELAJÚ · SIRX", x, 24, { characterSpacing: 1.6, lineBreak: false });
  doc.font("Barlow-B").fontSize(ajustar(doc, reporte.titulo, "Barlow-B", 27, 17, anchoTitulo - 4)).fillColor(PALETA.superficie);
  doc.text(reporte.titulo, x, 38, { width: anchoTitulo, lineBreak: false });

  let y = BANDA_ALTO + 16;
  const colDerX = x + ancho - 178;
  const anchoIzq = ancho - 190;

  // Filtros aplicados (izquierda).
  let yIzq = y;
  for (const f of reporte.filtrosAplicados) {
    doc.font("Inter-SB").fontSize(8).fillColor(PALETA.neutro600);
    const etiqueta = `${f.etiqueta}: `;
    doc.text(etiqueta, x, yIzq, { lineBreak: false });
    const wEt = doc.widthOfString(etiqueta);
    doc.font("Inter").fontSize(8.5).fillColor(PALETA.tinta);
    doc.text(f.valor, x + wEt, yIzq - 0.3, { width: anchoIzq - wEt, lineBreak: false, ellipsis: true });
    yIzq += 12.5;
  }
  if (reporte.filtrosAplicados.length === 0) {
    doc.font("Inter").fontSize(8.5).fillColor(PALETA.neutro600);
    doc.text("Sin filtros: inventario completo al momento de generar.", x, yIzq, { lineBreak: false });
    yIzq += 12.5;
  }

  // Datos de generación (derecha).
  const datos = [
    ["Generado", formatoFechaHora(reporte.generadoEn)],
    ["Por", reporte.generadoPor],
  ];
  let yDer = y;
  for (const [etiqueta, valor] of datos) {
    doc.font("Inter-SB").fontSize(8).fillColor(PALETA.neutro600);
    doc.text(`${etiqueta}: `, colDerX, yDer, { lineBreak: false });
    const wEt = doc.widthOfString(`${etiqueta}: `);
    doc.font("Inter").fontSize(8.5).fillColor(PALETA.tinta);
    doc.text(valor, colDerX + wEt, yDer - 0.3, { width: 178 - wEt, lineBreak: false, ellipsis: true });
    yDer += 12.5;
  }

  ctx.y = Math.max(yIzq, yDer) + 8;
}

// ---------------------------------------------------------------------
// Tarjetas KPI
// ---------------------------------------------------------------------
function textoKpi(k) {
  switch (k.tipo) {
    case "moneda":
      return formatoMoneda(k.valor);
    case "entero":
      return formatoEntero(k.valor);
    case "porcentaje":
      return formatoPorcentaje(k.valor);
    default:
      return String(k.valor);
  }
}

function dibujarKpis(ctx, reporte) {
  const { doc, x, ancho } = ctx;
  const kpis = reporte.kpis;
  if (kpis.length === 0) return;
  const porFila = kpis.length <= 5 ? kpis.length : 4;
  const hueco = 8;
  const w = (ancho - hueco * (porFila - 1)) / porFila;
  const alto = 56;

  for (let i = 0; i < kpis.length; i += porFila) {
    asegurarEspacio(ctx, reporte, alto + 6);
    kpis.slice(i, i + porFila).forEach((k, j) => {
      const cx = x + j * (w + hueco);
      const cy = ctx.y;
      doc.roundedRect(cx, cy, w, alto, 4).fillAndStroke(PALETA.papel, PALETA.borde);
      doc.rect(cx, cy + 6, 3, alto - 12).fill(PALETA.pino600);

      doc.font("Inter-SB").fillColor(PALETA.neutro600);
      doc.fontSize(ajustar(doc, k.etiqueta, "Inter-SB", 7.5, 6, w - 16));
      doc.text(k.etiqueta, cx + 11, cy + 8, { width: w + 20, lineBreak: false });

      const valor = textoKpi(k);
      const size = ajustar(doc, valor, "Barlow-B", 19, 10, w - 18, NUM);
      doc.font("Barlow-B").fontSize(size).fillColor(PALETA.pino800);
      doc.text(valor, cx + 11, cy + 20, { width: w - 16, lineBreak: false, ...NUM });

      const extra = [];
      if (k.variacion !== undefined && k.variacion !== null) {
        extra.push(`${k.variacion > 0 ? "+" : ""}${k.variacion.toFixed(1)}% vs período anterior`);
      } else if (k.variacion === null) {
        extra.push("Período previo sin ventas");
      }
      if (k.nota) extra.push(k.nota);
      if (extra.length) {
        doc.font("Inter").fontSize(7).fillColor(PALETA.neutro600);
        doc.text(extra.join(" · "), cx + 11, cy + 43, { width: w - 16, lineBreak: false, ellipsis: true });
      }
    });
    ctx.y += alto + 8;
  }
}

// ---------------------------------------------------------------------
// Gráficas vectoriales
// ---------------------------------------------------------------------
function tituloSeccion(ctx, texto, derecha) {
  const { doc, x, ancho } = ctx;
  doc.font("Barlow-SB").fontSize(11.5).fillColor(PALETA.pino700);
  doc.text(texto, x, ctx.y, { width: ancho, lineBreak: false });
  if (derecha) {
    doc.font("Inter").fontSize(7.5).fillColor(PALETA.neutro600);
    doc.text(derecha, x, ctx.y + 3, { width: ancho, align: "right", lineBreak: false });
  }
  ctx.y += 17;
}

function formatoValor(valor, formato) {
  return formato === "moneda" ? formatoMoneda(valor) : formatoEntero(valor);
}

function graficaBarras(ctx, reporte, g) {
  const { doc, x, ancho } = ctx;
  const items = g.items;
  const filaAlto = 15.5;
  asegurarEspacio(ctx, reporte, 20 + items.length * filaAlto + 6);
  tituloSeccion(ctx, g.titulo);

  const wEtiqueta = Math.min(190, ancho * 0.36);
  const wValor = 78;
  const wBarra = ancho - wEtiqueta - wValor - 8;
  const max = Math.max(...items.map((i) => Math.abs(i.valor)), 1);

  items.forEach((it, i) => {
    const y = ctx.y + i * filaAlto;
    doc.font("Inter").fontSize(8).fillColor(PALETA.tinta);
    doc.text(it.etiqueta, x, y + 3, { width: wEtiqueta - 8, lineBreak: false, ellipsis: true });
    // Pista suave detrás de la barra.
    doc.rect(x + wEtiqueta, y + 2, wBarra, 10).fill(PALETA.neutro200);
    const largo = Math.max((Math.abs(it.valor) / max) * wBarra, it.valor === 0 ? 0 : 1.5);
    doc.rect(x + wEtiqueta, y + 2, largo, 10).fill(it.valor < 0 ? PALETA.bad.mid : PALETA.pino600);
    doc.font("Inter-SB").fontSize(8).fillColor(PALETA.tinta);
    doc.text(formatoValor(it.valor, g.formato), x + wEtiqueta + wBarra + 6, y + 3, {
      width: wValor,
      lineBreak: false,
      ...NUM,
    });
  });
  ctx.y += items.length * filaAlto + 8;
}

function graficaLinea(ctx, reporte, g) {
  const { doc, x, ancho } = ctx;
  const items = g.items;
  const alto = 112;
  asegurarEspacio(ctx, reporte, 20 + alto + 24);
  tituloSeccion(ctx, g.titulo);

  const izq = 62;
  const px = x + izq;
  const pw = ancho - izq - 8;
  const py = ctx.y + 4;
  const max = Math.max(...items.map((i) => i.valor), 1);

  // Cuadrícula + etiquetas del eje Y.
  [0, 0.5, 1].forEach((f) => {
    const gy = py + alto - f * alto;
    doc.moveTo(px, gy).lineTo(px + pw, gy).lineWidth(f === 0 ? 0.9 : 0.4);
    if (f !== 0) doc.dash(2, { space: 2 });
    doc.stroke(f === 0 ? PALETA.neutro500 : PALETA.borde);
    doc.undash();
    doc.font("Inter").fontSize(7).fillColor(PALETA.neutro600);
    doc.text(formatoValor(max * f, g.formato), x, gy - 3.5, { width: izq - 6, align: "right", lineBreak: false, ...NUM });
  });

  const n = items.length;
  const paso = n > 1 ? pw / (n - 1) : 0;
  const puntos = items.map((it, i) => [n > 1 ? px + i * paso : px + pw / 2, py + alto - (it.valor / max) * alto]);

  if (n > 1) {
    doc.moveTo(puntos[0][0], py + alto);
    puntos.forEach(([ax, ay]) => doc.lineTo(ax, ay));
    doc.lineTo(puntos[n - 1][0], py + alto).closePath().fill(PALETA.pino100);
    doc.moveTo(puntos[0][0], puntos[0][1]);
    puntos.slice(1).forEach(([ax, ay]) => doc.lineTo(ax, ay));
    doc.lineWidth(1.6).lineJoin("round").stroke(PALETA.pino600);
  }
  if (n <= 31) puntos.forEach(([ax, ay]) => doc.circle(ax, ay, 2).fill(PALETA.pino700));

  // Etiquetas del eje X (aprox. 8 visibles).
  const cada = Math.max(1, Math.ceil(n / 8));
  doc.font("Inter").fontSize(7).fillColor(PALETA.neutro600);
  items.forEach((it, i) => {
    if (i % cada !== 0 && i !== n - 1) return;
    if (i === n - 1 && i % cada !== 0 && (i - Math.floor(i / cada) * cada) < cada * 0.6) return;
    const lx = puntos[i][0];
    doc.text(it.etiqueta, lx - 28, py + alto + 5, { width: 56, align: "center", lineBreak: false });
  });
  ctx.y = py + alto + 22;
}

// ---------------------------------------------------------------------
// Tablas
// ---------------------------------------------------------------------
const TAM_TABLA = 8;
const PAD = 4;

function alineacion(col) {
  return ["moneda", "entero", "decimal", "porcentaje"].includes(col.tipo) ? "right" : "left";
}

function anchosColumnas(columnas, ancho) {
  const total = columnas.reduce((a, c) => a + (c.ancho ?? 60), 0);
  return columnas.map((c) => ((c.ancho ?? 60) / total) * ancho);
}

function lineasDeTexto(doc, texto, w, maxLineas) {
  doc.font("Inter").fontSize(TAM_TABLA);
  const alto = doc.heightOfString(texto, { width: w });
  const lh = doc.currentLineHeight();
  return Math.max(1, Math.min(maxLineas, Math.round(alto / lh)));
}

function dibujarCabeceraTabla(ctx, columnas, anchos) {
  const { doc, x, ancho } = ctx;
  doc.font("Inter-B").fontSize(7.5);
  const lh = doc.currentLineHeight();
  const lineas = Math.max(
    ...columnas.map((c, i) => {
      const h = doc.heightOfString(c.etiqueta, { width: anchos[i] - PAD * 2 });
      return Math.min(2, Math.max(1, Math.round(h / lh)));
    }),
  );
  const alto = lineas * lh + 9;
  doc.rect(x, ctx.y, ancho, alto).fill(PALETA.pino700);
  doc.rect(x, ctx.y + alto - 1.2, ancho, 1.2).fill(PALETA.pino900);
  let cx = x;
  columnas.forEach((c, i) => {
    doc.font("Inter-B").fontSize(7.5).fillColor(PALETA.superficie);
    doc.text(c.etiqueta, cx + PAD, ctx.y + 4.5, {
      width: anchos[i] - PAD * 2,
      height: lineas * lh,
      align: alineacion(c),
      ellipsis: true,
    });
    cx += anchos[i];
  });
  ctx.y += alto;
}

function dibujarBadge(doc, celda, x, y, wMax, rowH) {
  const tono = PALETA[celda.tono] ?? PALETA.neutral;
  const size = ajustar(doc, celda.texto, "Inter-B", 7, 5.5, wMax - 18);
  doc.font("Inter-B").fontSize(size);
  const w = Math.min(wMax, doc.widthOfString(celda.texto) + 17);
  const h = 11.5;
  const by = y + (rowH - h) / 2;
  doc.roundedRect(x, by, w, h, 5.75).fillAndStroke(tono.bg, tono.mid);
  doc.circle(x + 6, by + h / 2, 2).fill(tono.mid);
  doc.fillColor(tono.text).text(celda.texto, x + 11, by + (h - doc.currentLineHeight()) / 2 + 0.3, { lineBreak: false });
}

function dibujarFila(ctx, tabla, anchos, fila, altoFila, idx, esTotal) {
  const { doc, x, ancho } = ctx;
  if (esTotal) {
    doc.rect(x, ctx.y, ancho, altoFila).fill(PALETA.pino100);
    doc.rect(x, ctx.y, ancho, 1).fill(PALETA.pino600);
  } else if (idx % 2 === 1) {
    doc.rect(x, ctx.y, ancho, altoFila).fill(PALETA.papel);
  }

  let cx = x;
  tabla.columnas.forEach((c, i) => {
    const w = anchos[i] - PAD * 2;
    const valor = fila[c.clave];
    const texto = textoCelda(valor, c.tipo, { signo: c.signo });
    const fuente = esTotal ? "Inter-B" : "Inter";
    const alinear = alineacion(c);

    if (c.tipo === "estado" && valor && typeof valor === "object" && !esTotal) {
      dibujarBadge(doc, valor, cx + PAD, ctx.y, w, altoFila);
    } else if (c.tipo === "texto") {
      doc.font(fuente).fontSize(TAM_TABLA).fillColor(PALETA.tinta);
      const lh = doc.currentLineHeight();
      const lineas = lineasDeTexto(doc, texto, w, 2);
      doc.text(texto, cx + PAD, ctx.y + (altoFila - lineas * lh) / 2 + 0.4, {
        width: w,
        height: lineas * lh,
        ellipsis: true,
        align: alinear,
      });
    } else {
      const size = ajustar(doc, texto, fuente, TAM_TABLA, 5.5, w, NUM);
      doc.font(fuente).fontSize(size).fillColor(valor !== null && valor < 0 && c.tipo !== "texto" ? PALETA.bad.text : PALETA.tinta);
      doc.text(texto, cx + PAD, ctx.y + (altoFila - doc.currentLineHeight()) / 2 + 0.4, {
        width: w,
        lineBreak: false,
        align: alinear,
        ...NUM,
      });
    }
    cx += anchos[i];
  });
  ctx.y += altoFila;
}

function altoFilaCalculado(doc, tabla, anchos, fila) {
  doc.font("Inter").fontSize(TAM_TABLA);
  const lh = doc.currentLineHeight();
  let lineas = 1;
  tabla.columnas.forEach((c, i) => {
    if (c.tipo !== "texto") return;
    const texto = textoCelda(fila[c.clave], c.tipo);
    lineas = Math.max(lineas, lineasDeTexto(doc, texto, anchos[i] - PAD * 2, 2));
  });
  return Math.max(17, lineas * lh + 7);
}

function dibujarTabla(ctx, reporte, tabla) {
  const { doc, x, ancho } = ctx;
  const anchos = anchosColumnas(tabla.columnas, ancho);

  asegurarEspacio(ctx, reporte, 17 + 24 + 17 * 2);
  tituloSeccion(ctx, tabla.titulo, `${tabla.totalFilas.toLocaleString("en-US")} fila${tabla.totalFilas === 1 ? "" : "s"}`);
  dibujarCabeceraTabla(ctx, tabla.columnas, anchos);

  if (tabla.filas.length === 0) {
    doc.font("Inter").fontSize(8.5).fillColor(PALETA.neutro600);
    doc.text("Sin registros.", x + PAD, ctx.y + 6, { lineBreak: false });
    ctx.y += 22;
  }

  tabla.filas.forEach((fila, idx) => {
    const alto = altoFilaCalculado(doc, tabla, anchos, fila);
    if (ctx.y + alto > ctx.limiteY) {
      nuevaPagina(ctx, reporte, false);
      dibujarCabeceraTabla(ctx, tabla.columnas, anchos);
    }
    dibujarFila(ctx, tabla, anchos, fila, alto, idx, false);
  });

  if (tabla.totales) {
    const alto = 19;
    if (ctx.y + alto > ctx.limiteY) {
      nuevaPagina(ctx, reporte, false);
      dibujarCabeceraTabla(ctx, tabla.columnas, anchos);
    }
    dibujarFila(ctx, tabla, anchos, tabla.totales, alto, 0, true);
  }

  doc.moveTo(x, ctx.y).lineTo(x + ancho, ctx.y).lineWidth(0.6).stroke(PALETA.pino600);
  ctx.y += 6;

  if (tabla.truncada) {
    asegurarEspacio(ctx, reporte, 14);
    doc.font("Inter").fontSize(7.5).fillColor(PALETA.neutro600);
    doc.text(
      `Se muestran las primeras ${tabla.filas.length.toLocaleString("en-US")} de ${tabla.totalFilas.toLocaleString("en-US")} filas. Usa el filtro de fechas o categoría para acotar, o descarga el Excel.`,
      x,
      ctx.y,
      { width: ancho, lineBreak: false, ellipsis: true },
    );
    ctx.y += 12;
  }
  ctx.y += 10;
}

function dibujarNotas(ctx, reporte) {
  const { doc, x, ancho } = ctx;
  if (!reporte.notas?.length) return;
  doc.font("Inter").fontSize(7.5);
  const alto = reporte.notas.reduce((a, n) => a + doc.heightOfString(n, { width: ancho - 10 }) + 3, 0) + 18;
  asegurarEspacio(ctx, reporte, alto);
  tituloSeccion(ctx, "Notas");
  reporte.notas.forEach((nota) => {
    doc.font("Inter").fontSize(7.5).fillColor(PALETA.neutro600);
    const h = doc.heightOfString(nota, { width: ancho - 10 });
    doc.circle(x + 2.5, ctx.y + 4, 1.1).fill(PALETA.neutro500);
    doc.fillColor(PALETA.neutro600).text(nota, x + 10, ctx.y, { width: ancho - 10 });
    ctx.y += h + 3;
  });
}

function dibujarVacio(ctx, reporte) {
  const { doc, x, ancho } = ctx;
  asegurarEspacio(ctx, reporte, 70);
  doc.roundedRect(x, ctx.y, ancho, 54, 5).fillAndStroke(PALETA.papel, PALETA.borde);
  doc.rect(x, ctx.y + 6, 3, 42).fill(PALETA.laton);
  doc.font("Barlow-SB").fontSize(12).fillColor(PALETA.pino700);
  doc.text("Sin datos para este reporte", x + 14, ctx.y + 12, { lineBreak: false });
  doc.font("Inter").fontSize(8.5).fillColor(PALETA.neutro600);
  doc.text(reporte.vacio, x + 14, ctx.y + 30, { width: ancho - 28, lineBreak: false, ellipsis: true });
  ctx.y += 66;
}

// ---------------------------------------------------------------------
// Pie y cabecera corrida (se dibujan al final, cuando se conoce el total)
// ---------------------------------------------------------------------
function decorarPaginas(ctx, generadoEn, generadoPor) {
  const { doc } = ctx;
  const rango = doc.bufferedPageRange();
  for (let i = 0; i < rango.count; i += 1) {
    doc.switchToPage(rango.start + i);
    const meta = ctx.paginas[i];
    const W = doc.page.width;
    const H = doc.page.height;
    const x = meta.lados;
    const ancho = W - meta.lados * 2;
    // Escribir en el margen inferior no debe disparar una página nueva.
    doc.page.margins.bottom = 0;
    doc.page.margins.top = 0;

    if (meta.cont) {
      doc.font("Barlow-SB").fontSize(9.5).fillColor(PALETA.pino700);
      doc.text("REPUESTOS XELAJÚ · SIRX", x, 26, { characterSpacing: 1.2, lineBreak: false });
      doc.font("Inter").fontSize(8).fillColor(PALETA.neutro600);
      doc.text(meta.titulo, x, 27, { width: ancho, align: "right", lineBreak: false });
      doc.moveTo(x, 42).lineTo(x + ancho, 42).lineWidth(0.8).stroke(PALETA.pino600);
      doc.rect(x, 41, 26, 2.4).fill(PALETA.laton);
    }

    const yPie = H - 40;
    doc.moveTo(x, yPie).lineTo(x + ancho, yPie).lineWidth(0.5).stroke(PALETA.borde);
    doc.font("Inter-SB").fontSize(7.2).fillColor(PALETA.neutro700);
    doc.text(LEYENDA, x, yPie + 6, { width: ancho - 90, lineBreak: false });
    doc.font("Inter").fontSize(6.8).fillColor(PALETA.neutro600);
    doc.text(
      `SIRX · Repuestos Xelajú · Generado ${formatoFechaHora(generadoEn)} por ${generadoPor}`,
      x,
      yPie + 17,
      { width: ancho - 90, lineBreak: false, ellipsis: true },
    );
    doc.font("Inter-SB").fontSize(8).fillColor(PALETA.neutro700);
    doc.text(`Página ${i + 1} de ${rango.count}`, x + ancho - 90, yPie + 6, {
      width: 90,
      align: "right",
      lineBreak: false,
      ...NUM,
    });
  }
}

function dibujarReporte(ctx, reporte) {
  nuevaPagina(ctx, reporte, true);
  dibujarEncabezado(ctx, reporte);
  dibujarKpis(ctx, reporte);

  if (reporte.vacio) {
    dibujarVacio(ctx, reporte);
  } else {
    if (reporte.grafica?.items?.length && reporte.grafica.items.some((i) => i.valor !== 0)) {
      if (reporte.grafica.tipo === "linea") graficaLinea(ctx, reporte, reporte.grafica);
      else graficaBarras(ctx, reporte, reporte.grafica);
      ctx.y += 4;
    }
    for (const tabla of reporte.tablas) dibujarTabla(ctx, reporte, tabla);
  }
  dibujarNotas(ctx, reporte);
}

function renderPdf(reportes) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        autoFirstPage: false,
        bufferPages: true,
        size: "LETTER",
        info: {
          Title: reportes.length === 1 ? reportes[0].titulo : "Reportes SIRX",
          Author: "SIRX · Repuestos Xelajú",
          Subject: reportes.map((r) => r.titulo).join(", "),
          Creator: "SIRX",
          Producer: "SIRX (pdfkit)",
        },
      });
      for (const clave of Object.keys(FUENTES)) doc.registerFont(clave, cargarFuente(clave));

      const trozos = [];
      doc.on("data", (t) => trozos.push(t));
      doc.on("end", () => resolve(Buffer.concat(trozos)));
      doc.on("error", reject);

      const ctx = crearContexto(doc);
      for (const reporte of reportes) dibujarReporte(ctx, reporte);
      decorarPaginas(ctx, reportes[0].generadoEn, reportes[0].generadoPor);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { renderPdf };
