import { TOKEN_KEY } from "@/context/AuthContext";
import type { Conteo, CrearConteoInput, EstadoConteo, ListarConteosResultado } from "@/types/conteo";

const API_URL = import.meta.env.VITE_API_URL;

export class ConteoApiError extends Error {
  status: number;
  // "CAMBIO_STOCK" | "STOCK_NEGATIVO" cuando el cierre no puede aplicarse tal cual.
  codigo?: string;

  constructor(message: string, status: number, codigo?: string) {
    super(message);
    this.name = "ConteoApiError";
    this.status = status;
    this.codigo = codigo;
  }
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem(TOKEN_KEY);
  return { Authorization: `Bearer ${token}` };
}

async function manejarRespuesta<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ConteoApiError(data.message || "Ocurrió un error inesperado", response.status, data.codigo);
  }
  return data as T;
}

function json(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

export async function listarConteos(estado?: EstadoConteo, signal?: AbortSignal): Promise<ListarConteosResultado> {
  const query = estado ? `?estado=${encodeURIComponent(estado)}&porPagina=100` : "?porPagina=100";
  const response = await fetch(`${API_URL}/api/conteos${query}`, { headers: authHeaders(), signal });
  return manejarRespuesta<ListarConteosResultado>(response);
}

export async function crearConteo(input: CrearConteoInput): Promise<Conteo> {
  const data = await manejarRespuesta<{ conteo: Conteo }>(await fetch(`${API_URL}/api/conteos`, json("POST", input)));
  return data.conteo;
}

export async function obtenerConteo(id: number): Promise<Conteo> {
  const data = await manejarRespuesta<{ conteo: Conteo }>(await fetch(`${API_URL}/api/conteos/${id}`, { headers: authHeaders() }));
  return data.conteo;
}

export async function guardarLineasConteo(id: number, lineas: { sku: string; cantidad: number }[]): Promise<Conteo> {
  const data = await manejarRespuesta<{ conteo: Conteo }>(await fetch(`${API_URL}/api/conteos/${id}/lineas`, json("PUT", { lineas })));
  return data.conteo;
}

export async function quitarLineaConteo(id: number, sku: string): Promise<Conteo> {
  const data = await manejarRespuesta<{ conteo: Conteo }>(
    await fetch(`${API_URL}/api/conteos/${id}/lineas/${encodeURIComponent(sku)}`, json("DELETE")),
  );
  return data.conteo;
}

export async function cerrarConteo(id: number, aplicarAjustes: boolean, confirmarCambios = false): Promise<Conteo> {
  const data = await manejarRespuesta<{ conteo: Conteo }>(
    await fetch(`${API_URL}/api/conteos/${id}/cerrar`, json("POST", { aplicarAjustes, confirmarCambios })),
  );
  return data.conteo;
}

export async function cancelarConteo(id: number): Promise<Conteo> {
  const data = await manejarRespuesta<{ conteo: Conteo }>(await fetch(`${API_URL}/api/conteos/${id}/cancelar`, json("POST")));
  return data.conteo;
}

export async function eliminarConteo(id: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/conteos/${id}`, json("DELETE"));
  if (!response.ok) await manejarRespuesta(response);
}
