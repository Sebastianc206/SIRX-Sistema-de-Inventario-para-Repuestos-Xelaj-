import type { SerieVentas } from "@/types/movimiento";

interface VentasComparacionChartProps {
  series: SerieVentas[];
  colorPorSku: (sku: string) => string;
  // Conjunto de skus "enfocados" — 0, 1 o varios a la vez. Cada clic en una
  // cápsula/leyenda/línea alterna (toggle) su propia membresía, sin afectar
  // a las demás. Con el conjunto vacío, todas las series se ven normales.
  resaltados: ReadonlySet<string>;
  onToggleResaltado: (sku: string) => void;
}

const ANCHO = 720;
const ALTO = 320;
const MARGEN = { top: 16, right: 16, bottom: 32, left: 44 };

function formatearFechaCorta(fechaIso: string): string {
  const [, mes, dia] = fechaIso.split("-");
  return `${dia}/${mes}`;
}

// Gráfica de líneas comparando ventas de varios productos (dataviz skill:
// marcas finas, líneas punteadas para diferenciarse de un área sólida,
// puntos marcados >=8px, leyenda siempre presente con 2+ series). El color
// de cada serie lo decide `colorPorSku` — en MovimientosPage se asigna por
// ORDEN DE SELECCIÓN del producto, no por su posición en el catálogo (así
// el 1er producto elegido siempre es azul, el 2do naranja, etc.), cambio de
// diseño intencional. Al hacer clic en una línea/leyenda, esa serie entra o
// sale del conjunto resaltado (selección múltiple) y las que quedan fuera
// del conjunto se atenúan.
export function VentasComparacionChart({
  series,
  colorPorSku,
  resaltados,
  onToggleResaltado,
}: VentasComparacionChartProps) {
  const todasLasFechas = [...new Set(series.flatMap((s) => s.puntos.map((p) => p.fecha)))].sort();

  if (todasLasFechas.length === 0) {
    return <p className="admin-estado-vacio">Ninguno de los productos seleccionados tiene ventas registradas.</p>;
  }

  const tiempoMin = new Date(todasLasFechas[0]).getTime();
  const tiempoMax = new Date(todasLasFechas[todasLasFechas.length - 1]).getTime();
  const rangoTiempo = Math.max(tiempoMax - tiempoMin, 1);

  const cantidadMaxima = Math.max(1, ...series.flatMap((s) => s.puntos.map((p) => p.cantidad)));
  const yMax = cantidadMaxima * 1.15;

  const anchoUtil = ANCHO - MARGEN.left - MARGEN.right;
  const altoUtil = ALTO - MARGEN.top - MARGEN.bottom;

  function x(fecha: string): number {
    if (rangoTiempo === 0) return MARGEN.left + anchoUtil / 2;
    return MARGEN.left + ((new Date(fecha).getTime() - tiempoMin) / rangoTiempo) * anchoUtil;
  }

  function y(cantidad: number): number {
    return MARGEN.top + altoUtil - (cantidad / yMax) * altoUtil;
  }

  const ticksY = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax * f));
  // Máximo ~6 etiquetas de fecha en el eje X para que no se amontonen.
  const paso = Math.max(1, Math.ceil(todasLasFechas.length / 6));
  const fechasEtiquetadas = todasLasFechas.filter((_, i) => i % paso === 0);

  return (
    <div className="comparacion-grafica">
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img" aria-label="Comparación de ventas entre productos">
        {ticksY.map((valor) => (
          <g key={valor}>
            <line
              x1={MARGEN.left}
              x2={ANCHO - MARGEN.right}
              y1={y(valor)}
              y2={y(valor)}
              className="comparacion-grafica-grid"
            />
            <text x={MARGEN.left - 8} y={y(valor)} textAnchor="end" dominantBaseline="middle" className="comparacion-grafica-eje">
              {valor}
            </text>
          </g>
        ))}

        <line
          x1={MARGEN.left}
          x2={MARGEN.left}
          y1={MARGEN.top}
          y2={ALTO - MARGEN.bottom}
          className="comparacion-grafica-eje-linea"
        />
        <line
          x1={MARGEN.left}
          x2={ANCHO - MARGEN.right}
          y1={ALTO - MARGEN.bottom}
          y2={ALTO - MARGEN.bottom}
          className="comparacion-grafica-eje-linea"
        />

        {fechasEtiquetadas.map((fecha) => (
          <text
            key={fecha}
            x={x(fecha)}
            y={ALTO - MARGEN.bottom + 18}
            textAnchor="middle"
            className="comparacion-grafica-eje"
          >
            {formatearFechaCorta(fecha)}
          </text>
        ))}

        {series.map((serie) => {
          const color = colorPorSku(serie.sku);
          const activa = resaltados.has(serie.sku);
          const atenuada = resaltados.size > 0 && !activa;
          const puntosOrdenados = [...serie.puntos].sort((a, b) => a.fecha.localeCompare(b.fecha));
          const puntosSvg = puntosOrdenados.map((p) => `${x(p.fecha)},${y(p.cantidad)}`).join(" ");

          return (
            <g
              key={serie.sku}
              className="comparacion-grafica-serie"
              style={{ opacity: atenuada ? 0.25 : 1, cursor: "pointer" }}
              onClick={() => onToggleResaltado(serie.sku)}
            >
              <polyline
                points={puntosSvg}
                fill="none"
                stroke={color}
                strokeWidth={activa ? 3 : 2}
                strokeDasharray="6 4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {puntosOrdenados.map((p) => (
                <circle key={p.fecha} cx={x(p.fecha)} cy={y(p.cantidad)} r={4} fill={color}>
                  <title>
                    {serie.nombre} · {formatearFechaCorta(p.fecha)}: {p.cantidad} vendidos
                  </title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>

      <ul className="comparacion-leyenda">
        {series.map((serie) => {
          const activa = resaltados.has(serie.sku);
          const atenuada = resaltados.size > 0 && !activa;
          return (
            <li key={serie.sku}>
              <button
                type="button"
                className={`comparacion-leyenda-item${activa ? " comparacion-leyenda-item--activa" : ""}`}
                onClick={() => onToggleResaltado(serie.sku)}
                style={{ opacity: atenuada ? 0.5 : 1 }}
              >
                <span className="comparacion-leyenda-swatch" style={{ background: colorPorSku(serie.sku) }} />
                {serie.nombre}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
