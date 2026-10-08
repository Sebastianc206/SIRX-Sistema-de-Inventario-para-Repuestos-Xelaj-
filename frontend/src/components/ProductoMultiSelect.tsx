import { useEffect, useRef, useState } from "react";

export interface OpcionMultiSelect {
  id: string;
  etiqueta: string;
  detalle?: string;
}

interface ProductoMultiSelectProps {
  opciones: OpcionMultiSelect[];
  seleccionados: string[];
  onCambiarSeleccion: (seleccionados: string[]) => void;
  etiquetaBoton: (cantidadSeleccionada: number) => string;
  // "Todas" arriba de la lista: marcarla selecciona todas las opciones
  // VISIBLES (las que llegan en `opciones`), desmarcarla las deselecciona
  // todas. Se omite en selects con tope (ver `maximo`) porque "seleccionar
  // todas" no es compatible con un límite — ej. comparación de ventas.
  conOpcionTodas?: boolean;
  // Tope de selecciones simultáneas (ej. comparación de ventas, máximo 10).
  // Sin tope si se omite.
  maximo?: number;
  mensajeLimite?: string;
  mensajeVacio?: string;
  ariaLabel: string;
}

// Dropdown de selección múltiple reutilizable (MovimientosPage: producto,
// categoría, marca — antes solo producto): botón + panel desplegable con
// checkboxes. A diferencia de RepuestoSkuSelect (que sí necesita un portal a
// document.body porque vive dentro de una tabla con overflow-x:auto que
// recortaría la lista), este panel es hijo directo del filtro de la página
// — sin overflow que lo recorte — así que se renderiza como hijo normal,
// posicionado con CSS absoluto, evitando por completo el bug de portal+clic
// que motivó el portal allá (un clic en una opción dentro del portal no
// llegaba a registrarse porque el listener de "clic afuera" se disparaba
// primero).
export function ProductoMultiSelect({
  opciones,
  seleccionados,
  onCambiarSeleccion,
  etiquetaBoton,
  conOpcionTodas = false,
  maximo,
  mensajeLimite,
  mensajeVacio = "Ningún resultado coincide con ese filtro.",
  ariaLabel,
}: ProductoMultiSelectProps) {
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

  const idsVisibles = opciones.map((opcion) => opcion.id);
  const todasMarcadas = idsVisibles.length > 0 && idsVisibles.every((id) => seleccionados.includes(id));
  const enElLimite = maximo !== undefined && seleccionados.length >= maximo;

  function toggleUno(id: string) {
    const yaMarcado = seleccionados.includes(id);
    if (yaMarcado) {
      onCambiarSeleccion(seleccionados.filter((s) => s !== id));
    } else if (maximo === undefined || seleccionados.length < maximo) {
      onCambiarSeleccion([...seleccionados, id]);
    }
  }

  function toggleTodas() {
    if (todasMarcadas) {
      onCambiarSeleccion(seleccionados.filter((s) => !idsVisibles.includes(s)));
    } else {
      onCambiarSeleccion([...new Set([...seleccionados, ...idsVisibles])]);
    }
  }

  return (
    <div className="producto-dropdown" ref={contenedorRef}>
      <button
        type="button"
        className="producto-dropdown-boton"
        onClick={() => setAbierto((actual) => !actual)}
        aria-expanded={abierto}
      >
        {etiquetaBoton(seleccionados.length)}
        <span aria-hidden="true">▾</span>
      </button>

      {abierto && (
        <div className="producto-dropdown-panel" role="group" aria-label={ariaLabel}>
          {enElLimite && mensajeLimite && (
            <p className="modal-helper-text producto-dropdown-limite">{mensajeLimite}</p>
          )}
          {opciones.length === 0 ? (
            <p className="modal-helper-text">{mensajeVacio}</p>
          ) : (
            <>
              {conOpcionTodas && (
                <label className="producto-dropdown-item producto-dropdown-item--todas">
                  <input type="checkbox" checked={todasMarcadas} onChange={toggleTodas} />
                  Todas
                </label>
              )}
              {opciones.map((opcion) => {
                const marcado = seleccionados.includes(opcion.id);
                return (
                  <label key={opcion.id} className="producto-dropdown-item">
                    <input
                      type="checkbox"
                      checked={marcado}
                      disabled={!marcado && enElLimite}
                      onChange={() => toggleUno(opcion.id)}
                    />
                    {opcion.etiqueta} {opcion.detalle && <span className="modal-helper-text">({opcion.detalle})</span>}
                  </label>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
