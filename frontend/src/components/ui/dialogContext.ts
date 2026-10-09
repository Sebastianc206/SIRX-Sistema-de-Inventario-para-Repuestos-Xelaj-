import { createContext, useContext } from "react";

interface DialogControl {
  // Pide cerrar respetando el aviso de cambios sin guardar.
  requestClose: () => void;
}

export const DialogContext = createContext<DialogControl>({ requestClose: () => undefined });

export function useDialogControl(): DialogControl {
  return useContext(DialogContext);
}
