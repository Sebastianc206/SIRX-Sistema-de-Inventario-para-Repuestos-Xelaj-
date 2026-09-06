import { TOKEN_KEY } from "@/context/AuthContext";
import type { Departamento, Marca, Modelo, Pais, Municipio } from "@/types/catalogosAuxiliares";

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

export async function listarModelos(): Promise<Modelo[]> {
  const response = await fetch(`${API_URL}/api/catalogos/modelos`, { headers: authHeaders() });
  if (!response.ok) return [];
  const data = await response.json();
  return data.modelos;
}

export async function listarPaises(): Promise<Pais[]> {
  const response = await fetch(`${API_URL}/api/catalogos/paises`, { headers: authHeaders() });
  if (!response.ok) return [];
  const data = await response.json();
  return data.paises;
}

export async function listarDepartamentos(): Promise<Departamento[]> {
  const response = await fetch(`${API_URL}/api/catalogos/departamentos`, { headers: authHeaders() });
  if (!response.ok) return [];
  const data = await response.json();
  return data.departamentos;
}

export async function listarMunicipios(): Promise<Municipio[]> {
  const response = await fetch(`${API_URL}/api/catalogos/municipios`, { headers: authHeaders() });
  if (!response.ok) return [];
  const data = await response.json();
  return data.municipios;
}
