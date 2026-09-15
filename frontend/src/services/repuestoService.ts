import { TOKEN_KEY } from "@/context/AuthContext";
import type {
  CargaMasivaResultado,
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

// DELETE responde 204 sin body: no se puede llamar response.json() sobre eso.
async function manejarRespuestaSinBody(response: Response): Promise<void> {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new RepuestoApiError(data.message || "Ocurrió un error inesperado", response.status);
  }
}

export async function listarRepuestos(filtros: FiltrosRepuestos = {}): Promise<ListarRepuestosResultado> {
  const params = new URLSearchParams();
  if (filtros.pagina) params.set("pagina", String(filtros.pagina));
  if (filtros.porPagina) params.set("porPagina", String(filtros.porPagina));
  if (filtros.busqueda) params.set("busqueda", filtros.busqueda);
  if (filtros.estado) params.set("estado", filtros.estado);
  if (filtros.idCategoria) params.set("idCategoria", String(filtros.idCategoria));
  if (filtros.idMarca) params.set("idMarca", String(filtros.idMarca));
  if (filtros.idModelo) params.set("idModelo", String(filtros.idModelo));

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

// Eliminación real (opción adicional a cambiarEstadoRepuesto): solo para
// repuestos ya inactivos y sin historial asociado — el backend rechaza con
// 409 si tiene compras, ventas o modelos compatibles asociados.
export async function eliminarRepuesto(sku: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/repuestos/${encodeURIComponent(sku)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return manejarRespuestaSinBody(response);
}

// T-047: la plantilla es un endpoint autenticado (no un <a href> plano), así
// que hay que descargarla como blob y disparar la descarga en el cliente.
export async function descargarPlantillaRepuestos(): Promise<void> {
  const response = await fetch(`${API_URL}/api/repuestos/plantilla-carga-masiva`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new RepuestoApiError(data.message || "No se pudo descargar la plantilla", response.status);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = "plantilla-repuestos.xlsx";
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

export async function cargarRepuestosMasivo(archivo: File): Promise<CargaMasivaResultado> {
  const formData = new FormData();
  formData.append("archivo", archivo);

  const response = await fetch(`${API_URL}/api/repuestos/carga-masiva`, {
    method: "POST",
    // Sin Content-Type explícito: el navegador arma el boundary del
    // multipart él mismo a partir del FormData.
    headers: authHeaders(),
    body: formData,
  });
  return manejarRespuesta<CargaMasivaResultado>(response);
}
