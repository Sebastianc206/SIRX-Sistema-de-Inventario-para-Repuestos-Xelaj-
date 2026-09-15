jest.mock("../utils/prismaClient", () => ({
  proveedor: { findUnique: jest.fn() },
  articulo: { findMany: jest.fn() },
  inventario: { findMany: jest.fn(), update: jest.fn() },
  compraMaestro: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(),
}));

const prisma = require("../utils/prismaClient");
const { CompraError, crearCompra, obtenerCompraPorId, listarCompras, anularCompra } = require("./compraService");

const PROVEEDOR = { idProveedor: 1, nombre: "Repuestos Guate S.A." };
const LINEA_VALIDA = { sku: "FRE-001", cantidad: 5, precioCompra: 20 };

function mockTransaccionExitosa() {
  const txCreateCompra = jest.fn();
  const txCreateDetalle = jest.fn();
  const txUpdateInventario = jest.fn();

  prisma.$transaction.mockImplementationOnce(async (callback) =>
    callback({
      compraMaestro: { aggregate: jest.fn().mockResolvedValue({ _max: { idCompra: 0 } }), create: txCreateCompra },
      compraDetalle: {
        aggregate: jest.fn().mockResolvedValue({ _max: { idDetalleCompra: 0 } }),
        create: txCreateDetalle,
      },
      inventario: { update: txUpdateInventario },
    }),
  );

  return { txCreateCompra, txCreateDetalle, txUpdateInventario };
}

describe("compraService", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("crearCompra", () => {
    it("rechaza si no se indica idProveedor", async () => {
      await expect(crearCompra(1, { lineas: [LINEA_VALIDA] })).rejects.toMatchObject({
        message: "idProveedor es requerido",
        statusCode: 400,
      });
    });

    it("rechaza una compra sin líneas", async () => {
      await expect(crearCompra(1, { idProveedor: 1, lineas: [] })).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("rechaza una línea con cantidad no entera/positiva", async () => {
      await expect(
        crearCompra(1, { idProveedor: 1, lineas: [{ ...LINEA_VALIDA, cantidad: 0 }] }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("rechaza si el sku se repite entre líneas", async () => {
      prisma.proveedor.findUnique.mockResolvedValueOnce(PROVEEDOR);

      await expect(
        crearCompra(1, { idProveedor: 1, lineas: [LINEA_VALIDA, LINEA_VALIDA] }),
      ).rejects.toMatchObject({
        message: "No repitas el mismo sku en dos líneas de la misma compra",
        statusCode: 400,
      });
    });

    it("rechaza con 400 si el proveedor no existe", async () => {
      prisma.proveedor.findUnique.mockResolvedValueOnce(null);

      await expect(crearCompra(1, { idProveedor: 99, lineas: [LINEA_VALIDA] })).rejects.toMatchObject({
        message: "El proveedor indicado no existe",
        statusCode: 400,
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("rechaza con 400 si algún sku no existe", async () => {
      prisma.proveedor.findUnique.mockResolvedValueOnce(PROVEEDOR);
      prisma.articulo.findMany.mockResolvedValueOnce([]);

      await expect(crearCompra(1, { idProveedor: 1, lineas: [LINEA_VALIDA] })).rejects.toMatchObject({
        message: "Uno o más repuestos indicados no existen",
        statusCode: 400,
      });
    });

    it("HU-08: crea la compra, calcula el total y suma el stock de cada línea", async () => {
      prisma.proveedor.findUnique.mockResolvedValueOnce(PROVEEDOR);
      prisma.articulo.findMany.mockResolvedValueOnce([{ sku: "FRE-001" }]);
      const { txCreateCompra, txCreateDetalle, txUpdateInventario } = mockTransaccionExitosa();
      prisma.compraMaestro.findUnique.mockResolvedValueOnce({
        idCompra: 1,
        fechaCompra: new Date(),
        montoTotalCompra: 100,
        proveedor: PROVEEDOR,
        colaborador: { idColaborador: 1, nombres: "Ana", primerApel: "Pérez" },
        detalles: [{ idDetalleCompra: 1, sku: "FRE-001", cantidad: 5, precioCompra: 20, articulo: { nombre: "Pastillas" } }],
      });

      const resultado = await crearCompra(1, { idProveedor: 1, lineas: [LINEA_VALIDA] });

      expect(txCreateCompra).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ idCompra: 1, montoTotalCompra: 100, idProveedor: 1 }) }),
      );
      expect(txCreateDetalle).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ idCompra: 1, sku: "FRE-001", cantidad: 5, precioCompra: 20 }),
        }),
      );
      expect(txUpdateInventario).toHaveBeenCalledWith({
        where: { sku: "FRE-001" },
        data: { cantidad: { increment: 5 } },
      });
      expect(resultado.montoTotalCompra).toBe(100);
      expect(resultado.lineas).toHaveLength(1);
    });
  });

  describe("obtenerCompraPorId", () => {
    it("lanza 404 si la compra no existe", async () => {
      prisma.compraMaestro.findUnique.mockResolvedValueOnce(null);

      await expect(obtenerCompraPorId(99, { ocultarDatosSensibles: false })).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("oculta montoTotalCompra y precioCompra cuando ocultarDatosSensibles es true", async () => {
      prisma.compraMaestro.findUnique.mockResolvedValueOnce({
        idCompra: 1,
        fechaCompra: new Date(),
        montoTotalCompra: 100,
        proveedor: PROVEEDOR,
        colaborador: null,
        detalles: [{ idDetalleCompra: 1, sku: "FRE-001", cantidad: 5, precioCompra: 20, articulo: { nombre: "Pastillas" } }],
      });

      const resultado = await obtenerCompraPorId(1, { ocultarDatosSensibles: true });

      expect(resultado.montoTotalCompra).toBeUndefined();
      expect(resultado.lineas[0].precioCompra).toBeUndefined();
    });
  });

  describe("listarCompras", () => {
    it("pagina y formatea el historial de compras", async () => {
      prisma.compraMaestro.count.mockResolvedValueOnce(1);
      prisma.compraMaestro.findMany.mockResolvedValueOnce([
        {
          idCompra: 1,
          fechaCompra: new Date(),
          montoTotalCompra: 100,
          proveedor: PROVEEDOR,
          colaborador: null,
          detalles: [],
        },
      ]);

      const resultado = await listarCompras({ ocultarDatosSensibles: false });

      expect(resultado.compras).toHaveLength(1);
      expect(resultado.paginacion).toEqual({ pagina: 1, porPagina: 20, total: 1, totalPaginas: 1 });
    });
  });

  describe("anularCompra", () => {
    function mockTransaccionAnular() {
      const txUpdateInventario = jest.fn();
      const txUpdateCompraMaestro = jest.fn();
      prisma.$transaction.mockImplementationOnce(async (callback) =>
        callback({
          inventario: { update: txUpdateInventario },
          compraMaestro: { update: txUpdateCompraMaestro },
        }),
      );
      return { txUpdateInventario, txUpdateCompraMaestro };
    }

    it("lanza 404 si la compra no existe", async () => {
      prisma.compraMaestro.findUnique.mockResolvedValueOnce(null);

      await expect(anularCompra(99)).rejects.toMatchObject({ statusCode: 404 });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("rechaza con 400 si la compra ya está anulada", async () => {
      prisma.compraMaestro.findUnique.mockResolvedValueOnce({
        idCompra: 1,
        anulada: true,
        detalles: [{ sku: "FRE-001", cantidad: 5 }],
      });

      await expect(anularCompra(1)).rejects.toMatchObject({
        message: "La compra ya está anulada",
        statusCode: 400,
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("rechaza con 400 si anular dejaría el stock negativo (ya se vendió parte)", async () => {
      prisma.compraMaestro.findUnique.mockResolvedValueOnce({
        idCompra: 1,
        anulada: false,
        detalles: [{ sku: "FRE-001", cantidad: 5 }],
      });
      prisma.inventario.findMany.mockResolvedValueOnce([{ sku: "FRE-001", cantidad: 2 }]);

      await expect(anularCompra(1)).rejects.toMatchObject({ statusCode: 400 });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("HU-08: decrementa el stock de cada línea y marca la compra como anulada", async () => {
      prisma.compraMaestro.findUnique.mockResolvedValueOnce({
        idCompra: 1,
        anulada: false,
        detalles: [
          { sku: "FRE-001", cantidad: 5 },
          { sku: "FIL-002", cantidad: 2 },
        ],
      });
      prisma.inventario.findMany.mockResolvedValueOnce([
        { sku: "FRE-001", cantidad: 10 },
        { sku: "FIL-002", cantidad: 5 },
      ]);
      const { txUpdateInventario, txUpdateCompraMaestro } = mockTransaccionAnular();
      prisma.compraMaestro.findUnique.mockResolvedValueOnce({
        idCompra: 1,
        anulada: true,
        fechaCompra: new Date(),
        montoTotalCompra: 100,
        proveedor: null,
        colaborador: null,
        detalles: [],
      });

      const resultado = await anularCompra(1);

      expect(txUpdateInventario).toHaveBeenCalledWith({
        where: { sku: "FRE-001" },
        data: { cantidad: { decrement: 5 } },
      });
      expect(txUpdateInventario).toHaveBeenCalledWith({
        where: { sku: "FIL-002" },
        data: { cantidad: { decrement: 2 } },
      });
      expect(txUpdateCompraMaestro).toHaveBeenCalledWith({
        where: { idCompra: 1 },
        data: { anulada: true },
      });
      expect(resultado.anulada).toBe(true);
    });
  });

  it("CompraError conserva el statusCode", () => {
    const error = new CompraError("mensaje", 418);
    expect(error.message).toBe("mensaje");
    expect(error.statusCode).toBe(418);
  });
});
