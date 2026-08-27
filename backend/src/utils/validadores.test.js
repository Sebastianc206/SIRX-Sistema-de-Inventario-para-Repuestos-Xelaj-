const {
  esTextoValido,
  esTextoOpcionalValido,
  esCorreoValido,
  esCorreoOpcionalValido,
  esTelefonoValido,
  esTelefonoOpcionalValido,
  esUsernameValido,
  esPasswordValida,
} = require("./validadores");

describe("esTextoValido", () => {
  it("acepta texto dentro del rango", () => {
    expect(esTextoValido("Frenos", { max: 100 })).toBe(true);
  });

  it("rechaza texto vacío o solo espacios", () => {
    expect(esTextoValido("", { max: 100 })).toBe(false);
    expect(esTextoValido("   ", { max: 100 })).toBe(false);
  });

  it("rechaza texto más largo que el máximo", () => {
    expect(esTextoValido("a".repeat(101), { max: 100 })).toBe(false);
  });

  it("rechaza tipos que no son string (T-099: no basta con truthy)", () => {
    expect(esTextoValido(123)).toBe(false);
    expect(esTextoValido(["texto"])).toBe(false);
    expect(esTextoValido({ nombre: "texto" })).toBe(false);
    expect(esTextoValido(null)).toBe(false);
    expect(esTextoValido(undefined)).toBe(false);
  });
});

describe("esTextoOpcionalValido", () => {
  it("acepta undefined (campo no enviado)", () => {
    expect(esTextoOpcionalValido(undefined)).toBe(true);
  });

  it("valida igual que esTextoValido cuando sí viene un valor", () => {
    expect(esTextoOpcionalValido("a".repeat(101), { max: 100 })).toBe(false);
    expect(esTextoOpcionalValido("Perez", { max: 100 })).toBe(true);
  });
});

describe("esCorreoValido / esCorreoOpcionalValido", () => {
  it("acepta un correo con formato válido", () => {
    expect(esCorreoValido("persona@dominio.com")).toBe(true);
  });

  it("rechaza formatos inválidos", () => {
    expect(esCorreoValido("no-es-correo")).toBe(false);
    expect(esCorreoValido("falta-dominio@")).toBe(false);
    expect(esCorreoValido("@sin-usuario.com")).toBe(false);
  });

  it("el opcional acepta undefined y string vacío", () => {
    expect(esCorreoOpcionalValido(undefined)).toBe(true);
    expect(esCorreoOpcionalValido("")).toBe(true);
  });
});

describe("esTelefonoValido / esTelefonoOpcionalValido", () => {
  it("acepta formatos comunes de teléfono", () => {
    expect(esTelefonoValido("+502 5555-5555")).toBe(true);
    expect(esTelefonoValido("55555555")).toBe(true);
  });

  it("rechaza texto que no parece teléfono", () => {
    expect(esTelefonoValido("no-es-telefono")).toBe(false);
    expect(esTelefonoValido("123")).toBe(false);
  });

  it("el opcional acepta undefined y string vacío", () => {
    expect(esTelefonoOpcionalValido(undefined)).toBe(true);
    expect(esTelefonoOpcionalValido("")).toBe(true);
  });
});

describe("esUsernameValido", () => {
  it("acepta usernames con caracteres permitidos", () => {
    expect(esUsernameValido("jperez")).toBe(true);
    expect(esUsernameValido("j.perez_2")).toBe(true);
  });

  it("rechaza usernames con espacios u otros caracteres especiales", () => {
    expect(esUsernameValido("j perez")).toBe(false);
    expect(esUsernameValido("jperez@")).toBe(false);
    expect(esUsernameValido("<script>")).toBe(false);
  });

  it("rechaza usernames fuera del rango de longitud", () => {
    expect(esUsernameValido("ab")).toBe(false);
    expect(esUsernameValido("a".repeat(31))).toBe(false);
  });
});

describe("esPasswordValida", () => {
  it("acepta contraseñas entre 8 y 72 caracteres", () => {
    expect(esPasswordValida("Mostrador123!")).toBe(true);
  });

  it("rechaza contraseñas demasiado cortas", () => {
    expect(esPasswordValida("abc123")).toBe(false);
  });

  it("rechaza contraseñas de más de 72 caracteres (límite de bcrypt)", () => {
    expect(esPasswordValida("a".repeat(73))).toBe(false);
  });
});
