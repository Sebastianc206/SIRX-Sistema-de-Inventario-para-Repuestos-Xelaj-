const mockDashboardService = {
  obtenerResumenDashboard: jest.fn(),
};

jest.mock("../services/dashboardService", () => mockDashboardService);

const jwt = require("jsonwebtoken");
const request = require("supertest");
const app = require("../app");

function token(role) {
  return jwt.sign({ sub: 1, username: "usuario-test", role }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
}

describe("Rutas /api/dashboard", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("rechaza peticiones sin token con 401", async () => {
    const respuesta = await request(app).get("/api/dashboard/resumen");
    expect(respuesta.status).toBe(401);
  });

  it("HU-12/15: Operador recibe el resumen con ocultarDatosSensibles=true", async () => {
    mockDashboardService.obtenerResumenDashboard.mockResolvedValueOnce({
      skusActivos: 10,
      alertasStockBajo: [],
      ventasHoy: null,
    });

    const respuesta = await request(app)
      .get("/api/dashboard/resumen")
      .set("Authorization", `Bearer ${token("Operador")}`);

    expect(respuesta.status).toBe(200);
    expect(mockDashboardService.obtenerResumenDashboard).toHaveBeenCalledWith({ ocultarDatosSensibles: true });
    expect(respuesta.body.ventasHoy).toBeNull();
  });

  it("Administrador recibe ocultarDatosSensibles=false", async () => {
    mockDashboardService.obtenerResumenDashboard.mockResolvedValueOnce({
      skusActivos: 10,
      alertasStockBajo: [],
      ventasHoy: { total: 500, cantidad: 3 },
    });

    await request(app)
      .get("/api/dashboard/resumen")
      .set("Authorization", `Bearer ${token("Administrador")}`);

    expect(mockDashboardService.obtenerResumenDashboard).toHaveBeenCalledWith({ ocultarDatosSensibles: false });
  });
});
