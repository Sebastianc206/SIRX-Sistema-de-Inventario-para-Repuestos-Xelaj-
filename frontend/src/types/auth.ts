// El rol es el texto libre de Rol.Descripcion (ej. "Administrador",
// "Operador"), no un enum fijo: se define por la Plaza vigente del
// colaborador, no por una columna en Usuario.
export type Role = string;

export interface Usuario {
  idColaborador: number;
  username: string;
  nombreCompleto: string;
  role: Role;
}

export interface LoginResponse {
  token: string;
  usuario: Usuario;
}
