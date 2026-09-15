import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { RepuestoSkuSelect } from "@/components/RepuestoSkuSelect";
import { IconMas } from "@/components/icons";
import { ProveedorRequeridoSelect } from "@/components/ProveedorRequeridoSelect";
import { crearCompra, listarCompras, CompraApiError } from "@/services/compraService";
import type { Compra, CompraFormLinea } from "@/types/movimiento";

// cantidad/precioCompra admiten "" mientras se edita el campo — un number
// input controlado que fuerza Number("") a 0 de inmediato no deja borrar el
// 0 por defecto para escribir un valor nuevo. Se coerciona a number recién
// al enviar (ver handleSubmit).
type LineaEnEdicion = Omit<CompraFormLinea, "cantidad" | "precioCompra"> & {
  cantidad: number | "";
  precioCompra: number | "";
};

const LINEA_VACIA: LineaEnEdicion = { sku: "", cantidad: 1, precioCompra: 0 };

// HU-08: registrar una compra a proveedor (una o varias líneas de
// producto, cada una suma stock) y consultar el historial ya registrado.
// Administrador-only en el backend (precioCompra es un dato de costo).
export default function ComprasPage() {
  const [compras, setCompras] = useState<Compra[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [idProveedor, setIdProveedor] = useState<number | undefined>(undefined);
  const [lineas, setLineas] = useState<LineaEnEdicion[]>([{ ...LINEA_VACIA }]);
  const [enviando, setEnviando] = useState(false);

  const cargarCompras = useCallback(async () => {
    setCargando(true);
    try {
      const resultado = await listarCompras();
      setCompras(resultado.compras);
    } catch (err) {
      setError(err instanceof CompraApiError ? err.message : "No se pudo cargar el historial de compras");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarCompras();
  }, [cargarCompras]);

  function actualizarLinea(indice: number, cambios: Partial<LineaEnEdicion>) {
    setLineas((actual) => actual.map((linea, i) => (i === indice ? { ...linea, ...cambios } : linea)));
  }

  function agregarLinea() {
    setLineas((actual) => [...actual, { ...LINEA_VACIA }]);
  }

  function quitarLinea(indice: number) {
    setLineas((actual) => actual.filter((_, i) => i !== indice));
  }

  const total = lineas.reduce((acumulado, l) => acumulado + Number(l.cantidad || 0) * Number(l.precioCompra || 0), 0);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (idProveedor === undefined) {
      setError("Selecciona un proveedor");
      return;
    }
    if (lineas.some((l) => !l.sku)) {
      setError("Selecciona un repuesto en cada línea");
      return;
    }
    if (lineas.some((l) => l.cantidad === "" || l.precioCompra === "")) {
      setError("Completa cantidad y precio de compra en cada línea");
      return;
    }

    setEnviando(true);
    try {
      const lineasFinales: CompraFormLinea[] = lineas.map((l) => ({
        sku: l.sku,
        cantidad: Number(l.cantidad),
        precioCompra: Number(l.precioCompra),
      }));
      await crearCompra({ idProveedor, lineas: lineasFinales });
      setMensaje("Compra registrada correctamente. El stock ya se actualizó.");
      setLineas([{ ...LINEA_VACIA }]);
      setIdProveedor(undefined);
      cargarCompras();
    } catch (err) {
      setError(err instanceof CompraApiError ? err.message : "No se pudo registrar la compra");
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
          <h2>Compras</h2>
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
          <h3>Registrar compra</h3>

          <div className="form-fila-cabecera">
            <ProveedorRequeridoSelect value={idProveedor} onChange={setIdProveedor} disabled={enviando} />
          </div>

          <div className="lineas-tabla-wrap">
            <table className="lineas-tabla">
              <thead>
                <tr>
                  <th>Repuesto</th>
                  <th>Cantidad</th>
                  <th>Precio de compra (Q)</th>
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
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={linea.precioCompra}
                        disabled={enviando}
                        onChange={(event) =>
                          actualizarLinea(indice, {
                            precioCompra: event.target.value === "" ? "" : Number(event.target.value),
                          })
                        }
                      />
                    </td>
                    <td className="lineas-tabla-subtotal">
                      Q{(Number(linea.cantidad || 0) * Number(linea.precioCompra || 0)).toFixed(2)}
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
              {enviando ? "Registrando..." : "Registrar compra"}
            </button>
          </div>
        </form>

        <div className="admin-toolbar">
          <h2>Historial de compras</h2>
        </div>

        {cargando ? (
          <p className="admin-estado-vacio">Cargando compras...</p>
        ) : compras.length === 0 ? (
          <p className="admin-estado-vacio">Todavía no hay compras registradas.</p>
        ) : (
          <div className="admin-tabla-wrap">
            <table className="admin-tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Proveedor</th>
                  <th>Líneas</th>
                  <th>Total</th>
                  <th>Registrada por</th>
                </tr>
              </thead>
              <tbody>
                {compras.map((compra) => (
                  <tr key={compra.idCompra}>
                    <td>{new Date(compra.fechaCompra).toLocaleDateString("es-GT")}</td>
                    <td>{compra.proveedor?.nombre ?? "—"}</td>
                    <td>{compra.lineas.map((l) => `${l.sku} (${l.cantidad})`).join(", ")}</td>
                    <td>{compra.montoTotalCompra !== undefined ? `Q${Number(compra.montoTotalCompra).toFixed(2)}` : "—"}</td>
                    <td>{compra.colaborador?.nombreCompleto ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
