import { TOKEN_KEY } from "@/context/AuthContext";
import type { EditarProveedorInput, Proveedor, ProveedorFormInput } from "@/types/proveedor";

const API_URL = import.meta.env.VITE_API_URL;

export class ProveedorApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ProveedorApiError";
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
    throw new ProveedorApiError(data.message || "Ocurrió un error inesperado", response.status);
  }

  return data as T;
}

export async function listarProveedores(): Promise<Proveedor[]> {
  const response = await fetch(`${API_URL}/api/proveedores`, { headers: authHeaders() });
  const data = await manejarRespuesta<{ proveedores: Proveedor[] }>(response);
  return data.proveedores;
}

export async function crearProveedor(input: ProveedorFormInput): Promise<Proveedor> {
  const response = await fetch(`${API_URL}/api/proveedores`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  });
  const data = await manejarRespuesta<{ proveedor: Proveedor }>(response);
  return data.proveedor;
}

export async function editarProveedor(idProveedor: number, input: EditarProveedorInput): Promise<Proveedor> {
  const response = await fetch(`${API_URL}/api/proveedores/${idProveedor}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  });
  const data = await manejarRespuesta<{ proveedor: Proveedor }>(response);
  return data.proveedor;
}
