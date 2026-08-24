import type { LoginResponse, Usuario } from "@/types/auth";

const API_URL = import.meta.env.VITE_API_URL;

export async function login(username: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "No se pudo iniciar sesión");
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
