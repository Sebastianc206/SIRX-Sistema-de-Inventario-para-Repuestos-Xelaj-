import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AuthApiError } from "@/services/authService";

interface ErrorInfo {
  message: string;
  bloqueado: boolean;
}

function IconoCandado() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 10V8a6 6 0 1 1 12 0v2m-13 0h14a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function IconoAlerta() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16" r="1" fill="currentColor" />
    </svg>
  );
}

function IconoInfo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 11v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="8" r="1" fill="currentColor" />
    </svg>
  );
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
      <div className="login-card">
        <div className="login-brand">
          <span className="login-brand-mark" aria-hidden="true">
            SX
          </span>
          <div className="login-brand-text">
            <h1>SIRX</h1>
            <p>Repuestos Xelajú</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="username">Usuario</label>
            <input
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {!errorInfo && logoutReason === "inactivity" && (
            <p className="login-banner login-info" role="status">
              <IconoInfo />
              <span>Tu sesión se cerró por inactividad. Inicia sesión nuevamente.</span>
            </p>
          )}

          {errorInfo && (
            <p
              className={
                errorInfo.bloqueado
                  ? "login-banner login-error login-error--locked"
                  : "login-banner login-error"
              }
              role="alert"
            >
              {errorInfo.bloqueado ? <IconoCandado /> : <IconoAlerta />}
              <span>{errorInfo.message}</span>
            </p>
          )}

          <button type="submit" disabled={enviando}>
            {enviando ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
