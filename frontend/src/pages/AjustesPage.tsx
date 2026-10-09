import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { RepuestoSkuSelect } from "@/components/RepuestoSkuSelect";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconButton } from "@/components/ui/IconButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/toastContext";
import { crearAjuste, listarTiposAjuste, AjusteApiError } from "@/services/ajusteService";
import type { SalidaAjusteFormLinea, TipoSalidaAjuste } from "@/types/movimiento";

// cantidad admite "" mientras se edita el campo (ver nota en VentasPage): se
// coerciona a number recién al enviar.
type LineaEnEdicion = Omit<SalidaAjusteFormLinea, "cantidad"> & { cantidad: number | "" };

const LINEA_VACIA: LineaEnEdicion = { sku: "", cantidad: 1, idTipoSalida: "" };

// HU-09: salidas de inventario que NO son una venta (ajuste, merma, uso
// interno, garantía). Abierto a ambos roles: es una tarea operativa de
// bodega, sin datos de costo. El motivo vive por línea — un mismo registro
// puede traer, por ejemplo, una línea de merma y otra de garantía. El
// historial/reversión vive en Movimientos (solo Administrador).
export default function AjustesPage() {
  const toast = useToast();
  const [tipos, setTipos] = useState<TipoSalidaAjuste[]>([]);
  const [error, setError] = useState<string | null>(null);
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
      const lineasFinales = lineas.map((l) => ({ sku: l.sku, cantidad: Number(l.cantidad), idTipoSalida: Number(l.idTipoSalida) }));
      await crearAjuste({ lineas: lineasFinales });
      toast.success("Salida registrada correctamente. El stock ya se actualizó.");
      setLineas([{ ...LINEA_VACIA }]);
    } catch (err) {
      setError(err instanceof AjusteApiError ? err.message : "No se pudo registrar la salida");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="page-stack">
      <PageHeader title="Ajustes" />

      <Card title="Registrar salida de inventario" description="Mermas, uso interno, garantías. Cada línea lleva su motivo.">
        <form onSubmit={handleSubmit}>
          <div className="dt dt--lines">
            <div className="dt-scroll">
              <table>
                <caption className="sr-only">Líneas de la salida</caption>
                <thead>
                  <tr>
                    <th scope="col">Repuesto</th>
                    <th scope="col">Cantidad</th>
                    <th scope="col">Motivo</th>
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
                      <td data-label="Motivo">
                        <select
                          value={linea.idTipoSalida}
                          disabled={enviando}
                          aria-label={`Motivo, línea ${indice + 1}`}
                          onChange={(e) => actualizarLinea(indice, { idTipoSalida: e.target.value === "" ? "" : Number(e.target.value) })}
                        >
                          <option value="">Selecciona un motivo</option>
                          {tipos.map((tipo) => (
                            <option key={tipo.idTipoSalida} value={tipo.idTipoSalida}>
                              {tipo.descripcion}
                            </option>
                          ))}
                        </select>
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
          </div>

          {error && <Alert tone="error">{error}</Alert>}

          <div className="form-actions">
            <Button type="submit" size="lg" loading={enviando}>
              {enviando ? "Registrando..." : "Registrar salida"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
