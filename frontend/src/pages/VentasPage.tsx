import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { RepuestoSkuSelect } from "@/components/RepuestoSkuSelect";
import { IconMas } from "@/components/icons";
import { crearVenta, VentaApiError } from "@/services/ventaService";
import type { Repuesto } from "@/types/repuesto";
import type { VentaFormLinea } from "@/types/movimiento";

// cantidad/precioVenta admiten "" mientras se edita el campo — un number
// input controlado que fuerza Number("") a 0 de inmediato no deja borrar el
// 0 por defecto para escribir un valor nuevo. Se coerciona a number recién
// al enviar (ver handleSubmit).
type LineaEnEdicion = Omit<VentaFormLinea, "cantidad" | "precioVenta"> & {
  cantidad: number | "";
  precioVenta: number | "";
  // Contexto de solo lectura (no se envía al backend): la marca del
  // repuesto elegido, para que el operador confirme que está vendiendo el
  // producto correcto antes de cobrar.
  marca: string | null;
};

const LINEA_VACIA: LineaEnEdicion = { sku: "", cantidad: 1, precioVenta: 0, marca: null };

// HU-13: venta de mostrador con una o varias líneas de producto — descuenta
// stock y calcula el total. Abierto a ambos roles (CLAUDE.md: "Operador:
// counter sales"). El historial/reversión de ventas vive en Movimientos
// (visión unificada de auditoría, exclusiva de Administrador) — esta página
// es solo el formulario de registro; el banner de éxito ya confirma la
// operación.
export default function VentasPage() {
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [lineas, setLineas] = useState<LineaEnEdicion[]>([{ ...LINEA_VACIA }]);
  const [enviando, setEnviando] = useState(false);

  function actualizarLinea(indice: number, cambios: Partial<LineaEnEdicion>) {
    setLineas((actual) => actual.map((linea, i) => (i === indice ? { ...linea, ...cambios } : linea)));
  }

  // HU-13: al elegir un repuesto, autocompleta el precio de venta con el
  // del catálogo (el usuario sigue pudiendo cambiarlo después) y muestra la
  // marca como contexto de solo lectura — ayuda a confirmar que es el
  // producto correcto antes de cobrar, no se envía al backend.
  function handleSeleccionarRepuesto(indice: number, repuesto: Repuesto) {
    actualizarLinea(indice, {
      precioVenta: Number(repuesto.precioVenta),
      marca: repuesto.marca?.nombre ?? null,
    });
  }

  function agregarLinea() {
    setLineas((actual) => [...actual, { ...LINEA_VACIA }]);
  }

  function quitarLinea(indice: number) {
    setLineas((actual) => actual.filter((_, i) => i !== indice));
  }

  const total = lineas.reduce((acumulado, l) => acumulado + Number(l.cantidad || 0) * Number(l.precioVenta || 0), 0);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (lineas.some((l) => !l.sku)) {
      setError("Selecciona un repuesto en cada línea");
      return;
    }
    if (lineas.some((l) => l.cantidad === "" || l.precioVenta === "")) {
      setError("Completa cantidad y precio de venta en cada línea");
      return;
    }

    setEnviando(true);
    try {
      const lineasFinales: VentaFormLinea[] = lineas.map((l) => ({
        sku: l.sku,
        cantidad: Number(l.cantidad),
        precioVenta: Number(l.precioVenta),
      }));
      const venta = await crearVenta({ lineas: lineasFinales });
      setMensaje(`Venta registrada por Q${Number(venta.montoTotalVenta).toFixed(2)}. El stock ya se actualizó.`);
      setLineas([{ ...LINEA_VACIA }]);
    } catch (err) {
      setError(err instanceof VentaApiError ? err.message : "No se pudo registrar la venta");
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
          <h2>Ventas</h2>
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
          <h3>Registrar venta de mostrador</h3>

          <div className="lineas-tabla-wrap">
            <table className="lineas-tabla">
              <thead>
                <tr>
                  <th>Repuesto</th>
                  <th>Cantidad</th>
                  <th>Precio de venta (Q)</th>
                  <th>Subtotal</th>
                  <th aria-label="Quitar" />
                </tr>
              </thead>
              <tbody>
                {lineas.map((linea, indice) => (
                  <tr key={indice}>
                    <td>
                      <RepuestoSkuSelect
                        value={linea.sku}
                        onChange={(sku) => actualizarLinea(indice, sku === "" ? { sku, marca: null } : { sku })}
                        onSeleccionar={(repuesto) => handleSeleccionarRepuesto(indice, repuesto)}
                        disabled={enviando}
                      />
                      {linea.marca && <p className="modal-helper-text">Marca: {linea.marca}</p>}
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
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={linea.precioVenta}
                        disabled={enviando}
                        onChange={(event) =>
                          actualizarLinea(indice, {
                            precioVenta: event.target.value === "" ? "" : Number(event.target.value),
                          })
                        }
                      />
                    </td>
                    <td className="lineas-tabla-subtotal">
                      Q{(Number(linea.cantidad || 0) * Number(linea.precioVenta || 0)).toFixed(2)}
                    </td>
                    <td>
                      {lineas.length > 1 && (
                        <button
                          type="button"
                          className="btn-danger"
                          onClick={() => quitarLinea(indice)}
                          disabled={enviando}
                        >
                          Quitar
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
            <span className="lineas-total">Total: Q{total.toFixed(2)}</span>
          </div>

          <div className="modal-actions">
            <button type="submit" disabled={enviando}>
              {enviando ? "Registrando..." : "Registrar venta"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
