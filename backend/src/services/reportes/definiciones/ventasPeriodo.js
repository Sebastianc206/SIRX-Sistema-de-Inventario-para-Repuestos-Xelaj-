const prisma = require("../../../utils/prismaClient");
const { ADMIN, ID_TIPO_SALIDA_VENTA, pct } = require("../comun");
const { redondear2, formatoFecha, formatoMoneda, isoFechaGT } = require("../formato");

// Reporte 6 — Ventas por período (solo Administrador: ingresos). Agrupa las
// ventas por día/semana/mes (en hora de Guatemala), calcula ticket promedio y
// compara contra el período inmediatamente anterior de igual duración.
//
// Una "venta" es un maestro NO anulado cuyas líneas son todas de tipo Venta
// (misma regla que el tablero). El ingreso es monto_total_venta del maestro.
const UNIDADES_SQL = { dia: "day", semana: "week", mes: "month" };
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function etiquetaPeriodo(iso, agrupacion) {
  if (agrupacion === "mes") {
    const [a, m] = iso.split("-");
    return `${MESES[Number(m) - 1]} ${a}`;
  }
  const corto = formatoFecha(iso).slice(0, 5);
  return agrupacion === "semana" ? `Sem. ${corto}` : corto;
}

function variacion(actual, previo) {
  if (previo === 0) return actual === 0 ? 0 : null;
  return ((actual - previo) / previo) * 100;
}

async function totalesPeriodo(desde, hasta) {
  const [fila] = await prisma.$queryRaw`
    WITH v AS (
      SELECT s.id_venta,
             COALESCE(s.monto_total_venta, SUM(d.cantidad * COALESCE(d.precio_venta, 0)))::float8 AS monto,
             SUM(d.cantidad)::int AS unidades
      FROM salida_maestro s
      JOIN salida_detalle d ON d.id_salida = s.id_venta
      WHERE s.anulada = false AND s.fecha_salida >= ${desde} AND s.fecha_salida < ${hasta}
      GROUP BY s.id_venta
      HAVING bool_and(d.id_tipo_salida = ${ID_TIPO_SALIDA_VENTA})
    )
    SELECT COUNT(*)::int AS ventas, COALESCE(SUM(monto), 0)::float8 AS ingreso, COALESCE(SUM(unidades), 0)::int AS unidades
    FROM v`;
  return fila ?? { ventas: 0, ingreso: 0, unidades: 0 };
}

async function ejecutar(filtros) {
  const { rango, agrupacion } = filtros;
  const unidad = UNIDADES_SQL[agrupacion];

  const [periodos, actual, previo] = await Promise.all([
    prisma.$queryRaw`
      WITH v AS (
        SELECT s.id_venta,
               to_char(date_trunc(${unidad}, (s.fecha_salida AT TIME ZONE 'UTC') AT TIME ZONE 'America/Guatemala'), 'YYYY-MM-DD') AS periodo,
               COALESCE(s.monto_total_venta, SUM(d.cantidad * COALESCE(d.precio_venta, 0)))::float8 AS monto,
               SUM(d.cantidad)::int AS unidades
        FROM salida_maestro s
        JOIN salida_detalle d ON d.id_salida = s.id_venta
        WHERE s.anulada = false AND s.fecha_salida >= ${rango.desde} AND s.fecha_salida < ${rango.hasta}
        GROUP BY s.id_venta
        HAVING bool_and(d.id_tipo_salida = ${ID_TIPO_SALIDA_VENTA})
      )
      SELECT periodo, COUNT(*)::int AS ventas, SUM(monto)::float8 AS ingreso, SUM(unidades)::int AS unidades
      FROM v GROUP BY periodo ORDER BY periodo`,
    totalesPeriodo(rango.desde, rango.hasta),
    totalesPeriodo(rango.previoDesde, rango.previoHasta),
  ]);

  const filas = periodos.map((p) => ({
    periodo: etiquetaPeriodo(p.periodo, agrupacion),
    ventas: p.ventas,
    unidades: p.unidades,
    ingreso: redondear2(p.ingreso),
    ticket: p.ventas > 0 ? redondear2(p.ingreso / p.ventas) : 0,
    pctIngreso: pct(p.ingreso, actual.ingreso),
  }));

  const ticketActual = actual.ventas > 0 ? actual.ingreso / actual.ventas : 0;
  const ticketPrevio = previo.ventas > 0 ? previo.ingreso / previo.ventas : 0;
  const mejor = [...filas].sort((a, b) => b.ingreso - a.ingreso)[0];
  const previoDesdeISO = isoFechaGT(rango.previoDesde);
  const previoHastaISO = isoFechaGT(new Date(rango.previoHasta.getTime() - 1));

  return {
    kpis: [
      { etiqueta: "Ingreso por ventas", valor: redondear2(actual.ingreso), tipo: "moneda", variacion: variacion(actual.ingreso, previo.ingreso), sensible: true },
      { etiqueta: "Ventas (tickets)", valor: actual.ventas, tipo: "entero", variacion: variacion(actual.ventas, previo.ventas) },
      { etiqueta: "Ticket promedio", valor: redondear2(ticketActual), tipo: "moneda", variacion: variacion(ticketActual, ticketPrevio), sensible: true },
      { etiqueta: "Unidades vendidas", valor: actual.unidades, tipo: "entero", variacion: variacion(actual.unidades, previo.unidades) },
    ],
    comparacion: {
      etiqueta: `Variación contra los ${rango.dias} día${rango.dias === 1 ? "" : "s"} anteriores`,
      detalle: `Período anterior (${formatoFecha(previoDesdeISO)} al ${formatoFecha(previoHastaISO)}): ${formatoMoneda(previo.ingreso)} en ${previo.ventas} venta${previo.ventas === 1 ? "" : "s"}.`,
      previo: { ingreso: redondear2(previo.ingreso), ventas: previo.ventas, unidades: previo.unidades },
    },
    tablas: [
      {
        id: "periodos",
        titulo: `Ventas ${agrupacion === "dia" ? "por día" : agrupacion === "semana" ? "por semana" : "por mes"}`,
        principal: true,
        columnas: [
          { clave: "periodo", etiqueta: agrupacion === "dia" ? "Día" : agrupacion === "semana" ? "Semana" : "Mes", tipo: "texto", ancho: 90 },
          { clave: "ventas", etiqueta: "Ventas", tipo: "entero", ancho: 60 },
          { clave: "unidades", etiqueta: "Unidades", tipo: "entero", ancho: 66 },
          { clave: "ingreso", etiqueta: "Ingreso", tipo: "moneda", ancho: 90, sensible: true },
          { clave: "ticket", etiqueta: "Ticket promedio", tipo: "moneda", ancho: 90, sensible: true },
          { clave: "pctIngreso", etiqueta: "% del ingreso", tipo: "porcentaje", ancho: 70, sensible: true },
        ],
        filas,
        totalFilas: filas.length,
        totales: {
          periodo: "Total",
          ventas: actual.ventas,
          unidades: actual.unidades,
          ingreso: redondear2(actual.ingreso),
          ticket: redondear2(ticketActual),
          pctIngreso: actual.ingreso > 0 ? 100 : 0,
        },
      },
    ],
    grafica: {
      tipo: "linea",
      titulo: "Ingreso por período",
      formato: "moneda",
      sensible: true,
      items: filas.map((f) => ({ etiqueta: f.periodo, valor: f.ingreso })),
    },
    notas: [
      "Cuenta solo ventas de mostrador no anuladas. El período anterior tiene la misma duración y termina el día previo al inicio del rango.",
      mejor ? `Mejor ${agrupacion === "dia" ? "día" : agrupacion === "semana" ? "semana" : "mes"} del rango: ${mejor.periodo}.` : null,
    ].filter(Boolean),
    vacio: actual.ventas === 0 ? "No hay ventas en este rango. Prueba ampliando las fechas." : null,
  };
}

module.exports = {
  id: "ventas-periodo",
  nombreCorto: "Ventas por periodo",
  titulo: "Ventas por período",
  descripcion: "Cómo van las ventas por día, semana o mes: ingreso, ticket promedio y comparación contra el período anterior.",
  icono: "barChart",
  roles: [ADMIN],
  filtros: ["rango", "agrupacion"],
  etiquetaPeriodo,
  ejecutar,
};
