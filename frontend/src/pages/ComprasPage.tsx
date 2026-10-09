import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ProveedorRequeridoSelect } from "@/components/ProveedorRequeridoSelect";
import { RepuestoSkuSelect } from "@/components/RepuestoSkuSelect";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/toastContext";
import { crearCompra, listarCompras, CompraApiError } from "@/services/compraService";
import type { Compra, CompraFormLinea } from "@/types/movimiento";
import { quetzales } from "@/utils/formato";

// cantidad/precioCompra admiten "" mientras se edita el campo (ver nota en
// VentasPage): se coerciona a number recién al enviar.
type LineaEnEdicion = Omit<CompraFormLinea, "cantidad" | "precioCompra"> & {
  cantidad: number | "";
  precioCompra: number | "";
};

const LINEA_VACIA: LineaEnEdicion = { sku: "", cantidad: 1, precioCompra: 0 };

// HU-08: registrar una compra a proveedor (una o varias líneas, cada una
// suma stock) y consultar el historial. Administrador-only en el backend
// (precioCompra es un dato de costo).
export default function ComprasPage() {
  const toast = useToast();
  const [compras, setCompras] = useState<Compra[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorHistorial, setErrorHistorial] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [idProveedor, setIdProveedor] = useState<number | undefined>(undefined);
  const [lineas, setLineas] = useState<LineaEnEdicion[]>([{ ...LINEA_VACIA }]);
  const [enviando, setEnviando] = useState(false);

  const cargarCompras = useCallback(async () => {
    setCargando(true);
    setErrorHistorial(null);
    try {
      const resultado = await listarCompras();
      setCompras(resultado.compras);
    } catch (err) {
      setErrorHistorial(err instanceof CompraApiError ? err.message : "No se pudo cargar el historial de compras");
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
      const lineasFinales: CompraFormLinea[] = lineas.map((l) => ({ sku: l.sku, cantidad: Number(l.cantidad), precioCompra: Number(l.precioCompra) }));
      await crearCompra({ idProveedor, lineas: lineasFinales });
      toast.success("Compra registrada correctamente. El stock ya se actualizó.");
      setLineas([{ ...LINEA_VACIA }]);
      setIdProveedor(undefined);
      cargarCompras();
    } catch (err) {
      setError(err instanceof CompraApiError ? err.message : "No se pudo registrar la compra");
    } finally {
      setEnviando(false);
    }
  }

  const columnas: Column<Compra>[] = [
    { key: "fecha", header: "Fecha", primary: true, sortValue: (c) => new Date(c.fechaCompra).getTime(), cell: (c) => new Date(c.fechaCompra).toLocaleDateString("es-GT") },
    { key: "proveedor", header: "Proveedor", sortValue: (c) => c.proveedor?.nombre, cell: (c) => c.proveedor?.nombre ?? "—" },
    { key: "lineas", header: "Líneas", cell: (c) => c.lineas.map((l) => `${l.sku} (${l.cantidad})`).join(", ") },
    {
      key: "total",
      header: "Total",
      align: "right",
      sortValue: (c) => (c.montoTotalCompra !== undefined ? Number(c.montoTotalCompra) : null),
      cell: (c) => (c.montoTotalCompra !== undefined ? quetzales(c.montoTotalCompra) : "—"),
    },
    { key: "registro", header: "Registrada por", sortValue: (c) => c.colaborador?.nombreCompleto, cell: (c) => c.colaborador?.nombreCompleto ?? "—" },
  ];

  return (
    <div className="page-stack">
      <PageHeader title="Compras" />

      <Card title="Nueva compra">
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <ProveedorRequeridoSelect value={idProveedor} onChange={setIdProveedor} disabled={enviando} />
          </div>

          <div className="dt dt--lines">
            <div className="dt-scroll">
              <table>
                <caption className="sr-only">Líneas de la compra</caption>
                <thead>
                  <tr>
                    <th scope="col">Repuesto</th>
                    <th scope="col">Cantidad</th>
                    <th scope="col">Precio de compra (Q)</th>
                    <th scope="col" className="dt-right">
                      Subtotal
                    </th>
                    <th scope="col">
                      <span className="sr-only">Quitar línea</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((linea, indice) => (
                    <tr key={indice}>
                      <td data-label="Repuesto" className="dt-primary lines-field-wide">
                        <RepuestoSkuSelect value={linea.sku} onChange={(sku) => actualizarLinea(indice, { sku })} disabled={enviando} />
                      </td>
                      <td data-label="Cantidad">
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          step="1"
                          aria-label={`Cantidad, línea ${indice + 1}`}
                          value={linea.cantidad}
                          disabled={enviando}
                          onChange={(e) => actualizarLinea(indice, { cantidad: e.target.value === "" ? "" : Number(e.target.value) })}
                        />
                      </td>
                      <td data-label="Precio de compra (Q)">
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0.01"
                          step="0.01"
                          aria-label={`Precio de compra, línea ${indice + 1}`}
                          value={linea.precioCompra}
                          disabled={enviando}
                          onChange={(e) => actualizarLinea(indice, { precioCompra: e.target.value === "" ? "" : Number(e.target.value) })}
                        />
                      </td>
                      <td data-label="Subtotal" className="dt-right lines-subtotal">
                        {quetzales(Number(linea.cantidad || 0) * Number(linea.precioCompra || 0))}
                      </td>
                      <td data-label="Quitar" className="dt-actions">
                        {lineas.length > 1 && (
                          <IconButton icon="trash" label={`Quitar línea ${indice + 1}`} variant="danger-ghost" onClick={() => setLineas((a) => a.filter((_, i) => i !== indice))} disabled={enviando} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lines-footer">
            <Button variant="secondary" icon="plus" onClick={() => setLineas((a) => [...a, { ...LINEA_VACIA }])} disabled={enviando}>
              Agregar línea
            </Button>
            <p className="lines-total">
              Total <strong className="tabular">{quetzales(total)}</strong>
            </p>
          </div>

          {error && <Alert tone="error">{error}</Alert>}

          <div className="form-actions">
            <Button type="submit" size="lg" loading={enviando}>
              {enviando ? "Registrando..." : "Registrar compra"}
            </Button>
          </div>
        </form>
      </Card>

      {errorHistorial && (
        <Alert tone="error" action={<Button size="sm" variant="secondary" onClick={cargarCompras}>Reintentar</Button>}>
          {errorHistorial}
        </Alert>
      )}

      <Card padded={false} className="table-card">
        <div className="table-card-head">
          <h2>Historial de compras</h2>
        </div>
        <DataTable
          caption="Historial de compras"
          columns={columnas}
          rows={compras}
          rowKey={(c) => c.idCompra}
          loading={cargando}
          empty={errorHistorial ? null : <EmptyState icon="receipt" title="Todavía no hay compras registradas." description="Las compras que registres aparecerán aquí con su proveedor y total." />}
        />
      </Card>
    </div>
  );
}
