// Tipos para HU-08 (compras), HU-09 (ajustes/mermas), HU-10 (historial de
// movimientos), HU-13/14 (ventas) y HU-12/15 (dashboard). Compra/Venta usan
// paginación igual que Repuesto (ver types/repuesto.ts); Ajuste no pagina
// porque el backend acota el listado a 200 filas recientes.

export interface Paginacion {
  pagina: number;
  porPagina: number;
  total: number;
  totalPaginas: number;
}

export interface EntidadReferenciada {
  idProveedor?: number;
  idCliente?: number;
  idColaborador?: number;
  nombre?: string;
  nombreCompleto?: string;
}

// ---------- Compras (HU-08) ----------

export interface LineaCompra {
  idDetalleCompra?: number;
  sku: string;
  nombre?: string;
  cantidad: number;
  precioCompra?: number;
}

export interface Compra {
  idCompra: number;
  fechaCompra: string;
  anulada: boolean;
  proveedor: { idProveedor: number; nombre: string } | null;
  colaborador: { idColaborador: number; nombreCompleto: string } | null;
  montoTotalCompra?: number;
  lineas: LineaCompra[];
}

export interface CompraFormLinea {
  sku: string;
  cantidad: number;
  precioCompra: number;
}

export interface CompraFormInput {
  idProveedor: number;
  fechaCompra?: string;
  lineas: CompraFormLinea[];
}

export interface ListarComprasResultado {
  compras: Compra[];
  paginacion: Paginacion;
}

// ---------- Ajustes / mermas (HU-09) ----------

export interface TipoSalidaAjuste {
  idTipoSalida: number;
  descripcion: string;
}

// El motivo vive por línea (no en el encabezado) desde la migración
// `20260914000000_tipo_salida_por_linea`: un ajuste puede traer líneas con
// motivos distintos (una de merma, otra de garantía, etc.).
export interface LineaSalidaAjuste {
  idDetalleSalida?: number;
  sku: string;
  nombre?: string;
  cantidad: number;
  tipoSalida: TipoSalidaAjuste | null;
}

export interface SalidaAjuste {
  idVenta: number;
  fechaSalida: string;
  anulada: boolean;
  colaborador: { idColaborador: number; nombreCompleto: string } | null;
  lineas: LineaSalidaAjuste[];
}

export interface SalidaAjusteFormLinea {
  sku: string;
  cantidad: number;
  idTipoSalida: number | "";
}

export interface SalidaAjusteFormInput {
  fechaSalida?: string;
  lineas: { sku: string; cantidad: number; idTipoSalida: number }[];
}

// ---------- Ventas (HU-13/14) ----------

export interface LineaVenta {
  idDetalleSalida?: number;
  sku: string;
  nombre?: string;
  cantidad: number;
  precioVenta: number;
}

export interface Venta {
  idVenta: number;
  fechaSalida: string;
  montoTotalVenta: number;
  anulada: boolean;
  cliente: { idCliente: number; nombre: string } | null;
  colaborador: { idColaborador: number; nombreCompleto: string } | null;
  lineas: LineaVenta[];
}

export interface VentaFormLinea {
  sku: string;
  cantidad: number;
  precioVenta: number;
}

export interface VentaFormInput {
  idCliente?: number;
  fechaSalida?: string;
  lineas: VentaFormLinea[];
}

// ---------- Historial de movimientos (HU-10) ----------
// Ya no está acotado a UN producto: se filtra por categoría/marca/producto(s)
// y rango de fechas, y puede traer movimientos de muchos productos a la vez
// — por eso cada fila trae su propio sku/nombreProducto.

// categoria alimenta el filtro por chips (Todos/Compras/Ventas/Mermas/
// Ajustes) — "ajuste" agrupa Uso interno y Garantía junto con Ajuste.
export type CategoriaMovimiento = "compra" | "venta" | "merma" | "ajuste";

export interface MovimientoHistorial {
  tipo: "entrada" | "salida";
  categoria: CategoriaMovimiento;
  // id real del registro detrás del movimiento (idCompra o idVenta de
  // CompraMaestro/SalidaMaestro) — con anulada, arma el botón "Anular" y su
  // endpoint sin adivinar nada a partir de `referencia`.
  id: number;
  anulada: boolean;
  // false = no se puede anular desde Movimientos (ajuste por conteo físico).
  anulable?: boolean;
  sku: string;
  nombreProducto?: string;
  fecha: string;
  cantidad: number;
  referencia: string;
  motivo?: string | null;
  precioCompra?: number;
  proveedor?: string | null;
  precioVenta?: number;
  // Solo ajustes por conteo físico: existencia antes y después del ajuste.
  cantidadAntes?: number | null;
  cantidadDespues?: number | null;
}

export interface FiltrosMovimientos {
  skus?: string[];
  idCategoria?: number;
  idMarca?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  pagina?: number;
  porPagina?: number;
}

export interface ListarMovimientosResultado {
  movimientos: MovimientoHistorial[];
  paginacion: Paginacion;
}

// ---------- Comparación de ventas entre productos (MovimientosPage) ----------
// Consulta separada del historial general: esta SOLO agrega ventas
// (idTipoSalida = Venta) por sku y por día — el historial general incluye
// compras/ajustes/mermas también.

export interface PuntoVenta {
  fecha: string;
  cantidad: number;
}

export interface SerieVentas {
  sku: string;
  nombre: string;
  puntos: PuntoVenta[];
  total: number;
}

export interface ComparacionVentas {
  series: SerieVentas[];
}

// ---------- Dashboard (HU-12/15) ----------

export interface AlertaStockBajo {
  sku: string;
  nombre: string;
  cantidadInventario: number;
  inventarioMinimo: number;
  estadoStock?: "agotado" | "bajo" | "en_stock";
}

export interface ResumenDashboard {
  skusActivos: number;
  alertasStockBajo: AlertaStockBajo[];
  ventasHoy: { total: number; cantidad: number } | null;
}
