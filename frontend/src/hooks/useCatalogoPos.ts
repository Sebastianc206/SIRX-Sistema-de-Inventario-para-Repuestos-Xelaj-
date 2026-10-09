import { useCallback, useEffect, useRef, useState } from "react";
import { listarRepuestos } from "@/services/repuestoService";
import type { Repuesto } from "@/types/repuesto";

export const POS_POR_PAGINA = 50;
const DEBOUNCE_MS = 250;

interface Params {
  consulta: string;
  idCategoria?: number;
  idMarca?: number;
  soloConExistencias: boolean;
}

// Catálogo del punto de venta con paginación incremental en servidor:
// búsqueda con debounce, filtros y "cargar más" (scroll infinito). Cada
// cambio de parámetros reinicia la lista; las respuestas obsoletas se
// descartan con un contador de generación. `refrescar` vuelve a pedir desde
// la primera página (p. ej. tras una venta, para actualizar existencias).
export function useCatalogoPos({ consulta, idCategoria, idMarca, soloConExistencias }: Params) {
  const [items, setItems] = useState<Repuesto[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const generacion = useRef(0);
  const paginaActual = useRef(0);
  const ocupado = useRef(false);
  const estado = useRef({ items: 0, total: 0 });
  estado.current = { items: items.length, total };

  const filtros = useCallback(
    (pagina: number) => ({
      estado: "activo" as const,
      busqueda: consulta.trim() || undefined,
      idCategoria,
      idMarca,
      soloConExistencias: soloConExistencias || undefined,
      // Con existencias primero (si ya se filtra por existencias no hace falta).
      orden: soloConExistencias ? undefined : ("existencias" as const),
      pagina,
      porPagina: POS_POR_PAGINA,
    }),
    [consulta, idCategoria, idMarca, soloConExistencias],
  );

  useEffect(() => {
    const miGeneracion = generacion.current + 1;
    generacion.current = miGeneracion;
    paginaActual.current = 0;
    ocupado.current = true;
    setCargando(true);
    setError(null);
    const temporizador = setTimeout(
      () => {
        listarRepuestos(filtros(1))
          .then((r) => {
            if (generacion.current !== miGeneracion) return;
            paginaActual.current = 1;
            setItems(r.articulos);
            setTotal(r.paginacion.total);
          })
          .catch((err: unknown) => {
            if (generacion.current !== miGeneracion) return;
            setItems([]);
            setTotal(0);
            setError(err instanceof Error ? err.message : "No se pudo buscar en el catálogo");
          })
          .finally(() => {
            if (generacion.current === miGeneracion) {
              ocupado.current = false;
              setCargando(false);
            }
          });
      },
      consulta.trim() ? DEBOUNCE_MS : 0,
    );
    return () => clearTimeout(temporizador);
  }, [filtros, consulta, version]);

  const cargarMas = useCallback(() => {
    if (ocupado.current || paginaActual.current === 0) return;
    if (estado.current.items >= estado.current.total) return;
    const miGeneracion = generacion.current;
    const siguiente = paginaActual.current + 1;
    ocupado.current = true;
    setCargandoMas(true);
    listarRepuestos(filtros(siguiente))
      .then((r) => {
        if (generacion.current !== miGeneracion) return;
        paginaActual.current = siguiente;
        setTotal(r.paginacion.total);
        // Dedupe por SKU: si el catálogo cambió entre páginas no se repiten filas.
        setItems((actual) => {
          const vistos = new Set(actual.map((a) => a.sku));
          return [...actual, ...r.articulos.filter((a) => !vistos.has(a.sku))];
        });
      })
      .catch((err: unknown) => {
        if (generacion.current === miGeneracion) setError(err instanceof Error ? err.message : "No se pudo cargar más resultados");
      })
      .finally(() => {
        if (generacion.current === miGeneracion) {
          ocupado.current = false;
          setCargandoMas(false);
        }
      });
  }, [filtros]);

  const refrescar = useCallback(() => setVersion((v) => v + 1), []);

  return { items, total, cargando, cargandoMas, error, cargarMas, refrescar };
}
