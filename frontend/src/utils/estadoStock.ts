export type EstadoStockApi = "agotado" | "bajo" | "en_stock";

const POR_ESTADO: Record<EstadoStockApi, { clase: string; texto: string }> = {
  agotado: { clase: "stock-badge--agotado", texto: "Agotado" },
  bajo: { clase: "stock-badge--bajo", texto: "Stock bajo" },
  en_stock: { clase: "stock-badge--en-stock", texto: "En stock" },
};

// Mapeo estado de stock -> dato del backend (CONTEXTO_SIRX.md §8): agotado
// cuando ya no queda existencia, bajo cuando toca el umbral o menos.
//
// La fuente de verdad es el backend (umbralStockService.js): GET
// /api/repuestos trae `estadoStock` ya calculado con el umbral EFECTIVO
// (el del producto si lo tiene, si no el general que fija el
// Administrador). Si llega, se usa tal cual; si no (datos de otra fuente,
// pruebas), se deriva de cantidad vs `minimo` — que en la API también es el
// umbral efectivo — con la misma regla.
export function estadoStock(
  cantidad: number,
  minimo: number,
  estadoApi?: EstadoStockApi,
): { clase: string; texto: string } {
  if (estadoApi && POR_ESTADO[estadoApi]) return POR_ESTADO[estadoApi];
  if (cantidad <= 0) return POR_ESTADO.agotado;
  if (cantidad <= minimo) return POR_ESTADO.bajo;
  return POR_ESTADO.en_stock;
}
