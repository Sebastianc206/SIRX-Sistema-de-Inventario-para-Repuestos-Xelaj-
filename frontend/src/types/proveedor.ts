export interface Proveedor {
  idProveedor: number;
  nombre: string;
  direccion: string | null;
  contacto: string | null;
  vigente: boolean;
  idPais: number;
  idDepartamento: number | null;
  idMunicipio: number | null;
}

export interface ProveedorFormInput {
  nombre: string;
  direccion?: string;
  contacto?: string;
  idPais: number;
  idDepartamento?: number;
  idMunicipio?: number;
}

export type EditarProveedorInput = Partial<ProveedorFormInput>;
