const mockMovimientoService = {
  listarMovimientos: jest.fn(),
  obtenerComparacionVentas: jest.fn(),
};

jest.mock("../services/movimientoService", () => ({
  MovimientoError: class MovimientoError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  ...mockMovimientoService,
}));

const jwt = require("jsonwebtoken");
const request = require("supertest");
const app = require("../app");

function token(role) {
  return jwt.sign({ sub: 1, username: "usuario-test", role }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
}

describe("Rutas /api/movimientos", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("rechaza peticiones sin token con 401", async () => {
    const respuesta = await request(app).get("/api/movimientos");
    expect(respuesta.status).toBe(401);
  });

  it("HU-10: rechaza a Operador con 403 (visión de auditoría/reportes, exclusiva de Administrador)", async () => {
    const respuesta = await request(app)
      .get("/api/movimientos")
      .set("Authorization", `Bearer ${token("Operador")}`);
    expect(respuesta.status).toBe(403);
    expect(mockMovimientoService.listarMovimientos).not.toHaveBeenCalled();
  });

  describe("GET /api/movimientos", () => {
    it("permite consultar a Administrador sin filtros (ocultarDatosSensibles=false)", async () => {
      mockMovimientoService.listarMovimientos.mockResolvedValueOnce({
        movimientos: [],
        paginacion: { pagina: 1, porPagina: 15, total: 0, totalPaginas: 1 },
      });

      const respuesta = await request(app)
        .get("/api/movimientos")
        .set("Authorization", `Bearer ${token("Administrador")}`);

      expect(respuesta.status).toBe(200);
      expect(mockMovimientoService.listarMovimientos).toHaveBeenCalledWith({
        skus: [],
        idCategoria: undefined,
        idMarca: undefined,
        fechaDesde: undefined,
        fechaHasta: undefined,
        pagina: undefined,
        porPagina: undefined,
        ocultarDatosSensibles: false,
      });
    });

    it("pasa skus, idCategoria, idMarca, fechas y paginación al servicio", async () => {
      mockMovimientoService.listarMovimientos.mockResolvedValueOnce({
        movimientos: [],
        paginacion: { pagina: 2, porPagina: 15, total: 0, totalPaginas: 1 },
      });

      await request(app)
        .get(
          "/api/movimientos?skus=FRE-001,FIL-002&idCategoria=3&idMarca=7&fechaDesde=2026-09-01&fechaHasta=2026-09-14&pagina=2&porPagina=15",
        )
        .set("Authorization", `Bearer ${token("Administrador")}`);

      expect(mockMovimientoService.listarMovimientos).toHaveBeenCalledWith({
        skus: ["FRE-001", "FIL-002"],
        idCategoria: 3,
        idMarca: 7,
        fechaDesde: "2026-09-01",
        fechaHasta: "2026-09-14",
        pagina: 2,
        porPagina: 15,
        ocultarDatosSensibles: false,
      });
    });
  });

  describe("GET /api/movimientos/comparacion-ventas", () => {
    it("rechaza a Operador con 403", async () => {
      const respuesta = await request(app)
        .get("/api/movimientos/comparacion-ventas?skus=A,B")
        .set("Authorization", `Bearer ${token("Operador")}`);
      expect(respuesta.status).toBe(403);
      expect(mockMovimientoService.obtenerComparacionVentas).not.toHaveBeenCalled();
    });

    it("no colisiona con GET / (ya no hay ruta :sku)", async () => {
      mockMovimientoService.obtenerComparacionVentas.mockResolvedValueOnce({ series: [] });

      const respuesta = await request(app)
        .get("/api/movimientos/comparacion-ventas?skus=A,B")
        .set("Authorization", `Bearer ${token("Administrador")}`);

      expect(respuesta.status).toBe(200);
      expect(mockMovimientoService.listarMovimientos).not.toHaveBeenCalled();
      expect(mockMovimientoService.obtenerComparacionVentas).toHaveBeenCalledWith(
        ["A", "B"],
        { fechaDesde: undefined, fechaHasta: undefined },
      );
    });

    it("pasa un array vacío al servicio si no se envía el parámetro skus", async () => {
      mockMovimientoService.obtenerComparacionVentas.mockResolvedValueOnce({ series: [] });

      await request(app)
        .get("/api/movimientos/comparacion-ventas")
        .set("Authorization", `Bearer ${token("Administrador")}`);

      expect(mockMovimientoService.obtenerComparacionVentas).toHaveBeenCalledWith(
        [],
        { fechaDesde: undefined, fechaHasta: undefined },
      );
    });

    it("pasa fechaDesde/fechaHasta al servicio", async () => {
      mockMovimientoService.obtenerComparacionVentas.mockResolvedValueOnce({ series: [] });

      await request(app)
        .get("/api/movimientos/comparacion-ventas?skus=A,B&fechaDesde=2026-09-01&fechaHasta=2026-09-14")
        .set("Authorization", `Bearer ${token("Administrador")}`);

      expect(mockMovimientoService.obtenerComparacionVentas).toHaveBeenCalledWith(
        ["A", "B"],
        { fechaDesde: "2026-09-01", fechaHasta: "2026-09-14" },
      );
    });
  });
});
