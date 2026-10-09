import { useEffect, useId, useState } from "react";
import type { FormEvent } from "react";
import { CategoriaSelect } from "@/components/CategoriaSelect";
import { MarcaSelect } from "@/components/MarcaSelect";
import { ProveedorSelect } from "@/components/ProveedorSelect";
import { ModelosCompatiblesField } from "@/components/ModelosCompatiblesField";
import { Alert } from "@/components/ui/Alert";
import { StockBadge } from "@/components/ui/Badge";
import { DialogBody, Drawer, FormFooter } from "@/components/ui/Dialog";
import { obtenerConfiguracionStock, UMBRAL_MAXIMO } from "@/services/configuracionService";
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
  // Vacío = sin umbral propio: el producto usa el umbral general.
  const [inventarioMinimo, setInventarioMinimo] = useState(
    repuesto?.inventarioMinimoPropio != null ? String(repuesto.inventarioMinimoPropio) : "",
  );
  const [umbralGeneral, setUmbralGeneral] = useState<number | null>(null);
  const [ubicacion, setUbicacion] = useState(repuesto?.ubicacion ?? "");
  const [idCategoria, setIdCategoria] = useState<number | undefined>(repuesto?.categoria?.idCategoria);
  const [idMarca, setIdMarca] = useState<number | undefined>(repuesto?.marca?.idMarca);
  const [idProveedor, setIdProveedor] = useState<number | undefined>(repuesto?.proveedor?.idProveedor);
  const [idsModelosCompatibles, setIdsModelosCompatibles] = useState<number[]>(
    repuesto?.modelosCompatibles.map((m) => m.idModelo) ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Cualquier cambio en el formulario activa el aviso de "cambios sin guardar".
  const [modificado, setModificado] = useState(false);

  // Solo informativo (texto de ayuda): si falla, el formulario sigue igual.
  useEffect(() => {
    let cancelado = false;
    obtenerConfiguracionStock()
      .then((c) => {
        if (!cancelado) setUmbralGeneral(c.umbralGeneral);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, []);

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

    // null = usar el umbral general.
    let inventarioMinimoNum: number | null = null;
    if (inventarioMinimo.trim() !== "") {
      inventarioMinimoNum = Number(inventarioMinimo);
      if (!Number.isInteger(inventarioMinimoNum) || inventarioMinimoNum < 0 || inventarioMinimoNum > UMBRAL_MAXIMO) {
        setError(`La alerta de stock bajo debe ser un entero entre 0 y ${UMBRAL_MAXIMO}, o dejarse vacía para usar el umbral general`);
        return;
      }
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
    <Drawer title={esEdicion ? "Editar repuesto" : "Nuevo repuesto"} dirty={modificado && !enviando} onClose={onClose}>
      <form className="dialog-form" onSubmit={handleSubmit} onChange={() => setModificado(true)}>
        <DialogBody>
          <h3 className="form-section-title">Identificación</h3>
          <div className="login-field">
            <label htmlFor={skuId}>SKU (código único)</label>
            {esEdicion ? (
              <p className="modal-readonly-info">
                <span className="modal-readonly-username">{repuesto.sku}</span>
                <span className="modal-helper-text">El código no se puede modificar</span>
              </p>
            ) : (
              <input id={skuId} value={sku} onChange={(event) => setSku(event.target.value)} autoComplete="off" required />
            )}
          </div>

          <div className="login-field">
            <label htmlFor={nombreId}>Nombre</label>
            <input id={nombreId} value={nombre} onChange={(event) => setNombre(event.target.value)} maxLength={150} required />
          </div>

          {esEdicion && (
            <div className="repuesto-stock-block">
              <div className="repuesto-stock-item">
                <span className="repuesto-stock-label">Stock actual</span>
                <span className="repuesto-stock-valor">{repuesto.cantidadInventario}</span>
              </div>
              <div className="repuesto-stock-item">
                <span className="repuesto-stock-label">Alerta de stock bajo</span>
                <span className="repuesto-stock-valor">
                  {repuesto.inventarioMinimo}
                  {repuesto.inventarioMinimoPropio == null && <span className="modal-helper-text"> (general)</span>}
                </span>
              </div>
              <div className="repuesto-stock-item">
                <span className="repuesto-stock-label">Estado</span>
                <StockBadge cantidad={repuesto.cantidadInventario} minimo={repuesto.inventarioMinimo} estado={repuesto.estadoStock} mostrarCantidad={false} />
              </div>
            </div>
          )}

          <div className="form-grid">
            <CategoriaSelect value={idCategoria} onChange={setIdCategoria} disabled={enviando} />
            <MarcaSelect value={idMarca} onChange={setIdMarca} disabled={enviando} />
          </div>

          <h3 className="form-section-title">Precios e inventario</h3>
          <div className="form-grid">
            <div className="login-field">
              <label htmlFor={precioVentaId}>Precio de venta (Q)</label>
              <input id={precioVentaId} type="number" inputMode="decimal" min="0.01" step="0.01" value={precioVenta} onChange={(event) => setPrecioVenta(event.target.value)} required />
            </div>

            <div className="login-field">
              <label htmlFor={precioCostoId}>Precio de costo (Q)</label>
              <span className="modal-helper-text">Solo lo ve el rol Administrador</span>
              <input id={precioCostoId} type="number" inputMode="decimal" min="0.01" step="0.01" value={precioCosto} onChange={(event) => setPrecioCosto(event.target.value)} required />
            </div>

            <div className="login-field">
              <label htmlFor={inventarioMinimoId}>Alerta de stock bajo (opcional)</label>
              <span className="modal-helper-text" id={`${inventarioMinimoId}-ayuda`}>
                Vacío = usa el umbral general{umbralGeneral !== null ? ` (${umbralGeneral})` : ""}. Si pones un número, ese producto avisa al llegar a esa cantidad.
              </span>
              <input
                id={inventarioMinimoId}
                type="number"
                inputMode="numeric"
                min="0"
                max={UMBRAL_MAXIMO}
                step="1"
                value={inventarioMinimo}
                placeholder={umbralGeneral !== null ? `General: ${umbralGeneral}` : "General"}
                aria-describedby={`${inventarioMinimoId}-ayuda`}
                onChange={(event) => setInventarioMinimo(event.target.value)}
              />
            </div>

            <div className="login-field">
              <label htmlFor={ubicacionId}>Ubicación (opcional)</label>
              <input id={ubicacionId} value={ubicacion} onChange={(event) => setUbicacion(event.target.value)} placeholder="Ej. Estante A1" maxLength={100} />
            </div>
          </div>

          <h3 className="form-section-title">Origen y compatibilidad</h3>
          <ProveedorSelect value={idProveedor} onChange={setIdProveedor} disabled={enviando} />
          <ModelosCompatiblesField value={idsModelosCompatibles} onChange={setIdsModelosCompatibles} disabled={enviando} />

          {error && <Alert tone="error">{error}</Alert>}
        </DialogBody>
        <FormFooter enviando={enviando} />
      </form>
    </Drawer>
  );
}
