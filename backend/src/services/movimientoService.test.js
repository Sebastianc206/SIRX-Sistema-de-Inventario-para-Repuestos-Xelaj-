jest.mock("../utils/prismaClient", () => ({
  articulo: { findMany: jest.fn() },
  compraDetalle: { findMany: jest.fn() },
  salidaDetalle: { findMany: jest.fn() },
}));

const prisma = require("../utils/prismaClient");
const { MovimientoError, listarMovimientos, obtenerComparacionVentas } = require("./movimientoService");

describe("movimientoService", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("listarMovimientos", () => {
    it("HU-10: sin filtros trae compras y salidas de todos los productos, ordenado por fecha", async () => {
      prisma.compraDetalle.findMany.mockResolvedValueOnce([
        {
          idDetalleCompra: 1,
          idCompra: 10,
          sku: "FRE-001",
          cantidad: 5,
          precioCompra: 20,
          fecCompra: new Date("2026-09-01"),
          articulo: { nombre: "Pastillas" },
          compraMaestro: { anulada: false, proveedor: { nombre: "Repuestos Guate S.A." } },
        },
      ]);
      prisma.salidaDetalle.findMany.mockResolvedValueOnce([
        {
          idDetalleSalida: 1,
          idSalida: 20,
          sku: "FIL-002",
          cantidad: 2,
          fecCompra: new Date("2026-09-05"),
          articulo: { nombre: "Filtro" },
          tipoSalida: { idTipoSalida: 2, descripcion: "Merma" },
          salidaMaestro: { anulada: false },
        },
        {
          idDetalleSalida: 2,
          idSalida: 21,
          sku: "FRE-001",
          cantidad: 1,
          precioVenta: 450,
          fecCompra: new Date("2026-09-10"),
          articulo: { nombre: "Pastillas" },
          tipoSalida: { idTipoSalida: 1, descripcion: "Venta" },
          salidaMaestro: { anulada: false },
        },
      ]);

      const resultado = await listarMovimientos({ ocultarDatosSensibles: false });

      expect(prisma.compraDetalle.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
      expect(prisma.salidaDetalle.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
      expect(resultado.movimientos).toHaveLength(3);
      // Más reciente primero: venta (10) > merma (05) > compra (01).
      expect(resultado.movimientos[0]).toMatchObject({
        sku: "FRE-001",
        nombreProducto: "Pastillas",
        categoria: "venta",
        referencia: "Venta #21",
        precioVenta: 450,
      });
      expect(resultado.movimientos[1]).toMatchObject({ sku: "FIL-002", nombreProducto: "Filtro", categoria: "merma" });
      expect(resultado.movimientos[2]).toMatchObject({ sku: "FRE-001", tipo: "entrada", categoria: "compra" });
      expect(resultado.paginacion).toEqual({ pagina: 1, porPagina: 15, total: 3, totalPaginas: 1 });
    });

    it("filtra por skus, idCategoria e idMarca vía la relación articulo", async () => {
      prisma.compraDetalle.findMany.mockResolvedValueOnce([]);
      prisma.salidaDetalle.findMany.mockResolvedValueOnce([]);

      await listarMovimientos({ skus: ["FRE-001", "FIL-002"], idCategoria: 3, idMarca: 7 });

      const whereEsperado = { articulo: { sku: { in: ["FRE-001", "FIL-002"] }, idCategoria: 3, idMarca: 7 } };
      expect(prisma.compraDetalle.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: whereEsperado }));
      expect(prisma.salidaDetalle.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: whereEsperado }));
    });

    it("filtra por fecCompra cuando se indican fechaDesde/fechaHasta", async () => {
      prisma.compraDetalle.findMany.mockResolvedValueOnce([]);
      prisma.salidaDetalle.findMany.mockResolvedValueOnce([]);

      await listarMovimientos({ fechaDesde: "2026-09-01", fechaHasta: "2026-09-14" });

      expect(prisma.compraDetalle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { fecCompra: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }) },
        }),
      );
    });

    it("rechaza una fechaDesde inválida con 400", async () => {
      await expect(listarMovimientos({ fechaDesde: "no-es-fecha" })).rejects.toMatchObject({ statusCode: 400 });
    });

    it("oculta precioCompra y proveedor cuando ocultarDatosSensibles es true", async () => {
      prisma.compraDetalle.findMany.mockResolvedValueOnce([
        {
          idDetalleCompra: 1,
          idCompra: 10,
          sku: "FRE-001",
          cantidad: 5,
          precioCompra: 20,
          fecCompra: new Date(),
          articulo: { nombre: "Pastillas" },
          compraMaestro: { anulada: false, proveedor: { nombre: "Repuestos Guate S.A." } },
        },
      ]);
      prisma.salidaDetalle.findMany.mockResolvedValueOnce([]);

      const resultado = await listarMovimientos({ ocultarDatosSensibles: true });

      expect(resultado.movimientos[0].precioCompra).toBeUndefined();
      expect(resultado.movimientos[0].proveedor).toBeUndefined();
    });

    it("expone id y anulada de cada movimiento (para el botón Anular del frontend)", async () => {
      prisma.compraDetalle.findMany.mockResolvedValueOnce([
        {
          idDetalleCompra: 1,
          idCompra: 10,
          sku: "FRE-001",
          cantidad: 5,
          precioCompra: 20,
          fecCompra: new Date("2026-09-01"),
          articulo: { nombre: "Pastillas" },
          compraMaestro: { anulada: true, proveedor: { nombre: "Repuestos Guate S.A." } },
        },
      ]);
      prisma.salidaDetalle.findMany.mockResolvedValueOnce([
        {
          idDetalleSalida: 1,
          idSalida: 21,
          sku: "FRE-001",
          cantidad: 1,
          precioVenta: 450,
          fecCompra: new Date("2026-09-10"),
          articulo: { nombre: "Pastillas" },
          tipoSalida: { idTipoSalida: 1, descripcion: "Venta" },
          salidaMaestro: { anulada: false },
        },
      ]);

      const resultado = await listarMovimientos({ ocultarDatosSensibles: false });

      expect(resultado.movimientos[0]).toMatchObject({ id: 21, anulada: false });
      expect(resultado.movimientos[1]).toMatchObject({ id: 10, anulada: true });
    });

    it("pagina el resultado combinado (compras + salidas) ya ordenado", async () => {
      const compras = Array.from({ length: 3 }, (_, i) => ({
        idDetalleCompra: i,
        idCompra: i,
        sku: "FRE-001",
        cantidad: 1,
        precioCompra: 10,
        fecCompra: new Date(`2026-09-0${i + 1}`),
        articulo: { nombre: "Pastillas" },
        compraMaestro: { anulada: false, proveedor: null },
      }));
      prisma.compraDetalle.findMany.mockResolvedValueOnce(compras);
      prisma.salidaDetalle.findMany.mockResolvedValueOnce([]);

      const resultado = await listarMovimientos({ pagina: 1, porPagina: 2 });

      expect(resultado.movimientos).toHaveLength(2);
      expect(resultado.paginacion).toEqual({ pagina: 1, porPagina: 2, total: 3, totalPaginas: 2 });
      // Más reciente primero: día 03 y 02 en la página 1.
      expect(resultado.movimientos[0].id).toBe(2);
      expect(resultado.movimientos[1].id).toBe(1);
    });
  });

  it("MovimientoError conserva el statusCode", () => {
    const error = new MovimientoError("mensaje", 418);
    expect(error.statusCode).toBe(418);
  });

  describe("obtenerComparacionVentas", () => {
    it("rechaza si no se indica ningún sku", async () => {
      await expect(obtenerComparacionVentas([])).rejects.toMatchObject({ statusCode: 400 });
    });

    it("rechaza más de 10 skus a la vez", async () => {
      const muchos = Array.from({ length: 11 }, (_, i) => `SKU-${i}`);
      await expect(obtenerComparacionVentas(muchos)).rejects.toMatchObject({ statusCode: 400 });
    });

    it("acepta hasta 10 skus", async () => {
      const diez = Array.from({ length: 10 }, (_, i) => `SKU-${i}`);
      prisma.articulo.findMany.mockResolvedValueOnce(diez.map((sku) => ({ sku, nombre: sku })));
      prisma.salidaDetalle.findMany.mockResolvedValueOnce([]);

      await expect(obtenerComparacionVentas(diez)).resolves.toBeDefined();
    });

    it("rechaza con 400 si algún sku no existe", async () => {
      prisma.articulo.findMany.mockResolvedValueOnce([{ sku: "A" }]);

      await expect(obtenerComparacionVentas(["A", "B"])).rejects.toMatchObject({
        message: "Uno o más repuestos indicados no existen",
        statusCode: 400,
      });
    });

    it("filtra SOLO ventas y agrega cantidad por sku y por día", async () => {
      prisma.articulo.findMany.mockResolvedValueOnce([
        { sku: "A", nombre: "Producto A" },
        { sku: "B", nombre: "Producto B" },
      ]);
      prisma.salidaDetalle.findMany.mockResolvedValueOnce([
        { sku: "A", cantidad: 3, salidaMaestro: { fechaSalida: new Date("2026-09-01T10:00:00Z") } },
        { sku: "A", cantidad: 2, salidaMaestro: { fechaSalida: new Date("2026-09-01T18:00:00Z") } },
        { sku: "A", cantidad: 4, salidaMaestro: { fechaSalida: new Date("2026-09-02T10:00:00Z") } },
        { sku: "B", cantidad: 1, salidaMaestro: { fechaSalida: new Date("2026-09-02T10:00:00Z") } },
      ]);

      const resultado = await obtenerComparacionVentas(["A", "B"]);

      expect(prisma.salidaDetalle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sku: { in: ["A", "B"] }, idTipoSalida: 1, salidaMaestro: { anulada: false } },
        }),
      );

      // El orden de las series sigue el orden de `skus` recibido (orden de
      // selección en el frontend), no el orden alfabético/catálogo.
      expect(resultado.series.map((s) => s.sku)).toEqual(["A", "B"]);
      const serieA = resultado.series.find((s) => s.sku === "A");
      const serieB = resultado.series.find((s) => s.sku === "B");
      expect(serieA.puntos).toEqual([
        { fecha: "2026-09-01", cantidad: 5 },
        { fecha: "2026-09-02", cantidad: 4 },
      ]);
      expect(serieA.total).toBe(9);
      expect(serieB.puntos).toEqual([{ fecha: "2026-09-02", cantidad: 1 }]);
      expect(serieB.total).toBe(1);
    });

    it("filtra por fechaSalida cuando se indican fechaDesde/fechaHasta", async () => {
      prisma.articulo.findMany.mockResolvedValueOnce([{ sku: "A", nombre: "Producto A" }]);
      prisma.salidaDetalle.findMany.mockResolvedValueOnce([]);

      await obtenerComparacionVentas(["A"], { fechaDesde: "2026-09-01", fechaHasta: "2026-09-14" });

      expect(prisma.salidaDetalle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            salidaMaestro: {
              anulada: false,
              fechaSalida: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
            },
          }),
        }),
      );
    });
  });
});
