import { useEffect, useId, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { CategoriaSelect } from "@/components/CategoriaSelect";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, Input } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/toastContext";
import { useAsync } from "@/hooks/useAsync";
import {
  aplicarUmbralMasivo,
  ConfiguracionApiError,
  guardarUmbralGeneral,
  obtenerConfiguracionStock,
  previsualizarImpacto,
  UMBRAL_MAXIMO,
} from "@/services/configuracionService";
import type { ImpactoUmbral } from "@/services/configuracionService";

const DEBOUNCE_MS = 300;

// Texto → entero válido o null. Estricto: sin decimales, sin notación
// científica ("1e3"), rango 0..UMBRAL_MAXIMO.
function parsearUmbral(texto: string): number | null {
  if (!/^\d+$/.test(texto.trim())) return null;
  const n = Number(texto);
  return n <= UMBRAL_MAXIMO ? n : null;
}

function mensajeImpacto(i: ImpactoUmbral): string {
  const bajos = `${i.enBajo} producto${i.enBajo === 1 ? "" : "s"} quedaría${i.enBajo === 1 ? "" : "n"} en "Stock bajo"`;
  const agotados = `${i.agotados} agotado${i.agotados === 1 ? "" : "s"}`;
  return `${bajos} y ${agotados} (de ${i.totalActivos} activos).`;
}

// Configuración del negocio (solo Administrador). Hoy: umbral de "stock
// bajo" — general para todo el catálogo y ajuste masivo del umbral propio
// por categoría o por lista de SKUs. El cálculo del estado vive en backend.
export default function ConfiguracionPage() {
  const toast = useToast();
  const config = useAsync(obtenerConfiguracionStock, [], "No se pudo cargar la configuración");

  const umbralGuardado = config.data?.umbralGeneral ?? null;
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  const [impacto, setImpacto] = useState<ImpactoUmbral | null>(null);
  const [calculando, setCalculando] = useState(false);

  // Sincroniza el campo con el valor guardado cuando llega/cambia.
  useEffect(() => {
    if (umbralGuardado !== null) setTexto(String(umbralGuardado));
  }, [umbralGuardado]);

  const valor = parsearUmbral(texto);
  const invalido = texto.trim() !== "" && valor === null;
  const cambiado = valor !== null && valor !== umbralGuardado;

  // Vista de impacto en vivo (con debounce) para el valor que se está escribiendo.
  useEffect(() => {
    if (valor === null) {
      setImpacto(null);
      return undefined;
    }
    let vigente = true;
    setCalculando(true);
    const t = setTimeout(() => {
      previsualizarImpacto(valor)
        .then((r) => {
          if (vigente) setImpacto(r);
        })
        .catch(() => {
          if (vigente) setImpacto(null);
        })
        .finally(() => {
          if (vigente) setCalculando(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [valor]);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (valor === null) return;
    setErrorGuardar(null);
    setGuardando(true);
    try {
      await guardarUmbralGeneral(valor);
      toast.success(`Umbral general actualizado a ${valor}.`);
      config.recargar();
    } catch (err) {
      setErrorGuardar(err instanceof ConfiguracionApiError ? err.message : "No se pudo guardar el umbral");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="page-stack">
      <PageHeader title="Configuración" />

      {config.error && (
        <Alert tone="error" action={<Button size="sm" variant="secondary" onClick={config.recargar}>Reintentar</Button>}>
          {config.error}
        </Alert>
      )}

      <Card
        title="Umbral general de stock bajo"
        description="Un repuesto está en stock bajo cuando sus existencias son iguales o menores al umbral. Aplica a los que no tienen umbral propio."
      >
        {config.cargando && !config.data ? (
          <Skeleton height="8rem" />
        ) : (
          <form className="stack" onSubmit={guardar} noValidate>
            <div className="config-umbral">
              <Field
                label="Umbral general (unidades)"
                hint={`Entero entre 0 y ${UMBRAL_MAXIMO}.`}
                error={invalido ? `Escribe un número entero entre 0 y ${UMBRAL_MAXIMO}` : undefined}
              >
                {(p) => (
                  <Input
                    {...p}
                    type="text"
                    inputMode="numeric"
                    value={texto}
                    onChange={(ev) => setTexto(ev.target.value)}
                    disabled={guardando || !config.data}
                    autoComplete="off"
                  />
                )}
              </Field>

              <div className="config-impacto" role="status" aria-live="polite" aria-busy={calculando}>
                <p className="config-impacto-titulo">Vista de impacto</p>
                {valor === null ? (
                  <p className="muted">Escribe un umbral válido para ver cuántos productos quedarían en stock bajo.</p>
                ) : impacto ? (
                  <>
                    <p className="config-impacto-cifra tabular">
                      <strong>{impacto.enBajo}</strong> en stock bajo
                    </p>
                    <p className="muted">{mensajeImpacto(impacto)}</p>
                    {impacto.conUmbralPropio > 0 && (
                      <p className="muted">
                        {impacto.conUmbralPropio} producto{impacto.conUmbralPropio === 1 ? " tiene" : "s tienen"} umbral propio y no cambian con este valor.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="muted">Calculando…</p>
                )}
              </div>
            </div>

            {errorGuardar && <Alert tone="error">{errorGuardar}</Alert>}

            <div className="row">
              <Button type="submit" loading={guardando} disabled={!cambiado || guardando}>
                Guardar umbral general
              </Button>
              {cambiado && (
                <Button variant="ghost" onClick={() => setTexto(String(umbralGuardado))} disabled={guardando}>
                  Descartar cambio
                </Button>
              )}
            </div>
          </form>
        )}
      </Card>

      <AjusteMasivo umbralGeneral={umbralGuardado} onAplicado={config.recargar} />
    </div>
  );
}

type Alcance = "categoria" | "skus";

function AjusteMasivo({ umbralGeneral, onAplicado }: { umbralGeneral: number | null; onAplicado: () => void }) {
  const toast = useToast();
  const idAlcance = useId();
  const [alcance, setAlcance] = useState<Alcance>("categoria");
  const [idCategoria, setIdCategoria] = useState<number | undefined>(undefined);
  const [skusTexto, setSkusTexto] = useState("");
  const [restablecer, setRestablecer] = useState(false);
  const [texto, setTexto] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const skus = useMemo(() => [...new Set(skusTexto.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean))], [skusTexto]);
  const valor = parsearUmbral(texto);

  const objetivoListo = alcance === "categoria" ? idCategoria !== undefined : skus.length > 0;
  const umbralListo = restablecer || valor !== null;
  const puedeAplicar = objetivoListo && umbralListo && !enviando;

  function pedirConfirmacion(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!puedeAplicar) {
      setError(!objetivoListo ? "Elige una categoría o indica al menos un SKU" : `Escribe un umbral entero entre 0 y ${UMBRAL_MAXIMO}, o marca "Usar el umbral general"`);
      return;
    }
    setConfirmando(true);
  }

  async function aplicar() {
    setEnviando(true);
    setError(null);
    try {
      const r = await aplicarUmbralMasivo({
        umbral: restablecer ? null : valor,
        ...(alcance === "categoria" ? { idCategoria } : { skus }),
      });
      toast.success(
        r.actualizados === 0
          ? "No se encontró ningún repuesto con ese criterio."
          : `Se actualizó el umbral de ${r.actualizados} repuesto${r.actualizados === 1 ? "" : "s"}.`,
      );
      onAplicado();
    } catch (err) {
      setError(err instanceof ConfiguracionApiError ? err.message : "No se pudo aplicar el cambio");
    } finally {
      setEnviando(false);
      setConfirmando(false);
    }
  }

  const resumenObjetivo = alcance === "categoria" ? "todos los repuestos de la categoría elegida" : `${skus.length} SKU${skus.length === 1 ? "" : "s"}`;
  const resumenUmbral = restablecer ? `usarán el umbral general${umbralGeneral !== null ? ` (${umbralGeneral})` : ""}` : `tendrán umbral propio de ${valor ?? "—"}`;

  return (
    <details className="disclosure">
      <summary>Ajuste por producto, en bloque</summary>
      <p className="muted disclosure-note">Fija el umbral propio de varios repuestos a la vez, por categoría o con una lista de SKUs.</p>
      <form className="stack" onSubmit={pedirConfirmacion} noValidate>
        <fieldset className="config-alcance">
          <legend>Aplicar a</legend>
          <label>
            <input type="radio" name={idAlcance} checked={alcance === "categoria"} onChange={() => setAlcance("categoria")} /> Una categoría
          </label>
          <label>
            <input type="radio" name={idAlcance} checked={alcance === "skus"} onChange={() => setAlcance("skus")} /> Una lista de SKUs
          </label>
        </fieldset>

        {alcance === "categoria" ? (
          <CategoriaSelect value={idCategoria} onChange={setIdCategoria} disabled={enviando} />
        ) : (
          <Field label="SKUs" hint="Sepáralos con comas, espacios o saltos de línea (máximo 1000).">
            {(p) => (
              <textarea
                {...p}
                className="input"
                rows={4}
                value={skusTexto}
                onChange={(ev) => setSkusTexto(ev.target.value)}
                disabled={enviando}
                placeholder="FRE-001, FIL-002, ..."
              />
            )}
          </Field>
        )}

        <div className="config-umbral">
          <Field label="Umbral propio (unidades)" hint={restablecer ? "Se ignora: los repuestos usarán el umbral general." : `Entero entre 0 y ${UMBRAL_MAXIMO}.`}>
            {(p) => (
              <Input
                {...p}
                type="text"
                inputMode="numeric"
                value={texto}
                onChange={(ev) => setTexto(ev.target.value)}
                disabled={restablecer || enviando}
                autoComplete="off"
              />
            )}
          </Field>
          <label className="config-restablecer">
            <input type="checkbox" checked={restablecer} onChange={(ev) => setRestablecer(ev.target.checked)} disabled={enviando} /> Usar el umbral general
            (quitar el umbral propio)
          </label>
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        <div className="row">
          <Button type="submit" disabled={!puedeAplicar}>
            Aplicar en bloque
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmando}
        tone="primary"
        title="¿Aplicar el cambio en bloque?"
        description={`Se modificará ${resumenObjetivo}: ${resumenUmbral}. Esto cambia qué productos aparecen en alertas de stock bajo.`}
        confirmLabel="Aplicar cambio"
        loading={enviando}
        onConfirm={aplicar}
        onCancel={() => setConfirmando(false)}
      />
    </details>
  );
}
