const { obtenerJwtExpiresIn, obtenerJwtSecret } = require("./jwtConfig");

const SECRETO_VALIDO = "a".repeat(32);

describe("obtenerJwtSecret", () => {
  const originalSecret = process.env.JWT_SECRET;

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  it("devuelve el secreto cuando cumple la longitud mínima", () => {
    process.env.JWT_SECRET = SECRETO_VALIDO;
    expect(obtenerJwtSecret()).toBe(SECRETO_VALIDO);
  });

  it("lanza un error si falta JWT_SECRET", () => {
    delete process.env.JWT_SECRET;
    expect(() => obtenerJwtSecret()).toThrow(/Falta la variable de entorno JWT_SECRET/);
  });

  it("lanza un error si el secreto es más corto que el mínimo (T-105)", () => {
    process.env.JWT_SECRET = "muy-corto";
    expect(() => obtenerJwtSecret()).toThrow(/demasiado corto/);
  });
});

describe("obtenerJwtExpiresIn", () => {
  const originalExpiresIn = process.env.JWT_EXPIRES_IN;

  afterEach(() => {
    if (originalExpiresIn === undefined) {
      delete process.env.JWT_EXPIRES_IN;
    } else {
      process.env.JWT_EXPIRES_IN = originalExpiresIn;
    }
  });

  it("usa 30m por defecto si no está configurado", () => {
    delete process.env.JWT_EXPIRES_IN;
    expect(obtenerJwtExpiresIn()).toBe("30m");
  });

  it("acepta valores dentro de la política de sesión corta", () => {
    process.env.JWT_EXPIRES_IN = "15m";
    expect(obtenerJwtExpiresIn()).toBe("15m");
  });

  it("acepta el techo de 1 hora", () => {
    process.env.JWT_EXPIRES_IN = "1h";
    expect(obtenerJwtExpiresIn()).toBe("1h");
  });

  it("rechaza una duración mayor a 1 hora (T-105: sesión corta forzada)", () => {
    process.env.JWT_EXPIRES_IN = "7d";
    expect(() => obtenerJwtExpiresIn()).toThrow(/política de sesión corta/);
  });

  it("rechaza una duración menor a 1 minuto", () => {
    process.env.JWT_EXPIRES_IN = "10s";
    expect(() => obtenerJwtExpiresIn()).toThrow(/política de sesión corta/);
  });

  it("rechaza un formato de duración inválido", () => {
    process.env.JWT_EXPIRES_IN = "treinta-minutos";
    expect(() => obtenerJwtExpiresIn()).toThrow(/no es una duración válida/);
  });
});
