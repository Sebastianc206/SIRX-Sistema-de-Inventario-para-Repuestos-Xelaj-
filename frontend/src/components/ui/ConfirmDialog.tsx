import { useId } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Overlay } from "@/components/ui/Overlay";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Confirmación reutilizable para acciones destructivas (dar de baja,
// eliminar, anular, descartar cambios). role="alertdialog"; el foco inicial
// cae en "Cancelar" (opción segura) y Escape cancela.
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  tone = "danger",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();

  if (!open) return null;

  return (
    <Overlay
      variant="alert"
      role="alertdialog"
      size="sm"
      labelledBy={titleId}
      describedBy={description ? descId : undefined}
      onRequestClose={() => {
        if (!loading) onCancel();
      }}
    >
      <div className="dialog-body confirm-body">
        <span className={`confirm-icon confirm-icon--${tone}`}>
          <Icon name={tone === "danger" ? "alert" : "info"} size={22} />
        </span>
        <div>
          <h2 id={titleId} className="confirm-title">
            {title}
          </h2>
          {description && (
            <p id={descId} className="confirm-description">
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="dialog-footer">
        <Button variant="secondary" onClick={onCancel} disabled={loading} data-autofocus>
          {cancelLabel}
        </Button>
        <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Overlay>
  );
}
