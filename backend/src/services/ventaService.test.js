jest.mock("../utils/prismaClient", () => ({
  cliente: { findUnique: jest.fn() },
  inventario: { findMany: jest.fn(), update: jest.fn() },
  salidaMaestro: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(),
}));

const prisma = require("../utils/prismaClient");
const { VentaError, crearVenta, obtenerVentaPorId, listarVentas, anularVenta } = require("./ventaService");

const LINEA_VALIDA = { sku: "FRE-001", cantidad: 2, precioVenta: 150 };

function mockTransaccionExitosa() {
  const txCreateVenta = jest.fn();
  const txCreateDetalle = jest.fn();
  const txUpdateInventario = jest.fn();

  prisma.$transaction.mockImplementationOnce(async (callback) =>
    callback({
      salidaMaestro: { aggregate: jest.fn().mockResolvedValue({ _max: { idVenta: 0 } }), create: txCreateVenta },
      salidaDetalle: {
        aggregate: jest.fn().mockResolvedValue({ _max: { idDetalleSalida: 0 } }),
        create: txCreateDetalle,
      },
      inventario: { update: txUpdateInventario },
    }),
  );

  return { txCreateVenta, txCreateDetalle, txUpdateInventario };
}

describe("ventaService", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("crearVenta", () => {
    it("rechaza una venta sin líneas", async () => {
      await expect(crearVenta(1, { lineas: [] })).rejects.toMatchObject({ statusCode: 400 });
    });

    it("rechaza con 400 si el cliente indicado no existe", async () => {
      prisma.cliente.findUnique.mockResolvedValueOnce(null);

      await expect(crearVenta(1, { idCliente: 99, lineas: [LINEA_VALIDA] })).rejects.toMatchObject({
        message: "El cliente indicado no existe",
        statusCode: 400,
      });
    });

    it("rechaza con 400 si el stock es insuficiente", async () => {
      prisma.inventario.findMany.mockResolvedValueOnce([{ sku: "FRE-001", cantidad: 1 }]);

      await expect(crearVenta(1, { lineas: [LINEA_VALIDA] })).rejects.toMatchObject({ statusCode: 400 });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("HU-13: registra una venta con varias líneas, calcula el total y descuenta stock de cada una", async () => {
      const linea2 = { sku: "FIL-002", cantidad: 1, precioVenta: 50 };
      prisma.inventario.findMany.mockResolvedValueOnce([
        { sku: "FRE-001", cantidad: 10 },
        { sku: "FIL-002", cantidad: 5 },
      ]);
      const { txCreateVenta, txCreateDetalle, txUpdateInventario } = mockTransaccionExitosa();
      prisma.salidaMaestro.findUnique.mockResolvedValueOnce({
        idVenta: 1,
        fechaSalida: new Date(),
        montoTotalVenta: 350,
        cliente: null,
        colaborador: null,
        detalles: [
          { idDetalleSalida: 1, sku: "FRE-001", cantidad: 2, precioVenta: 150, idTipoSalida: 1, articulo: { nombre: "Pastillas" } },
          { idDetalleSalida: 2, sku: "FIL-002", cantidad: 1, precioVenta: 50, idTipoSalida: 1, articulo: { nombre: "Filtro" } },
        ],
      });

      const resultado = await crearVenta(2, { lineas: [LINEA_VALIDA, linea2] });

      expect(txCreateVenta).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ idVenta: 1, montoTotalVenta: 350, idColaborador: 2 }),
        }),
      );
      expect(txCreateDetalle).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ sku: "FRE-001", idTipoSalida: 1 }) }),
      );
      expect(txCreateDetalle).toHaveBeenCalledTimes(2);
      expect(txUpdateInventario).toHaveBeenCalledWith({
        where: { sku: "FRE-001" },
        data: { cantidad: { decrement: 2 } },
      });
      expect(txUpdateInventario).toHaveBeenCalledWith({
        where: { sku: "FIL-002" },
        data: { cantidad: { decrement: 1 } },
      });
      expect(resultado.montoTotalVenta).toBe(350);
      expect(resultado.lineas).toHaveLength(2);
    });
  });

  describe("obtenerVentaPorId", () => {
    it("lanza 404 si no existe", async () => {
      prisma.salidaMaestro.findUnique.mockResolvedValueOnce(null);

      await expect(obtenerVentaPorId(99)).rejects.toMatchObject({ statusCode: 404 });
    });

    it("lanza 404 si el id corresponde a un ajuste (no una venta)", async () => {
      prisma.salidaMaestro.findUnique.mockResolvedValueOnce({ idVenta: 1, detalles: [{ idTipoSalida: 2 }] });

      await expect(obtenerVentaPorId(1)).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe("listarVentas", () => {
    it("filtra solo salidas donde todas las líneas sean de tipo Venta, y pagina", async () => {
      prisma.salidaMaestro.count.mockResolvedValueOnce(0);
      prisma.salidaMaestro.findMany.mockResolvedValueOnce([]);

      await listarVentas({});

      const whereEsperado = { detalles: { every: { idTipoSalida: 1 } } };
      expect(prisma.salidaMaestro.count).toHaveBeenCalledWith({ where: whereEsperado });
      expect(prisma.salidaMaestro.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: whereEsperado }),
      );
    });

    it("filtra por fechaSalida cuando se indican fechaDesde/fechaHasta", async () => {
      prisma.salidaMaestro.count.mockResolvedValueOnce(0);
      prisma.salidaMaestro.findMany.mockResolvedValueOnce([]);

      await listarVentas({ fechaDesde: "2026-09-01", fechaHasta: "2026-09-14" });

      expect(prisma.salidaMaestro.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          fechaSalida: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
        }),
      });
    });

    it("rechaza una fechaDesde inválida con 400", async () => {
      await expect(listarVentas({ fechaDesde: "no-es-fecha" })).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe("anularVenta", () => {
    function mockTransaccionAnular() {
      const txUpdateInventario = jest.fn();
      const txUpdateSalidaMaestro = jest.fn();
      prisma.$transaction.mockImplementationOnce(async (callback) =>
        callback({
          inventario: { update: txUpdateInventario },
          salidaMaestro: { update: txUpdateSalidaMaestro },
        }),
      );
      return { txUpdateInventario, txUpdateSalidaMaestro };
    }

    it("lanza 404 si la venta no existe", async () => {
      prisma.salidaMaestro.findUnique.mockResolvedValueOnce(null);

      await expect(anularVenta(99)).rejects.toMatchObject({ statusCode: 404 });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("lanza 404 si el id corresponde a un ajuste (no una venta)", async () => {
      prisma.salidaMaestro.findUnique.mockResolvedValueOnce({
        idVenta: 1,
        anulada: false,
        detalles: [{ idTipoSalida: 2 }],
      });

      await expect(anularVenta(1)).rejects.toMatchObject({ statusCode: 404 });
    });

    it("rechaza con 400 si la venta ya está anulada", async () => {
      prisma.salidaMaestro.findUnique.mockResolvedValueOnce({
        idVenta: 1,
        anulada: true,
        detalles: [{ sku: "FRE-001", cantidad: 2, idTipoSalida: 1 }],
      });

      await expect(anularVenta(1)).rejects.toMatchObject({
        message: "La venta ya está anulada",
        statusCode: 400,
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("HU-14: restaura el stock de cada línea y marca la venta como anulada", async () => {
      prisma.salidaMaestro.findUnique.mockResolvedValueOnce({
        idVenta: 1,
        anulada: false,
        detalles: [
          { sku: "FRE-001", cantidad: 2, idTipoSalida: 1 },
          { sku: "FIL-002", cantidad: 1, idTipoSalida: 1 },
        ],
      });
      const { txUpdateInventario, txUpdateSalidaMaestro } = mockTransaccionAnular();
      prisma.salidaMaestro.findUnique.mockResolvedValueOnce({
        idVenta: 1,
        anulada: true,
        fechaSalida: new Date(),
        montoTotalVenta: 350,
        cliente: null,
        colaborador: null,
        detalles: [
          { idDetalleSalida: 1, sku: "FRE-001", cantidad: 2, precioVenta: 150, idTipoSalida: 1, articulo: { nombre: "Pastillas" } },
        ],
      });

      const resultado = await anularVenta(1);

      expect(txUpdateInventario).toHaveBeenCalledWith({
        where: { sku: "FRE-001" },
        data: { cantidad: { increment: 2 } },
      });
      expect(txUpdateInventario).toHaveBeenCalledWith({
        where: { sku: "FIL-002" },
        data: { cantidad: { increment: 1 } },
      });
      expect(txUpdateSalidaMaestro).toHaveBeenCalledWith({
        where: { idVenta: 1 },
        data: { anulada: true },
      });
      expect(resultado.anulada).toBe(true);
    });
  });

  it("VentaError conserva el statusCode", () => {
    const error = new VentaError("mensaje", 418);
    expect(error.statusCode).toBe(418);
  });
});
