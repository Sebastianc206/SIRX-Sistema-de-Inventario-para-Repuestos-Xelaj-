import { TOKEN_KEY } from "@/context/AuthContext";
import type { ArchivoDescargado, DefinicionReporte, FiltrosReporte, FormatoReporte, Reporte } from "@/types/reporte";

const API_URL = import.meta.env.VITE_API_URL;

export class ReporteApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ReporteApiError";
    this.status = status;
  }
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem(TOKEN_KEY);
  return { Authorization: `Bearer ${token}` };
}

async function errorDe(response: Response): Promise<ReporteApiError> {
  const data = await response.json().catch(() => ({}));
  return new ReporteApiError(data.message || "Ocurrió un error inesperado", response.status);
}

// Solo llegan los reportes que el rol puede ver (el filtro real es del backend).
export async function listarReportes(): Promise<DefinicionReporte[]> {
  const response = await fetch(`${API_URL}/api/reportes`, { headers: authHeaders() });
  if (!response.ok) throw await errorDe(response);
  const data = (await response.json()) as { reportes: DefinicionReporte[] };
  return data.reportes;
}

function limpiar(filtros: FiltrosReporte): Record<string, string> {
  return Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== undefined && v !== ""));
}

export async function obtenerVistaPrevia(id: string, filtros: FiltrosReporte, signal?: AbortSignal): Promise<Reporte> {
  const params = new URLSearchParams(limpiar(filtros));
  const response = await fetch(`${API_URL}/api/reportes/${encodeURIComponent(id)}?${params.toString()}`, {
    headers: authHeaders(),
    signal,
  });
  if (!response.ok) throw await errorDe(response);
  return (await response.json()) as Reporte;
}

function nombreDeCabecera(response: Response, respaldo: string): string {
  const cabecera = response.headers.get("Content-Disposition") ?? "";
  const m = /filename="?([^";]+)"?/i.exec(cabecera);
  return m ? m[1] : respaldo;
}

// Uno o varios reportes en un mismo archivo. PDF/Excel salen combinados; CSV
// con varios reportes sale como ZIP (lo decide el backend).
export async function descargarReportes(
  formato: FormatoReporte,
  reportes: { tipo: string; filtros: FiltrosReporte }[],
): Promise<ArchivoDescargado> {
  const response = await fetch(`${API_URL}/api/reportes/descargar`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ formato, reportes: reportes.map((r) => ({ tipo: r.tipo, filtros: limpiar(r.filtros) })) }),
  });
  if (!response.ok) throw await errorDe(response);
  const blob = await response.blob();
  const extension = reportes.length > 1 && formato === "csv" ? "zip" : formato;
  return { blob, nombre: nombreDeCabecera(response, `sirx_reporte.${extension}`) };
}

// Dispara la descarga en el navegador (también macOS/Safari).
export function guardarArchivo({ blob, nombre }: ArchivoDescargado): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
