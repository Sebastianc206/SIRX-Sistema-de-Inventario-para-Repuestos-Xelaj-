const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token no proporcionado" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = { id: payload.sub, username: payload.username, role: payload.role };
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Sesión expirada, inicia sesión nuevamente" });
  }
}

module.exports = authMiddleware;
