import { useId, useState } from "react";
import type { FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { DialogBody, DialogFooter, Modal } from "@/components/ui/Dialog";
import { useDialogControl } from "@/components/ui/dialogContext";
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
    <Modal title="Carga masiva de repuestos" size="lg" dirty={archivo !== null && !resultado && !enviando} onClose={onClose}>
      {resultado ? (
        <>
          <DialogBody>
            <Alert tone="success">
              {resultado.creadas.length} repuesto{resultado.creadas.length === 1 ? "" : "s"} creado
              {resultado.creadas.length === 1 ? "" : "s"} correctamente.
            </Alert>

            {resultado.errores.length > 0 && (
              <>
                <Alert tone="error">
                  {resultado.errores.length} fila{resultado.errores.length === 1 ? "" : "s"} con error — no se creó ese repuesto, el resto de la
                  carga no se vio afectado.
                </Alert>
                <div className="dt">
                  <div className="dt-scroll">
                    <table>
                      <caption className="sr-only">Filas con error de la carga masiva</caption>
                      <thead>
                        <tr>
                          <th scope="col">Fila</th>
                          <th scope="col">SKU</th>
                          <th scope="col">Motivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultado.errores.map((fila) => (
                          <tr key={fila.fila}>
                            <td data-label="Fila">{fila.fila}</td>
                            <td data-label="SKU">{fila.sku || "—"}</td>
                            <td data-label="Motivo">{fila.motivo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </DialogBody>
          <DialogFooter>
            <Button onClick={onClose}>Cerrar</Button>
          </DialogFooter>
        </>
      ) : (
        <form className="dialog-form" onSubmit={handleSubmit}>
          <DialogBody>
            <p className="modal-helper-text">
              Descarga la plantilla, complétala con tu catálogo y súbela aquí. Las categorías, marcas y proveedores que uses deben existir de
              antemano (créalos primero en su propia sección) — se identifican por nombre, no por id.
            </p>

            <div className="modal-actions">
              <Button variant="secondary" icon="download" onClick={handleDescargarPlantilla}>
                Descargar plantilla
              </Button>
            </div>

            <div className="login-field">
              <label htmlFor={archivoId}>Archivo Excel (.xlsx)</label>
              <input id={archivoId} type="file" accept=".xlsx" onChange={(event) => setArchivo(event.target.files?.[0] ?? null)} />
            </div>

            {error && <Alert tone="error">{error}</Alert>}
          </DialogBody>
          <DialogFooter>
            <CancelarCarga enviando={enviando} />
            <Button type="submit" loading={enviando}>
              {enviando ? "Procesando..." : "Cargar"}
            </Button>
          </DialogFooter>
        </form>
      )}
    </Modal>
  );
}

function CancelarCarga({ enviando }: { enviando: boolean }) {
  const { requestClose } = useDialogControl();
  return (
    <Button variant="secondary" onClick={requestClose} disabled={enviando}>
      Cancelar
    </Button>
  );
}
