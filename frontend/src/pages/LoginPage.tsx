import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AuthApiError } from "@/services/authService";

interface ErrorInfo {
  message: string;
  bloqueado: boolean;
}

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
  const [enviando, setEnviando] = useState(false);
  const { iniciarSesion, logoutReason, limpiarMotivoCierre } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorInfo(null);
    limpiarMotivoCierre();
    setEnviando(true);

    try {
      await iniciarSesion(username, password);
      navigate("/");
    } catch (err) {
      if (err instanceof AuthApiError) {
        setErrorInfo({ message: err.message, bloqueado: err.status === 423 });
      } else {
        setErrorInfo({ message: "No se pudo iniciar sesión", bloqueado: false });
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login-page">
      <form onSubmit={handleSubmit}>
        <h1>SIRX — Iniciar sesión</h1>

        <label htmlFor="username">Usuario</label>
        <input
          id="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          required
        />

        <label htmlFor="password">Contraseña</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />

        {!errorInfo && logoutReason === "inactivity" && (
          <p className="login-info" role="status">
            Tu sesión se cerró por inactividad. Inicia sesión nuevamente.
          </p>
        )}

        {errorInfo && (
          <p
            className={errorInfo.bloqueado ? "login-error login-error--locked" : "login-error"}
            role="alert"
          >
            {errorInfo.bloqueado && <span aria-hidden="true">🔒 </span>}
            {errorInfo.message}
          </p>
        )}

        <button type="submit" disabled={enviando}>
          {enviando ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
