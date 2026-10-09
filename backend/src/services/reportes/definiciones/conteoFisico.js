const { ADMIN } = require("../comun");
const { ReporteError } = require("../errores");
const { redondear2, formatoFecha } = require("../formato");
const conteoService = require("../../conteoService");

// Reporte 9 — Conteo físico (solo Administrador: incluye valorización con
// precioCosto). Compara lo contado contra lo que el sistema tenía al
// momento de contar cada SKU y resume la exactitud frente a la meta del
// acta (diferencia agregada <= 5 %). Requiere el filtro `idConteo`.
const NIVELES = {
  exacto: { texto: "Exacto", tono: "ok" },
  leve: { texto: "Diferencia leve", tono: "warn" },
  alto: { texto: "Diferencia alta", tono: "bad" },
};
const ETIQUETA_ESTADO = { borrador: "Borrador", cerrado: "Cerrado", aplicado: "Aplicado", cancelado: "Cancelado" };

async function ejecutar(filtros, ctx) {
  let conteo;
  try {
    conteo = await conteoService.obtenerConteo(filtros.idConteo);
  } catch (error) {
    if (error instanceof conteoService.ConteoError) throw new ReporteError(error.message, error.statusCode);
    throw error;
  }
  const r = conteo.resumen;

  const ordenadas = [...conteo.lineas].sort(
    (a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia) || a.sku.localeCompare(b.sku),
  );
  const filas = ordenadas.slice(0, ctx.limite).map((l) => ({
    sku: l.sku,
    nombre: l.nombre,
    sistema: l.cantidadSistema,
    contado: l.cantidadContada,
    diferencia: l.diferencia,
    nivel: NIVELES[l.nivel],
    valor: redondear2(l.valorDiferencia),
  }));

  const cumple = r.cumpleMeta === null ? null : r.cumpleMeta;
  const notas = [
    "Exactitud = productos sin diferencia / productos contados. Diferencia agregada = suma de |contado - sistema| / suma del stock del sistema.",
    `Meta del acta: diferencia agregada de ${r.metaPct} % o menos. Nivel por producto: leve = hasta ${r.metaPct} % de su stock; alta = más.`,
    "El stock del sistema es el registrado al momento de contar cada producto. Al aplicar, la diferencia se suma al stock vigente (no lo reemplaza), así que las ventas posteriores se conservan.",
    conteo.estado === "aplicado"
      ? "Los ajustes de este conteo se aplicaron y figuran en Movimientos como «Conteo físico»."
      : `Estado del conteo: ${ETIQUETA_ESTADO[conteo.estado]}. El inventario no se ha corregido con este conteo.`,
    `Productos del alcance sin contar: ${conteo.alcance.sinContar} de ${conteo.alcance.productosEnAlcance}. No se incluyen en la exactitud.`,
  ];

  return {
    kpis: [
      {
        etiqueta: "Exactitud de existencias",
        valor: r.exactitudPct ?? 0,
        tipo: "porcentaje",
        nota: `${r.productosExactos} de ${r.productosContados} productos sin diferencia`,
      },
      {
        etiqueta: "Diferencia agregada",
        valor: r.diferenciaPct ?? 0,
        tipo: "porcentaje",
        nota: cumple === null ? "Sin productos contados" : cumple ? `Cumple la meta de ${r.metaPct} %` : `No cumple la meta de ${r.metaPct} %`,
      },
      {
        etiqueta: "Unidades con diferencia",
        valor: r.unidadesDiferenciaAbs,
        tipo: "entero",
        nota: `${r.unidadesFaltantes} faltantes, ${r.unidadesSobrantes} sobrantes`,
      },
      {
        etiqueta: "Valor neto de la diferencia",
        valor: r.valorDiferenciaNeto,
        tipo: "moneda",
        nota: "A costo actual",
        sensible: true,
      },
    ],
    tablas: [
      {
        id: "diferencias",
        titulo: `${conteo.nombre} (${formatoFecha(conteo.fechaConteo)}${conteo.categoria ? `, ${conteo.categoria.descripcion}` : ", todo el catálogo"})`,
        principal: true,
        columnas: [
          { clave: "sku", etiqueta: "SKU", tipo: "texto", ancho: 62 },
          { clave: "nombre", etiqueta: "Producto", tipo: "texto", ancho: 150 },
          { clave: "sistema", etiqueta: "Sistema", tipo: "entero", ancho: 46 },
          { clave: "contado", etiqueta: "Contado", tipo: "entero", ancho: 46 },
          { clave: "diferencia", etiqueta: "Diferencia", tipo: "entero", signo: true, ancho: 52 },
          { clave: "nivel", etiqueta: "Nivel", tipo: "estado", ancho: 76 },
          { clave: "valor", etiqueta: "Valor dif.", tipo: "moneda", ancho: 58, sensible: true },
        ],
        filas,
        totalFilas: conteo.lineas.length,
      },
    ],
    grafica: null,
    notas,
    vacio: conteo.lineas.length === 0 ? "Este conteo todavía no tiene productos contados." : null,
  };
}

module.exports = {
  id: "conteo-fisico",
  nombreCorto: "Conteo físico",
  titulo: "Conteo físico de inventario",
  descripcion: "Diferencias entre lo contado y lo registrado, exactitud de existencias y cumplimiento de la meta del 5 %.",
  icono: "clipboard",
  roles: [ADMIN],
  filtros: ["idConteo"],
  ejecutar,
};
