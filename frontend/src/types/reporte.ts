// Contratos de /api/reportes. El backend decide qué columnas/KPIs recibe
// cada rol (Operador nunca recibe costos, ingresos ni márgenes), así que la
// UI solo pinta lo que llega.
export type TipoColumna = "texto" | "entero" | "decimal" | "moneda" | "porcentaje" | "fecha" | "fechaHora" | "estado";
export type TonoEstado = "ok" | "warn" | "bad" | "info" | "neutral";

export interface CeldaEstado {
  texto: string;
  tono: TonoEstado;
}

export type ValorCelda = string | number | null | CeldaEstado;

export interface ColumnaReporte {
  clave: string;
  etiqueta: string;
  tipo: TipoColumna;
  signo?: boolean;
}

export interface TablaReporte {
  id: string;
  titulo: string;
  principal?: boolean;
  columnas: ColumnaReporte[];
  filas: Record<string, ValorCelda>[];
  totales?: Record<string, ValorCelda>;
  totalFilas: number;
  truncada: boolean;
}

export interface KpiReporte {
  etiqueta: string;
  valor: number | string;
  tipo: "entero" | "moneda" | "porcentaje" | "texto";
  nota?: string;
  // Variación % contra el período anterior; null = sin base comparable.
  variacion?: number | null;
}

export interface GraficaReporte {
  tipo: "barras" | "linea";
  titulo: string;
  formato: "entero" | "moneda";
  items: { etiqueta: string; valor: number }[];
}

export interface Reporte {
  id: string;
  titulo: string;
  descripcion: string;
  generadoEn: string;
  generadoPor: string;
  filtrosAplicados: { etiqueta: string; valor: string }[];
  kpis: KpiReporte[];
  tablas: TablaReporte[];
  grafica: GraficaReporte | null;
  notas?: string[];
  vacio: string | null;
}

export type FiltroReporte =
  | "fechaDesde"
  | "fechaHasta"
  | "idCategoria"
  | "idMarca"
  | "idConteo"
  | "top"
  | "orden"
  | "ventana"
  | "agrupacion"
  | "agruparPor"
  | "tipo";

export interface DefinicionReporte {
  id: string;
  titulo: string;
  descripcion: string;
  icono: string;
  filtros: FiltroReporte[];
  soloAdministrador: boolean;
}

export type FiltrosReporte = Partial<Record<FiltroReporte, string>>;
export type FormatoReporte = "pdf" | "xlsx" | "csv";

export interface ArchivoDescargado {
  blob: Blob;
  nombre: string;
}
