import { TOKEN_KEY } from "@/context/AuthContext";
import type { Compra, CompraFormInput, ListarComprasResultado } from "@/types/movimiento";

const API_URL = import.meta.env.VITE_API_URL;

export class CompraApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CompraApiError";
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
    throw new CompraApiError(data.message || "Ocurrió un error inesperado", response.status);
  }

  return data as T;
}

export async function listarCompras(pagina = 1): Promise<ListarComprasResultado> {
  const response = await fetch(`${API_URL}/api/compras?pagina=${pagina}`, { headers: authHeaders() });
  return manejarRespuesta<ListarComprasResultado>(response);
}

export async function crearCompra(input: CompraFormInput): Promise<Compra> {
  const response = await fetch(`${API_URL}/api/compras`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  });
  const data = await manejarRespuesta<{ compra: Compra }>(response);
  return data.compra;
}

export async function anularCompra(idCompra: number): Promise<Compra> {
  const response = await fetch(`${API_URL}/api/compras/${idCompra}/anular`, {
    method: "PATCH",
    headers: authHeaders(),
  });
  const data = await manejarRespuesta<{ compra: Compra }>(response);
  return data.compra;
}
