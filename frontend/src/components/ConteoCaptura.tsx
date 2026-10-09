import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Icon } from "@/components/ui/Icon";
import { listarRepuestos } from "@/services/repuestoService";
import type { Repuesto } from "@/types/repuesto";

interface ConteoCapturaProps {
  idCategoria?: number;
  // Se llama con el repuesto elegido (Enter con SKU exacto/único o clic en una sugerencia).
  onAgregar: (repuesto: Repuesto) => void;
}

export interface ConteoCapturaHandle {
  enfocar: () => void;
}

const DEBOUNCE_MS = 200;
const MAX_SUGERENCIAS = 8;

// Buscador de captura del conteo: SKU o nombre. Pensado para lector de
// códigos (el lector "teclea" el SKU y envía Enter): Enter con un SKU exacto
// (o un único resultado) agrega el producto y deja el foco aquí para el
// siguiente. Si hay varios resultados, se elige con flechas + Enter o clic.
export const ConteoCaptura = forwardRef<ConteoCapturaHandle, ConteoCapturaProps>(function ConteoCaptura({ idCategoria, onAgregar }, ref) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listaId = useId();
  const [texto, setTexto] = useState("");
  const [opciones, setOpciones] = useState<Repuesto[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const [aviso, setAviso] = useState("");
  const generacion = useRef(0);
  const cola = useRef<Promise<void>>(Promise.resolve());

  useImperativeHandle(ref, () => ({ enfocar: () => inputRef.current?.focus() }));

  function consultar(termino: string) {
    return listarRepuestos({ estado: "activo", busqueda: termino, idCategoria, porPagina: MAX_SUGERENCIAS });
  }

  useEffect(() => {
    const termino = texto.trim();
    if (!termino) {
      setOpciones([]);
      setAbierto(false);
      return undefined;
    }
    const mia = ++generacion.current;
    const t = setTimeout(() => {
      consultar(termino)
        .then((r) => {
          if (generacion.current !== mia) return;
          setOpciones(r.articulos);
          setActivo(-1);
          setAbierto(true);
        })
        .catch(() => {
          if (generacion.current === mia) setOpciones([]);
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto, idCategoria]);

  function agregarElegido(repuesto: Repuesto) {
    setActivo(-1);
    setAviso(`${repuesto.sku} agregado`);
    onAgregar(repuesto);
    inputRef.current?.focus();
  }

  function elegir(repuesto: Repuesto) {
    generacion.current += 1;
    setTexto("");
    setOpciones([]);
    setAbierto(false);
    agregarElegido(repuesto);
  }

  // Un lector de códigos envía el siguiente SKU enseguida: el campo se vacía
  // en el acto (no espera a la red) y las búsquedas se atienden en orden.
  function confirmar() {
    const termino = texto.trim();
    if (!termino) return;
    if (activo >= 0 && opciones[activo]) {
      elegir(opciones[activo]);
      return;
    }
    generacion.current += 1;
    setTexto("");
    setOpciones([]);
    setAbierto(false);
    cola.current = cola.current.then(() => resolver(termino));
  }

  async function resolver(termino: string) {
    try {
      const r = await consultar(termino);
      const exacto = r.articulos.find((a) => a.sku.toLowerCase() === termino.toLowerCase());
      if (exacto) {
        agregarElegido(exacto);
        return;
      }
      if (r.articulos.length === 1) {
        agregarElegido(r.articulos[0]);
        return;
      }
      // Sin coincidencia clara: se devuelve el texto al campo para corregirlo o elegir.
      setTexto(termino);
      if (r.articulos.length === 0) {
        setAviso(
          idCategoria
            ? `No se encontró «${termino}» en la categoría de este conteo.`
            : `No se encontró «${termino}». Revisa el SKU o busca por nombre.`,
        );
        setTimeout(() => inputRef.current?.select(), 0);
        return;
      }
      setOpciones(r.articulos);
      setActivo(0);
      setAbierto(true);
      setAviso(`${r.articulos.length} resultados: elige uno`);
    } catch {
      setTexto(termino);
      setAviso("No se pudo buscar. Intenta de nuevo.");
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      confirmar();
    } else if (e.key === "ArrowDown" && opciones.length > 0) {
      e.preventDefault();
      setAbierto(true);
      setActivo((a) => Math.min(a + 1, opciones.length - 1));
    } else if (e.key === "ArrowUp" && opciones.length > 0) {
      e.preventDefault();
      setActivo((a) => Math.max(a - 1, 0));
    } else if (e.key === "Escape" && abierto) {
      e.stopPropagation();
      setAbierto(false);
    }
  }

  return (
    <div className="conteo-captura">
      <div className="conteo-captura-campo">
        <Icon name="search" size={18} />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          className="input conteo-captura-input"
          aria-label="Buscar o escanear producto"
          aria-expanded={abierto}
          aria-controls={listaId}
          aria-autocomplete="list"
          aria-activedescendant={activo >= 0 ? `${listaId}-${activo}` : undefined}
          placeholder="Escanea o escribe un SKU o nombre y pulsa Enter"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setAviso("");
          }}
          onKeyDown={onKeyDown}
          onBlur={() => setTimeout(() => setAbierto(false), 120)}
          onFocus={() => opciones.length > 0 && setAbierto(true)}
        />
        {abierto && opciones.length > 0 && (
          <ul id={listaId} role="listbox" className="combobox-lista conteo-captura-lista">
            {opciones.map((r, i) => (
              <li
                key={r.sku}
                id={`${listaId}-${i}`}
                role="option"
                aria-selected={i === activo}
                className={`combobox-opcion${i === activo ? " combobox-opcion--activa" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActivo(i)}
                onClick={() => elegir(r)}
              >
                <strong>{r.sku}</strong> {r.nombre} <span className="combobox-opcion-sku">(sistema: {r.cantidadInventario})</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="conteo-captura-aviso" role="status" aria-live="polite">
        {aviso}
      </p>
    </div>
  );
});
