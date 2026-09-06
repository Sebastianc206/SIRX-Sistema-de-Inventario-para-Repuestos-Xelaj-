const mockUsuarioService = {
  crearUsuarioOperador: jest.fn(),
  editarUsuario: jest.fn(),
  cambiarEstadoUsuario: jest.fn(),
  listarUsuarios: jest.fn(),
};

jest.mock("../services/usuarioService", () => ({
  UsuarioError: class UsuarioError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  ...mockUsuarioService,
}));

const jwt = require("jsonwebtoken");
const request = require("supertest");
const app = require("../app");

function token(role, idColaborador = 1) {
  return jwt.sign({ sub: idColaborador, username: "usuario-test", role }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
}

const usuarioValido = {
  nombres: "Maria",
  primerApel: "Lopez",
  username: "mlopez",
  password: "Mostrador123!",
  idRol: 2,
};

// T-100: el rol/permiso se verifica en el backend, no solo ocultando
// botones en el frontend. Estas pruebas ejercitan las rutas reales
// (authMiddleware + authorize de verdad, con JWTs firmados), mockeando
// solo la capa de servicio.
describe("Rutas /api/usuarios — permisos", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  const casos = [
    { metodo: "get", ruta: "/api/usuarios" },
    { metodo: "post", ruta: "/api/usuarios" },
    { metodo: "put", ruta: "/api/usuarios/1" },
    { metodo: "patch", ruta: "/api/usuarios/1/estado" },
  ];

  it.each(casos)("rechaza $metodo $ruta sin token con 401", async ({ metodo, ruta }) => {
    const respuesta = await request(app)[metodo](ruta);
    expect(respuesta.status).toBe(401);
  });

  it.each(casos)("rechaza $metodo $ruta para el rol Operador con 403", async ({ metodo, ruta }) => {
    const respuesta = await request(app)[metodo](ruta)
      .set("Authorization", `Bearer ${token("Operador")}`)
      .send({});

    expect(respuesta.status).toBe(403);
  });

  it("no llama al servicio cuando el rol no es Administrador", async () => {
    await request(app)
      .post("/api/usuarios")
      .set("Authorization", `Bearer ${token("Operador")}`)
      .send(usuarioValido);

    expect(mockUsuarioService.crearUsuarioOperador).not.toHaveBeenCalled();
  });
});

describe("POST /api/usuarios — validación de entrada", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("crea el usuario cuando Administrador envía datos válidos", async () => {
    mockUsuarioService.crearUsuarioOperador.mockResolvedValueOnce({
      idColaborador: 9,
      username: "mlopez",
      nombreCompleto: "Maria Lopez",
      role: "Operador",
      vigente: true,
    });

    const respuesta = await request(app)
      .post("/api/usuarios")
      .set("Authorization", `Bearer ${token("Administrador")}`)
      .send(usuarioValido);

    expect(respuesta.status).toBe(201);
    expect(mockUsuarioService.crearUsuarioOperador).toHaveBeenCalledWith(
      expect.objectContaining({ username: "mlopez", idRol: 2 }),
    );
  });

  it("rechaza username con caracteres inválidos sin llamar al servicio", async () => {
    const respuesta = await request(app)
      .post("/api/usuarios")
      .set("Authorization", `Bearer ${token("Administrador")}`)
      .send({ ...usuarioValido, username: "maria lopez!" });

    expect(respuesta.status).toBe(400);
    expect(mockUsuarioService.crearUsuarioOperador).not.toHaveBeenCalled();
  });

  it("rechaza un correo con formato inválido sin llamar al servicio", async () => {
    const respuesta = await request(app)
      .post("/api/usuarios")
      .set("Authorization", `Bearer ${token("Administrador")}`)
      .send({ ...usuarioValido, correo: "no-es-un-correo" });

    expect(respuesta.status).toBe(400);
    expect(mockUsuarioService.crearUsuarioOperador).not.toHaveBeenCalled();
  });

  it("rechaza un objeto en lugar de texto para nombres (T-099)", async () => {
    const respuesta = await request(app)
      .post("/api/usuarios")
      .set("Authorization", `Bearer ${token("Administrador")}`)
      .send({ ...usuarioValido, nombres: { esto: "no es texto" } });

    expect(respuesta.status).toBe(400);
    expect(mockUsuarioService.crearUsuarioOperador).not.toHaveBeenCalled();
  });

  it("rechaza contraseñas demasiado cortas", async () => {
    const respuesta = await request(app)
      .post("/api/usuarios")
      .set("Authorization", `Bearer ${token("Administrador")}`)
      .send({ ...usuarioValido, password: "abc123" });

    expect(respuesta.status).toBe(400);
    expect(mockUsuarioService.crearUsuarioOperador).not.toHaveBeenCalled();
  });

  // T-104: política de contraseñas — longitud mínima ya no basta sin complejidad.
  it("rechaza una contraseña larga pero sin complejidad suficiente", async () => {
    const respuesta = await request(app)
      .post("/api/usuarios")
      .set("Authorization", `Bearer ${token("Administrador")}`)
      .send({ ...usuarioValido, password: "todaminusculaslarga" });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.message).toMatch(/mayúscula/i);
    expect(mockUsuarioService.crearUsuarioOperador).not.toHaveBeenCalled();
  });
});

describe("GET /api/usuarios — Administrador", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("permite listar cuando el token es de Administrador", async () => {
    mockUsuarioService.listarUsuarios.mockResolvedValueOnce([]);

    const respuesta = await request(app)
      .get("/api/usuarios")
      .set("Authorization", `Bearer ${token("Administrador")}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ usuarios: [] });
  });
});
