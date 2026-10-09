import { Badge } from "@/components/ui/Badge";
import type { BadgeTone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { KpiCard } from "@/components/ui/KpiCard";
import { ReporteChart } from "@/components/reportes/ReporteChart";
import { esCeldaEstado, textoCelda } from "@/utils/reportes";
import type { KpiReporte, Reporte, TablaReporte, TonoEstado, ValorCelda } from "@/types/reporte";

const TONOS: Record<TonoEstado, BadgeTone> = { ok: "success", warn: "warning", bad: "danger", info: "info", neutral: "neutral" };
const NUMERICAS = new Set(["entero", "decimal", "moneda", "porcentaje"]);

function valorKpi(k: KpiReporte): string {
  if (k.tipo === "texto") return String(k.valor);
  return textoCelda(k.valor, { tipo: k.tipo });
}

type Fila = Record<string, ValorCelda>;

function columnasDe(tabla: TablaReporte): Column<Fila>[] {
  return tabla.columnas.map((c, i) => ({
    key: c.clave,
    header: c.etiqueta,
    align: NUMERICAS.has(c.tipo) ? "right" : undefined,
    primary: i === 0 || c.clave === "nombre",
    className: NUMERICAS.has(c.tipo) ? "tabular" : undefined,
    cell: (fila) => {
      const v = fila[c.clave] ?? null;
      if (esCeldaEstado(v)) return <Badge tone={TONOS[v.tono] ?? "neutral"}>{v.texto}</Badge>;
      return textoCelda(v, c);
    },
  }));
}

function TablaVista({ tabla, rowLabel }: { tabla: TablaReporte; rowLabel: string }) {
  const filas: Fila[] = tabla.filas;
  return (
    <Card
      as="section"
      padded={false}
      className="rep-tabla"
      title={tabla.titulo}
      description={
        tabla.truncada
          ? `Vista previa: ${tabla.filas.length} de ${tabla.totalFilas.toLocaleString("es-GT")} filas. El archivo descargado incluye más filas.`
          : `${tabla.totalFilas.toLocaleString("es-GT")} fila${tabla.totalFilas === 1 ? "" : "s"}`
      }
    >
      <DataTable<Fila>
        caption={`${rowLabel}: ${tabla.titulo}`}
        columns={columnasDe(tabla)}
        rows={filas}
        rowKey={(f) => `${tabla.id}-${filas.indexOf(f)}`}
        density="compact"
        empty={<EmptyState compact icon="search" title="Sin registros" description="No hay filas para mostrar con estos filtros." />}
      />
      {tabla.totales && (
        <dl className="rep-totales" aria-label={`Totales de ${tabla.titulo}`}>
          {tabla.columnas
            .filter((c) => tabla.totales && tabla.totales[c.clave] != null && NUMERICAS.has(c.tipo))
            .map((c) => (
              <div key={c.clave}>
                <dt>{c.etiqueta}</dt>
                <dd className="tabular">{textoCelda(tabla.totales?.[c.clave] ?? null, c)}</dd>
              </div>
            ))}
        </dl>
      )}
    </Card>
  );
}

// Vista previa en pantalla: KPIs resumen + gráfica + tablas, con el mismo
// contenido (y el mismo filtrado por rol, hecho en el backend) que el archivo.
export function ReporteVistaPrevia({ reporte }: { reporte: Reporte }) {
  return (
    <div className="rep-preview stack">
      <ul className="rep-filtros-aplicados" aria-label="Filtros aplicados">
        {reporte.filtrosAplicados.map((f) => (
          <li key={f.etiqueta}>
            <span>{f.etiqueta}:</span> {f.valor}
          </li>
        ))}
        {reporte.filtrosAplicados.length === 0 && <li>Inventario completo al momento de generar</li>}
      </ul>

      {reporte.kpis.length > 0 && (
        <div className="kpi-grid rep-kpis">
          {reporte.kpis.map((k) => (
            <KpiCard
              key={k.etiqueta}
              label={k.etiqueta}
              valor={valorKpi(k)}
              nota={k.nota}
              tendencia={k.variacion !== undefined ? { porcentaje: k.variacion, contra: "vs período anterior" } : undefined}
            />
          ))}
        </div>
      )}

      {reporte.vacio ? (
        <Card>
          <EmptyState icon="search" title="Sin datos para este reporte" description={reporte.vacio} />
        </Card>
      ) : (
        <>
          {reporte.grafica && (
            <Card>
              <ReporteChart grafica={reporte.grafica} />
            </Card>
          )}
          {reporte.tablas.map((t) => (
            <TablaVista key={t.id} tabla={t} rowLabel={reporte.titulo} />
          ))}
        </>
      )}

      {reporte.notas && reporte.notas.length > 0 && (
        <aside className="rep-notas" aria-label="Notas del reporte">
          <h4>Notas</h4>
          <ul>
            {reporte.notas.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <p>Documento operativo, no constituye documento tributario.</p>
        </aside>
      )}
    </div>
  );
}
