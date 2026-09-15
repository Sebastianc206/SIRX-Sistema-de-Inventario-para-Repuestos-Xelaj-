const mockCompraService = {
  listarCompras: jest.fn(),
  obtenerCompraPorId: jest.fn(),
  crearCompra: jest.fn(),
  anularCompra: jest.fn(),
};

jest.mock("../services/compraService", () => ({
  CompraError: class CompraError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  ...mockCompraService,
}));

const jwt = require("jsonwebtoken");
const request = require("supertest");
const app = require("../app");
const { CompraError } = require("../services/compraService");

function token(role) {
  return jwt.sign({ sub: 1, username: "usuario-test", role }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
}

describe("Rutas /api/compras", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("rechaza peticiones sin token con 401", async () => {
    const respuesta = await request(app).get("/api/compras");
    expect(respuesta.status).toBe(401);
  });

  describe("GET /api/compras", () => {
    it("rechaza a Operador con 403 (datos de costo)", async () => {
      const respuesta = await request(app)
        .get("/api/compras")
        .set("Authorization", `Bearer ${token("Operador")}`);

      expect(respuesta.status).toBe(403);
      expect(mockCompraService.listarCompras).not.toHaveBeenCalled();
    });

    it("permite listar a Administrador", async () => {
      mockCompraService.listarCompras.mockResolvedValueOnce({
        compras: [],
        paginacion: { pagina: 1, porPagina: 20, total: 0, totalPaginas: 1 },
      });

      const respuesta = await request(app)
        .get("/api/compras")
        .set("Authorization", `Bearer ${token("Administrador")}`);

      expect(respuesta.status).toBe(200);
    });
  });

  describe("POST /api/compras", () => {
    it("rechaza a Operador con 403", async () => {
      const respuesta = await request(app)
        .post("/api/compras")
        .set("Authorization", `Bearer ${token("Operador")}`)
        .send({ idProveedor: 1, lineas: [{ sku: "X", cantidad: 1, precioCompra: 1 }] });

      expect(respuesta.status).toBe(403);
      expect(mockCompraService.crearCompra).not.toHaveBeenCalled();
    });

    it("HU-08: registra la compra cuando Administrador envía datos válidos", async () => {
      mockCompraService.crearCompra.mockResolvedValueOnce({ idCompra: 1, montoTotalCompra: 100 });

      const respuesta = await request(app)
        .post("/api/compras")
        .set("Authorization", `Bearer ${token("Administrador")}`)
        .send({ idProveedor: 1, lineas: [{ sku: "FRE-001", cantidad: 5, precioCompra: 20 }] });

      expect(respuesta.status).toBe(201);
      expect(respuesta.body).toEqual({ compra: { idCompra: 1, montoTotalCompra: 100 } });
      expect(mockCompraService.crearCompra).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ idProveedor: 1 }),
      );
    });

    it("traduce a 400 el CompraError de validación que lanza el servicio", async () => {
      mockCompraService.crearCompra.mockRejectedValueOnce(new CompraError("Stock insuficiente", 400));

      const respuesta = await request(app)
        .post("/api/compras")
        .set("Authorization", `Bearer ${token("Administrador")}`)
        .send({ idProveedor: 1, lineas: [] });

      expect(respuesta.status).toBe(400);
    });
  });

  describe("GET /api/compras/:id", () => {
    it("rechaza un id no numérico con 400", async () => {
      const respuesta = await request(app)
        .get("/api/compras/abc")
        .set("Authorization", `Bearer ${token("Administrador")}`);

      expect(respuesta.status).toBe(400);
    });

    it("devuelve la compra cuando existe", async () => {
      mockCompraService.obtenerCompraPorId.mockResolvedValueOnce({ idCompra: 1 });

      const respuesta = await request(app)
        .get("/api/compras/1")
        .set("Authorization", `Bearer ${token("Administrador")}`);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body).toEqual({ compra: { idCompra: 1 } });
    });
  });

  describe("PATCH /api/compras/:id/anular", () => {
    it("rechaza a Operador con 403", async () => {
      const respuesta = await request(app)
        .patch("/api/compras/1/anular")
        .set("Authorization", `Bearer ${token("Operador")}`);

      expect(respuesta.status).toBe(403);
      expect(mockCompraService.anularCompra).not.toHaveBeenCalled();
    });

    it("permite a Administrador anular una compra", async () => {
      mockCompraService.anularCompra.mockResolvedValueOnce({ idCompra: 1, anulada: true });

      const respuesta = await request(app)
        .patch("/api/compras/1/anular")
        .set("Authorization", `Bearer ${token("Administrador")}`);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body).toEqual({ compra: { idCompra: 1, anulada: true } });
      expect(mockCompraService.anularCompra).toHaveBeenCalledWith(1);
    });

    it("traduce a 400 el CompraError si anular dejaría stock negativo", async () => {
      mockCompraService.anularCompra.mockRejectedValueOnce(new CompraError("Stock quedaría negativo", 400));

      const respuesta = await request(app)
        .patch("/api/compras/1/anular")
        .set("Authorization", `Bearer ${token("Administrador")}`);

      expect(respuesta.status).toBe(400);
    });

    it("rechaza un id no numérico con 400", async () => {
      const respuesta = await request(app)
        .patch("/api/compras/abc/anular")
        .set("Authorization", `Bearer ${token("Administrador")}`);

      expect(respuesta.status).toBe(400);
    });
  });
});
