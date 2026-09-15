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

// DELETE responde 204 sin body: no se puede llamar response.json() sobre eso.
async function manejarRespuestaSinBody(response: Response): Promise<void> {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ProveedorApiError(data.message || "Ocurrió un error inesperado", response.status);
  }
}

// vigente=true filtra los proveedores dados de baja — usarlo en cualquier
// selector (ProveedorSelect/ProveedorRequeridoSelect) para que uno inactivo
// no se pueda asignar a un repuesto ni a una compra nueva. Sin el filtro
// (ProveedoresPage), se listan todos para poder reactivarlos.
export async function listarProveedores(opciones: { vigente?: boolean } = {}): Promise<Proveedor[]> {
  const params = new URLSearchParams();
  if (opciones.vigente) params.set("vigente", "true");

  const response = await fetch(`${API_URL}/api/proveedores?${params.toString()}`, { headers: authHeaders() });
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

export async function cambiarEstadoProveedor(idProveedor: number, vigente: boolean): Promise<Proveedor> {
  const response = await fetch(`${API_URL}/api/proveedores/${idProveedor}/estado`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ vigente }),
  });
  const data = await manejarRespuesta<{ proveedor: Proveedor }>(response);
  return data.proveedor;
}

// Eliminación real (opción adicional a cambiarEstadoProveedor): solo para
// proveedores ya inactivos y sin historial asociado — el backend rechaza
// con 409 si tiene repuestos o compras asociadas.
export async function eliminarProveedor(idProveedor: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/proveedores/${idProveedor}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return manejarRespuestaSinBody(response);
}
