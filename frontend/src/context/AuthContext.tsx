import { createContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Usuario } from "@/types/auth";
import { fetchCurrentUser, login as loginRequest } from "@/services/authService";

interface AuthContextValue {
  usuario: Usuario | null;
  cargando: boolean;
  iniciarSesion: (username: string, password: string) => Promise<void>;
  cerrarSesion: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = "sirx_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
      setCargando(false);
      return;
    }

    fetchCurrentUser(token)
      .then(setUsuario)
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setCargando(false));
  }, []);

  async function iniciarSesion(username: string, password: string) {
    const { token, usuario: usuarioAutenticado } = await loginRequest(username, password);
    localStorage.setItem(TOKEN_KEY, token);
    setUsuario(usuarioAutenticado);
  }

  function cerrarSesion() {
    localStorage.removeItem(TOKEN_KEY);
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, cargando, iniciarSesion, cerrarSesion }}>
      {children}
    </AuthContext.Provider>
  );
}
