import type { Role } from "./auth";

export interface UsuarioAdmin {
  idColaborador: number;
  username: string;
  nombreCompleto: string;
  role: Role;
  vigente: boolean;
}

export interface CrearUsuarioInput {
  nombres: string;
  primerApel: string;
  segundoApel?: string;
  correo?: string;
  numeroCelular?: string;
  username: string;
  password: string;
  idRol: number;
  vigente?: boolean;
}

export interface EditarUsuarioInput {
  idRol?: number;
  vigente?: boolean;
}

export interface RolOpcion {
  idRol: number;
  descripcion: string;
}

// El backend no expone un endpoint para listar roles (no está en el
// alcance de HU-02) y el sistema solo define estos dos por ahora
// (ver backend/prisma/seed.js). Si se agregan más roles, esto debería
// venir de la API en vez de estar hardcodeado.
export const ROLES_DISPONIBLES: RolOpcion[] = [
  { idRol: 1, descripcion: "Administrador" },
  { idRol: 2, descripcion: "Operador" },
];
