jest.mock("../utils/prismaClient", () => ({
  configuracion: { findUnique: jest.fn(), upsert: jest.fn() },
  articulo: { findMany: jest.fn(), updateMany: jest.fn() },
  categoria: { findUnique: jest.fn() },
}));

const prisma = require("../utils/prismaClient");
const {
  UmbralStockError,
  esUmbralValido,
  normalizarUmbralPropio,
  umbralEfectivo,
  calcularEstadoStock,
  obtenerUmbralGeneral,
  obtenerConfiguracionStock,
  previsualizarImpacto,
  actualizarConfiguracionStock,
  aplicarUmbralMasivo,
} = require("./umbralStockService");

describe("umbralStockService", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("regla efectiva", () => {
    it("usa el umbral propio si está definido (incluido 0) y el general si es null", () => {
      expect(umbralEfectivo(3, 10)).toBe(3);
      expect(umbralEfectivo(0, 10)).toBe(0);
      expect(umbralEfectivo(null, 10)).toBe(10);
    });

    it("calcula agotado / bajo / en_stock (borde incluido)", () => {
      expect(calcularEstadoStock(0, 5)).toBe("agotado");
      expect(calcularEstadoStock(1, 5)).toBe("bajo");
      expect(calcularEstadoStock(5, 5)).toBe("bajo");
      expect(calcularEstadoStock(6, 5)).toBe("en_stock");
      expect(calcularEstadoStock(1, 0)).toBe("en_stock");
    });
  });

  describe("validaciones", () => {
    it("esUmbralValido exige entero number entre 0 y 10000", () => {
      expect(esUmbralValido(0)).toBe(true);
      expect(esUmbralValido(10000)).toBe(true);
      expect(esUmbralValido(-1)).toBe(false);
      expect(esUmbralValido(10001)).toBe(false);
      expect(esUmbralValido(2.5)).toBe(false);
      expect(esUmbralValido("5")).toBe(false);
      expect(esUmbralValido(NaN)).toBe(false);
      expect(esUmbralValido(null)).toBe(false);
    });

    it("normalizarUmbralPropio: vacío => null, numérico => número, inválido => error 400", () => {
      expect(normalizarUmbralPropio(undefined)).toBeNull();
      expect(normalizarUmbralPropio(null)).toBeNull();
      expect(normalizarUmbralPropio("  ")).toBeNull();
      expect(normalizarUmbralPropio("7")).toBe(7);
      expect(normalizarUmbralPropio(0)).toBe(0);
      expect(() => normalizarUmbralPropio(-2)).toThrow(UmbralStockError);
      expect(() => normalizarUmbralPropio(1.5)).toThrow(UmbralStockError);
      expect(() => normalizarUmbralPropio("abc")).toThrow(UmbralStockError);
      expect(() => normalizarUmbralPropio(10001)).toThrow(UmbralStockError);
    });
  });

  describe("umbral general", () => {
    it("devuelve el valor guardado", async () => {
      prisma.configuracion.findUnique.mockResolvedValueOnce({ clave: "umbral_stock_bajo", valor: "8" });
      await expect(obtenerUmbralGeneral()).resolves.toBe(8);
    });

    it("usa 5 por defecto si no hay fila o el valor está corrupto", async () => {
      prisma.configuracion.findUnique.mockResolvedValueOnce(null);
      await expect(obtenerUmbralGeneral()).resolves.toBe(5);
      prisma.configuracion.findUnique.mockResolvedValueOnce({ valor: "xyz" });
      await expect(obtenerUmbralGeneral()).resolves.toBe(5);
    });

    it("actualizar rechaza valores inválidos sin tocar la base", async () => {
      await expect(actualizarConfiguracionStock({ umbralGeneral: -1 })).rejects.toMatchObject({ statusCode: 400 });
      await expect(actualizarConfiguracionStock({ umbralGeneral: "5" })).rejects.toMatchObject({ statusCode: 400 });
      await expect(actualizarConfiguracionStock({ umbralGeneral: 99999 })).rejects.toMatchObject({ statusCode: 400 });
      expect(prisma.configuracion.upsert).not.toHaveBeenCalled();
    });

    it("actualizar guarda como texto y devuelve la configuración con impacto", async () => {
      prisma.configuracion.upsert.mockResolvedValueOnce({});
      prisma.configuracion.findUnique.mockResolvedValueOnce({ valor: "9" });
      prisma.articulo.findMany.mockResolvedValueOnce([]);

      const r = await actualizarConfiguracionStock({ umbralGeneral: 9 });

      expect(prisma.configuracion.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { valor: "9" } }),
      );
      expect(r.umbralGeneral).toBe(9);
    });
  });

  describe("impacto", () => {
    const ARTICULOS = [
      { inventarioMinimo: null, inventario: { cantidad: 4 } }, // general
      { inventarioMinimo: null, inventario: { cantidad: 12 } }, // general
      { inventarioMinimo: 2, inventario: { cantidad: 4 } }, // propio: en stock
      { inventarioMinimo: 4, inventario: { cantidad: 4 } }, // propio: bajo
      { inventarioMinimo: null, inventario: { cantidad: 0 } }, // agotado
      { inventarioMinimo: null, inventario: null }, // sin fila de inventario => agotado
    ];

    it("con general=5: 2 bajos (uno propio, uno general), 2 agotados, 2 con umbral propio", async () => {
      prisma.configuracion.findUnique.mockResolvedValueOnce({ valor: "5" });
      prisma.articulo.findMany.mockResolvedValueOnce(ARTICULOS);

      const { impacto, umbralGeneral } = await obtenerConfiguracionStock();

      expect(umbralGeneral).toBe(5);
      expect(impacto).toEqual({ totalActivos: 6, enBajo: 2, agotados: 2, conUmbralPropio: 2 });
    });

    it("la vista previa recalcula con otro general; los de umbral propio no cambian", async () => {
      prisma.articulo.findMany.mockResolvedValueOnce(ARTICULOS);
      const sube = await previsualizarImpacto(12);
      expect(sube.enBajo).toBe(3); // 4 y 12 (general) + el propio 4<=4

      prisma.articulo.findMany.mockResolvedValueOnce(ARTICULOS);
      const baja = await previsualizarImpacto(0);
      expect(baja.enBajo).toBe(1); // solo el propio
    });

    it("la vista previa rechaza umbral inválido", async () => {
      await expect(previsualizarImpacto(NaN)).rejects.toMatchObject({ statusCode: 400 });
    });

    it("solo cuenta productos activos", async () => {
      prisma.articulo.findMany.mockResolvedValueOnce([]);
      await previsualizarImpacto(3);
      expect(prisma.articulo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { estado: true } }),
      );
    });
  });

  describe("aplicarUmbralMasivo", () => {
    it("por SKUs: updateMany con in[] y devuelve cantidad", async () => {
      prisma.articulo.updateMany.mockResolvedValueOnce({ count: 2 });
      const r = await aplicarUmbralMasivo({ umbral: 7, skus: [" A-1 ", "B-2"] });
      expect(r).toEqual({ actualizados: 2 });
      expect(prisma.articulo.updateMany).toHaveBeenCalledWith({
        where: { sku: { in: ["A-1", "B-2"] } },
        data: { inventarioMinimo: 7 },
      });
    });

    it("por categoría; umbral null restablece al general", async () => {
      prisma.categoria.findUnique.mockResolvedValueOnce({ idCategoria: 1 });
      prisma.articulo.updateMany.mockResolvedValueOnce({ count: 4 });
      await aplicarUmbralMasivo({ umbral: null, idCategoria: 1 });
      expect(prisma.articulo.updateMany).toHaveBeenCalledWith({
        where: { idCategoria: 1 },
        data: { inventarioMinimo: null },
      });
    });

    it("rechaza: umbral ausente/inválido, ambos o ningún objetivo, categoría inexistente, lista vacía", async () => {
      await expect(aplicarUmbralMasivo({ skus: ["A"] })).rejects.toMatchObject({ statusCode: 400 });
      await expect(aplicarUmbralMasivo({ umbral: -1, skus: ["A"] })).rejects.toMatchObject({ statusCode: 400 });
      await expect(aplicarUmbralMasivo({ umbral: 3 })).rejects.toMatchObject({ statusCode: 400 });
      await expect(aplicarUmbralMasivo({ umbral: 3, skus: ["A"], idCategoria: 1 })).rejects.toMatchObject({ statusCode: 400 });
      await expect(aplicarUmbralMasivo({ umbral: 3, skus: [] })).rejects.toMatchObject({ statusCode: 400 });
      await expect(aplicarUmbralMasivo({ umbral: 3, skus: [""] })).rejects.toMatchObject({ statusCode: 400 });
      prisma.categoria.findUnique.mockResolvedValueOnce(null);
      await expect(aplicarUmbralMasivo({ umbral: 3, idCategoria: 99 })).rejects.toMatchObject({ statusCode: 400 });
      expect(prisma.articulo.updateMany).not.toHaveBeenCalled();
    });
  });
});
