// Forma de los datos del catálogo de repuestos (HU-04). precioCosto y
// proveedor son opcionales en el tipo porque el backend los omite por
// completo de la respuesta cuando el rol autenticado es Operador (T-031) —
// no llegan como null, directamente no existen en el objeto.
export interface Repuesto {
  sku: string;
  nombre: string;
  precioVenta: number;
  precioCosto?: number;
  inventarioMinimo: number;
  ubicacion: string | null;
  estado: boolean;
  categoria: { idCategoria: number; descripcion: string } | null;
  marca: { idMarca: number; nombre: string } | null;
  proveedor?: { idProveedor: number; nombre: string } | null;
  modelosCompatibles: { idModelo: number; descripcion: string }[];
  cantidadInventario: number;
}

export interface RepuestoFormInput {
  sku: string;
  nombre: string;
  precioVenta: number;
  precioCosto: number;
  inventarioMinimo: number;
  ubicacion?: string;
  idCategoria: number;
  idMarca?: number;
  idProveedor?: number;
  idsModelosCompatibles?: number[];
}

// PUT admite actualizar un subconjunto de campos (sku nunca cambia, va en la URL).
export type EditarRepuestoInput = Partial<Omit<RepuestoFormInput, "sku">>;

export interface Paginacion {
  pagina: number;
  porPagina: number;
  total: number;
  totalPaginas: number;
}

export interface ListarRepuestosResultado {
  articulos: Repuesto[];
  paginacion: Paginacion;
}

// HU-06: idCategoria/idMarca/idModelo son combinables entre sí y con
// busqueda/estado (criterio 3) — el backend los intersecta con AND.
export interface FiltrosRepuestos {
  pagina?: number;
  porPagina?: number;
  busqueda?: string;
  estado?: "activo" | "inactivo";
  idCategoria?: number;
  idMarca?: number;
  idModelo?: number;
}

// HU-05: resumen que devuelve la carga masiva — filas exitosas y filas con
// error (con su motivo), tal como pide el criterio de aceptación 4.
export interface FilaCargaMasivaError {
  fila: number;
  sku: string;
  motivo: string;
}

export interface FilaCargaMasivaCreada {
  sku: string;
  nombre: string;
}

export interface CargaMasivaResultado {
  creadas: FilaCargaMasivaCreada[];
  errores: FilaCargaMasivaError[];
}
