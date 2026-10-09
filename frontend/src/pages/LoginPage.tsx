import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import type { IconName } from "@/components/ui/Icon";
import { useAuth } from "@/hooks/useAuth";
import { AuthApiError } from "@/services/authService";

interface ErrorInfo {
  message: string;
  bloqueado: boolean;
}

interface ErroresCampo {
  username?: string;
  password?: string;
}

// Solo se recuerda el nombre de usuario; la contraseña nunca se guarda.
const CLAVE_USUARIO = "sirx-remembered-username";

function leerUsuarioRecordado(): string {
  try {
    return localStorage.getItem(CLAVE_USUARIO) ?? "";
  } catch {
    return "";
  }
}

function guardarUsuarioRecordado(usuario: string | null) {
  try {
    if (usuario) localStorage.setItem(CLAVE_USUARIO, usuario);
    else localStorage.removeItem(CLAVE_USUARIO);
  } catch {
    /* Sin persistencia si el almacenamiento local no está disponible. */
  }
}

const FUNCIONES: { icono: IconName; texto: string }[] = [
  { icono: "box", texto: "Inventario" },
  { icono: "cart", texto: "Ventas de mostrador" },
  { icono: "barChart", texto: "Reportes" },
];

// Tarjeta sobre lienzo claro: panel de marca verde bosque (el logo es el
// protagonista, centrado) + formulario blanco. En móvil el panel se reduce a
// una cabecera compacta con el logo.
export default function LoginPage() {
  const [recordado] = useState(leerUsuarioRecordado);
  const [username, setUsername] = useState(recordado);
  const [password, setPassword] = useState("");
  const [recordar, setRecordar] = useState(recordado !== "");
  const [verPassword, setVerPassword] = useState(false);
  const [errores, setErrores] = useState<ErroresCampo>({});
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
  const [enviando, setEnviando] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const { usuario, iniciarSesion, logoutReason, limpiarMotivoCierre } = useAuth();
  const navigate = useNavigate();

  if (usuario) {
    return <Navigate to="/" replace />;
  }

  function validar(): boolean {
    const nuevos: ErroresCampo = {};
    if (!username.trim()) nuevos.username = "Ingresa tu nombre de usuario.";
    if (!password) nuevos.password = "Ingresa tu contraseña.";
    setErrores(nuevos);
    if (nuevos.username) usernameRef.current?.focus();
    else if (nuevos.password) passwordRef.current?.focus();
    return !nuevos.username && !nuevos.password;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorInfo(null);
    limpiarMotivoCierre();
    if (!validar()) return;
    setEnviando(true);

    try {
      await iniciarSesion(username, password);
      guardarUsuarioRecordado(recordar ? username.trim() : null);
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

  function cambiarRecordar(valor: boolean) {
    setRecordar(valor);
    if (!valor) guardarUsuarioRecordado(null);
  }

  return (
    <div className="login">
      <div className="login-shell">
        <aside className="login-brand on-dark" aria-label="Acerca de SIRX">
          <div className="login-brand-center">
            <div role="img" aria-label="SIRX, Repuestos Xelajú">
              <BrandLogo className="login-brand-logo" />
            </div>

            <div className="login-brand-more">
              <span className="login-brand-rule" aria-hidden="true" />
              <p className="login-brand-headline">
                Todo tu inventario. <span>En un solo lugar.</span>
              </p>
              <p className="login-brand-lead">
                Administra tus repuestos, agiliza las ventas y mantén el control de tu operación desde una plataforma sencilla y confiable.
              </p>
              <ul className="login-brand-facts" aria-label="Funciones del sistema">
                {FUNCIONES.map((f) => (
                  <li key={f.texto}>
                    <Icon name={f.icono} size={16} />
                    {f.texto}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="login-brand-foot">
            <span>Sistema de Inventario</span>
            <strong>Repuestos Xelajú</strong>
          </p>
        </aside>

        <main className="login-panel">
          <div className="login-card">
            <h1>Bienvenido de nuevo</h1>
            <p className="login-subtitle">Ingresa tus credenciales para continuar.</p>

            <form onSubmit={handleSubmit} noValidate>
              <Field label="Usuario" error={errores.username}>
                {(props) => (
                  <div className="input-icon-wrap">
                    <Icon name="user" size={19} className="input-icon" />
                    <Input
                      {...props}
                      ref={usernameRef}
                      value={username}
                      onChange={(event) => {
                        setUsername(event.target.value);
                        if (errores.username) setErrores((e) => ({ ...e, username: undefined }));
                      }}
                      placeholder="Ingresa tu usuario"
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      autoFocus={!recordado}
                      aria-required="true"
                    />
                  </div>
                )}
              </Field>

              <Field label="Contraseña" error={errores.password}>
                {(props) => (
                  <div className="input-icon-wrap password-wrap">
                    <Icon name="lock" size={19} className="input-icon" />
                    <Input
                      {...props}
                      ref={passwordRef}
                      type={verPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        if (errores.password) setErrores((e) => ({ ...e, password: undefined }));
                      }}
                      placeholder="Ingresa tu contraseña"
                      autoComplete="current-password"
                      autoFocus={!!recordado}
                      aria-required="true"
                    />
                    <button type="button" className="password-toggle" aria-pressed={verPassword} onClick={() => setVerPassword((v) => !v)}>
                      {verPassword ? "Ocultar" : "Mostrar"}
                    </button>
                  </div>
                )}
              </Field>

              <label className="login-remember">
                <input type="checkbox" checked={recordar} onChange={(event) => cambiarRecordar(event.target.checked)} />
                Recordar usuario
              </label>

              {!errorInfo && logoutReason === "inactivity" && (
                <Alert tone="info" className="login-banner login-info">
                  Tu sesión se cerró por inactividad. Inicia sesión nuevamente.
                </Alert>
              )}

              {errorInfo && (
                <Alert tone="error" className={errorInfo.bloqueado ? "login-banner login-error login-error--locked" : "login-banner login-error"}>
                  {errorInfo.message}
                </Alert>
              )}

              <Button type="submit" size="lg" block loading={enviando}>
                {enviando ? (
                  "Ingresando..."
                ) : (
                  <>
                    Ingresar
                    <Icon name="arrowRight" size={18} strokeWidth={2} />
                  </>
                )}
              </Button>
            </form>

            <p className="login-help">
              ¿Necesitas acceso al sistema?
              <br />
              <strong>Comunícate con el administrador.</strong>
            </p>
          </div>
          <p className="login-foot">© {new Date().getFullYear()} Repuestos Xelajú · SIRX</p>
        </main>
      </div>
    </div>
  );
}
