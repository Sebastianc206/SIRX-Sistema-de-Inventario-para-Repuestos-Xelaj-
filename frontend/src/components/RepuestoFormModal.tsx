import { useId, useState } from "react";
import type { FormEvent } from "react";
import { CategoriaSelect } from "@/components/CategoriaSelect";
import { MarcaSelect } from "@/components/MarcaSelect";
import { ProveedorSelect } from "@/components/ProveedorSelect";
import { ModelosCompatiblesField } from "@/components/ModelosCompatiblesField";
import { crearRepuesto, editarRepuesto, RepuestoApiError } from "@/services/repuestoService";
import type { Repuesto } from "@/types/repuesto";

interface RepuestoFormModalProps {
  // null = crear un repuesto nuevo; un Repuesto = editar ese repuesto.
  repuesto: Repuesto | null;
  onClose: () => void;
  onGuardado: (mensaje: string) => void;
}

export function RepuestoFormModal({ repuesto, onClose, onGuardado }: RepuestoFormModalProps) {
  const esEdicion = repuesto !== null;
  const tituloId = useId();
  const skuId = useId();
  const nombreId = useId();
  const precioVentaId = useId();
  const precioCostoId = useId();
  const inventarioMinimoId = useId();
  const ubicacionId = useId();

  const [sku, setSku] = useState(repuesto?.sku ?? "");
  const [nombre, setNombre] = useState(repuesto?.nombre ?? "");
  const [precioVenta, setPrecioVenta] = useState(repuesto ? String(repuesto.precioVenta) : "");
  const [precioCosto, setPrecioCosto] = useState(
    repuesto?.precioCosto !== undefined ? String(repuesto.precioCosto) : "",
  );
  const [inventarioMinimo, setInventarioMinimo] = useState(
    repuesto ? String(repuesto.inventarioMinimo) : "0",
  );
  const [ubicacion, setUbicacion] = useState(repuesto?.ubicacion ?? "");
  const [idCategoria, setIdCategoria] = useState<number | undefined>(repuesto?.categoria?.idCategoria);
  const [idMarca, setIdMarca] = useState<number | undefined>(repuesto?.marca?.idMarca);
  const [idProveedor, setIdProveedor] = useState<number | undefined>(repuesto?.proveedor?.idProveedor);
  const [idsModelosCompatibles, setIdsModelosCompatibles] = useState<number[]>(
    repuesto?.modelosCompatibles.map((m) => m.idModelo) ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (idCategoria === undefined) {
      setError("Selecciona una categoría");
      return;
    }

    const precioVentaNum = Number(precioVenta);
    if (!Number.isFinite(precioVentaNum) || precioVentaNum <= 0) {
      setError("El precio de venta debe ser un número mayor a 0");
      return;
    }

    const precioCostoNum = Number(precioCosto);
    if (!Number.isFinite(precioCostoNum) || precioCostoNum <= 0) {
      setError("El precio de costo debe ser un número mayor a 0");
      return;
    }

    const inventarioMinimoNum = Number(inventarioMinimo);
    if (!Number.isInteger(inventarioMinimoNum) || inventarioMinimoNum < 0) {
      setError("El inventario mínimo debe ser un número entero mayor o igual a 0");
      return;
    }

    setEnviando(true);
    try {
      if (esEdicion) {
        await editarRepuesto(repuesto.sku, {
          nombre: nombre.trim(),
          precioVenta: precioVentaNum,
          precioCosto: precioCostoNum,
          inventarioMinimo: inventarioMinimoNum,
          ubicacion: ubicacion.trim() || undefined,
          idCategoria,
          idMarca,
          idProveedor,
          idsModelosCompatibles,
        });
        onGuardado("Repuesto actualizado correctamente.");
      } else {
        await crearRepuesto({
          sku: sku.trim(),
          nombre: nombre.trim(),
          precioVenta: precioVentaNum,
          precioCosto: precioCostoNum,
          inventarioMinimo: inventarioMinimoNum,
          ubicacion: ubicacion.trim() || undefined,
          idCategoria,
          idMarca,
          idProveedor,
          idsModelosCompatibles,
        });
        onGuardado("Repuesto creado correctamente.");
      }
    } catch (err) {
      setError(err instanceof RepuestoApiError ? err.message : "No se pudo guardar el repuesto");
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
        <h2 id={tituloId}>{esEdicion ? "Editar repuesto" : "Nuevo repuesto"}</h2>

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor={skuId}>SKU (código único)</label>
            {esEdicion ? (
              <p className="modal-readonly-info">
                <span className="modal-readonly-username">{repuesto.sku}</span>
                <span className="modal-helper-text">El código no se puede modificar</span>
              </p>
            ) : (
              <input
                id={skuId}
                value={sku}
                onChange={(event) => setSku(event.target.value)}
                autoComplete="off"
                required
              />
            )}
          </div>

          <div className="login-field">
            <label htmlFor={nombreId}>Nombre</label>
            <input
              id={nombreId}
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              maxLength={150}
              required
            />
          </div>

          <CategoriaSelect value={idCategoria} onChange={setIdCategoria} disabled={enviando} />
          <MarcaSelect value={idMarca} onChange={setIdMarca} disabled={enviando} />

          <div className="login-field">
            <label htmlFor={precioVentaId}>Precio de venta (Q)</label>
            <input
              id={precioVentaId}
              type="number"
              min="0.01"
              step="0.01"
              value={precioVenta}
              onChange={(event) => setPrecioVenta(event.target.value)}
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor={precioCostoId}>Precio de costo (Q)</label>
            <span className="modal-helper-text">Solo lo ve el rol Administrador</span>
            <input
              id={precioCostoId}
              type="number"
              min="0.01"
              step="0.01"
              value={precioCosto}
              onChange={(event) => setPrecioCosto(event.target.value)}
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

          <div className="login-field">
            <label htmlFor={ubicacionId}>Ubicación (opcional)</label>
            <input
              id={ubicacionId}
              value={ubicacion}
              onChange={(event) => setUbicacion(event.target.value)}
              placeholder="Ej. Estante A1"
              maxLength={100}
            />
          </div>

          <ProveedorSelect value={idProveedor} onChange={setIdProveedor} disabled={enviando} />
          <ModelosCompatiblesField
            value={idsModelosCompatibles}
            onChange={setIdsModelosCompatibles}
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
