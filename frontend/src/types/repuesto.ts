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

export interface FiltrosRepuestos {
  pagina?: number;
  porPagina?: number;
  busqueda?: string;
  estado?: "activo" | "inactivo";
}
