export interface Categoria {
  idCategoria: number;
  descripcion: string;
}

export interface CrearCategoriaInput {
  descripcion: string;
}

export interface EditarCategoriaInput {
  descripcion: string;
}
