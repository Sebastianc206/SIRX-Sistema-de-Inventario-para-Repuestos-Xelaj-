import { useState } from "react";
import type { FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { DialogBody, Drawer, FormFooter } from "@/components/ui/Dialog";
import { crearUsuario, editarUsuario, UsuarioApiError } from "@/services/usuarioService";
import { ROLES_DISPONIBLES } from "@/types/usuario";
import type { UsuarioAdmin } from "@/types/usuario";

interface UsuarioFormModalProps {
  // null = crear un usuario nuevo; un UsuarioAdmin = editar ese usuario.
  usuario: UsuarioAdmin | null;
  onClose: () => void;
  onGuardado: (mensaje: string) => void;
}

export function UsuarioFormModal({ usuario, onClose, onGuardado }: UsuarioFormModalProps) {
  const esEdicion = usuario !== null;

  const [nombres, setNombres] = useState("");
  const [primerApel, setPrimerApel] = useState("");
  const [segundoApel, setSegundoApel] = useState("");
  const [correo, setCorreo] = useState("");
  const [numeroCelular, setNumeroCelular] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [idRol, setIdRol] = useState(
    usuario ? ROLES_DISPONIBLES.find((r) => r.descripcion === usuario.role)?.idRol : undefined,
  );
  const [vigente, setVigente] = useState(usuario?.vigente ?? true);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [modificado, setModificado] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (idRol === undefined) {
      setError("Selecciona un rol");
      return;
    }

    setEnviando(true);
    try {
      if (esEdicion) {
        await editarUsuario(usuario.idColaborador, { idRol, vigente });
        onGuardado("Usuario actualizado correctamente.");
      } else {
        await crearUsuario({
          nombres,
          primerApel,
          segundoApel: segundoApel || undefined,
          correo: correo || undefined,
          numeroCelular: numeroCelular || undefined,
          username,
          password,
          idRol,
          vigente,
        });
        onGuardado("Usuario creado correctamente.");
      }
    } catch (err) {
      setError(err instanceof UsuarioApiError ? err.message : "No se pudo guardar el usuario");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Drawer title={esEdicion ? "Editar usuario" : "Nuevo usuario operador"} dirty={modificado && !enviando} onClose={onClose}>
      <form className="dialog-form" onSubmit={handleSubmit} onChange={() => setModificado(true)}>
        <DialogBody>
          {esEdicion && (
            <div className="modal-readonly-info">
              <span>{usuario.nombreCompleto}</span>
              <span className="modal-readonly-username">@{usuario.username}</span>
            </div>
          )}

          {!esEdicion && (
            <>
              <div className="login-field">
                <label htmlFor="nombres">Nombres</label>
                <input
                  id="nombres"
                  value={nombres}
                  onChange={(event) => setNombres(event.target.value)}
                  required
                />
              </div>

              <div className="login-field">
                <label htmlFor="primerApel">Primer apellido</label>
                <input
                  id="primerApel"
                  value={primerApel}
                  onChange={(event) => setPrimerApel(event.target.value)}
                  required
                />
              </div>

              <div className="login-field">
                <label htmlFor="segundoApel">Segundo apellido (opcional)</label>
                <input
                  id="segundoApel"
                  value={segundoApel}
                  onChange={(event) => setSegundoApel(event.target.value)}
                />
              </div>

              <div className="login-field">
                <label htmlFor="correo">Correo (opcional)</label>
                <input
                  id="correo"
                  type="email"
                  value={correo}
                  onChange={(event) => setCorreo(event.target.value)}
                />
              </div>

              <div className="login-field">
                <label htmlFor="numeroCelular">Celular (opcional)</label>
                <input
                  id="numeroCelular"
                  value={numeroCelular}
                  onChange={(event) => setNumeroCelular(event.target.value)}
                />
              </div>

              <div className="login-field">
                <label htmlFor="username">Usuario</label>
                <input
                  id="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="off"
                  required
                />
              </div>

              <div className="login-field">
                <label htmlFor="password">Contraseña</label>
                <span className="modal-helper-text">
                  Mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo
                </span>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
            </>
          )}

          <fieldset className="login-field">
            <legend>Rol</legend>
            {ROLES_DISPONIBLES.map((rol) => (
              <label key={rol.idRol} className="modal-radio-option">
                <input
                  type="radio"
                  name="idRol"
                  value={rol.idRol}
                  checked={idRol === rol.idRol}
                  onChange={() => setIdRol(rol.idRol)}
                />
                {rol.descripcion}
              </label>
            ))}
          </fieldset>

          <fieldset className="login-field">
            <legend>Estado</legend>
            <label className="modal-radio-option">
              <input
                type="radio"
                name="vigente"
                checked={vigente}
                onChange={() => setVigente(true)}
              />
              Activo
            </label>
            <label className="modal-radio-option">
              <input
                type="radio"
                name="vigente"
                checked={!vigente}
                onChange={() => setVigente(false)}
              />
              Inactivo
            </label>
          </fieldset>

          {error && <Alert tone="error">{error}</Alert>}
        </DialogBody>
        <FormFooter enviando={enviando} />
      </form>
    </Drawer>
  );
}
