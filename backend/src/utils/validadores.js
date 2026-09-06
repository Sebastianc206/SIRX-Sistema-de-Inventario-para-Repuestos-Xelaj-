// Validadores de entrada reutilizables (T-099). Cada endpoint que reciba
// datos del usuario debe validar tipo, formato y longitud antes de tocar la
// base de datos — no basta con comprobar que el campo "existe" (un objeto o
// número truthy pasa un `if (!campo)` mal escrito).

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TELEFONO_REGEX = /^[0-9()+\-\s]{7,20}$/;
const USERNAME_REGEX = /^[a-zA-Z0-9._-]+$/;

function esTexto(valor) {
  return typeof valor === "string";
}

// Texto requerido: string, no vacío tras trim, dentro de un largo razonable.
function esTextoValido(valor, { min = 1, max = 255 } = {}) {
  if (!esTexto(valor)) return false;
  const largo = valor.trim().length;
  return largo >= min && largo <= max;
}

// Texto opcional: si viene, debe ser válido; si no viene (undefined), pasa.
function esTextoOpcionalValido(valor, opciones = {}) {
  if (valor === undefined) return true;
  return esTextoValido(valor, opciones);
}

function esCorreoValido(valor) {
  return esTexto(valor) && valor.trim().length <= 255 && EMAIL_REGEX.test(valor.trim());
}

function esCorreoOpcionalValido(valor) {
  if (valor === undefined || valor === "") return true;
  return esCorreoValido(valor);
}

function esTelefonoValido(valor) {
  return esTexto(valor) && TELEFONO_REGEX.test(valor.trim());
}

function esTelefonoOpcionalValido(valor) {
  if (valor === undefined || valor === "") return true;
  return esTelefonoValido(valor);
}

// Usuario (username): sin espacios ni caracteres que compliquen login/URLs.
function esUsernameValido(valor, { min = 3, max = 30 } = {}) {
  if (!esTexto(valor)) return false;
  const limpio = valor.trim();
  return limpio.length >= min && limpio.length <= max && USERNAME_REGEX.test(limpio);
}

// T-104: política de contraseñas. bcrypt trunca en 72 bytes: una
// contraseña más larga no suma seguridad y solo sirve para golpear el
// hashing con payloads enormes. La complejidad exige mayúscula, minúscula,
// número y símbolo — las contraseñas de ejemplo del proyecto
// ("Admin123!", "Operador123!") ya cumplen esta regla.
const MAYUSCULA_REGEX = /[A-ZÁÉÍÓÚÑ]/;
const MINUSCULA_REGEX = /[a-záéíóúñ]/;
const NUMERO_REGEX = /[0-9]/;
const SIMBOLO_REGEX = /[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9]/;

function tieneComplejidadSuficiente(valor) {
  return (
    MAYUSCULA_REGEX.test(valor) &&
    MINUSCULA_REGEX.test(valor) &&
    NUMERO_REGEX.test(valor) &&
    SIMBOLO_REGEX.test(valor)
  );
}

function esPasswordValida(valor, { min = 8, max = 72 } = {}) {
  if (!esTexto(valor)) return false;
  if (valor.length < min || valor.length > max) return false;
  return tieneComplejidadSuficiente(valor);
}

// HU-04: precios/stock. Number(valor) en vez de typeof === "number" porque
// el body de un POST/PUT llega como JSON y ahí sí viajan números de verdad,
// pero se acepta también el string "123.45" para no ser más estricto de lo
// necesario si algún formulario lo manda como texto.
function esNumeroFinito(valor) {
  if (typeof valor === "number") return Number.isFinite(valor);
  if (typeof valor === "string" && valor.trim() !== "") return Number.isFinite(Number(valor));
  return false;
}

function esNumeroPositivo(valor) {
  return esNumeroFinito(valor) && Number(valor) > 0;
}

function esEnteroNoNegativo(valor) {
  return esNumeroFinito(valor) && Number.isInteger(Number(valor)) && Number(valor) >= 0;
}

// SKU: código de producto sin espacios, para que sea seguro usarlo tal cual
// en una URL (GET/PUT /api/repuestos/:sku).
const SKU_REGEX = /^[A-Za-z0-9._-]+$/;

function esSkuValido(valor, { max = 50 } = {}) {
  return esTexto(valor) && valor.trim().length > 0 && valor.trim().length <= max && SKU_REGEX.test(valor.trim());
}

module.exports = {
  esTexto,
  esTextoValido,
  esTextoOpcionalValido,
  esCorreoValido,
  esCorreoOpcionalValido,
  esTelefonoValido,
  esTelefonoOpcionalValido,
  esUsernameValido,
  esPasswordValida,
  esNumeroFinito,
  esNumeroPositivo,
  esEnteroNoNegativo,
  esSkuValido,
};
