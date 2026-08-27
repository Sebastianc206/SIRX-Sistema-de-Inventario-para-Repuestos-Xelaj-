import { createContext, useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Usuario } from "@/types/auth";
import { fetchCurrentUser, login as loginRequest } from "@/services/authService";

export type LogoutReason = "inactivity" | null;

interface AuthContextValue {
  usuario: Usuario | null;
  cargando: boolean;
  logoutReason: LogoutReason;
  iniciarSesion: (username: string, password: string) => Promise<void>;
  cerrarSesion: () => void;
  limpiarMotivoCierre: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const TOKEN_KEY = "sirx_token";

// Tiempo sin actividad del usuario antes de cerrar la sesión automáticamente.
// Configurable vía VITE_INACTIVITY_TIMEOUT_MINUTES (ver .env.example).
const INACTIVITY_TIMEOUT_MINUTES = Number(import.meta.env.VITE_INACTIVITY_TIMEOUT_MINUTES ?? 15);
export const INACTIVITY_TIMEOUT_MS = INACTIVITY_TIMEOUT_MINUTES * 60 * 1000;

const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [logoutReason, setLogoutReason] = useState<LogoutReason>(null);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout>>();

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

  function cerrarSesion() {
    localStorage.removeItem(TOKEN_KEY);
    setUsuario(null);
  }

  const cerrarSesionPorInactividad = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUsuario(null);
    setLogoutReason("inactivity");
  }, []);

  // El temporizador solo corre mientras hay sesión activa; cualquier
  // interacción del usuario lo reinicia. Al vencerse, cierra sesión y deja
  // que ProtectedRoute redirija a /login (mismo mecanismo que un logout manual).
  useEffect(() => {
    if (!usuario) {
      return;
    }

    function reiniciarTemporizador() {
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
      inactivityTimer.current = setTimeout(cerrarSesionPorInactividad, INACTIVITY_TIMEOUT_MS);
    }

    reiniciarTemporizador();
    ACTIVITY_EVENTS.forEach((evento) =>
      window.addEventListener(evento, reiniciarTemporizador, { passive: true }),
    );

    return () => {
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
      ACTIVITY_EVENTS.forEach((evento) =>
        window.removeEventListener(evento, reiniciarTemporizador),
      );
    };
  }, [usuario, cerrarSesionPorInactividad]);

  async function iniciarSesion(username: string, password: string) {
    const { token, usuario: usuarioAutenticado } = await loginRequest(username, password);
    localStorage.setItem(TOKEN_KEY, token);
    setUsuario(usuarioAutenticado);
    setLogoutReason(null);
  }

  function limpiarMotivoCierre() {
    setLogoutReason(null);
  }

  return (
    <AuthContext.Provider
      value={{ usuario, cargando, logoutReason, iniciarSesion, cerrarSesion, limpiarMotivoCierre }}
    >
      {children}
    </AuthContext.Provider>
  );
}
