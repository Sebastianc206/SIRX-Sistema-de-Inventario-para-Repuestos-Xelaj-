import { formatoValorGrafica } from "@/utils/reportes";
import type { GraficaReporte } from "@/types/reporte";

// Gráficas SVG propias de la vista previa de reportes (mismas que el PDF:
// barras horizontales y línea con área). Sin librerías; cada gráfica lleva
// una tabla equivalente solo para lectores de pantalla y no depende solo del
// color (cada barra/punto lleva su valor).
const ANCHO = 640;

function recortar(texto: string, max: number): string {
  return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;
}

function Barras({ grafica }: { grafica: GraficaReporte }) {
  const fila = 28;
  const izq = 196;
  const der = 112;
  const alto = grafica.items.length * fila + 8;
  const max = Math.max(...grafica.items.map((i) => Math.abs(i.valor)), 1);
  const largoMax = ANCHO - izq - der;

  return (
    <svg
      viewBox={`0 0 ${ANCHO} ${alto}`}
      role="img"
      aria-label={grafica.titulo}
      className="rep-chart-svg"
      preserveAspectRatio="xMidYMid meet"
    >
      {grafica.items.map((it, i) => {
        const y = i * fila + 4;
        const largo = Math.max(
          it.valor === 0 ? 0 : 2,
          (Math.abs(it.valor) / max) * largoMax,
        );
        return (
          <g key={`${it.etiqueta}-${i}`}>
            <title>{`${it.etiqueta}: ${formatoValorGrafica(it.valor, grafica.formato)}`}</title>
            <text x={0} y={y + 14} className="rep-chart-label">
              {recortar(it.etiqueta, 30)}
            </text>
            <rect
              x={izq}
              y={y + 3}
              width={largoMax}
              height={14}
              rx={3}
              className="rep-chart-track"
            />
            <rect
              x={izq}
              y={y + 3}
              width={largo}
              height={14}
              rx={3}
              className={
                it.valor < 0
                  ? "rep-chart-bar rep-chart-bar--neg"
                  : "rep-chart-bar"
              }
            />
            <text
              x={izq + largoMax + 8}
              y={y + 14.5}
              className="rep-chart-value"
            >
              {formatoValorGrafica(it.valor, grafica.formato)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Linea({ grafica }: { grafica: GraficaReporte }) {
  const alto = 220;
  const m = { top: 14, right: 16, bottom: 30, left: 78 };
  const items = grafica.items;
  const max = Math.max(...items.map((i) => i.valor), 1);
  const w = ANCHO - m.left - m.right;
  const h = alto - m.top - m.bottom;
  const n = items.length;
  const x = (i: number) =>
    n > 1 ? m.left + (i * w) / (n - 1) : m.left + w / 2;
  const y = (v: number) => m.top + h - (v / max) * h;
  const puntos = items.map((it, i) => `${x(i)},${y(it.valor)}`).join(" ");
  const cada = Math.max(1, Math.ceil(n / 8));

  return (
    <svg
      viewBox={`0 0 ${ANCHO} ${alto}`}
      role="img"
      aria-label={grafica.titulo}
      className="rep-chart-svg"
      preserveAspectRatio="xMidYMid meet"
    >
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line
            x1={m.left}
            x2={ANCHO - m.right}
            y1={y(max * f)}
            y2={y(max * f)}
            className={f === 0 ? "rep-chart-axis-line" : "rep-chart-grid"}
          />
          <text
            x={m.left - 8}
            y={y(max * f)}
            textAnchor="end"
            dominantBaseline="middle"
            className="rep-chart-axis"
          >
            {formatoValorGrafica(max * f, grafica.formato)}
          </text>
        </g>
      ))}
      {n > 1 && (
        <polygon
          points={`${x(0)},${y(0)} ${puntos} ${x(n - 1)},${y(0)}`}
          className="rep-chart-area"
        />
      )}
      {n > 1 && (
        <polyline points={puntos} className="rep-chart-line" fill="none" />
      )}
      {items.map((it, i) => (
        <g key={`${it.etiqueta}-${i}`}>
          <title>{`${it.etiqueta}: ${formatoValorGrafica(it.valor, grafica.formato)}`}</title>
          {n <= 31 && (
            <circle
              cx={x(i)}
              cy={y(it.valor)}
              r={3}
              className="rep-chart-dot"
            />
          )}
          {(i % cada === 0 ||
            (i === n - 1 && (n - 1) % cada >= cada * 0.6)) && (
            <text
              x={x(i)}
              y={alto - 10}
              textAnchor="middle"
              className="rep-chart-axis"
            >
              {it.etiqueta}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

export function ReporteChart({ grafica }: { grafica: GraficaReporte }) {
  if (grafica.items.length === 0 || grafica.items.every((i) => i.valor === 0))
    return null;
  return (
    <figure className="rep-chart">
      <figcaption className="rep-chart-title">{grafica.titulo}</figcaption>
      {grafica.tipo === "linea" ? (
        <Linea grafica={grafica} />
      ) : (
        <Barras grafica={grafica} />
      )}
      <div className="sr-only">
        <table>
          <caption>{grafica.titulo}</caption>
          <thead>
            <tr>
              <th scope="col">Elemento</th>
              <th scope="col">Valor</th>
            </tr>
          </thead>
          <tbody>
            {grafica.items.map((it, i) => (
              <tr key={`${it.etiqueta}-${i}`}>
                <th scope="row">{it.etiqueta}</th>
                <td>{formatoValorGrafica(it.valor, grafica.formato)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
