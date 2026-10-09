import { cloneElement, useCallback, useId, useRef, useState } from "react";
import type { ReactElement } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  texto: string;
  lado?: "arriba" | "abajo" | "derecha";
  // Un único hijo enfocable: recibe aria-describedby y los manejadores.
  children: ReactElement;
}

// Tooltip accesible: aparece con hover y con foco de teclado, se descarta
// con Escape y se renderiza en un portal con posición fija — así no lo
// recortan los contenedores con overflow (tablas, sidebar en modo riel).
export function Tooltip({ texto, lado = "arriba", children }: TooltipProps) {
  const id = useId();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const objetivo = useRef<HTMLElement | null>(null);

  const mostrar = useCallback(
    (el: HTMLElement) => {
      objetivo.current = el;
      const r = el.getBoundingClientRect();
      if (lado === "derecha") setPos({ x: r.right + 8, y: r.top + r.height / 2 });
      else if (lado === "abajo") setPos({ x: r.left + r.width / 2, y: r.bottom + 8 });
      else setPos({ x: r.left + r.width / 2, y: r.top - 8 });
    },
    [lado],
  );

  const ocultar = useCallback(() => setPos(null), []);

  const hijo = children as ReactElement<Record<string, unknown>>;
  const props = hijo.props;

  return (
    <>
      {cloneElement(hijo, {
        "aria-describedby": pos ? id : (props["aria-describedby"] as string | undefined),
        onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
          (props.onMouseEnter as ((e: unknown) => void) | undefined)?.(e);
          mostrar(e.currentTarget);
        },
        onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
          (props.onMouseLeave as ((e: unknown) => void) | undefined)?.(e);
          ocultar();
        },
        onFocus: (e: React.FocusEvent<HTMLElement>) => {
          (props.onFocus as ((e: unknown) => void) | undefined)?.(e);
          if (e.currentTarget.matches(":focus-visible")) mostrar(e.currentTarget);
        },
        onBlur: (e: React.FocusEvent<HTMLElement>) => {
          (props.onBlur as ((e: unknown) => void) | undefined)?.(e);
          ocultar();
        },
        onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
          (props.onKeyDown as ((e: unknown) => void) | undefined)?.(e);
          if (e.key === "Escape") ocultar();
        },
      })}
      {pos &&
        createPortal(
          <span id={id} role="tooltip" className={`tooltip tooltip--${lado}`} style={{ left: pos.x, top: pos.y }}>
            {texto}
          </span>,
          document.body,
        )}
    </>
  );
}
