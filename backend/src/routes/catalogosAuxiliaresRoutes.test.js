const mockService = {
  listarMarcas: jest.fn(),
  listarModelos: jest.fn(),
  listarPaises: jest.fn(),
  listarDepartamentos: jest.fn(),
  listarMunicipios: jest.fn(),
};

jest.mock("../services/catalogosAuxiliaresService", () => mockService);

const jwt = require("jsonwebtoken");
const request = require("supertest");
const app = require("../app");

function token(role) {
  return jwt.sign({ sub: 1, username: "usuario-test", role }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
}

describe("Rutas /api/catalogos", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // HU-06: marcas y modelos los necesita el filtro del catálogo, que ve
  // cualquier rol autenticado — a diferencia de país/departamento/municipio,
  // que solo usa el formulario de proveedores (Administrador).
  describe.each(["marcas", "modelos"])("GET /api/catalogos/%s", (recurso) => {
    it("permite tanto a Administrador como a Operador", async () => {
      mockService[`listar${recurso[0].toUpperCase()}${recurso.slice(1)}`].mockResolvedValue([]);

      const comoAdmin = await request(app)
        .get(`/api/catalogos/${recurso}`)
        .set("Authorization", `Bearer ${token("Administrador")}`);
      const comoOperador = await request(app)
        .get(`/api/catalogos/${recurso}`)
        .set("Authorization", `Bearer ${token("Operador")}`);

      expect(comoAdmin.status).toBe(200);
      expect(comoOperador.status).toBe(200);
    });
  });

  describe.each(["paises", "departamentos", "municipios"])("GET /api/catalogos/%s", (recurso) => {
    it("rechaza a Operador con 403", async () => {
      const respuesta = await request(app)
        .get(`/api/catalogos/${recurso}`)
        .set("Authorization", `Bearer ${token("Operador")}`);

      expect(respuesta.status).toBe(403);
    });

    it("permite a Administrador", async () => {
      const clave = recurso === "paises" ? "listarPaises" : `listar${recurso[0].toUpperCase()}${recurso.slice(1)}`;
      mockService[clave].mockResolvedValue([]);

      const respuesta = await request(app)
        .get(`/api/catalogos/${recurso}`)
        .set("Authorization", `Bearer ${token("Administrador")}`);

      expect(respuesta.status).toBe(200);
    });
  });

  it("rechaza peticiones sin token con 401", async () => {
    const respuesta = await request(app).get("/api/catalogos/marcas");
    expect(respuesta.status).toBe(401);
  });
});
