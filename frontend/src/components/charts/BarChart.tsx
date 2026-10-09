export interface PuntoBarra {
  clave: string;
  etiqueta: string;
  valor: number;
  // Texto completo para tooltip y lectores de pantalla.
  detalle: string;
}

interface BarChartProps {
  datos: PuntoBarra[];
  ariaLabel: string;
  formatoEje: (valor: number) => string;
  columnaValor: string;
}

const ANCHO = 640;
const ALTO = 260;
const MARGEN = { top: 18, right: 12, bottom: 30, left: 56 };

// Escala "agradable": 4 intervalos con paso 1/2/2.5/5 x 10^n.
function escala(maximo: number): { max: number; ticks: number[] } {
  if (maximo <= 0) return { max: 4, ticks: [0, 1, 2, 3, 4] };
  const bruto = maximo / 4;
  const magnitud = 10 ** Math.floor(Math.log10(bruto));
  const paso =
    [1, 2, 2.5, 5, 10].map((f) => f * magnitud).find((p) => p >= bruto) ??
    magnitud * 10;
  return { max: paso * 4, ticks: [0, 1, 2, 3, 4].map((i) => i * paso) };
}

// Gráfica de barras en SVG propio (sin librerías): ejes con escala, barras
// enfocables con teclado (valor al enfocar/pasar el puntero), la última barra
// resaltada (hoy) y una tabla equivalente solo para lectores de pantalla.
export function BarChart({
  datos,
  ariaLabel,
  formatoEje,
  columnaValor,
}: BarChartProps) {
  const { max, ticks } = escala(Math.max(0, ...datos.map((d) => d.valor)));
  const anchoUtil = ANCHO - MARGEN.left - MARGEN.right;
  const altoUtil = ALTO - MARGEN.top - MARGEN.bottom;
  const paso = anchoUtil / Math.max(datos.length, 1);
  const anchoBarra = Math.min(36, paso * 0.62);
  const cadaN = Math.max(1, Math.ceil(datos.length / 8));
  const y = (valor: number) => MARGEN.top + altoUtil - (valor / max) * altoUtil;

  return (
    <figure className="chart">
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        role="group"
        aria-label={ariaLabel}
        preserveAspectRatio="xMidYMid meet"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={MARGEN.left}
              x2={ANCHO - MARGEN.right}
              y1={y(t)}
              y2={y(t)}
              className="chart-grid"
            />
            <text
              x={MARGEN.left - 8}
              y={y(t)}
              textAnchor="end"
              dominantBaseline="middle"
              className="chart-axis"
            >
              {formatoEje(t)}
            </text>
          </g>
        ))}

        {datos.map((d, i) => {
          const x = MARGEN.left + paso * i + (paso - anchoBarra) / 2;
          const alto = Math.max(
            d.valor > 0 ? 2 : 0,
            (d.valor / max) * altoUtil,
          );
          const ultima = i === datos.length - 1;
          return (
            <g
              key={d.clave}
              className="chart-bar-group"
              tabIndex={0}
              role="img"
              aria-label={d.detalle}
            >
              <title>{d.detalle}</title>
              <rect
                x={MARGEN.left + paso * i}
                y={MARGEN.top}
                width={paso}
                height={altoUtil}
                className="chart-bar-hit"
              />
              <rect
                x={x}
                y={MARGEN.top + altoUtil - alto}
                width={anchoBarra}
                height={alto}
                rx={3}
                className={`chart-bar${ultima ? " chart-bar--hoy" : ""}`}
              />
              {d.valor > 0 && (
                <text
                  x={x + anchoBarra / 2}
                  y={MARGEN.top + altoUtil - alto - 6}
                  textAnchor="middle"
                  className="chart-bar-value"
                >
                  {formatoEje(d.valor)}
                </text>
              )}
              {i % cadaN === 0 || ultima ? (
                <text
                  x={x + anchoBarra / 2}
                  y={ALTO - MARGEN.bottom + 18}
                  textAnchor="middle"
                  className="chart-axis"
                >
                  {d.etiqueta}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      <div className="sr-only">
        <table>
          <caption>{ariaLabel}</caption>
          <thead>
            <tr>
              <th scope="col">Día</th>
              <th scope="col">{columnaValor}</th>
            </tr>
          </thead>
          <tbody>
            {datos.map((d) => (
              <tr key={d.clave}>
                <th scope="row">{d.etiqueta}</th>
                <td>{d.detalle}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
