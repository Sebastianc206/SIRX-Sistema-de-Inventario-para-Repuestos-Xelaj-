import { useCallback, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { ToastContext } from "@/components/ui/toastContext";
import type { ToastApi, ToastTone } from "@/components/ui/toastContext";

interface ToastItem {
  id: number;
  tone: ToastTone;
  mensaje: string;
}

const ICONOS = { success: "checkCircle", error: "xCircle", info: "info", warning: "alert" } as const;
// Éxito/info se descartan solos (4-5 s); errores y avisos duran más para
// poder leerse. Todos se pueden cerrar a mano.
const DURACION: Record<ToastTone, number> = { success: 4500, info: 4500, warning: 8000, error: 8000 };
const MAXIMO_VISIBLES = 4;

function ToastCard({ item, onClose }: { item: ToastItem; onClose: (id: number) => void }) {
  const temporizador = useRef<ReturnType<typeof setTimeout>>();
  const programar = useCallback(() => {
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => onClose(item.id), DURACION[item.tone]);
  }, [item.id, item.tone, onClose]);

  // Se programa al montar y se pausa mientras hay hover/foco encima.
  const refInicial = useCallback(
    (el: HTMLDivElement | null) => {
      if (el) programar();
      else clearTimeout(temporizador.current);
    },
    [programar],
  );

  return (
    <div
      ref={refInicial}
      className={`toast toast--${item.tone}`}
      role={item.tone === "error" || item.tone === "warning" ? "alert" : "status"}
      onMouseEnter={() => clearTimeout(temporizador.current)}
      onMouseLeave={programar}
      onFocus={() => clearTimeout(temporizador.current)}
      onBlur={programar}
    >
      <Icon name={ICONOS[item.tone]} size={20} />
      <p className="toast-message">{item.mensaje}</p>
      <IconButton icon="x" label="Cerrar aviso" size="sm" sinTooltip onClick={() => onClose(item.id)} className="toast-close" />
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const contador = useRef(0);

  const cerrar = useCallback((id: number) => setToasts((actual) => actual.filter((t) => t.id !== id)), []);

  const agregar = useCallback((tone: ToastTone, mensaje: string) => {
    contador.current += 1;
    const id = contador.current;
    setToasts((actual) => [...actual, { id, tone, mensaje }].slice(-MAXIMO_VISIBLES));
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => agregar("success", m),
      error: (m) => agregar("error", m),
      info: (m) => agregar("info", m),
      warning: (m) => agregar("warning", m),
    }),
    [agregar],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="toast-region">
          {toasts.map((t) => (
            <ToastCard key={t.id} item={t} onClose={cerrar} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}
