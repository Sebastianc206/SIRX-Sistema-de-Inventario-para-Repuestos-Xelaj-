jest.mock("../utils/prismaClient", () => ({
  articulo: { findMany: jest.fn(), count: jest.fn() },
  configuracion: { findUnique: jest.fn() },
  salidaMaestro: { aggregate: jest.fn() },
}));

const prisma = require("../utils/prismaClient");
const { listarAlertasStockBajo, obtenerResumenDashboard } = require("./dashboardService");

describe("dashboardService", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("listarAlertasStockBajo", () => {
    it("usa el umbral general cuando el producto no tiene uno propio y respeta el propio", async () => {
      prisma.configuracion.findUnique.mockResolvedValueOnce({ valor: "10" });
      prisma.articulo.findMany.mockResolvedValueOnce([
        { sku: "G", nombre: "General", inventarioMinimo: null, inventario: { cantidad: 8 } }, // bajo (<=10)
        { sku: "P", nombre: "Propio", inventarioMinimo: 2, inventario: { cantidad: 8 } }, // en stock
        { sku: "Z", nombre: "Propio 0", inventarioMinimo: 0, inventario: { cantidad: 1 } }, // en stock
      ]);

      const alertas = await listarAlertasStockBajo();

      expect(alertas).toEqual([
        { sku: "G", nombre: "General", cantidadInventario: 8, inventarioMinimo: 10, estadoStock: "bajo" },
      ]);
    });

    it("HU-12: solo incluye repuestos activos con cantidad <= inventarioMinimo, ordenados ascendente", async () => {
      prisma.articulo.findMany.mockResolvedValueOnce([
        { sku: "A", nombre: "En stock", inventarioMinimo: 5, inventario: { cantidad: 20 } },
        { sku: "B", nombre: "Agotado", inventarioMinimo: 5, inventario: { cantidad: 0 } },
        { sku: "C", nombre: "Stock bajo", inventarioMinimo: 5, inventario: { cantidad: 3 } },
      ]);

      const alertas = await listarAlertasStockBajo();

      expect(alertas.map((a) => a.sku)).toEqual(["B", "C"]);
      expect(prisma.articulo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { estado: true } }),
      );
    });
  });

  describe("obtenerResumenDashboard", () => {
    it("HU-15: Administrador ve ventasHoy", async () => {
      prisma.articulo.count.mockResolvedValueOnce(10);
      prisma.articulo.findMany.mockResolvedValueOnce([]);
      prisma.salidaMaestro.aggregate.mockResolvedValueOnce({ _sum: { montoTotalVenta: 500 }, _count: 3 });

      const resumen = await obtenerResumenDashboard({ ocultarDatosSensibles: false });

      expect(resumen.skusActivos).toBe(10);
      expect(resumen.ventasHoy).toEqual({ total: 500, cantidad: 3 });
    });

    it("HU-15: Operador no recibe ventasHoy (dato financiero)", async () => {
      prisma.articulo.count.mockResolvedValueOnce(10);
      prisma.articulo.findMany.mockResolvedValueOnce([]);

      const resumen = await obtenerResumenDashboard({ ocultarDatosSensibles: true });

      expect(resumen.ventasHoy).toBeNull();
      expect(prisma.salidaMaestro.aggregate).not.toHaveBeenCalled();
    });
  });
});
