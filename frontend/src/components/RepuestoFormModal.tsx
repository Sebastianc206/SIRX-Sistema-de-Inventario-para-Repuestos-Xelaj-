import { useId, useState } from "react";
import type { FormEvent } from "react";
import { CategoriaSelect } from "@/components/CategoriaSelect";
import type { RepuestoFormInput } from "@/types/repuesto";

interface RepuestoFormModalProps {
  onClose: () => void;
  // Inyectado por quien use el modal: todavía no existe un endpoint de
  // Articulo (esa es otra tarea, "CRUD de repuestos"), así que este
  // formulario no asume ningún servicio concreto para guardar los datos.
  onSubmit: (datos: RepuestoFormInput) => Promise<void>;
}

export function RepuestoFormModal({ onClose, onSubmit }: RepuestoFormModalProps) {
  const tituloId = useId();
  const skuId = useId();
  const nombreId = useId();
  const precioId = useId();
  const inventarioMinimoId = useId();

  const [sku, setSku] = useState("");
  const [nombre, setNombre] = useState("");
  const [precioVenta, setPrecioVenta] = useState("");
  const [inventarioMinimo, setInventarioMinimo] = useState("0");
  const [idCategoria, setIdCategoria] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (idCategoria === undefined) {
      setError("Selecciona una categoría");
      return;
    }

    const precio = Number(precioVenta);
    if (!Number.isFinite(precio) || precio <= 0) {
      setError("El precio de venta debe ser un número mayor a 0");
      return;
    }

    const minimo = Number(inventarioMinimo);
    if (!Number.isInteger(minimo) || minimo < 0) {
      setError("El inventario mínimo debe ser un número entero mayor o igual a 0");
      return;
    }

    setEnviando(true);
    try {
      await onSubmit({
        sku: sku.trim(),
        nombre: nombre.trim(),
        precioVenta: precio,
        inventarioMinimo: minimo,
        idCategoria,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el repuesto");
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
        <h2 id={tituloId}>Nuevo repuesto</h2>

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor={skuId}>SKU</label>
            <input
              id={skuId}
              value={sku}
              onChange={(event) => setSku(event.target.value)}
              autoComplete="off"
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor={nombreId}>Nombre</label>
            <input
              id={nombreId}
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              required
            />
          </div>

          <CategoriaSelect value={idCategoria} onChange={setIdCategoria} disabled={enviando} />

          <div className="login-field">
            <label htmlFor={precioId}>Precio de venta (Q)</label>
            <input
              id={precioId}
              type="number"
              min="0.01"
              step="0.01"
              value={precioVenta}
              onChange={(event) => setPrecioVenta(event.target.value)}
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor={inventarioMinimoId}>Inventario mínimo</label>
            <span className="modal-helper-text">Cantidad que dispara la alerta de stock bajo</span>
            <input
              id={inventarioMinimoId}
              type="number"
              min="0"
              step="1"
              value={inventarioMinimo}
              onChange={(event) => setInventarioMinimo(event.target.value)}
              required
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
              {enviando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
