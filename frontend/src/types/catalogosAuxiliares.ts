// Catálogos de solo lectura que alimentan los selectores del formulario de
// repuestos (HU-04). No tienen CRUD propio todavía — ver
// backend/src/services/catalogosAuxiliaresService.js.
export interface Marca {
  idMarca: number;
  nombre: string;
}

export interface Proveedor {
  idProveedor: number;
  nombre: string;
}

export interface Modelo {
  idModelo: number;
  descripcion: string;
}
