const mockArticuloService = {
  listarArticulos: jest.fn(),
  obtenerArticuloPorSku: jest.fn(),
  crearArticulo: jest.fn(),
  editarArticulo: jest.fn(),
  cambiarEstadoArticulo: jest.fn(),
};

jest.mock("../services/articuloService", () => ({
  ArticuloError: class ArticuloError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  ...mockArticuloService,
}));

const jwt = require("jsonwebtoken");
const request = require("supertest");
const app = require("../app");
const { ArticuloError } = require("../services/articuloService");

function token(role) {
  return jwt.sign({ sub: 1, username: "usuario-test", role }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
}

describe("Rutas /api/repuestos", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("rechaza peticiones sin token con 401", async () => {
    const respuesta = await request(app).get("/api/repuestos");
    expect(respuesta.status).toBe(401);
  });

  describe("GET /api/repuestos", () => {
    it("HU-04 criterio 5: permite listar tanto a Administrador como a Operador", async () => {
      mockArticuloService.listarArticulos.mockResolvedValue({
        articulos: [],
        paginacion: { pagina: 1, porPagina: 20, total: 0, totalPaginas: 1 },
      });

      const comoAdmin = await request(app)
        .get("/api/repuestos")
        .set("Authorization", `Bearer ${token("Administrador")}`);
      const comoOperador = await request(app)
        .get("/api/repuestos")
        .set("Authorization", `Bearer ${token("Operador")}`);

      expect(comoAdmin.status).toBe(200);
      expect(comoOperador.status).toBe(200);
    });

    it("T-037: le pide al servicio ocultar datos sensibles cuando el rol es Operador", async () => {
      mockArticuloService.listarArticulos.mockResolvedValue({
        articulos: [],
        paginacion: { pagina: 1, porPagina: 20, total: 0, totalPaginas: 1 },
      });

      await request(app).get("/api/repuestos").set("Authorization", `Bearer ${token("Operador")}`);

      expect(mockArticuloService.listarArticulos).toHaveBeenCalledWith(
        expect.objectContaining({ ocultarDatosSensibles: true }),
      );

      await request(app).get("/api/repuestos").set("Authorization", `Bearer ${token("Administrador")}`);

      expect(mockArticuloService.listarArticulos).toHaveBeenLastCalledWith(
        expect.objectContaining({ ocultarDatosSensibles: false }),
      );
    });

    it("pasa pagina/porPagina/busqueda/estado desde el query string", async () => {
      mockArticuloService.listarArticulos.mockResolvedValue({
        articulos: [],
        paginacion: { pagina: 2, porPagina: 10, total: 0, totalPaginas: 1 },
      });

      await request(app)
        .get("/api/repuestos?pagina=2&porPagina=10&busqueda=freno&estado=activo")
        .set("Authorization", `Bearer ${token("Administrador")}`);

      expect(mockArticuloService.listarArticulos).toHaveBeenCalledWith(
        expect.objectContaining({ pagina: 2, porPagina: 10, busqueda: "freno", estado: "activo" }),
      );
    });
  });

  describe("GET /api/repuestos/:sku", () => {
    it("responde 404 cuando el servicio lanza ArticuloError(404)", async () => {
      mockArticuloService.obtenerArticuloPorSku.mockRejectedValueOnce(
        new ArticuloError("Repuesto no encontrado", 404),
      );

      const respuesta = await request(app)
        .get("/api/repuestos/NO-EXISTE")
        .set("Authorization", `Bearer ${token("Operador")}`);

      expect(respuesta.status).toBe(404);
    });
  });

  describe("POST /api/repuestos", () => {
    it("rechaza a Operador con 403", async () => {
      const respuesta = await request(app)
        .post("/api/repuestos")
        .set("Authorization", `Bearer ${token("Operador")}`)
        .send({ sku: "FRE-001" });

      expect(respuesta.status).toBe(403);
      expect(mockArticuloService.crearArticulo).not.toHaveBeenCalled();
    });

    it("crea el repuesto cuando Administrador envía datos válidos", async () => {
      mockArticuloService.crearArticulo.mockResolvedValueOnce({ sku: "FRE-001", nombre: "Pastillas" });

      const respuesta = await request(app)
        .post("/api/repuestos")
        .set("Authorization", `Bearer ${token("Administrador")}`)
        .send({ sku: "FRE-001", nombre: "Pastillas" });

      expect(respuesta.status).toBe(201);
      expect(respuesta.body).toEqual({ articulo: { sku: "FRE-001", nombre: "Pastillas" } });
    });

    it("T-036: traduce a 409 el ArticuloError de sku duplicado", async () => {
      mockArticuloService.crearArticulo.mockRejectedValueOnce(
        new ArticuloError("Ya existe un repuesto con ese código (SKU)", 409),
      );

      const respuesta = await request(app)
        .post("/api/repuestos")
        .set("Authorization", `Bearer ${token("Administrador")}`)
        .send({ sku: "FRE-001" });

      expect(respuesta.status).toBe(409);
    });
  });

  describe("PUT /api/repuestos/:sku", () => {
    it("rechaza a Operador con 403", async () => {
      const respuesta = await request(app)
        .put("/api/repuestos/FRE-001")
        .set("Authorization", `Bearer ${token("Operador")}`)
        .send({ nombre: "X" });

      expect(respuesta.status).toBe(403);
      expect(mockArticuloService.editarArticulo).not.toHaveBeenCalled();
    });

    it("edita cuando Administrador envía datos válidos", async () => {
      mockArticuloService.editarArticulo.mockResolvedValueOnce({ sku: "FRE-001", nombre: "Pastillas premium" });

      const respuesta = await request(app)
        .put("/api/repuestos/FRE-001")
        .set("Authorization", `Bearer ${token("Administrador")}`)
        .send({ nombre: "Pastillas premium" });

      expect(respuesta.status).toBe(200);
      expect(mockArticuloService.editarArticulo).toHaveBeenCalledWith("FRE-001", { nombre: "Pastillas premium" });
    });
  });

  describe("PATCH /api/repuestos/:sku/estado", () => {
    it("rechaza a Operador con 403", async () => {
      const respuesta = await request(app)
        .patch("/api/repuestos/FRE-001/estado")
        .set("Authorization", `Bearer ${token("Operador")}`)
        .send({ estado: false });

      expect(respuesta.status).toBe(403);
    });

    it("rechaza con 400 si estado no es booleano", async () => {
      const respuesta = await request(app)
        .patch("/api/repuestos/FRE-001/estado")
        .set("Authorization", `Bearer ${token("Administrador")}`)
        .send({ estado: "no" });

      expect(respuesta.status).toBe(400);
      expect(mockArticuloService.cambiarEstadoArticulo).not.toHaveBeenCalled();
    });

    it("T-028: da de baja (estado=false) cuando Administrador lo solicita", async () => {
      mockArticuloService.cambiarEstadoArticulo.mockResolvedValueOnce({ sku: "FRE-001", estado: false });

      const respuesta = await request(app)
        .patch("/api/repuestos/FRE-001/estado")
        .set("Authorization", `Bearer ${token("Administrador")}`)
        .send({ estado: false });

      expect(respuesta.status).toBe(200);
      expect(mockArticuloService.cambiarEstadoArticulo).toHaveBeenCalledWith("FRE-001", false);
    });
  });
});
