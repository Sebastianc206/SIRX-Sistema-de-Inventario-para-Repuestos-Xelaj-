export type Role = "ADMINISTRADOR" | "OPERADOR";

export interface Usuario {
  id: number;
  username: string;
  role: Role;
}

export interface LoginResponse {
  token: string;
  usuario: Usuario;
}
