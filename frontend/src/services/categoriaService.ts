import { TOKEN_KEY } from "@/context/AuthContext";
import type { Categoria, CrearCategoriaInput, EditarCategoriaInput } from "@/types/categoria";

const API_URL = import.meta.env.VITE_API_URL;

export class CategoriaApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CategoriaApiError";
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
    throw new CategoriaApiError(data.message || "Ocurrió un error inesperado", response.status);
  }

  return data as T;
}

// DELETE responde 204 sin body: no se puede llamar response.json() sobre eso.
async function manejarRespuestaSinBody(response: Response): Promise<void> {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new CategoriaApiError(data.message || "Ocurrió un error inesperado", response.status);
  }
}

export async function listarCategorias(): Promise<Categoria[]> {
  const response = await fetch(`${API_URL}/api/categorias`, { headers: authHeaders() });
  const data = await manejarRespuesta<{ categorias: Categoria[] }>(response);
  return data.categorias;
}

export async function crearCategoria(input: CrearCategoriaInput): Promise<Categoria> {
  const response = await fetch(`${API_URL}/api/categorias`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  });
  const data = await manejarRespuesta<{ categoria: Categoria }>(response);
  return data.categoria;
}

export async function editarCategoria(
  idCategoria: number,
  input: EditarCategoriaInput,
): Promise<Categoria> {
  const response = await fetch(`${API_URL}/api/categorias/${idCategoria}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  });
  const data = await manejarRespuesta<{ categoria: Categoria }>(response);
  return data.categoria;
}

export async function eliminarCategoria(idCategoria: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/categorias/${idCategoria}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return manejarRespuestaSinBody(response);
}
