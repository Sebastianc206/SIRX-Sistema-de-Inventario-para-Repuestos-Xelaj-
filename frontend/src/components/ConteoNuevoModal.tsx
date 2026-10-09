import { useState } from "react";
import type { FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { DialogBody, FormFooter, Modal } from "@/components/ui/Dialog";
import { Field, Input, Select } from "@/components/ui/Field";
import { crearConteo, ConteoApiError } from "@/services/conteoService";
import type { Categoria } from "@/types/categoria";
import type { Conteo } from "@/types/conteo";
import { hoyISO } from "@/utils/fechas";
import { fechaAMediodiaGT } from "@/utils/conteo";

interface ConteoNuevoModalProps {
  categorias: Categoria[];
  onClose: () => void;
  onCreado: (conteo: Conteo) => void;
}

function nombreSugerido(): string {
  const [a, m, d] = hoyISO().split("-");
  return `Conteo ${d}/${m}/${a}`;
}

// Un conteo nace en borrador: nombre, fecha y alcance (todo el catálogo o una
// categoría). Las cantidades se capturan después, en la pantalla del conteo.
export function ConteoNuevoModal({ categorias, onClose, onCreado }: ConteoNuevoModalProps) {
  const [nombre, setNombre] = useState(nombreSugerido);
  const [fecha, setFecha] = useState(hoyISO);
  const [idCategoria, setIdCategoria] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [modificado, setModificado] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (nombre.trim().length < 3) {
      setError("El nombre debe tener al menos 3 caracteres");
      return;
    }
    setEnviando(true);
    try {
      const conteo = await crearConteo({
        nombre: nombre.trim(),
        fechaConteo: fecha ? fechaAMediodiaGT(fecha) : undefined,
        idCategoria: idCategoria ? Number(idCategoria) : undefined,
      });
      onCreado(conteo);
    } catch (err) {
      setError(err instanceof ConteoApiError ? err.message : "No se pudo crear el conteo");
      setEnviando(false);
    }
  }

  return (
    <Modal title="Nuevo conteo físico" size="sm" dirty={modificado && !enviando} onClose={onClose}>
      <form className="dialog-form" onSubmit={enviar} onChange={() => setModificado(true)}>
        <DialogBody>
          <Field label="Nombre">
            {(p) => <Input {...p} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} required autoFocus />}
          </Field>
          <Field label="Fecha del conteo">
            {(p) => <Input {...p} type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} required />}
          </Field>
          <Field label="Alcance" hint="Con una categoría, solo se pueden contar productos de ella.">
            {(p) => (
              <Select {...p} value={idCategoria} onChange={(e) => setIdCategoria(e.target.value)}>
                <option value="">Todo el catálogo</option>
                {categorias.map((c) => (
                  <option key={c.idCategoria} value={c.idCategoria}>
                    {c.descripcion}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {error && <Alert tone="error">{error}</Alert>}
        </DialogBody>
        <FormFooter enviando={enviando} submitLabel="Crear y empezar a contar" enviandoLabel="Creando..." />
      </form>
    </Modal>
  );
}
