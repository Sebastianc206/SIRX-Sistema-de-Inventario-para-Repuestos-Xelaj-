import type { LoginResponse, Usuario } from "@/types/auth";

const API_URL = import.meta.env.VITE_API_URL;

// Preserva el status HTTP (401 credenciales inválidas, 423 cuenta
// bloqueada, etc.) para que la UI pueda diferenciar el mensaje/estilo.
export class AuthApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthApiError";
    this.status = status;
  }
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new AuthApiError(data.message || "No se pudo iniciar sesión", response.status);
  }

  return data as LoginResponse;
}

export async function fetchCurrentUser(token: string): Promise<Usuario> {
  const response = await fetch(`${API_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Sesión inválida");
  }

  return data.usuario as Usuario;
}
