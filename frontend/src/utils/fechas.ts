// Defaults de los 4 filtros de rango de fechas (Ventas, Ajustes, historial
// de producto y comparación de ventas en MovimientosPage) — todo en hora
// LOCAL del navegador, nunca UTC, para que "hoy"/"día 1" coincidan con lo
// que el usuario ve en su reloj.
export function aISO(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

export function hoyISO(): string {
  return aISO(new Date());
}

export function primerDiaDelMesISO(): string {
  const hoy = new Date();
  return aISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
}

// Fecha ISO local de hace `n` días (n = 0 es hoy).
export function haceDiasISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return aISO(d);
}
