// Datos derivados para el tablero. NO hay endpoints nuevos: se reutilizan los
// servicios existentes (catálogo de repuestos e historial de movimientos) y se
// agregan en el cliente. El historial es de uso exclusivo de Administrador en
// la API (403 para Operador), así que ni siquiera se invoca para otros roles
// (ver DashboardPage). Aquí no se lee ningún dato de costo ni de proveedor.
import { listarMovimientos } from "@/services/movimientoService";
import { listarRepuestos } from "@/services/repuestoService";
import { aISO, haceDiasISO, hoyISO } from "@/utils/fechas";
import type { MovimientoHistorial } from "@/types/movimiento";

const POR_PAGINA = 100;
const MAX_PAGINAS_CATALOGO = 10;
const MAX_PAGINAS_MOVIMIENTOS = 8;

export interface CategoriaStock {
  categoria: string;
  unidades: number;
  skus: number;
  bajos: number;
  agotados: number;
}

export interface ResumenInventario {
  categorias: CategoriaStock[];
  unidadesTotales: number;
  skusBajos: number;
  skusAgotados: number;
  // true si el catálogo superó el tope de páginas y el resumen es parcial.
  truncado: boolean;
}

export async function obtenerResumenInventario(): Promise<ResumenInventario> {
  const primera = await listarRepuestos({ estado: "activo", porPagina: POR_PAGINA, pagina: 1 });
  const totalPaginas = Math.min(primera.paginacion.totalPaginas, MAX_PAGINAS_CATALOGO);
  const restantes = await Promise.all(
    Array.from({ length: Math.max(0, totalPaginas - 1) }, (_, i) => listarRepuestos({ estado: "activo", porPagina: POR_PAGINA, pagina: i + 2 })),
  );
  const articulos = [primera, ...restantes].flatMap((r) => r.articulos);

  const porCategoria = new Map<string, CategoriaStock>();
  let unidadesTotales = 0;
  let skusBajos = 0;
  let skusAgotados = 0;

  for (const a of articulos) {
    const nombre = a.categoria?.descripcion ?? "Sin categoría";
    const fila = porCategoria.get(nombre) ?? { categoria: nombre, unidades: 0, skus: 0, bajos: 0, agotados: 0 };
    fila.skus += 1;
    fila.unidades += Math.max(0, a.cantidadInventario);
    // El estado viene calculado del backend (umbral efectivo).
    const estado = a.estadoStock ?? (a.cantidadInventario <= 0 ? "agotado" : a.cantidadInventario <= a.inventarioMinimo ? "bajo" : "en_stock");
    if (estado === "agotado") {
      fila.agotados += 1;
      skusAgotados += 1;
    } else if (estado === "bajo") {
      fila.bajos += 1;
      skusBajos += 1;
    }
    unidadesTotales += Math.max(0, a.cantidadInventario);
    porCategoria.set(nombre, fila);
  }

  return {
    categorias: [...porCategoria.values()].sort((a, b) => b.unidades - a.unidades),
    unidadesTotales,
    skusBajos,
    skusAgotados,
    truncado: primera.paginacion.totalPaginas > MAX_PAGINAS_CATALOGO,
  };
}

export interface VentaDia {
  fecha: string; // aaaa-mm-dd (local)
  total: number;
  unidades: number;
  transacciones: number;
}

export interface ActividadVentas {
  dias: VentaDia[];
  recientes: MovimientoHistorial[];
  truncado: boolean;
}

// Ventas por día de los últimos `dias` días (incluye hoy), sin las anuladas.
export async function obtenerActividadVentas(dias: number): Promise<ActividadVentas> {
  const filtros = { fechaDesde: haceDiasISO(dias - 1), fechaHasta: hoyISO(), porPagina: POR_PAGINA };
  const primera = await listarMovimientos({ ...filtros, pagina: 1 });
  const totalPaginas = Math.min(primera.paginacion.totalPaginas, MAX_PAGINAS_MOVIMIENTOS);
  const restantes = await Promise.all(
    Array.from({ length: Math.max(0, totalPaginas - 1) }, (_, i) => listarMovimientos({ ...filtros, pagina: i + 2 })),
  );
  const movimientos = [primera, ...restantes].flatMap((r) => r.movimientos);

  const mapa = new Map<string, VentaDia>();
  for (let i = dias - 1; i >= 0; i -= 1) {
    const fecha = haceDiasISO(i);
    mapa.set(fecha, { fecha, total: 0, unidades: 0, transacciones: 0 });
  }
  for (const m of movimientos) {
    if (m.categoria !== "venta" || m.anulada) continue;
    const fila = mapa.get(aISO(new Date(m.fecha)));
    if (!fila) continue;
    fila.total += m.cantidad * Number(m.precioVenta ?? 0);
    fila.unidades += m.cantidad;
    fila.transacciones += 1;
  }

  return {
    dias: [...mapa.values()],
    recientes: primera.movimientos.slice(0, 8),
    truncado: primera.paginacion.totalPaginas > MAX_PAGINAS_MOVIMIENTOS,
  };
}
