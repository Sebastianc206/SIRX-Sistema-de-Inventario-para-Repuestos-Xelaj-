import { TOKEN_KEY } from "@/context/AuthContext";
import type { SalidaAjuste, SalidaAjusteFormInput, TipoSalidaAjuste } from "@/types/movimiento";

const API_URL = import.meta.env.VITE_API_URL;

export class AjusteApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AjusteApiError";
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
    throw new AjusteApiError(data.message || "Ocurrió un error inesperado", response.status);
  }

  return data as T;
}

export async function listarTiposAjuste(): Promise<TipoSalidaAjuste[]> {
  const response = await fetch(`${API_URL}/api/ajustes-inventario/tipos`, { headers: authHeaders() });
  const data = await manejarRespuesta<{ tipos: TipoSalidaAjuste[] }>(response);
  return data.tipos;
}

export async function crearAjuste(input: SalidaAjusteFormInput): Promise<SalidaAjuste> {
  const response = await fetch(`${API_URL}/api/ajustes-inventario`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  });
  const data = await manejarRespuesta<{ salida: SalidaAjuste }>(response);
  return data.salida;
}

export async function anularAjuste(idVenta: number): Promise<SalidaAjuste> {
  const response = await fetch(`${API_URL}/api/ajustes-inventario/${idVenta}/anular`, {
    method: "PATCH",
    headers: authHeaders(),
  });
  const data = await manejarRespuesta<{ salida: SalidaAjuste }>(response);
  return data.salida;
}
