import { useCallback, useEffect, useRef, useState } from "react";

interface EstadoAsync<T> {
  data: T | null;
  cargando: boolean;
  error: string | null;
  recargar: () => void;
}

// Carga asíncrona con estados de carga/error/reintento. Ignora respuestas de
// llamadas obsoletas (cambio de dependencias o desmontaje).
export function useAsync<T>(fn: () => Promise<T>, deps: ReadonlyArray<unknown>, mensajeError = "No se pudo cargar la información"): EstadoAsync<T> {
  const [data, setData] = useState<T | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);
    fnRef
      .current()
      .then((resultado) => {
        if (vigente) setData(resultado);
      })
      .catch((err: unknown) => {
        if (vigente) setError(err instanceof Error && err.message ? err.message : mensajeError);
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version, mensajeError]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  return { data, cargando, error, recargar };
}
