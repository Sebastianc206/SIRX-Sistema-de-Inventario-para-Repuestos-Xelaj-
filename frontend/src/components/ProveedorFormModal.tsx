import { useId, useState } from "react";
import type { FormEvent } from "react";
import { PaisSelect } from "@/components/PaisSelect";
import { DepartamentoSelect } from "@/components/DepartamentoSelect";
import { MunicipioSelect } from "@/components/MunicipioSelect";
import { crearProveedor, editarProveedor, ProveedorApiError } from "@/services/proveedorService";
import type { Proveedor } from "@/types/proveedor";

interface ProveedorFormModalProps {
  // null = crear un proveedor nuevo; un Proveedor = editar ese proveedor.
  proveedor: Proveedor | null;
  onClose: () => void;
  onGuardado: (mensaje: string) => void;
}

export function ProveedorFormModal({ proveedor, onClose, onGuardado }: ProveedorFormModalProps) {
  const esEdicion = proveedor !== null;
  const tituloId = useId();
  const nombreId = useId();
  const direccionId = useId();
  const contactoId = useId();

  const [nombre, setNombre] = useState(proveedor?.nombre ?? "");
  const [direccion, setDireccion] = useState(proveedor?.direccion ?? "");
  const [contacto, setContacto] = useState(proveedor?.contacto ?? "");
  const [idPais, setIdPais] = useState<number | undefined>(proveedor?.idPais);
  const [idDepartamento, setIdDepartamento] = useState<number | undefined>(
    proveedor?.idDepartamento ?? undefined,
  );
  const [idMunicipio, setIdMunicipio] = useState<number | undefined>(proveedor?.idMunicipio ?? undefined);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function handleCambiarDepartamento(nuevoIdDepartamento: number | undefined) {
    setIdDepartamento(nuevoIdDepartamento);
    // Si el municipio elegido ya no corresponde al nuevo departamento, se
    // limpia — evita mandar una combinación inconsistente que el backend
    // igual rechazaría (ver proveedorService.validarReferencias).
    setIdMunicipio(undefined);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (idPais === undefined) {
      setError("Selecciona un país");
      return;
    }

    setEnviando(true);
    try {
      const datos = {
        nombre: nombre.trim(),
        direccion: direccion.trim() || undefined,
        contacto: contacto.trim() || undefined,
        idPais,
        idDepartamento,
        idMunicipio,
      };

      if (esEdicion) {
        await editarProveedor(proveedor.idProveedor, datos);
        onGuardado("Proveedor actualizado correctamente.");
      } else {
        await crearProveedor(datos);
        onGuardado("Proveedor creado correctamente.");
      }
    } catch (err) {
      setError(err instanceof ProveedorApiError ? err.message : "No se pudo guardar el proveedor");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={tituloId}>{esEdicion ? "Editar proveedor" : "Nuevo proveedor"}</h2>

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor={nombreId}>Nombre</label>
            <input
              id={nombreId}
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              maxLength={150}
              autoFocus
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor={direccionId}>Dirección (opcional)</label>
            <input
              id={direccionId}
              value={direccion}
              onChange={(event) => setDireccion(event.target.value)}
              maxLength={255}
            />
          </div>

          <div className="login-field">
            <label htmlFor={contactoId}>Contacto (opcional)</label>
            <input
              id={contactoId}
              value={contacto}
              onChange={(event) => setContacto(event.target.value)}
              placeholder="Teléfono, correo o nombre de contacto"
              maxLength={255}
            />
          </div>

          <PaisSelect value={idPais} onChange={setIdPais} disabled={enviando} />
          <DepartamentoSelect value={idDepartamento} onChange={handleCambiarDepartamento} disabled={enviando} />
          <MunicipioSelect
            value={idMunicipio}
            onChange={setIdMunicipio}
            idDepartamento={idDepartamento}
            disabled={enviando}
          />

          {error && (
            <p className="banner banner--error" role="alert">
              {error}
            </p>
          )}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={enviando}>
              Cancelar
            </button>
            <button type="submit" disabled={enviando}>
              {enviando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
