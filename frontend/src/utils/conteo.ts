import type { BadgeTone } from "@/components/ui/Badge";
import type { EstadoConteo, LineaConteo, NivelDiferencia, ResumenConteo } from "@/types/conteo";

// Meta del acta del proyecto: diferencia agregada <= 5 %. Debe coincidir con
// META_EXACTITUD_PCT de backend/src/services/conteoService.js (el backend la
// envía en `resumen.metaPct`; esta constante solo sirve para el cálculo local
// mientras se edita un borrador).
export const META_EXACTITUD_PCT = 5;

export const ETIQUETA_ESTADO: Record<EstadoConteo, string> = {
  borrador: "En curso",
  aplicado: "Aplicado",
  cerrado: "Cerrado sin ajustes",
  cancelado: "Cancelado",
};

export const TONO_ESTADO: Record<EstadoConteo, BadgeTone> = {
  borrador: "info",
  aplicado: "success",
  cerrado: "neutral",
  cancelado: "danger",
};

export const TONO_NIVEL: Record<NivelDiferencia, BadgeTone> = { exacto: "success", leve: "warning", alto: "danger" };

// Espejo de clasificarDiferencia (backend): exacto = 0; leve = hasta la meta
// del stock del sistema; alto = más. Sistema 0 con diferencia = alto.
export function clasificarDiferencia(diferencia: number, cantidadSistema: number): NivelDiferencia {
  if (diferencia === 0) return "exacto";
  if (cantidadSistema <= 0) return "alto";
  return (Math.abs(diferencia) / cantidadSistema) * 100 <= META_EXACTITUD_PCT ? "leve" : "alto";
}

// Texto de la diferencia: siempre palabra + signo (no depende del color).
export function textoDiferencia(diferencia: number): string {
  if (diferencia === 0) return "Exacto";
  return diferencia > 0 ? `+${diferencia} sobran` : `−${Math.abs(diferencia)} faltan`;
}

export function redondear2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Recalcula los KPIs en pantalla mientras se edita el borrador (el servidor
// los vuelve a calcular al guardar; es la misma fórmula).
export function calcularResumenLocal(lineas: LineaConteo[]): ResumenConteo {
  const contados = lineas.length;
  let exactos = 0;
  let sobrantes = 0;
  let faltantes = 0;
  let sistema = 0;
  let absolutas = 0;
  let neto = 0;
  let absoluto = 0;
  for (const l of lineas) {
    sistema += l.cantidadSistema;
    absolutas += Math.abs(l.diferencia);
    if (l.diferencia === 0) exactos += 1;
    else if (l.diferencia > 0) sobrantes += l.diferencia;
    else faltantes += -l.diferencia;
    neto += l.valorDiferencia;
    absoluto += Math.abs(l.valorDiferencia);
  }
  const diferenciaPct = contados === 0 ? null : sistema > 0 ? (absolutas / sistema) * 100 : absolutas > 0 ? 100 : 0;
  return {
    productosContados: contados,
    productosExactos: exactos,
    productosConDiferencia: contados - exactos,
    exactitudPct: contados === 0 ? null : redondear2((exactos / contados) * 100),
    unidadesSistema: sistema,
    unidadesSobrantes: sobrantes,
    unidadesFaltantes: faltantes,
    unidadesDiferenciaAbs: absolutas,
    diferenciaPct: diferenciaPct === null ? null : redondear2(diferenciaPct),
    metaPct: META_EXACTITUD_PCT,
    cumpleMeta: diferenciaPct === null ? null : diferenciaPct <= META_EXACTITUD_PCT,
    valorDiferenciaNeto: redondear2(neto),
    valorDiferenciaAbsoluto: redondear2(absoluto),
  };
}

export function pct(n: number | null): string {
  return n === null ? "—" : `${n.toLocaleString("es-GT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

const FECHA = new Intl.DateTimeFormat("es-GT", { timeZone: "America/Guatemala", day: "2-digit", month: "2-digit", year: "numeric" });

export function fechaConteo(iso: string | null): string {
  return iso ? FECHA.format(new Date(iso)) : "—";
}

// Fecha elegida en <input type="date"> -> instante al mediodía en Guatemala
// (evita que el huso desplace el día al mostrarlo).
export function fechaAMediodiaGT(fechaISO: string): string {
  return `${fechaISO}T12:00:00-06:00`;
}
