const mockAuthService = {
  login: jest.fn(),
  obtenerPerfil: jest.fn(),
};

jest.mock("../services/authService", () => ({
  AuthError: class AuthError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  ...mockAuthService,
}));

const jwt = require("jsonwebtoken");
const request = require("supertest");
const app = require("../app");
const { AuthError } = require("../services/authService");

describe("POST /api/auth/login", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("rechaza con 400 si falta username o password", async () => {
    const respuesta = await request(app).post("/api/auth/login").send({ username: "admin" });

    expect(respuesta.status).toBe(400);
    expect(mockAuthService.login).not.toHaveBeenCalled();
  });

  // T-099: un objeto/array en el body es "truthy" pero no es texto — no
  // debe llegar tal cual a bcrypt.compare / a la consulta de Prisma.
  it("rechaza con 400 si username o password no son texto", async () => {
    const respuesta = await request(app)
      .post("/api/auth/login")
      .send({ username: { $ne: null }, password: "algo" });

    expect(respuesta.status).toBe(400);
    expect(mockAuthService.login).not.toHaveBeenCalled();
  });

  // T-098: como todas las consultas van por Prisma (parametrizadas), un
  // payload con pinta de inyección SQL no debe hacer nada especial —
  // solo falla como credenciales inválidas, igual que cualquier otro
  // usuario inexistente.
  it("un username con sintaxis de inyección SQL no rompe el flujo ni bypassa el login", async () => {
    mockAuthService.login.mockRejectedValueOnce(new AuthError("Usuario o contraseña incorrectos", 401));

    const respuesta = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin' OR '1'='1", password: "cualquiera" });

    expect(respuesta.status).toBe(401);
    expect(mockAuthService.login).toHaveBeenCalledWith("admin' OR '1'='1", "cualquiera");
  });

  it("responde 200 con el token cuando las credenciales son válidas", async () => {
    mockAuthService.login.mockResolvedValueOnce({
      token: "jwt-de-prueba",
      usuario: { idColaborador: 1, username: "admin", nombreCompleto: "Admin Sistema", role: "Administrador" },
    });

    const respuesta = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "Admin123!" });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.token).toBe("jwt-de-prueba");
  });

  it("traduce el bloqueo de cuenta (423) del servicio", async () => {
    mockAuthService.login.mockRejectedValueOnce(
      new AuthError("Cuenta bloqueada temporalmente por demasiados intentos fallidos.", 423),
    );

    const respuesta = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "incorrecta" });

    expect(respuesta.status).toBe(423);
  });
});

describe("GET /api/auth/me", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // T-100: /me exige un token válido, sin importar el rol.
  it("rechaza sin token con 401", async () => {
    const respuesta = await request(app).get("/api/auth/me");
    expect(respuesta.status).toBe(401);
    expect(mockAuthService.obtenerPerfil).not.toHaveBeenCalled();
  });

  it("rechaza un token con firma inválida", async () => {
    const tokenInvalido = jwt.sign({ sub: 1, username: "admin", role: "Administrador" }, "secreto-incorrecto");

    const respuesta = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${tokenInvalido}`);

    expect(respuesta.status).toBe(401);
  });

  it("devuelve el perfil cuando el token es válido", async () => {
    const tokenValido = jwt.sign(
      { sub: 1, username: "admin", role: "Administrador" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );
    mockAuthService.obtenerPerfil.mockResolvedValueOnce({
      idColaborador: 1,
      username: "admin",
      nombreCompleto: "Admin Sistema",
      role: "Administrador",
    });

    const respuesta = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${tokenValido}`);

    expect(respuesta.status).toBe(200);
    expect(mockAuthService.obtenerPerfil).toHaveBeenCalledWith(1);
  });
});
