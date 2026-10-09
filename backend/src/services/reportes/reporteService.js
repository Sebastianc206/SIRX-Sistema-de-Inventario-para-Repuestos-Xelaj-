const prisma = require("../../utils/prismaClient");
const { ReporteError } = require("./errores");
const { ADMIN } = require("./comun");
const { obtenerDefinicion, puedeVer, listarCatalogo } = require("./catalogo");
const { normalizarFiltros, describirFiltros } = require("./parametros");
const { nombreArchivo } = require("./formato");
const { renderPdf } = require("./render/pdf");
const { renderXlsx } = require("./render/xlsx");
const { renderCsv, renderZipCsv } = require("./render/csv");

// Límites de filas por salida. La vista previa trae pocas filas (los KPIs y
// totales siempre se calculan sobre TODO el rango, en la base); el PDF
// impone un tope más bajo porque cada fila es una página más.
const LIMITE_VISTA_PREVIA = 100;
const LIMITE_PDF = 1000;
// Presupuesto total de filas por PDF (render síncrono, bloquea el hilo): se
// reparte entre los reportes combinados para mantener < 5 s.
const PRESUPUESTO_FILAS_PDF = 1600;
const MIN_FILAS_PDF = 150;
const LIMITE_HOJA = 20000;
const MAX_REPORTES_POR_DESCARGA = 10;
const FORMATOS = {
  pdf: { contentType: "application/pdf", limite: LIMITE_PDF },
  xlsx: { contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", limite: LIMITE_HOJA },
  csv: { contentType: "text/csv; charset=utf-8", limite: LIMITE_HOJA },
};

// Defensa en profundidad: aunque cada definición ya decide qué calcula, todo
// lo marcado `sensible` (costos, márgenes, ingresos, proveedor) se elimina
// aquí para cualquier rol distinto de Administrador, y también de cada fila.
function quitarSensibles(cuerpo) {
  const tablas = cuerpo.tablas.map((tabla) => {
    const prohibidas = new Set(tabla.columnas.filter((c) => c.sensible).map((c) => c.clave));
    const quitar = (obj) => Object.fromEntries(Object.entries(obj).filter(([k]) => !prohibidas.has(k)));
    return {
      ...tabla,
      columnas: tabla.columnas.filter((c) => !c.sensible),
      filas: tabla.filas.map(quitar),
      ...(tabla.totales ? { totales: quitar(tabla.totales) } : {}),
    };
  });
  const resto = { ...cuerpo };
  delete resto.comparacion; // la comparación contra el período previo son importes
  const kpis = cuerpo.kpis
    .filter((k) => !k.sensible)
    .map((k) => {
      const copia = { ...k };
      delete copia.variacion;
      return copia;
    });
  const grafica = cuerpo.grafica && !cuerpo.grafica.sensible ? cuerpo.grafica : null;
  return { ...resto, kpis, tablas, grafica };
}

// Cada fila solo conserva las claves de columnas declaradas: nada "extra" que
// la consulta haya traído (costos, ids) llega al cliente ni a los archivos.
function proyectarColumnas(cuerpo) {
  const tablas = cuerpo.tablas.map((tabla) => {
    const claves = tabla.columnas.map((c) => c.clave);
    const proyectar = (obj) => Object.fromEntries(claves.filter((k) => k in obj).map((k) => [k, obj[k]]));
    return {
      ...tabla,
      filas: tabla.filas.map(proyectar),
      ...(tabla.totales ? { totales: proyectar(tabla.totales) } : {}),
    };
  });
  return { ...cuerpo, tablas };
}

async function nombresFiltro(filtros) {
  const [categoria, marca, conteo] = await Promise.all([
    filtros.idCategoria ? prisma.categoria.findUnique({ where: { idCategoria: filtros.idCategoria } }) : null,
    filtros.idMarca ? prisma.marca.findUnique({ where: { idMarca: filtros.idMarca } }) : null,
    filtros.idConteo ? prisma.conteoFisico.findUnique({ where: { idConteo: filtros.idConteo } }) : null,
  ]);
  if (filtros.idCategoria && !categoria) throw new ReporteError("La categoría indicada no existe", 400);
  if (filtros.idMarca && !marca) throw new ReporteError("La marca indicada no existe", 400);
  if (filtros.idConteo && !conteo) throw new ReporteError("El conteo indicado no existe", 404);
  return {
    categoria: categoria?.descripcion,
    marca: marca?.nombre,
    conteo: conteo ? `#${conteo.idConteo} ${conteo.nombre}` : undefined,
  };
}

async function nombreUsuario(usuario) {
  try {
    const col = await prisma.colaborador.findUnique({ where: { idColaborador: usuario.idColaborador } });
    if (col) return `${col.nombres} ${col.primerApel}`.trim();
  } catch (_error) {
    // Si falla la consulta, el reporte igual sale con el usuario de sesión.
  }
  return usuario.username;
}

async function generarReporte(id, query, { usuario, limite = LIMITE_VISTA_PREVIA, ahora = new Date() }) {
  const definicion = obtenerDefinicion(id);
  if (!definicion) throw new ReporteError("El reporte solicitado no existe", 404);
  if (!puedeVer(definicion, usuario.role)) {
    throw new ReporteError("No tienes permisos para este reporte", 403);
  }

  const esAdmin = usuario.role === ADMIN;
  const filtros = normalizarFiltros(definicion.filtros, query);
  const [nombres, generadoPor] = await Promise.all([nombresFiltro(filtros), nombreUsuario(usuario)]);

  const cuerpo = await definicion.ejecutar(filtros, { limite, esAdmin, ahora });
  const seguro = proyectarColumnas(esAdmin ? cuerpo : quitarSensibles(cuerpo));

  return {
    id: definicion.id,
    nombreCorto: definicion.nombreCorto,
    titulo: definicion.titulo,
    descripcion: definicion.descripcion,
    orientacion: definicion.orientacion ?? "vertical",
    generadoEn: ahora.toISOString(),
    generadoPor,
    filtrosAplicados: describirFiltros(filtros, nombres),
    ...seguro,
    tablas: seguro.tablas.map((t) => ({ ...t, truncada: t.filas.length < t.totalFilas })),
  };
}

// Vista previa en pantalla (JSON liviano: pocas filas, KPIs completos).
function generarVistaPrevia(id, query, contexto) {
  return generarReporte(id, query, { ...contexto, limite: LIMITE_VISTA_PREVIA });
}

function validarSolicitudDescarga(cuerpo) {
  if (!cuerpo || typeof cuerpo !== "object") throw new ReporteError("Solicitud inválida");
  const { formato, reportes } = cuerpo;
  if (typeof formato !== "string" || !Object.prototype.hasOwnProperty.call(FORMATOS, formato)) {
    throw new ReporteError("formato debe ser pdf, xlsx o csv");
  }
  if (!Array.isArray(reportes) || reportes.length === 0) {
    throw new ReporteError("Selecciona al menos un reporte");
  }
  if (reportes.length > MAX_REPORTES_POR_DESCARGA) {
    throw new ReporteError(`Puedes descargar hasta ${MAX_REPORTES_POR_DESCARGA} reportes a la vez`);
  }
  const vistos = new Set();
  for (const r of reportes) {
    if (!r || typeof r !== "object" || typeof r.tipo !== "string") {
      throw new ReporteError("Cada reporte debe indicar su tipo");
    }
    if (vistos.has(r.tipo)) throw new ReporteError("No repitas el mismo reporte en una descarga");
    vistos.add(r.tipo);
    if (r.filtros !== undefined && (typeof r.filtros !== "object" || r.filtros === null || Array.isArray(r.filtros))) {
      throw new ReporteError("Los filtros de cada reporte deben ser un objeto");
    }
  }
  return { formato, reportes };
}

// Genera el archivo descargable. Varios reportes: PDF/Excel salen combinados
// en un solo archivo (PDF = un reporte tras otro; Excel = un libro con hojas)
// y CSV, que no admite varias tablas, sale como un ZIP con un CSV por reporte.
async function generarDescarga(cuerpo, { usuario, ahora = new Date() }) {
  const { formato, reportes } = validarSolicitudDescarga(cuerpo);
  const { contentType } = FORMATOS[formato];
  const limite =
    formato === "pdf"
      ? Math.max(MIN_FILAS_PDF, Math.min(LIMITE_PDF, Math.floor(PRESUPUESTO_FILAS_PDF / reportes.length)))
      : FORMATOS[formato].limite;

  const generados = await Promise.all(
    reportes.map((r) => generarReporte(r.tipo, r.filtros ?? {}, { usuario, limite, ahora })),
  );

  const unico = generados.length === 1;
  let buffer;
  let extension = formato;
  let tipoContenido = contentType;

  if (formato === "pdf") {
    buffer = await renderPdf(generados);
  } else if (formato === "xlsx") {
    buffer = await renderXlsx(generados);
  } else if (unico) {
    buffer = renderCsv(generados[0]);
  } else {
    buffer = await renderZipCsv(generados, ahora);
    extension = "zip";
    tipoContenido = "application/zip";
  }

  const base = unico ? `sirx_reporte-${generados[0].id}` : formato === "csv" ? "sirx_reportes" : "sirx_reporte-combinado";
  return { buffer, contentType: tipoContenido, nombre: nombreArchivo(base, extension, ahora) };
}

module.exports = {
  LIMITE_VISTA_PREVIA,
  LIMITE_PDF,
  LIMITE_HOJA,
  MAX_REPORTES_POR_DESCARGA,
  ReporteError,
  listarCatalogo,
  generarReporte,
  generarVistaPrevia,
  generarDescarga,
  quitarSensibles,
};
