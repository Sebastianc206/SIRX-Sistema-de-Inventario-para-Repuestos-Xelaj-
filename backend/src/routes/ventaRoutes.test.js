const mockVentaService = {
  listarVentas: jest.fn(),
  obtenerVentaPorId: jest.fn(),
  crearVenta: jest.fn(),
  anularVenta: jest.fn(),
};

jest.mock("../services/ventaService", () => ({
  VentaError: class VentaError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  ...mockVentaService,
}));

const jwt = require("jsonwebtoken");
const request = require("supertest");
const app = require("../app");
const { VentaError } = require("../services/ventaService");

function token(role) {
  return jwt.sign({ sub: 1, username: "usuario-test", role }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
}

describe("Rutas /api/ventas", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("rechaza peticiones sin token con 401", async () => {
    const respuesta = await request(app).get("/api/ventas");
    expect(respuesta.status).toBe(401);
  });

  it("HU-13: Operador puede registrar una venta de mostrador", async () => {
    mockVentaService.crearVenta.mockResolvedValueOnce({ idVenta: 1, montoTotalVenta: 350 });

    const respuesta = await request(app)
      .post("/api/ventas")
      .set("Authorization", `Bearer ${token("Operador")}`)
      .send({ lineas: [{ sku: "FRE-001", cantidad: 2, precioVenta: 150 }] });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toEqual({ venta: { idVenta: 1, montoTotalVenta: 350 } });
    expect(mockVentaService.crearVenta).toHaveBeenCalledWith(1, expect.any(Object));
  });

  describe("GET /api/ventas", () => {
    it("HU-14: rechaza a Operador con 403 (el historial es visión de auditoría de Administrador)", async () => {
      const respuesta = await request(app)
        .get("/api/ventas")
        .set("Authorization", `Bearer ${token("Operador")}`);

      expect(respuesta.status).toBe(403);
      expect(mockVentaService.listarVentas).not.toHaveBeenCalled();
    });

    it("permite listar a Administrador", async () => {
      mockVentaService.listarVentas.mockResolvedValueOnce({
        ventas: [],
        paginacion: { pagina: 1, porPagina: 20, total: 0, totalPaginas: 1 },
      });

      const respuesta = await request(app)
        .get("/api/ventas")
        .set("Authorization", `Bearer ${token("Administrador")}`);

      expect(respuesta.status).toBe(200);
    });

    it("pasa fechaDesde/fechaHasta al servicio", async () => {
      mockVentaService.listarVentas.mockResolvedValueOnce({
        ventas: [],
        paginacion: { pagina: 1, porPagina: 20, total: 0, totalPaginas: 1 },
      });

      await request(app)
        .get("/api/ventas?fechaDesde=2026-09-01&fechaHasta=2026-09-14")
        .set("Authorization", `Bearer ${token("Administrador")}`);

      expect(mockVentaService.listarVentas).toHaveBeenCalledWith(
        expect.objectContaining({ fechaDesde: "2026-09-01", fechaHasta: "2026-09-14" }),
      );
    });
  });

  it("traduce a 400 el VentaError de validación (ej. stock insuficiente)", async () => {
    mockVentaService.crearVenta.mockRejectedValueOnce(new VentaError("Stock insuficiente", 400));

    const respuesta = await request(app)
      .post("/api/ventas")
      .set("Authorization", `Bearer ${token("Administrador")}`)
      .send({ lineas: [{ sku: "FRE-001", cantidad: 999, precioVenta: 150 }] });

    expect(respuesta.status).toBe(400);
  });

  it("rechaza un id no numérico con 400", async () => {
    const respuesta = await request(app)
      .get("/api/ventas/abc")
      .set("Authorization", `Bearer ${token("Operador")}`);

    expect(respuesta.status).toBe(400);
  });

  describe("PATCH /api/ventas/:id/anular", () => {
    it("HU-14: rechaza a Operador con 403 (reversión exclusiva de Administrador)", async () => {
      const respuesta = await request(app)
        .patch("/api/ventas/1/anular")
        .set("Authorization", `Bearer ${token("Operador")}`);

      expect(respuesta.status).toBe(403);
      expect(mockVentaService.anularVenta).not.toHaveBeenCalled();
    });

    it("permite a Administrador anular una venta", async () => {
      mockVentaService.anularVenta.mockResolvedValueOnce({ idVenta: 1, anulada: true });

      const respuesta = await request(app)
        .patch("/api/ventas/1/anular")
        .set("Authorization", `Bearer ${token("Administrador")}`);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body).toEqual({ venta: { idVenta: 1, anulada: true } });
      expect(mockVentaService.anularVenta).toHaveBeenCalledWith(1);
    });

    it("traduce a 400 el VentaError si la venta ya está anulada", async () => {
      mockVentaService.anularVenta.mockRejectedValueOnce(new VentaError("La venta ya está anulada", 400));

      const respuesta = await request(app)
        .patch("/api/ventas/1/anular")
        .set("Authorization", `Bearer ${token("Administrador")}`);

      expect(respuesta.status).toBe(400);
    });
  });
});
