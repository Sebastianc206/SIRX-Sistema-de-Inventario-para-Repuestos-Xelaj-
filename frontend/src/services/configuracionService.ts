import { TOKEN_KEY } from "@/context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL;

export class ConfiguracionApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ConfiguracionApiError";
    this.status = status;
  }
}

export interface ImpactoUmbral {
  totalActivos: number;
  enBajo: number;
  agotados: number;
  conUmbralPropio: number;
}

export interface ConfiguracionStock {
  umbralGeneral: number;
  impacto: ImpactoUmbral;
}

export const UMBRAL_MAXIMO = 10000;

function authHeaders(): HeadersInit {
  const token = localStorage.getItem(TOKEN_KEY);
  return { Authorization: `Bearer ${token}` };
}

async function manejarRespuesta<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ConfiguracionApiError(data.message || "Ocurrió un error inesperado", response.status);
  }
  return data as T;
}

// Solo Administrador (el backend responde 403 al resto).
export async function obtenerConfiguracionStock(): Promise<ConfiguracionStock> {
  const response = await fetch(`${API_URL}/api/configuracion/stock`, { headers: authHeaders() });
  return manejarRespuesta<ConfiguracionStock>(response);
}

export async function previsualizarImpacto(umbral: number): Promise<ImpactoUmbral> {
  const response = await fetch(`${API_URL}/api/configuracion/stock/impacto?umbral=${encodeURIComponent(String(umbral))}`, {
    headers: authHeaders(),
  });
  const data = await manejarRespuesta<{ impacto: ImpactoUmbral }>(response);
  return data.impacto;
}

export async function guardarUmbralGeneral(umbralGeneral: number): Promise<ConfiguracionStock> {
  const response = await fetch(`${API_URL}/api/configuracion/stock`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ umbralGeneral }),
  });
  return manejarRespuesta<ConfiguracionStock>(response);
}

// Ajuste masivo del umbral propio: por categoría o por lista de SKUs.
// umbral = null restablece (los productos vuelven a usar el general).
export async function aplicarUmbralMasivo(input: {
  umbral: number | null;
  idCategoria?: number;
  skus?: string[];
}): Promise<{ actualizados: number }> {
  const response = await fetch(`${API_URL}/api/configuracion/stock/umbral-masivo`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  });
  return manejarRespuesta<{ actualizados: number }>(response);
}
