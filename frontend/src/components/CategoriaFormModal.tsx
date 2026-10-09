import { useId, useState } from "react";
import type { FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { DialogBody, FormFooter, Modal } from "@/components/ui/Dialog";
import { crearCategoria, editarCategoria, CategoriaApiError } from "@/services/categoriaService";
import type { Categoria } from "@/types/categoria";

interface CategoriaFormModalProps {
  // null = crear una categoría nueva; una Categoria = editar esa categoría.
  categoria: Categoria | null;
  onClose: () => void;
  onGuardado: (mensaje: string) => void;
}

export function CategoriaFormModal({ categoria, onClose, onGuardado }: CategoriaFormModalProps) {
  const esEdicion = categoria !== null;
  const descripcionId = useId();

  const [descripcion, setDescripcion] = useState(categoria?.descripcion ?? "");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [modificado, setModificado] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (descripcion.trim().length === 0) {
      setError("La descripción es requerida");
      return;
    }

    setEnviando(true);
    try {
      if (esEdicion) {
        await editarCategoria(categoria.idCategoria, { descripcion });
        onGuardado("Categoría actualizada correctamente.");
      } else {
        await crearCategoria({ descripcion });
        onGuardado("Categoría creada correctamente.");
      }
    } catch (err) {
      setError(err instanceof CategoriaApiError ? err.message : "No se pudo guardar la categoría");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal title={esEdicion ? "Editar categoría" : "Nueva categoría"} size="sm" dirty={modificado && !enviando} onClose={onClose}>
      <form className="dialog-form" onSubmit={handleSubmit} onChange={() => setModificado(true)}>
        <DialogBody>
          <div className="login-field">
            <label htmlFor={descripcionId}>Descripción</label>
            <input
              id={descripcionId}
              value={descripcion}
              onChange={(event) => setDescripcion(event.target.value)}
              maxLength={100}
              autoFocus
              required
            />
          </div>

          {error && <Alert tone="error">{error}</Alert>}
        </DialogBody>
        <FormFooter enviando={enviando} />
      </form>
    </Modal>
  );
}
