import { createContext, useContext } from "react";

export type ToastTone = "success" | "error" | "info" | "warning";

export interface ToastApi {
  success: (mensaje: string) => void;
  error: (mensaje: string) => void;
  info: (mensaje: string) => void;
  warning: (mensaje: string) => void;
}

const NOOP = () => undefined;

export const ToastContext = createContext<ToastApi>({ success: NOOP, error: NOOP, info: NOOP, warning: NOOP });

// Sin ToastProvider (p. ej. un componente aislado en un test) los avisos
// simplemente no se muestran: nunca rompe el render.
export function useToast(): ToastApi {
  return useContext(ToastContext);
}
