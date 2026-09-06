import { useId, useState } from "react";
import type { FormEvent } from "react";
import {
  cargarRepuestosMasivo,
  descargarPlantillaRepuestos,
  RepuestoApiError,
} from "@/services/repuestoService";
import type { CargaMasivaResultado } from "@/types/repuesto";

interface CargaMasivaRepuestosModalProps {
  onClose: () => void;
  // Se llama solo si al menos una fila se creó, para refrescar el listado
  // (T-048: el resumen de la carga se muestra en este mismo modal, no hace
  // falta cerrarlo para verlo).
  onCargaCompleta: () => void;
}

export function CargaMasivaRepuestosModal({ onClose, onCargaCompleta }: CargaMasivaRepuestosModalProps) {
  const tituloId = useId();
  const archivoId = useId();

  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<CargaMasivaResultado | null>(null);

  async function handleDescargarPlantilla() {
    try {
      await descargarPlantillaRepuestos();
    } catch (err) {
      setError(err instanceof RepuestoApiError ? err.message : "No se pudo descargar la plantilla");
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!archivo) {
      setError("Selecciona un archivo Excel (.xlsx)");
      return;
    }

    setEnviando(true);
    try {
      const datos = await cargarRepuestosMasivo(archivo);
      setResultado(datos);
      if (datos.creadas.length > 0) {
        onCargaCompleta();
      }
    } catch (err) {
      setError(err instanceof RepuestoApiError ? err.message : "No se pudo procesar el archivo");
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
        <h2 id={tituloId}>Carga masiva de repuestos</h2>

        {resultado ? (
          <div>
            <p className="banner banner--success" role="status">
              {resultado.creadas.length} repuesto{resultado.creadas.length === 1 ? "" : "s"} creado
              {resultado.creadas.length === 1 ? "" : "s"} correctamente.
            </p>

            {resultado.errores.length > 0 && (
              <>
                <p className="banner banner--error" role="alert">
                  {resultado.errores.length} fila{resultado.errores.length === 1 ? "" : "s"} con error —
                  no se creó ese repuesto, el resto de la carga no se vio afectado.
                </p>
                <div className="admin-tabla-wrap">
                  <table className="admin-tabla">
                    <thead>
                      <tr>
                        <th>Fila</th>
                        <th>SKU</th>
                        <th>Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.errores.map((fila) => (
                        <tr key={fila.fila}>
                          <td>{fila.fila}</td>
                          <td>{fila.sku || "—"}</td>
                          <td>{fila.motivo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="modal-actions">
              <button type="button" onClick={onClose}>
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="modal-helper-text">
              Descarga la plantilla, complétala con tu catálogo y súbela aquí. Las categorías, marcas y
              proveedores que uses deben existir de antemano (créalos primero en su propia sección) —
              se identifican por nombre, no por id.
            </p>

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={handleDescargarPlantilla}>
                ⬇ Descargar plantilla
              </button>
            </div>

            <div className="login-field">
              <label htmlFor={archivoId}>Archivo Excel (.xlsx)</label>
              <input
                id={archivoId}
                type="file"
                accept=".xlsx"
                onChange={(event) => setArchivo(event.target.files?.[0] ?? null)}
              />
            </div>

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
                {enviando ? "Procesando..." : "Cargar"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
