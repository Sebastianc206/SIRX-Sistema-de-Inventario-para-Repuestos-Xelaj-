import { TOKEN_KEY } from "@/context/AuthContext";
import type { Venta, VentaFormInput } from "@/types/movimiento";

const API_URL = import.meta.env.VITE_API_URL;

export class VentaApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "VentaApiError";
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
    throw new VentaApiError(data.message || "Ocurrió un error inesperado", response.status);
  }

  return data as T;
}

export async function crearVenta(input: VentaFormInput): Promise<Venta> {
  const response = await fetch(`${API_URL}/api/ventas`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  });
  const data = await manejarRespuesta<{ venta: Venta }>(response);
  return data.venta;
}

export async function anularVenta(idVenta: number): Promise<Venta> {
  const response = await fetch(`${API_URL}/api/ventas/${idVenta}/anular`, {
    method: "PATCH",
    headers: authHeaders(),
  });
  const data = await manejarRespuesta<{ venta: Venta }>(response);
  return data.venta;
}
