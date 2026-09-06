import { TOKEN_KEY } from "@/context/AuthContext";
import type {
  EditarRepuestoInput,
  FiltrosRepuestos,
  ListarRepuestosResultado,
  Repuesto,
  RepuestoFormInput,
} from "@/types/repuesto";

const API_URL = import.meta.env.VITE_API_URL;

export class RepuestoApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "RepuestoApiError";
    this.status = status;
  }
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem(TOKEN_KEY);
  return { Authorization: `Bearer ${token}` };
}

async function manejarRespuesta<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (!response.ok) {
    throw new RepuestoApiError(data.message || "Ocurrió un error inesperado", response.status);
  }

  return data as T;
}

export async function listarRepuestos(filtros: FiltrosRepuestos = {}): Promise<ListarRepuestosResultado> {
  const params = new URLSearchParams();
  if (filtros.pagina) params.set("pagina", String(filtros.pagina));
  if (filtros.porPagina) params.set("porPagina", String(filtros.porPagina));
  if (filtros.busqueda) params.set("busqueda", filtros.busqueda);
  if (filtros.estado) params.set("estado", filtros.estado);

  const response = await fetch(`${API_URL}/api/repuestos?${params.toString()}`, {
    headers: authHeaders(),
  });
  return manejarRespuesta<ListarRepuestosResultado>(response);
}

export async function obtenerRepuesto(sku: string): Promise<Repuesto> {
  const response = await fetch(`${API_URL}/api/repuestos/${encodeURIComponent(sku)}`, {
    headers: authHeaders(),
  });
  const data = await manejarRespuesta<{ articulo: Repuesto }>(response);
  return data.articulo;
}

export async function crearRepuesto(input: RepuestoFormInput): Promise<Repuesto> {
  const response = await fetch(`${API_URL}/api/repuestos`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  });
  const data = await manejarRespuesta<{ articulo: Repuesto }>(response);
  return data.articulo;
}

export async function editarRepuesto(sku: string, input: EditarRepuestoInput): Promise<Repuesto> {
  const response = await fetch(`${API_URL}/api/repuestos/${encodeURIComponent(sku)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  });
  const data = await manejarRespuesta<{ articulo: Repuesto }>(response);
  return data.articulo;
}

export async function cambiarEstadoRepuesto(sku: string, estado: boolean): Promise<Repuesto> {
  const response = await fetch(`${API_URL}/api/repuestos/${encodeURIComponent(sku)}/estado`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ estado }),
  });
  const data = await manejarRespuesta<{ articulo: Repuesto }>(response);
  return data.articulo;
}
