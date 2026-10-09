const { ReporteError } = require("./errores");
const { OFFSET_GT, isoFechaGT, formatoFecha } = require("./formato");

// Validación estricta de los filtros de reportes. Cada definición declara
// qué filtros acepta (`filtros: [...]`); el resto de parámetros de la
// consulta se ignora. Todo lo que llega es texto (query string o JSON), así
// que se valida formato Y rango antes de tocar la base.

const DIA_MS = 86_400_000;
const MAX_DIAS_RANGO = 366;
const TOP_POR_DEFECTO = 20;
const TOP_MAXIMO = 100;
const VENTANAS = [30, 60, 90];
const AGRUPACIONES = ["dia", "semana", "mes"];
const AGRUPAR_POR = ["producto", "categoria"];
const TIPOS_MOVIMIENTO = ["todos", "compras", "ventas", "ajustes"];
const ORDENES = ["unidades", "ingreso"];
const ISO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

function aFechaGT(iso, nombre) {
  if (typeof iso !== "string" || !ISO_FECHA.test(iso)) {
    throw new ReporteError(`${nombre} debe tener formato AAAA-MM-DD`);
  }
  const fecha = new Date(`${iso}T00:00:00${OFFSET_GT}`);
  // Rechaza fechas "normalizadas" (2026-02-31 -> 2026-03-03).
  if (Number.isNaN(fecha.getTime()) || isoFechaGT(fecha) !== iso) {
    throw new ReporteError(`${nombre} no es una fecha válida`);
  }
  return fecha;
}

function sumarDias(fecha, dias) {
  return new Date(fecha.getTime() + dias * DIA_MS);
}

function enteroPositivo(valor, nombre) {
  if (typeof valor !== "string" && typeof valor !== "number") {
    throw new ReporteError(`${nombre} no es válido`);
  }
  const texto = String(valor).trim();
  if (!/^\d{1,9}$/.test(texto) || Number(texto) < 1) {
    throw new ReporteError(`${nombre} debe ser un entero positivo`);
  }
  return Number(texto);
}

// Rango [desde, hasta) con `hasta` exclusivo = medianoche del día siguiente
// a fechaHasta (en hora de Guatemala). Por defecto: últimos 30 días.
function resolverRango({ fechaDesde, fechaHasta }, hoy = new Date()) {
  const hastaISO = fechaHasta ?? isoFechaGT(hoy);
  const hastaDia = aFechaGT(hastaISO, "fechaHasta");
  const desdeISO = fechaDesde ?? isoFechaGT(sumarDias(hastaDia, -29));
  const desdeDia = aFechaGT(desdeISO, "fechaDesde");

  if (desdeDia > hastaDia) {
    throw new ReporteError("fechaDesde no puede ser posterior a fechaHasta");
  }
  const dias = Math.round((hastaDia - desdeDia) / DIA_MS) + 1;
  if (dias > MAX_DIAS_RANGO) {
    throw new ReporteError(`El rango máximo es de ${MAX_DIAS_RANGO} días`);
  }

  return {
    desde: desdeDia,
    hasta: sumarDias(hastaDia, 1),
    desdeISO,
    hastaISO,
    dias,
    // Período inmediatamente anterior de igual duración (comparaciones).
    previoDesde: sumarDias(desdeDia, -dias),
    previoHasta: desdeDia,
  };
}

const PARSERS = {
  rango: (query) => ({ rango: resolverRango(query) }),
  idCategoria: (query) =>
    query.idCategoria === undefined || query.idCategoria === ""
      ? {}
      : { idCategoria: enteroPositivo(query.idCategoria, "idCategoria") },
  idMarca: (query) =>
    query.idMarca === undefined || query.idMarca === ""
      ? {}
      : { idMarca: enteroPositivo(query.idMarca, "idMarca") },
  idConteo: (query) => {
    if (query.idConteo === undefined || query.idConteo === "") {
      throw new ReporteError("Elige el conteo físico del que quieres el reporte");
    }
    return { idConteo: enteroPositivo(query.idConteo, "idConteo") };
  },
  top: (query) => {
    if (query.top === undefined || query.top === "") return { top: TOP_POR_DEFECTO };
    const top = enteroPositivo(query.top, "top");
    if (top > TOP_MAXIMO) throw new ReporteError(`top debe estar entre 1 y ${TOP_MAXIMO}`);
    return { top };
  },
  ventana: (query) => {
    if (query.ventana === undefined || query.ventana === "") return { ventana: 30 };
    const v = Number(query.ventana);
    if (!VENTANAS.includes(v)) throw new ReporteError("ventana debe ser 30, 60 o 90 días");
    return { ventana: v };
  },
  agrupacion: (query) => {
    const valor = query.agrupacion ?? "dia";
    if (!AGRUPACIONES.includes(valor)) throw new ReporteError("agrupacion debe ser dia, semana o mes");
    return { agrupacion: valor };
  },
  agruparPor: (query) => {
    const valor = query.agruparPor ?? "producto";
    if (!AGRUPAR_POR.includes(valor)) throw new ReporteError("agruparPor debe ser producto o categoria");
    return { agruparPor: valor };
  },
  tipo: (query) => {
    const valor = query.tipo ?? "todos";
    if (!TIPOS_MOVIMIENTO.includes(valor)) {
      throw new ReporteError("tipo debe ser todos, compras, ventas o ajustes");
    }
    return { tipo: valor };
  },
  orden: (query) => {
    const valor = query.orden ?? "unidades";
    if (!ORDENES.includes(valor)) throw new ReporteError("orden debe ser unidades o ingreso");
    return { orden: valor };
  },
};

// Devuelve los filtros normalizados de las claves declaradas por el reporte.
function normalizarFiltros(nombres, query = {}) {
  const origen = query && typeof query === "object" ? query : {};
  let filtros = {};
  for (const nombre of nombres) {
    const parser = PARSERS[nombre];
    if (!parser) throw new Error(`Filtro de reporte desconocido: ${nombre}`);
    filtros = { ...filtros, ...parser(origen) };
  }
  return filtros;
}

// Líneas "Etiqueta: valor" que se imprimen bajo el título del reporte.
function describirFiltros(filtros, { categoria, marca, conteo } = {}) {
  const lineas = [];
  if (filtros.rango) {
    lineas.push({
      etiqueta: "Período",
      valor: `${formatoFecha(filtros.rango.desdeISO)} al ${formatoFecha(filtros.rango.hastaISO)} (${filtros.rango.dias} día${filtros.rango.dias === 1 ? "" : "s"})`,
    });
  }
  if (filtros.idCategoria) lineas.push({ etiqueta: "Categoría", valor: categoria ?? `#${filtros.idCategoria}` });
  if (filtros.idMarca) lineas.push({ etiqueta: "Marca", valor: marca ?? `#${filtros.idMarca}` });
  if (filtros.idConteo) lineas.push({ etiqueta: "Conteo", valor: conteo ?? `#${filtros.idConteo}` });
  if (filtros.top) lineas.push({ etiqueta: "Top", valor: String(filtros.top) });
  if (filtros.orden) lineas.push({ etiqueta: "Orden", valor: filtros.orden === "ingreso" ? "Ingreso" : "Unidades vendidas" });
  if (filtros.ventana) lineas.push({ etiqueta: "Rotación medida en", valor: `últimos ${filtros.ventana} días` });
  if (filtros.agrupacion) {
    lineas.push({ etiqueta: "Agrupación", valor: { dia: "Por día", semana: "Por semana", mes: "Por mes" }[filtros.agrupacion] });
  }
  if (filtros.agruparPor) {
    lineas.push({ etiqueta: "Agrupado por", valor: filtros.agruparPor === "categoria" ? "Categoría" : "Producto" });
  }
  if (filtros.tipo) {
    lineas.push({
      etiqueta: "Tipo de movimiento",
      valor: { todos: "Todos", compras: "Compras", ventas: "Ventas", ajustes: "Ajustes y mermas" }[filtros.tipo],
    });
  }
  return lineas;
}

module.exports = {
  MAX_DIAS_RANGO,
  TOP_MAXIMO,
  VENTANAS,
  resolverRango,
  normalizarFiltros,
  describirFiltros,
};
