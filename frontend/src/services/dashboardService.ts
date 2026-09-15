import { TOKEN_KEY } from "@/context/AuthContext";
import type { ResumenDashboard } from "@/types/movimiento";

const API_URL = import.meta.env.VITE_API_URL;

function authHeaders(): HeadersInit {
  const token = localStorage.getItem(TOKEN_KEY);
  return { Authorization: `Bearer ${token}` };
}

export async function obtenerResumenDashboard(): Promise<ResumenDashboard> {
  const response = await fetch(`${API_URL}/api/dashboard/resumen`, { headers: authHeaders() });
  if (!response.ok) {
    throw new Error("No se pudo cargar el resumen del tablero");
  }
  return (await response.json()) as ResumenDashboard;
}
