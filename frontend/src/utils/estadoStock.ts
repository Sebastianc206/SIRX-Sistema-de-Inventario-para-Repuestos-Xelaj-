// Mapeo estado de stock -> dato del backend (CONTEXTO_SIRX.md §8): agotado
// cuando ya no queda existencia, bajo cuando toca el mínimo o menos.
export function estadoStock(cantidad: number, minimo: number): { clase: string; texto: string } {
  if (cantidad <= 0) return { clase: "stock-badge--agotado", texto: "Agotado" };
  if (cantidad <= minimo) return { clase: "stock-badge--bajo", texto: "Stock bajo" };
  return { clase: "stock-badge--en-stock", texto: "En stock" };
}
