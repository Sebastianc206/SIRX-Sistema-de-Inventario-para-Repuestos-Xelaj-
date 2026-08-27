import { TOKEN_KEY } from "@/context/AuthContext";
import type { CrearUsuarioInput, EditarUsuarioInput, UsuarioAdmin } from "@/types/usuario";

const API_URL = import.meta.env.VITE_API_URL;

// Igual que AuthApiError: conserva el status HTTP para que la UI pueda
// distinguir, por ejemplo, un 409 (username duplicado) de un 400.
export class UsuarioApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "UsuarioApiError";
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
    throw new UsuarioApiError(data.message || "Ocurrió un error inesperado", response.status);
  }

  return data as T;
}

export interface FiltrosUsuarios {
  estado?: "activo" | "inactivo";
  idRol?: number;
}

export async function listarUsuarios(filtros: FiltrosUsuarios = {}): Promise<UsuarioAdmin[]> {
  const params = new URLSearchParams();
  if (filtros.estado) params.set("estado", filtros.estado);
  if (filtros.idRol !== undefined) params.set("rol", String(filtros.idRol));

  const response = await fetch(`${API_URL}/api/usuarios?${params.toString()}`, {
    headers: authHeaders(),
  });
  const data = await manejarRespuesta<{ usuarios: UsuarioAdmin[] }>(response);
  return data.usuarios;
}

export async function crearUsuario(input: CrearUsuarioInput): Promise<UsuarioAdmin> {
  const response = await fetch(`${API_URL}/api/usuarios`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  });
  const data = await manejarRespuesta<{ usuario: UsuarioAdmin }>(response);
  return data.usuario;
}

export async function editarUsuario(
  idColaborador: number,
  input: EditarUsuarioInput,
): Promise<UsuarioAdmin> {
  const response = await fetch(`${API_URL}/api/usuarios/${idColaborador}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  });
  const data = await manejarRespuesta<{ usuario: UsuarioAdmin }>(response);
  return data.usuario;
}

export async function cambiarEstadoUsuario(
  idColaborador: number,
  vigente: boolean,
): Promise<UsuarioAdmin> {
  const response = await fetch(`${API_URL}/api/usuarios/${idColaborador}/estado`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ vigente }),
  });
  const data = await manejarRespuesta<{ usuario: UsuarioAdmin }>(response);
  return data.usuario;
}
