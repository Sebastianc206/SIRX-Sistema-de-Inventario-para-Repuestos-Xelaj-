// Formato de montos en quetzales (Q1,234.50) y fechas relativas en español.
const FORMATO_Q = new Intl.NumberFormat("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function quetzales(monto: number | string): string {
  return `Q${FORMATO_Q.format(Number(monto))}`;
}

const RELATIVO = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

export function haceCuanto(fechaIso: string, ahora: Date = new Date()): string {
  const fecha = new Date(fechaIso);
  const segundos = Math.round((fecha.getTime() - ahora.getTime()) / 1000);
  const abs = Math.abs(segundos);
  if (abs < 60) return "hace un momento";
  if (abs < 3600) return RELATIVO.format(Math.round(segundos / 60), "minute");
  if (abs < 86400) return RELATIVO.format(Math.round(segundos / 3600), "hour");
  if (abs < 86400 * 30) return RELATIVO.format(Math.round(segundos / 86400), "day");
  return fecha.toLocaleDateString("es-GT");
}

export function saludo(hora: number = new Date().getHours()): string {
  if (hora < 12) return "Buenos días";
  if (hora < 19) return "Buenas tardes";
  return "Buenas noches";
}

// Variación porcentual entre dos períodos; null si no hay base de comparación.
export function variacion(actual: number, previo: number): number | null {
  if (previo === 0) return actual === 0 ? 0 : null;
  return ((actual - previo) / previo) * 100;
}
