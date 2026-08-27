const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../utils/prismaClient");
const { obtenerRolVigente } = require("../utils/rolVigente");
const { obtenerJwtExpiresIn, obtenerJwtSecret } = require("../utils/jwtConfig");

const MAX_LOGIN_ATTEMPTS = Number(process.env.MAX_LOGIN_ATTEMPTS || 3);
const LOCKOUT_MINUTES = Number(process.env.LOCKOUT_MINUTES || 15);

class AuthError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

async function login(username, password) {
  const usuario = await prisma.usuario.findUnique({
    where: { usuario: username },
    include: { colaborador: true },
  });

  if (!usuario || !usuario.vigente) {
    throw new AuthError("Usuario o contraseña incorrectos", 401);
  }

  if (usuario.lockedUntil && usuario.lockedUntil > new Date()) {
    throw new AuthError(
      "Cuenta bloqueada temporalmente por demasiados intentos fallidos. Intenta de nuevo más tarde.",
      423,
    );
  }

  const passwordValida = await bcrypt.compare(password, usuario.contrasena);

  if (!passwordValida) {
    const intentos = usuario.failedAttempts + 1;
    const alcanzoLimite = intentos >= MAX_LOGIN_ATTEMPTS;

    await prisma.usuario.update({
      where: { idColaborador: usuario.idColaborador },
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

  const rol = await obtenerRolVigente(usuario.idColaborador);

  if (!rol) {
    throw new AuthError("El colaborador no tiene una plaza/rol vigente asignado", 403);
  }

  await prisma.usuario.update({
    where: { idColaborador: usuario.idColaborador },
    data: { failedAttempts: 0, lockedUntil: null },
  });

  const token = jwt.sign(
    { sub: usuario.idColaborador, username: usuario.usuario, role: rol.descripcion },
    obtenerJwtSecret(),
    { expiresIn: obtenerJwtExpiresIn() },
  );

  return {
    token,
    usuario: {
      idColaborador: usuario.idColaborador,
      username: usuario.usuario,
      nombreCompleto: `${usuario.colaborador.nombres} ${usuario.colaborador.primerApel}`,
      role: rol.descripcion,
    },
  };
}

async function obtenerPerfil(idColaborador) {
  const colaborador = await prisma.colaborador.findUnique({ where: { idColaborador } });
  const usuario = await prisma.usuario.findUnique({ where: { idColaborador } });
  const rol = await obtenerRolVigente(idColaborador);

  if (!colaborador || !usuario) {
    throw new AuthError("Usuario no encontrado", 404);
  }

  return {
    idColaborador,
    username: usuario.usuario,
    nombreCompleto: `${colaborador.nombres} ${colaborador.primerApel}`,
    role: rol?.descripcion ?? null,
  };
}

module.exports = { login, obtenerPerfil, AuthError };
