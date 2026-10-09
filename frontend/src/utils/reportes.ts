import { aISO, haceDiasISO, hoyISO, primerDiaDelMesISO } from "@/utils/fechas";
import { quetzales } from "@/utils/formato";
import type { CeldaEstado, ColumnaReporte, FiltrosReporte, ValorCelda } from "@/types/reporte";

export interface AtajoFecha {
  id: string;
  etiqueta: string;
  rango: () => { fechaDesde: string; fechaHasta: string };
}

// Atajos de rango (hora local del navegador; el backend los interpreta como
// días de Guatemala, igual que el resto del sistema).
export const ATAJOS_FECHA: AtajoFecha[] = [
  { id: "hoy", etiqueta: "Hoy", rango: () => ({ fechaDesde: hoyISO(), fechaHasta: hoyISO() }) },
  { id: "7d", etiqueta: "7 días", rango: () => ({ fechaDesde: haceDiasISO(6), fechaHasta: hoyISO() }) },
  { id: "30d", etiqueta: "30 días", rango: () => ({ fechaDesde: haceDiasISO(29), fechaHasta: hoyISO() }) },
  { id: "mes", etiqueta: "Este mes", rango: () => ({ fechaDesde: primerDiaDelMesISO(), fechaHasta: hoyISO() }) },
  {
    id: "mes-anterior",
    etiqueta: "Mes anterior",
    rango: () => {
      const hoy = new Date();
      const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      const hasta = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
      return { fechaDesde: aISO(desde), fechaHasta: aISO(hasta) };
    },
  },
];

export function rangoPorDefecto(): { fechaDesde: string; fechaHasta: string } {
  return ATAJOS_FECHA[2].rango();
}

export function atajoActivo(filtros: FiltrosReporte): string | null {
  for (const a of ATAJOS_FECHA) {
    const r = a.rango();
    if (r.fechaDesde === filtros.fechaDesde && r.fechaHasta === filtros.fechaHasta) return a.id;
  }
  return null;
}

export function filtrosPorDefecto(filtrosDisponibles: string[]): FiltrosReporte {
  const f: FiltrosReporte = {};
  if (filtrosDisponibles.includes("fechaDesde")) Object.assign(f, rangoPorDefecto());
  if (filtrosDisponibles.includes("top")) f.top = "20";
  if (filtrosDisponibles.includes("ventana")) f.ventana = "30";
  if (filtrosDisponibles.includes("agrupacion")) f.agrupacion = "dia";
  if (filtrosDisponibles.includes("agruparPor")) f.agruparPor = "producto";
  if (filtrosDisponibles.includes("tipo")) f.tipo = "todos";
  if (filtrosDisponibles.includes("orden")) f.orden = "unidades";
  return f;
}

const ENTERO = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 0 });
const DECIMAL = new Intl.NumberFormat("es-GT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const FECHA_HORA = new Intl.DateTimeFormat("es-GT", {
  timeZone: "America/Guatemala",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const FECHA = new Intl.DateTimeFormat("es-GT", { timeZone: "America/Guatemala", day: "2-digit", month: "2-digit", year: "numeric" });

export function esCeldaEstado(v: ValorCelda): v is CeldaEstado {
  return typeof v === "object" && v !== null;
}

// Mismo criterio que los archivos descargables: sin dato = "—".
export function textoCelda(valor: ValorCelda, columna: Pick<ColumnaReporte, "tipo" | "signo">): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (esCeldaEstado(valor)) return valor.texto;
  switch (columna.tipo) {
    case "moneda":
      return quetzales(valor);
    case "entero": {
      const n = Number(valor);
      return `${columna.signo && n > 0 ? "+" : ""}${ENTERO.format(n)}`;
    }
    case "decimal":
      return DECIMAL.format(Number(valor));
    case "porcentaje":
      return `${DECIMAL.format(Number(valor))}%`;
    case "fecha":
      return FECHA.format(new Date(valor));
    case "fechaHora":
      return FECHA_HORA.format(new Date(valor)).replace(",", "");
    default:
      return String(valor);
  }
}

export function formatoValorGrafica(valor: number, formato: "entero" | "moneda"): string {
  return formato === "moneda" ? quetzales(valor) : ENTERO.format(valor);
}

export function resumenRango(filtros: FiltrosReporte): string | null {
  if (!filtros.fechaDesde || !filtros.fechaHasta) return null;
  const f = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");
  return filtros.fechaDesde === filtros.fechaHasta ? f(filtros.fechaDesde) : `${f(filtros.fechaDesde)} al ${f(filtros.fechaHasta)}`;
}
