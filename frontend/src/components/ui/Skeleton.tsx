interface SkeletonProps {
  width?: string;
  height?: string;
  className?: string;
}

// Bloque de carga. Es decorativo: el contenedor que lo usa expone aria-busy
// y el texto "Cargando..." solo para lectores de pantalla.
export function Skeleton({ width = "100%", height = "1rem", className }: SkeletonProps) {
  return <span className={`skeleton${className ? ` ${className}` : ""}`} style={{ width, height }} aria-hidden="true" />;
}

export function SkeletonRows({ filas = 6, columnas = 4 }: { filas?: number; columnas?: number }) {
  return (
    <div className="skeleton-rows" aria-busy="true">
      <span className="sr-only">Cargando...</span>
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="skeleton-row" style={{ gridTemplateColumns: `2fr repeat(${columnas - 1}, 1fr)` }}>
          {Array.from({ length: columnas }, (_, j) => (
            <Skeleton key={j} width={j === 0 ? "80%" : "60%"} height="0.9rem" />
          ))}
        </div>
      ))}
    </div>
  );
}
