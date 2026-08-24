const { login, AuthError } = require("../services/authService");

async function loginController(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Usuario y contraseña son requeridos" });
  }

  try {
    const resultado = await login(username, password);
    return res.json(resultado);
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    console.error(error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

function meController(req, res) {
  return res.json({ usuario: req.usuario });
}

module.exports = { loginController, meController };
