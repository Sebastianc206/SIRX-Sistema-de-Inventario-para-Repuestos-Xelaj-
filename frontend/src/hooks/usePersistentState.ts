import { useCallback, useState } from "react";

// useState respaldado por localStorage (preferencias de UI por navegador:
// densidad de tablas, sidebar colapsado). Todo acceso va en try/catch porque
// el almacenamiento puede estar bloqueado (ventana privada, políticas).
export function usePersistentState<T extends string | boolean>(clave: string, inicial: T): [T, (valor: T) => void] {
  const [valor, setValor] = useState<T>(() => {
    try {
      const guardado = localStorage.getItem(clave);
      if (guardado === null) return inicial;
      return (typeof inicial === "boolean" ? guardado === "true" : guardado) as T;
    } catch {
      return inicial;
    }
  });

  const actualizar = useCallback(
    (nuevo: T) => {
      setValor(nuevo);
      try {
        localStorage.setItem(clave, String(nuevo));
      } catch {
        // Sin almacenamiento: la preferencia vive solo en memoria.
      }
    },
    [clave],
  );

  return [valor, actualizar];
}
