const {
  UsuarioError,
  crearUsuarioOperador,
  editarUsuario,
  cambiarEstadoUsuario,
  listarUsuarios,
} = require("../services/usuarioService");

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

  if (!nombres || !primerApel || !username || !password || idRol === undefined) {
    return res
      .status(400)
      .json({ message: "nombres, primerApel, username, password e idRol son requeridos" });
  }

  if (typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ message: "La contraseña debe tener al menos 8 caracteres" });
  }

  const idRolNumero = Number(idRol);
  if (!Number.isInteger(idRolNumero)) {
    return res.status(400).json({ message: "idRol debe ser un número entero" });
  }

  try {
    const usuario = await crearUsuarioOperador({
      nombres,
      primerApel,
      segundoApel,
      correo,
      numeroCelular,
      username,
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
