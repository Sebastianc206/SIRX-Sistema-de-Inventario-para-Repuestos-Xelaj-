const {
  UsuarioError,
  crearUsuarioOperador,
  editarUsuario,
  cambiarEstadoUsuario,
  listarUsuarios,
} = require("../services/usuarioService");
const {
  esTextoValido,
  esTextoOpcionalValido,
  esCorreoOpcionalValido,
  esTelefonoOpcionalValido,
  esUsernameValido,
  esPasswordValida,
} = require("../utils/validadores");

function manejarError(res, error) {
  if (error instanceof UsuarioError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  console.error(error);
  return res.status(500).json({ message: "Error interno del servidor" });
}

function parseIdColaborador(req, res) {
  const idColaborador = Number(req.params.id);
  if (!Number.isInteger(idColaborador)) {
    res.status(400).json({ message: "El id de usuario debe ser un número entero" });
    return null;
  }
  return idColaborador;
}

async function crearController(req, res) {
  const { nombres, primerApel, segundoApel, correo, numeroCelular, username, password, idRol, vigente } =
    req.body;

  // T-099: se valida tipo, formato y longitud de cada campo, no solo que
  // "exista" — un objeto/array truthy en el body no debe llegar a la
  // capa de datos como si fuera texto.
  if (!esTextoValido(nombres, { max: 100 }) || !esTextoValido(primerApel, { max: 100 })) {
    return res.status(400).json({ message: "nombres y primerApel son requeridos (máximo 100 caracteres)" });
  }

  if (!esTextoOpcionalValido(segundoApel, { max: 100 })) {
    return res.status(400).json({ message: "segundoApel no puede superar 100 caracteres" });
  }

  if (!esCorreoOpcionalValido(correo)) {
    return res.status(400).json({ message: "correo no tiene un formato válido" });
  }

  if (!esTelefonoOpcionalValido(numeroCelular)) {
    return res.status(400).json({ message: "numeroCelular no tiene un formato válido" });
  }

  if (!esUsernameValido(username)) {
    return res.status(400).json({
      message: "username debe tener entre 3 y 30 caracteres, solo letras, números, puntos, guiones o guion bajo",
    });
  }

  if (!esPasswordValida(password)) {
    return res.status(400).json({ message: "La contraseña debe tener entre 8 y 72 caracteres" });
  }

  if (idRol === undefined || !Number.isInteger(Number(idRol))) {
    return res.status(400).json({ message: "idRol debe ser un número entero" });
  }

  if (vigente !== undefined && typeof vigente !== "boolean") {
    return res.status(400).json({ message: "vigente debe ser un booleano" });
  }

  const idRolNumero = Number(idRol);

  try {
    const usuario = await crearUsuarioOperador({
      nombres: nombres.trim(),
      primerApel: primerApel.trim(),
      segundoApel: segundoApel?.trim() || undefined,
      correo: correo?.trim() || undefined,
      numeroCelular: numeroCelular?.trim() || undefined,
      username: username.trim(),
      password,
      idRol: idRolNumero,
      vigente,
    });
    return res.status(201).json({ usuario });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function editarController(req, res) {
  const idColaborador = parseIdColaborador(req, res);
  if (idColaborador === null) return;

  const { idRol, vigente } = req.body;

  if (idRol === undefined && vigente === undefined) {
    return res.status(400).json({ message: "Debes indicar idRol y/o vigente" });
  }

  if (idRol !== undefined && !Number.isInteger(Number(idRol))) {
    return res.status(400).json({ message: "idRol debe ser un número entero" });
  }

  if (vigente !== undefined && typeof vigente !== "boolean") {
    return res.status(400).json({ message: "vigente debe ser un booleano" });
  }

  try {
    const usuario = await editarUsuario(idColaborador, {
      idRol: idRol !== undefined ? Number(idRol) : undefined,
      vigente,
    });
    return res.json({ usuario });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function cambiarEstadoController(req, res) {
  const idColaborador = parseIdColaborador(req, res);
  if (idColaborador === null) return;

  const { vigente } = req.body;
  if (typeof vigente !== "boolean") {
    return res.status(400).json({ message: "vigente (booleano) es requerido" });
  }

  try {
    const usuario = await cambiarEstadoUsuario(idColaborador, vigente);
    return res.json({ usuario });
  } catch (error) {
    return manejarError(res, error);
  }
}

async function listarController(req, res) {
  const { estado, rol } = req.query;

  if (estado !== undefined && !["activo", "inactivo"].includes(estado)) {
    return res.status(400).json({ message: "estado debe ser 'activo' o 'inactivo'" });
  }

  let idRol;
  if (rol !== undefined) {
    idRol = Number(rol);
    if (!Number.isInteger(idRol)) {
      return res.status(400).json({ message: "rol debe ser un idRol numérico" });
    }
  }

  try {
    const usuarios = await listarUsuarios({ estado, idRol });
    return res.json({ usuarios });
  } catch (error) {
    return manejarError(res, error);
  }
}

module.exports = { crearController, editarController, cambiarEstadoController, listarController };
