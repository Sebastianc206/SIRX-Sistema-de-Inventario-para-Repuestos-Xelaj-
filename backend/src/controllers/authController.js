const { login, obtenerPerfil, AuthError } = require("../services/authService");
const { esTexto } = require("../utils/validadores");

async function loginController(req, res) {
  const { username, password } = req.body;

  // No basta con comprobar "truthy": un objeto/array en el body también lo
  // es, y pasarlo tal cual a bcrypt.compare o a la consulta de Prisma
  // terminaría en un 500 en vez de un 400 claro (T-099).
  if (!esTexto(username) || !esTexto(password) || username.trim().length === 0 || password.length === 0) {
    return res.status(400).json({ message: "Usuario y contraseña son requeridos" });
  }

  try {
    const resultado = await login(username.trim(), password);
    return res.json(resultado);
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    console.error(error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

async function meController(req, res) {
  try {
    const usuario = await obtenerPerfil(req.usuario.idColaborador);
    return res.json({ usuario });
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    console.error(error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

module.exports = { loginController, meController };
