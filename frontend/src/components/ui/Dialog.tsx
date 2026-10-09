import { useId, useState } from "react";
import type { ReactNode } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { DialogContext, useDialogControl } from "@/components/ui/dialogContext";
import { IconButton } from "@/components/ui/IconButton";
import { Overlay } from "@/components/ui/Overlay";

interface DialogProps {
  title: string;
  description?: string;
  // Hay cambios sin guardar: cerrar (Escape, fondo, X, Cancelar) pide
  // confirmación antes de descartar.
  dirty?: boolean;
  size?: "sm" | "md" | "lg";
  onClose: () => void;
  children: ReactNode;
}

function DialogBase({ variant, title, description, dirty = false, size = "md", onClose, children }: DialogProps & { variant: "modal" | "drawer" }) {
  const titleId = useId();
  const descId = useId();
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);

  function requestClose() {
    if (dirty) setConfirmandoDescarte(true);
    else onClose();
  }

  return (
    <DialogContext.Provider value={{ requestClose }}>
      <Overlay variant={variant} size={size} labelledBy={titleId} describedBy={description ? descId : undefined} onRequestClose={requestClose}>
        <header className="dialog-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && (
              <p id={descId} className="dialog-description">
                {description}
              </p>
            )}
          </div>
          <IconButton icon="x" label="Cerrar" onClick={requestClose} tooltipSide="abajo" />
        </header>
        {children}
      </Overlay>
      <ConfirmDialog
        open={confirmandoDescarte}
        title="¿Descartar los cambios?"
        description="Tienes cambios sin guardar. Si sales ahora, se perderán."
        confirmLabel="Descartar cambios"
        cancelLabel="Seguir editando"
        onConfirm={() => {
          setConfirmandoDescarte(false);
          onClose();
        }}
        onCancel={() => setConfirmandoDescarte(false)}
      />
    </DialogContext.Provider>
  );
}

// Modal centrado: formularios cortos y mensajes.
export function Modal(props: DialogProps) {
  return <DialogBase variant="modal" {...props} />;
}

// Panel lateral: formularios largos de crear/editar. Pantalla completa en móvil.
export function Drawer(props: DialogProps) {
  return <DialogBase variant="drawer" {...props} />;
}

export function DialogBody({ children }: { children: ReactNode }) {
  return <div className="dialog-body">{children}</div>;
}

export function DialogFooter({ children }: { children: ReactNode }) {
  return <div className="dialog-footer">{children}</div>;
}

interface FormFooterProps {
  enviando: boolean;
  submitLabel?: string;
  enviandoLabel?: string;
  cancelLabel?: string;
  // Deshabilita "Guardar" (p. ej. formulario incompleto).
  submitDisabled?: boolean;
}

// Pie estándar de los formularios en Drawer/Modal: "Cancelar" pasa por
// requestClose (aviso de cambios sin guardar) y "Guardar" envía el <form>
// que lo contiene.
export function FormFooter({ enviando, submitLabel = "Guardar", enviandoLabel = "Guardando...", cancelLabel = "Cancelar", submitDisabled }: FormFooterProps) {
  const { requestClose } = useDialogControl();
  return (
    <DialogFooter>
      <Button variant="secondary" onClick={requestClose} disabled={enviando}>
        {cancelLabel}
      </Button>
      <Button type="submit" loading={enviando} disabled={submitDisabled}>
        {enviando ? enviandoLabel : submitLabel}
      </Button>
    </DialogFooter>
  );
}
