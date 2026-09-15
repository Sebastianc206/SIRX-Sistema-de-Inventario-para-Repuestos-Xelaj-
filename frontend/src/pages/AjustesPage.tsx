import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { RepuestoSkuSelect } from "@/components/RepuestoSkuSelect";
import { IconMas } from "@/components/icons";
import { crearAjuste, listarTiposAjuste, AjusteApiError } from "@/services/ajusteService";
import type { SalidaAjusteFormLinea, TipoSalidaAjuste } from "@/types/movimiento";

// cantidad admite "" mientras se edita el campo — un number input
// controlado que fuerza Number("") a 0 de inmediato no deja borrar el 0 por
// defecto para escribir un valor nuevo. Se coerciona a number recién al
// enviar (ver handleSubmit).
type LineaEnEdicion = Omit<SalidaAjusteFormLinea, "cantidad"> & { cantidad: number | "" };

const LINEA_VACIA: LineaEnEdicion = { sku: "", cantidad: 1, idTipoSalida: "" };

// HU-09: salidas de inventario que NO son una venta (ajuste, merma, uso
// interno, garantía). Abierto a ambos roles: es una tarea operativa de
// bodega, sin datos de costo. El motivo vive por línea (no en un selector
// global) — un mismo registro puede traer, por ejemplo, una línea de merma
// y otra de garantía. El historial/reversión vive en Movimientos (visión
// unificada de auditoría, exclusiva de Administrador) — esta página es solo
// el formulario de registro; el banner de éxito ya confirma la operación.
export default function AjustesPage() {
  const [tipos, setTipos] = useState<TipoSalidaAjuste[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [lineas, setLineas] = useState<LineaEnEdicion[]>([{ ...LINEA_VACIA }]);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    listarTiposAjuste()
      .then(setTipos)
      .catch(() => setTipos([]));
  }, []);

  function actualizarLinea(indice: number, cambios: Partial<LineaEnEdicion>) {
    setLineas((actual) => actual.map((linea, i) => (i === indice ? { ...linea, ...cambios } : linea)));
  }

  function agregarLinea() {
    setLineas((actual) => [...actual, { ...LINEA_VACIA }]);
  }

  function quitarLinea(indice: number) {
    setLineas((actual) => actual.filter((_, i) => i !== indice));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (lineas.some((l) => !l.sku)) {
      setError("Selecciona un repuesto en cada línea");
      return;
    }
    if (lineas.some((l) => l.idTipoSalida === "")) {
      setError("Selecciona un motivo en cada línea");
      return;
    }
    if (lineas.some((l) => l.cantidad === "")) {
      setError("Completa la cantidad en cada línea");
      return;
    }

    setEnviando(true);
    try {
      const lineasFinales = lineas.map((l) => ({
        sku: l.sku,
        cantidad: Number(l.cantidad),
        idTipoSalida: Number(l.idTipoSalida),
      }));
      await crearAjuste({ lineas: lineasFinales });
      setMensaje("Salida registrada correctamente. El stock ya se actualizó.");
      setLineas([{ ...LINEA_VACIA }]);
    } catch (err) {
      setError(err instanceof AjusteApiError ? err.message : "No se pudo registrar la salida");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="admin-page">
        <Link to="/" className="admin-volver">
          ← Volver al panel
        </Link>

        <div className="admin-toolbar">
          <h2>Ajustes de inventario</h2>
        </div>

        {mensaje && (
          <p className="banner banner--success" role="status">
            {mensaje}
          </p>
        )}
        {error && (
          <p className="banner banner--error" role="alert">
            {error}
          </p>
        )}

        <form className="form-card" onSubmit={handleSubmit}>
          <h3>Registrar salida (ajuste o merma)</h3>

          <div className="lineas-tabla-wrap">
            <table className="lineas-tabla">
              <thead>
                <tr>
                  <th>Repuesto</th>
                  <th>Cantidad</th>
                  <th>Motivo</th>
                  <th aria-label="Eliminar" />
                </tr>
              </thead>
              <tbody>
                {lineas.map((linea, indice) => (
                  <tr key={indice}>
                    <td>
                      <RepuestoSkuSelect
                        value={linea.sku}
                        onChange={(sku) => actualizarLinea(indice, { sku })}
                        disabled={enviando}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={linea.cantidad}
                        disabled={enviando}
                        onChange={(event) =>
                          actualizarLinea(indice, {
                            cantidad: event.target.value === "" ? "" : Number(event.target.value),
                          })
                        }
                      />
                    </td>
                    <td>
                      <select
                        value={linea.idTipoSalida}
                        disabled={enviando}
                        onChange={(event) =>
                          actualizarLinea(indice, {
                            idTipoSalida: event.target.value === "" ? "" : Number(event.target.value),
                          })
                        }
                      >
                        <option value="">Selecciona un motivo</option>
                        {tipos.map((tipo) => (
                          <option key={tipo.idTipoSalida} value={tipo.idTipoSalida}>
                            {tipo.descripcion}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {lineas.length > 1 && (
                        <button
                          type="button"
                          className="btn-danger"
                          onClick={() => quitarLinea(indice)}
                          disabled={enviando}
                        >
                          Eliminar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lineas-acciones">
            <button type="button" className="btn-agregar-linea" onClick={agregarLinea} disabled={enviando}>
              <IconMas />
              Agregar línea
            </button>
          </div>

          <div className="modal-actions">
            <button type="submit" disabled={enviando}>
              {enviando ? "Registrando..." : "Registrar salida"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
