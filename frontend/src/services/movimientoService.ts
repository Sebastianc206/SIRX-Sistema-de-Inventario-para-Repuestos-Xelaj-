import { TOKEN_KEY } from "@/context/AuthContext";
import type { ComparacionVentas, FiltrosMovimientos, ListarMovimientosResultado } from "@/types/movimiento";

const API_URL = import.meta.env.VITE_API_URL;

export class MovimientoApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "MovimientoApiError";
    this.status = status;
  }
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem(TOKEN_KEY);
  return { Authorization: `Bearer ${token}` };
}

export interface RangoFechas {
  fechaDesde?: string;
  fechaHasta?: string;
}

// HU-10: historial de movimientos filtrado por categoría/marca/producto(s) y
// rango de fechas, paginado — ya no está acotado a un solo sku.
export async function listarMovimientos(filtros: FiltrosMovimientos = {}): Promise<ListarMovimientosResultado> {
  const params = new URLSearchParams();
  if (filtros.skus && filtros.skus.length > 0) params.set("skus", filtros.skus.map(encodeURIComponent).join(","));
  if (filtros.idCategoria !== undefined) params.set("idCategoria", String(filtros.idCategoria));
  if (filtros.idMarca !== undefined) params.set("idMarca", String(filtros.idMarca));
  if (filtros.fechaDesde) params.set("fechaDesde", filtros.fechaDesde);
  if (filtros.fechaHasta) params.set("fechaHasta", filtros.fechaHasta);
  params.set("pagina", String(filtros.pagina ?? 1));
  if (filtros.porPagina) params.set("porPagina", String(filtros.porPagina));

  const response = await fetch(`${API_URL}/api/movimientos?${params.toString()}`, { headers: authHeaders() });
  const data = await response.json();

  if (!response.ok) {
    throw new MovimientoApiError(data.message || "Ocurrió un error inesperado", response.status);
  }

  return data as ListarMovimientosResultado;
}

export async function obtenerComparacionVentas(
  skus: string[],
  rango: RangoFechas = {},
): Promise<ComparacionVentas> {
  const params = new URLSearchParams();
  params.set("skus", skus.map(encodeURIComponent).join(","));
  if (rango.fechaDesde) params.set("fechaDesde", rango.fechaDesde);
  if (rango.fechaHasta) params.set("fechaHasta", rango.fechaHasta);

  const response = await fetch(`${API_URL}/api/movimientos/comparacion-ventas?${params.toString()}`, {
    headers: authHeaders(),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new MovimientoApiError(data.message || "Ocurrió un error inesperado", response.status);
  }

  return data as ComparacionVentas;
}
