// Catálogos de solo lectura que alimentan selectores de otros formularios.
// Marca/Modelo (HU-04) no tienen CRUD propio todavía. Pais/Departamento/
// Municipio (HU-26) son datos de referencia geográfica cargados por seed —
// ninguna historia pide administrarlos desde la aplicación.
export interface Marca {
  idMarca: number;
  nombre: string;
}

export interface Modelo {
  idModelo: number;
  descripcion: string;
}

export interface Pais {
  idPais: number;
  nombre: string;
}

export interface Departamento {
  idDepartamento: number;
  nombre: string;
}

export interface Municipio {
  idMunicipio: number;
  nombre: string;
  idDepartamento: number;
}
