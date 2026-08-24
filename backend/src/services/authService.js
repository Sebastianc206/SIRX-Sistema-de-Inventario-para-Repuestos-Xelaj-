const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../utils/prismaClient");

const MAX_LOGIN_ATTEMPTS = Number(process.env.MAX_LOGIN_ATTEMPTS || 3);
const LOCKOUT_MINUTES = Number(process.env.LOCKOUT_MINUTES || 15);
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "30m";

class AuthError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

async function login(username, password) {
  const usuario = await prisma.usuario.findUnique({ where: { username } });

  if (!usuario) {
    throw new AuthError("Usuario o contraseña incorrectos", 401);
  }

  if (usuario.lockedUntil && usuario.lockedUntil > new Date()) {
    throw new AuthError(
      "Cuenta bloqueada temporalmente por demasiados intentos fallidos. Intenta de nuevo más tarde.",
      423,
    );
  }

  const passwordValida = await bcrypt.compare(password, usuario.passwordHash);

  if (!passwordValida) {
    const intentos = usuario.failedAttempts + 1;
    const alcanzoLimite = intentos >= MAX_LOGIN_ATTEMPTS;

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        failedAttempts: alcanzoLimite ? 0 : intentos,
        lockedUntil: alcanzoLimite ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null,
      },
    });

    if (alcanzoLimite) {
      throw new AuthError(
        `Demasiados intentos fallidos. Cuenta bloqueada por ${LOCKOUT_MINUTES} minutos.`,
        423,
      );
    }

    throw new AuthError("Usuario o contraseña incorrectos", 401);
  }

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { failedAttempts: 0, lockedUntil: null },
  });

  const token = jwt.sign(
    { sub: usuario.id, username: usuario.username, role: usuario.role },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );

  return {
    token,
    usuario: {
      id: usuario.id,
      username: usuario.username,
      role: usuario.role,
    },
  };
}

module.exports = { login, AuthError };
