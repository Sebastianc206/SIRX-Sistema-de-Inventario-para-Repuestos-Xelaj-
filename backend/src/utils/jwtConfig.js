const ms = require("ms");

// T-105: expiración de sesión/JWT con tiempo de vida corto, forzada — no
// solo "el default es 30m", sino un techo que no se puede pasar por
// configuración. Fallar al arrancar el servidor si alguien pone
// JWT_EXPIRES_IN=7d por error es mejor que emitir sesiones largas en
// silencio.
const VIDA_MINIMA = "1m";
const VIDA_MAXIMA = "1h";
const JWT_EXPIRES_IN_POR_DEFECTO = "30m";

// Longitud mínima del secreto de firma. No es parte de T-102 (eso fue "no
// hardcodear el valor") sino de la robustez de la sesión en sí: un secreto
// corto es más fácil de fuerza-bruta.
const JWT_SECRET_LONGITUD_MINIMA = 32;

function obtenerJwtExpiresIn() {
  const valorConfigurado = process.env.JWT_EXPIRES_IN || JWT_EXPIRES_IN_POR_DEFECTO;
  const duracionMs = ms(valorConfigurado);

  if (typeof duracionMs !== "number" || Number.isNaN(duracionMs)) {
    throw new Error(
      `JWT_EXPIRES_IN="${valorConfigurado}" no es una duración válida (ej. "30m", "1h").`,
    );
  }

  if (duracionMs < ms(VIDA_MINIMA) || duracionMs > ms(VIDA_MAXIMA)) {
    throw new Error(
      `JWT_EXPIRES_IN="${valorConfigurado}" no cumple la política de sesión corta ` +
        `(debe estar entre ${VIDA_MINIMA} y ${VIDA_MAXIMA}).`,
    );
  }

  return valorConfigurado;
}

function obtenerJwtSecret() {
  const secreto = process.env.JWT_SECRET;

  if (!secreto || secreto.trim().length === 0) {
    throw new Error("Falta la variable de entorno JWT_SECRET.");
  }

  if (secreto.length < JWT_SECRET_LONGITUD_MINIMA) {
    throw new Error(
      `JWT_SECRET es demasiado corto (mínimo ${JWT_SECRET_LONGITUD_MINIMA} caracteres) para firmar sesiones de forma segura.`,
    );
  }

  return secreto;
}

module.exports = { obtenerJwtExpiresIn, obtenerJwtSecret };
