import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/components/ui/Icon";
import type { IconName } from "@/components/ui/Icon";
import { Overlay } from "@/components/ui/Overlay";
import { useAuth } from "@/hooks/useAuth";
import { ADMIN, itemsVisibles } from "@/navigation";
import { listarRepuestos } from "@/services/repuestoService";
import type { Repuesto } from "@/types/repuesto";
import { estadoStock } from "@/utils/estadoStock";

interface Opcion {
  id: string;
  grupo: "Acciones" | "Páginas" | "Repuestos";
  titulo: string;
  detalle?: string;
  icon: IconName;
  destino: string;
}

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const ACCIONES: { titulo: string; icon: IconName; destino: string; roles?: string[]; keywords: string }[] = [
  { titulo: "Nueva venta", icon: "cart", destino: "/ventas", keywords: "vender cobrar pos mostrador" },
  { titulo: "Nueva compra", icon: "receipt", destino: "/compras", roles: [ADMIN], keywords: "comprar reponer proveedor" },
  { titulo: "Registrar ajuste o merma", icon: "sliders", destino: "/ajustes", keywords: "salida merma garantia" },
  { titulo: "Nuevo repuesto", icon: "plus", destino: "/repuestos?nuevo=1", roles: [ADMIN], keywords: "crear agregar catalogo" },
];

interface CommandPaletteProps {
  onClose: () => void;
}

// Paleta de comandos (Ctrl+K): ir a páginas, lanzar acciones rápidas y
// buscar repuestos por SKU/nombre. Patrón combobox + listbox de WAI-ARIA:
// el foco se queda en el input y aria-activedescendant marca la opción.
export function CommandPalette({ onClose }: CommandPaletteProps) {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const tituloId = useId();
  const listaId = useId();
  const [consulta, setConsulta] = useState("");
  const [activa, setActiva] = useState(0);
  const [repuestos, setRepuestos] = useState<Repuesto[]>([]);
  const [buscando, setBuscando] = useState(false);
  const listaRef = useRef<HTMLUListElement>(null);

  const rol = usuario?.role;
  const termino = normalizar(consulta.trim());

  const estaticas = useMemo<Opcion[]>(() => {
    const acciones: Opcion[] = ACCIONES.filter((a) => !a.roles || (rol && a.roles.includes(rol))).map((a) => ({
      id: `accion-${a.destino}`,
      grupo: "Acciones",
      titulo: a.titulo,
      icon: a.icon,
      destino: a.destino,
      detalle: a.keywords,
    }));
    const paginas: Opcion[] = itemsVisibles(rol).map((i) => ({
      id: `pagina-${i.to}`,
      grupo: "Páginas",
      titulo: i.label,
      icon: i.icon,
      destino: i.to,
      detalle: i.keywords,
    }));
    const todas = [...acciones, ...paginas];
    if (!termino) return todas;
    return todas.filter((o) => normalizar(`${o.titulo} ${o.detalle ?? ""}`).includes(termino));
  }, [rol, termino]);

  // Búsqueda de repuestos con debounce (no se dispara con 1 letra).
  useEffect(() => {
    const t = consulta.trim();
    if (t.length < 2) {
      setRepuestos([]);
      setBuscando(false);
      return undefined;
    }
    let cancelado = false;
    setBuscando(true);
    const temporizador = setTimeout(() => {
      listarRepuestos({ busqueda: t, porPagina: 6 })
        .then((r) => {
          if (!cancelado) setRepuestos(r.articulos);
        })
        .catch(() => {
          if (!cancelado) setRepuestos([]);
        })
        .finally(() => {
          if (!cancelado) setBuscando(false);
        });
    }, 250);
    return () => {
      cancelado = true;
      clearTimeout(temporizador);
    };
  }, [consulta]);

  const opciones = useMemo<Opcion[]>(() => {
    const deRepuestos: Opcion[] = repuestos.map((r) => {
      const stock = estadoStock(r.cantidadInventario, r.inventarioMinimo, r.estadoStock);
      return {
        id: `repuesto-${r.sku}`,
        grupo: "Repuestos",
        titulo: r.nombre,
        detalle: `${r.sku} · ${r.cantidadInventario} en existencia · ${stock.texto}`,
        icon: "package",
        destino: `/repuestos?buscar=${encodeURIComponent(r.sku)}`,
      };
    });
    return [...deRepuestos, ...estaticas];
  }, [repuestos, estaticas]);

  useEffect(() => {
    setActiva(0);
  }, [consulta, repuestos.length]);

  useEffect(() => {
    listaRef.current?.querySelector(`[data-index="${activa}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [activa]);

  function ir(opcion: Opcion) {
    onClose();
    navigate(opcion.destino);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiva((i) => (opciones.length === 0 ? 0 : (i + 1) % opciones.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiva((i) => (opciones.length === 0 ? 0 : (i - 1 + opciones.length) % opciones.length));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiva(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiva(Math.max(0, opciones.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (opciones[activa]) ir(opciones[activa]);
    }
  }

  // Encabezados de grupo entre opciones consecutivas del mismo grupo.
  let grupoPrevio: string | null = null;

  return (
    <Overlay variant="palette" size="lg" labelledBy={tituloId} onRequestClose={onClose}>
      <h2 id={tituloId} className="sr-only">
        Buscar repuestos o ir a una página
      </h2>
      <div className="dialog-body palette-body">
        <div className="palette-input">
          <Icon name="search" size={20} />
          <input
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listaId}
            aria-activedescendant={opciones[activa] ? `${listaId}-${activa}` : undefined}
            aria-autocomplete="list"
            aria-label="Buscar repuestos por SKU o nombre, o ir a una página"
            placeholder="Buscar por SKU, nombre o página…"
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            onKeyDown={onKeyDown}
            autoComplete="off"
            data-autofocus
          />
          <kbd>Esc</kbd>
        </div>

        <ul ref={listaRef} id={listaId} role="listbox" className="palette-list" aria-label="Resultados">
          {opciones.map((o, i) => {
            const encabezado = o.grupo !== grupoPrevio;
            grupoPrevio = o.grupo;
            return (
              <li key={o.id} role="presentation">
                {encabezado && (
                  <p className="palette-group" role="presentation">
                    {o.grupo}
                  </p>
                )}
                <div
                  id={`${listaId}-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={i === activa}
                  className={`palette-option${i === activa ? " palette-option--active" : ""}`}
                  onMouseMove={() => setActiva(i)}
                  onClick={() => ir(o)}
                >
                  <span className="palette-option-icon">
                    <Icon name={o.icon} size={18} />
                  </span>
                  <span className="palette-option-text">
                    <span className="palette-option-title">{o.titulo}</span>
                    {o.grupo === "Repuestos" && o.detalle && <span className="palette-option-detail">{o.detalle}</span>}
                  </span>
                  <Icon name="arrowRight" size={16} className="palette-option-go" />
                </div>
              </li>
            );
          })}
          {opciones.length === 0 && !buscando && (
            <li className="palette-empty" role="presentation">
              Sin resultados para “{consulta}”.
            </li>
          )}
          {buscando && (
            <li className="palette-empty" role="presentation">
              Buscando repuestos…
            </li>
          )}
        </ul>
        <div className="palette-hint" aria-hidden="true">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> navegar
          </span>
          <span>
            <kbd>Enter</kbd> abrir
          </span>
        </div>
      </div>
    </Overlay>
  );
}
