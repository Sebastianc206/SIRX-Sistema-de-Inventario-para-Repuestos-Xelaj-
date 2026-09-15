import { useEffect, useRef, useState } from "react";
import type { Repuesto } from "@/types/repuesto";

interface ProductoMultiSelectProps {
  productos: Repuesto[];
  seleccionados: string[];
  onToggle: (sku: string) => void;
  maximo: number;
}

// Dropdown de selección múltiple para MovimientosPage (filtro de producto):
// botón + panel desplegable con checkboxes. A diferencia de
// RepuestoSkuSelect (que sí necesita un portal a document.body porque vive
// dentro de una tabla con overflow-x:auto que recortaría la lista), este
// panel es hijo directo del filtro de la página — sin overflow que lo
// recorte — así que se renderiza como hijo normal, posicionado con CSS
// absoluto, evitando por completo el bug de portal+click que motivó el
// portal allá (un clic en una opción dentro del portal no llegaba a
// registrarse porque el listener de "clic afuera" se disparaba primero).
export function ProductoMultiSelect({ productos, seleccionados, onToggle, maximo }: ProductoMultiSelectProps) {
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function alHacerClicFuera(evento: MouseEvent) {
      if (!contenedorRef.current?.contains(evento.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", alHacerClicFuera);
    return () => document.removeEventListener("mousedown", alHacerClicFuera);
  }, []);

  const etiqueta =
    seleccionados.length === 0
      ? "Todos los productos"
      : `${seleccionados.length} producto${seleccionados.length === 1 ? "" : "s"} seleccionado${seleccionados.length === 1 ? "" : "s"}`;

  return (
    <div className="producto-dropdown" ref={contenedorRef}>
      <button
        type="button"
        className="producto-dropdown-boton"
        onClick={() => setAbierto((actual) => !actual)}
        aria-expanded={abierto}
      >
        {etiqueta}
        <span aria-hidden="true">▾</span>
      </button>

      {abierto && (
        <div className="producto-dropdown-panel" role="group" aria-label="Filtrar por producto">
          {seleccionados.length >= maximo && (
            <p className="modal-helper-text producto-dropdown-limite">
              Máximo {maximo} productos a la vez — quita uno para elegir otro.
            </p>
          )}
          {productos.length === 0 ? (
            <p className="modal-helper-text">Ningún repuesto coincide con ese filtro.</p>
          ) : (
            productos.map((producto) => {
              const marcado = seleccionados.includes(producto.sku);
              return (
                <label key={producto.sku} className="producto-dropdown-item">
                  <input
                    type="checkbox"
                    checked={marcado}
                    disabled={!marcado && seleccionados.length >= maximo}
                    onChange={() => onToggle(producto.sku)}
                  />
                  {producto.nombre} <span className="modal-helper-text">({producto.sku})</span>
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
