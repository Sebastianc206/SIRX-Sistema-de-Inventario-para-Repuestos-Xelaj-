const mockSalidaAjusteService = {
  listarSalidasAjuste: jest.fn(),
  listarTiposSalidaAjuste: jest.fn(),
  obtenerSalidaAjustePorId: jest.fn(),
  crearSalidaAjuste: jest.fn(),
  anularSalidaAjuste: jest.fn(),
};

jest.mock("../services/salidaAjusteService", () => ({
  SalidaAjusteError: class SalidaAjusteError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  ...mockSalidaAjusteService,
}));

const jwt = require("jsonwebtoken");
const request = require("supertest");
const app = require("../app");

function token(role) {
  return jwt.sign({ sub: 1, username: "usuario-test", role }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
}

describe("Rutas /api/ajustes-inventario", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("rechaza peticiones sin token con 401", async () => {
    const respuesta = await request(app).get("/api/ajustes-inventario");
    expect(respuesta.status).toBe(401);
  });

  it("HU-09: Operador puede crear un ajuste (no es dato financiero)", async () => {
    mockSalidaAjusteService.crearSalidaAjuste.mockResolvedValueOnce({ idVenta: 1 });

    const respuesta = await request(app)
      .post("/api/ajustes-inventario")
      .set("Authorization", `Bearer ${token("Operador")}`)
      .send({ lineas: [{ sku: "FRE-001", cantidad: 1, idTipoSalida: 2 }] });

    expect(respuesta.status).toBe(201);
    expect(mockSalidaAjusteService.crearSalidaAjuste).toHaveBeenCalledWith(1, expect.any(Object));
  });

  describe("GET /api/ajustes-inventario", () => {
    it("rechaza a Operador con 403 (el historial es visión de auditoría de Administrador)", async () => {
      const respuesta = await request(app)
        .get("/api/ajustes-inventario")
        .set("Authorization", `Bearer ${token("Operador")}`);

      expect(respuesta.status).toBe(403);
      expect(mockSalidaAjusteService.listarSalidasAjuste).not.toHaveBeenCalled();
    });

    it("Administrador puede listar ajustes", async () => {
      mockSalidaAjusteService.listarSalidasAjuste.mockResolvedValueOnce([]);

      const respuesta = await request(app)
        .get("/api/ajustes-inventario")
        .set("Authorization", `Bearer ${token("Administrador")}`);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body).toEqual({ salidas: [] });
    });

    it("pasa fechaDesde/fechaHasta al servicio", async () => {
      mockSalidaAjusteService.listarSalidasAjuste.mockResolvedValueOnce([]);

      await request(app)
        .get("/api/ajustes-inventario?fechaDesde=2026-09-01&fechaHasta=2026-09-14")
        .set("Authorization", `Bearer ${token("Administrador")}`);

      expect(mockSalidaAjusteService.listarSalidasAjuste).toHaveBeenCalledWith({
        fechaDesde: "2026-09-01",
        fechaHasta: "2026-09-14",
      });
    });
  });

  it("GET /tipos no colisiona con GET /:id", async () => {
    mockSalidaAjusteService.listarTiposSalidaAjuste.mockResolvedValueOnce([{ idTipoSalida: 2, descripcion: "Merma" }]);

    const respuesta = await request(app)
      .get("/api/ajustes-inventario/tipos")
      .set("Authorization", `Bearer ${token("Operador")}`);

    expect(respuesta.status).toBe(200);
    expect(mockSalidaAjusteService.obtenerSalidaAjustePorId).not.toHaveBeenCalled();
  });

  it("rechaza un id no numérico con 400", async () => {
    const respuesta = await request(app)
      .get("/api/ajustes-inventario/abc")
      .set("Authorization", `Bearer ${token("Operador")}`);

    expect(respuesta.status).toBe(400);
  });

  describe("PATCH /api/ajustes-inventario/:id/anular", () => {
    it("rechaza a Operador con 403", async () => {
      const respuesta = await request(app)
        .patch("/api/ajustes-inventario/1/anular")
        .set("Authorization", `Bearer ${token("Operador")}`);

      expect(respuesta.status).toBe(403);
      expect(mockSalidaAjusteService.anularSalidaAjuste).not.toHaveBeenCalled();
    });

    it("permite a Administrador anular un ajuste", async () => {
      mockSalidaAjusteService.anularSalidaAjuste.mockResolvedValueOnce({ idVenta: 1, anulada: true });

      const respuesta = await request(app)
        .patch("/api/ajustes-inventario/1/anular")
        .set("Authorization", `Bearer ${token("Administrador")}`);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body).toEqual({ salida: { idVenta: 1, anulada: true } });
      expect(mockSalidaAjusteService.anularSalidaAjuste).toHaveBeenCalledWith(1);
    });
  });
});
