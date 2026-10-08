import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { listarRepuestos } from "@/services/repuestoService";
import type { Repuesto } from "@/types/repuesto";
import { IconBuscar } from "@/components/icons";

interface RepuestoSkuSelectProps {
  value: string;
  onChange: (sku: string) => void;
  disabled?: boolean;
  // Opcional: además de onChange(sku), entrega el repuesto completo elegido
  // — usado por VentasPage para autocompletar el precio de venta con el del
  // catálogo. Compras/Ajustes/Movimientos no lo necesitan y no lo pasan.
  onSeleccionar?: (repuesto: Repuesto) => void;
}

const RESULTADOS_MAXIMOS = 8;
const DEBOUNCE_MS = 250;

function etiquetaDe(repuesto: Repuesto): string {
  return `${repuesto.sku} — ${repuesto.nombre}`;
}

// Combobox con búsqueda (como en un POS): reemplaza al <select> nativo que
// cargaba hasta 100 repuestos de un jalón. Comparte el flujo de líneas de
// compra (HU-08), venta (HU-13) y ajuste (HU-09), y el buscador de
// MovimientosPage (HU-10) — misma interfaz value/onChange que antes, así
// que ningún llamador necesita cambiar.
//
// La lista de opciones se monta en un portal a document.body, posicionada
// con coordenadas fijas del input: en compras/ventas/ajustes este control
// vive dentro de .lineas-tabla-wrap, que tiene overflow-x:auto (necesario
// para el scroll horizontal de la tabla en pantallas angostas) — si la
// lista fuera un hijo normal, ese overflow la recortaría en vez de dejarla
// flotar sobre la fila siguiente.
export function RepuestoSkuSelect({ value, onChange, disabled, onSeleccionar }: RepuestoSkuSelectProps) {
  const listboxId = useId();
  const contenedorRef = useRef<HTMLDivElement>(null);
  const listaRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [texto, setTexto] = useState("");
  const [seleccionado, setSeleccionado] = useState<Repuesto | null>(null);
  const [opciones, setOpciones] = useState<Repuesto[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [indiceActivo, setIndiceActivo] = useState(0);
  const [posicion, setPosicion] = useState({ top: 0, left: 0, width: 0 });

  // Si el padre resetea el formulario (value vuelve a ""), limpia también
  // el texto mostrado y la selección interna.
  useEffect(() => {
    if (value === "" && seleccionado !== null) {
      setSeleccionado(null);
      setTexto("");
    }
    // Solo reacciona cuando el padre limpia el valor; una vez que el usuario
    // elige una opción, este mismo componente ya mantiene texto/value en
    // sincronía y no hay que re-derivar nada desde `value`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (!abierto) return undefined;

    const termino = texto.trim();
    setCargando(true);
    const temporizador = setTimeout(() => {
      listarRepuestos({ estado: "activo", busqueda: termino || undefined, porPagina: RESULTADOS_MAXIMOS })
        .then((resultado) => {
          setOpciones(resultado.articulos);
          setIndiceActivo(0);
        })
        .catch(() => setOpciones([]))
        .finally(() => setCargando(false));
    }, DEBOUNCE_MS);

    return () => clearTimeout(temporizador);
  }, [texto, abierto]);

  useLayoutEffect(() => {
    if (!abierto) return undefined;

    function actualizarPosicion() {
      const rect = inputRef.current?.getBoundingClientRect();
      if (rect) {
        setPosicion({ top: rect.bottom + 4, left: rect.left, width: rect.width });
      }
    }

    actualizarPosicion();
    window.addEventListener("scroll", actualizarPosicion, true);
    window.addEventListener("resize", actualizarPosicion);
    return () => {
      window.removeEventListener("scroll", actualizarPosicion, true);
      window.removeEventListener("resize", actualizarPosicion);
    };
  }, [abierto, opciones.length]);

  // La lista vive en un portal a document.body, así que un clic dentro de
  // ella no es descendiente de contenedorRef — sin este segundo chequeo,
  // "clic afuera" se disparaba también al clickear una opción y la cerraba
  // antes de que el onClick de la opción llegara a ejecutarse.
  useEffect(() => {
    function alHacerClicFuera(evento: MouseEvent) {
      const objetivo = evento.target as Node;
      const dentroContenedor = contenedorRef.current?.contains(objetivo) ?? false;
      const dentroLista = listaRef.current?.contains(objetivo) ?? false;
      if (!dentroContenedor && !dentroLista) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", alHacerClicFuera);
    return () => document.removeEventListener("mousedown", alHacerClicFuera);
  }, []);

  function elegir(repuesto: Repuesto) {
    setSeleccionado(repuesto);
    setTexto(etiquetaDe(repuesto));
    setAbierto(false);
    onChange(repuesto.sku);
    onSeleccionar?.(repuesto);
  }

  function handleInputChange(nuevoTexto: string) {
    setTexto(nuevoTexto);
    setAbierto(true);
    if (seleccionado) {
      setSeleccionado(null);
      onChange("");
    }
  }

  function handleKeyDown(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      if (!abierto) {
        setAbierto(true);
        return;
      }
      setIndiceActivo((actual) => Math.min(actual + 1, opciones.length - 1));
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setIndiceActivo((actual) => Math.max(actual - 1, 0));
    } else if (evento.key === "Enter") {
      if (abierto && opciones[indiceActivo]) {
        evento.preventDefault();
        elegir(opciones[indiceActivo]);
      }
    } else if (evento.key === "Escape") {
      setAbierto(false);
    }
  }

  return (
    <div className="combobox" ref={contenedorRef}>
      <input
        ref={inputRef}
        type="text"
        className="combobox-input"
        role="combobox"
        aria-expanded={abierto}
        aria-controls={listboxId}
        aria-autocomplete="list"
        placeholder="Buscar por SKU o nombre..."
        value={texto}
        disabled={disabled}
        onChange={(evento) => handleInputChange(evento.target.value)}
        onFocus={() => setAbierto(true)}
        onKeyDown={handleKeyDown}
      />
      {abierto &&
        createPortal(
          <ul
            ref={listaRef}
            className="combobox-lista"
            role="listbox"
            id={listboxId}
            style={{ position: "fixed", top: posicion.top, left: posicion.left, width: posicion.width }}
          >
            {cargando ? (
              <li className="combobox-mensaje">
                <IconBuscar /> Buscando...
              </li>
            ) : opciones.length === 0 ? (
              <li className="combobox-mensaje">Sin resultados</li>
            ) : (
              opciones.map((repuesto, indice) => (
                <li
                  key={repuesto.sku}
                  role="option"
                  aria-selected={indice === indiceActivo}
                  className={`combobox-opcion${indice === indiceActivo ? " combobox-opcion--activa" : ""}`}
                  onMouseDown={(evento) => evento.preventDefault()}
                  onMouseEnter={() => setIndiceActivo(indice)}
                  onClick={() => elegir(repuesto)}
                >
                  {repuesto.nombre} <span className="combobox-opcion-sku">({repuesto.sku})</span>
                </li>
              ))
            )}
          </ul>,
          document.body,
        )}
    </div>
  );
}
