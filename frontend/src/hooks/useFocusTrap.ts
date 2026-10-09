import { useEffect, useRef } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function obtenerFocusables(contenedor: HTMLElement): HTMLElement[] {
  return Array.from(contenedor.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute("hidden") && el.getAttribute("aria-hidden") !== "true",
  );
}

// Atrapa el foco dentro de `ref` mientras `activo`: foco inicial dentro del
// diálogo, Tab/Shift+Tab cíclicos y retorno del foco al elemento que abrió
// el diálogo al cerrarse (WCAG 2.4.3, patrón de diálogo modal de WAI-ARIA).
export function useFocusTrap(ref: RefObject<HTMLElement>, activo = true) {
  // Se captura durante el primer render, antes de que el foco se mueva.
  const previo = useRef<Element | null>(typeof document !== "undefined" ? document.activeElement : null);

  useEffect(() => {
    if (!activo) return undefined;
    const contenedor = ref.current;
    if (!contenedor) return undefined;

    if (!contenedor.contains(document.activeElement)) {
      const marcado = contenedor.querySelector<HTMLElement>("[data-autofocus]");
      const primerCampo = contenedor.querySelector<HTMLElement>(
        ".dialog-body input:not([type='hidden']):not([disabled]), .dialog-body select:not([disabled]), .dialog-body textarea:not([disabled])",
      );
      const inicial = marcado ?? primerCampo ?? obtenerFocusables(contenedor)[0] ?? contenedor;
      inicial.focus();
    }

    const elementoPrevio = previo.current;
    return () => {
      // Diferido: al desmontar, el fondo (#root) sigue inerte hasta que el
      // Overlay termina su limpieza; enfocar antes no tendría efecto.
      setTimeout(() => {
        // StrictMode (desarrollo) simula un desmontaje: si el diálogo sigue
        // en el DOM, no es un cierre real.
        if (contenedor.isConnected) return;
        if (elementoPrevio instanceof HTMLElement && document.contains(elementoPrevio)) {
          elementoPrevio.focus();
        } else {
          document.getElementById("main-content")?.focus();
        }
      }, 0);
    };
  }, [activo, ref]);

  function onKeyDown(evento: ReactKeyboardEvent<HTMLElement>) {
    if (evento.key !== "Tab" || !ref.current) return;
    const focusables = obtenerFocusables(ref.current);
    if (focusables.length === 0) {
      evento.preventDefault();
      return;
    }
    const primero = focusables[0];
    const ultimo = focusables[focusables.length - 1];
    const activoEl = document.activeElement;
    if (evento.shiftKey && (activoEl === primero || !ref.current.contains(activoEl))) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && (activoEl === ultimo || !ref.current.contains(activoEl))) {
      evento.preventDefault();
      primero.focus();
    }
    // Un diálogo anidado no debe propagar su Tab al diálogo padre.
    evento.stopPropagation();
  }

  return { onKeyDown };
}
