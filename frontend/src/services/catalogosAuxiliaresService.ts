import { TOKEN_KEY } from "@/context/AuthContext";
import type { Marca, Modelo, Proveedor } from "@/types/catalogosAuxiliares";

const API_URL = import.meta.env.VITE_API_URL;

function authHeaders(): HeadersInit {
  const token = localStorage.getItem(TOKEN_KEY);
  return { Authorization: `Bearer ${token}` };
}

export async function listarMarcas(): Promise<Marca[]> {
  const response = await fetch(`${API_URL}/api/catalogos/marcas`, { headers: authHeaders() });
  if (!response.ok) return [];
  const data = await response.json();
  return data.marcas;
}

export async function listarProveedores(): Promise<Proveedor[]> {
  const response = await fetch(`${API_URL}/api/catalogos/proveedores`, { headers: authHeaders() });
  if (!response.ok) return [];
  const data = await response.json();
  return data.proveedores;
}

export async function listarModelos(): Promise<Modelo[]> {
  const response = await fetch(`${API_URL}/api/catalogos/modelos`, { headers: authHeaders() });
  if (!response.ok) return [];
  const data = await response.json();
  return data.modelos;
}
