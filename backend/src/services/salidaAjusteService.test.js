jest.mock("../utils/prismaClient", () => ({
  tipoSalida: { findUnique: jest.fn(), findMany: jest.fn() },
  inventario: { findMany: jest.fn(), update: jest.fn() },
  salidaMaestro: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(),
}));

const prisma = require("../utils/prismaClient");
const {
  SalidaAjusteError,
  crearSalidaAjuste,
  obtenerSalidaAjustePorId,
  listarSalidasAjuste,
  anularSalidaAjuste,
} = require("./salidaAjusteService");

const TIPO_MERMA = { idTipoSalida: 2, descripcion: "Merma" };
const TIPO_GARANTIA = { idTipoSalida: 4, descripcion: "Garantía" };
const LINEA_VALIDA = { sku: "FRE-001", cantidad: 2, idTipoSalida: 2 };

function mockTransaccionExitosa() {
  const txCreateSalida = jest.fn();
  const txCreateDetalle = jest.fn();
  const txUpdateInventario = jest.fn();

  prisma.$transaction.mockImplementationOnce(async (callback) =>
    callback({
      salidaMaestro: { aggregate: jest.fn().mockResolvedValue({ _max: { idVenta: 0 } }), create: txCreateSalida },
      salidaDetalle: {
        aggregate: jest.fn().mockResolvedValue({ _max: { idDetalleSalida: 0 } }),
        create: txCreateDetalle,
      },
      inventario: { update: txUpdateInventario },
    }),
  );

  return { txCreateSalida, txCreateDetalle, txUpdateInventario };
}

describe("salidaAjusteService", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("crearSalidaAjuste", () => {
    it("rechaza una salida sin líneas", async () => {
      await expect(crearSalidaAjuste(1, { lineas: [] })).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("rechaza si una línea no indica idTipoSalida", async () => {
      await expect(
        crearSalidaAjuste(1, { lineas: [{ sku: "FRE-001", cantidad: 2 }] }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("rechaza con 400 si el motivo de alguna línea no existe", async () => {
      prisma.tipoSalida.findMany.mockResolvedValueOnce([]);

      await expect(
        crearSalidaAjuste(1, { lineas: [{ sku: "FRE-001", cantidad: 2, idTipoSalida: 99 }] }),
      ).rejects.toMatchObject({ message: 'El motivo indicado en la línea "FRE-001" no existe', statusCode: 400 });
    });

    it("rechaza si alguna línea usa el motivo Venta — ese flujo va por /api/ventas", async () => {
      prisma.tipoSalida.findMany.mockResolvedValueOnce([{ idTipoSalida: 1, descripcion: "Venta" }]);

      await expect(
        crearSalidaAjuste(1, { lineas: [{ sku: "FRE-001", cantidad: 2, idTipoSalida: 1 }] }),
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("rechaza con 400 si el stock es insuficiente", async () => {
      prisma.tipoSalida.findMany.mockResolvedValueOnce([TIPO_MERMA]);
      prisma.inventario.findMany.mockResolvedValueOnce([{ sku: "FRE-001", cantidad: 1 }]);

      await expect(
        crearSalidaAjuste(1, { lineas: [{ sku: "FRE-001", cantidad: 5, idTipoSalida: 2 }] }),
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("HU-09: registra la salida con líneas de distinto motivo y descuenta stock de cada una", async () => {
      const linea2 = { sku: "FIL-002", cantidad: 1, idTipoSalida: 4 };
      prisma.tipoSalida.findMany.mockResolvedValueOnce([TIPO_MERMA, TIPO_GARANTIA]);
      prisma.inventario.findMany.mockResolvedValueOnce([
        { sku: "FRE-001", cantidad: 10 },
        { sku: "FIL-002", cantidad: 5 },
      ]);
      const { txCreateSalida, txCreateDetalle, txUpdateInventario } = mockTransaccionExitosa();
      prisma.salidaMaestro.findUnique.mockResolvedValueOnce({
        idVenta: 1,
        fechaSalida: new Date(),
        colaborador: null,
        detalles: [
          { idDetalleSalida: 1, sku: "FRE-001", cantidad: 2, articulo: { nombre: "Pastillas" }, tipoSalida: TIPO_MERMA },
          { idDetalleSalida: 2, sku: "FIL-002", cantidad: 1, articulo: { nombre: "Filtro" }, tipoSalida: TIPO_GARANTIA },
        ],
      });

      const resultado = await crearSalidaAjuste(1, { lineas: [LINEA_VALIDA, linea2] });

      expect(txCreateSalida).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ idVenta: 1 }) }),
      );
      expect(txCreateSalida).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.not.objectContaining({ idTipoSalida: expect.anything() }) }),
      );
      expect(txCreateDetalle).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ sku: "FRE-001", cantidad: 2, idTipoSalida: 2 }) }),
      );
      expect(txCreateDetalle).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ sku: "FIL-002", cantidad: 1, idTipoSalida: 4 }) }),
      );
      expect(txUpdateInventario).toHaveBeenCalledWith({
        where: { sku: "FRE-001" },
        data: { cantidad: { decrement: 2 } },
      });
      expect(resultado.lineas).toHaveLength(2);
      expect(resultado.lineas[0].tipoSalida.descripcion).toBe("Merma");
      expect(resultado.lineas[1].tipoSalida.descripcion).toBe("Garantía");
    });
  });

  describe("obtenerSalidaAjustePorId", () => {
    it("lanza 404 si no existe", async () => {
      prisma.salidaMaestro.findUnique.mockResolvedValueOnce(null);

      await expect(obtenerSalidaAjustePorId(99)).rejects.toMatchObject({ statusCode: 404 });
    });

    it("lanza 404 si alguna línea usa el motivo Venta (es una venta, no un ajuste)", async () => {
      prisma.salidaMaestro.findUnique.mockResolvedValueOnce({
        idVenta: 1,
        detalles: [{ idTipoSalida: 1 }],
      });

      await expect(obtenerSalidaAjustePorId(1)).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe("listarSalidasAjuste", () => {
    it("excluye las salidas donde alguna línea sea de tipo Venta", async () => {
      prisma.salidaMaestro.findMany.mockResolvedValueOnce([]);

      await listarSalidasAjuste();

      expect(prisma.salidaMaestro.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { detalles: { every: { idTipoSalida: { not: 1 } } } } }),
      );
    });

    it("filtra por fechaSalida cuando se indican fechaDesde/fechaHasta", async () => {
      prisma.salidaMaestro.findMany.mockResolvedValueOnce([]);

      await listarSalidasAjuste({ fechaDesde: "2026-09-01", fechaHasta: "2026-09-14" });

      expect(prisma.salidaMaestro.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ fechaSalida: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }) }),
        }),
      );
    });
  });

  describe("anularSalidaAjuste", () => {
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

    it("lanza 404 si no existe", async () => {
      prisma.salidaMaestro.findUnique.mockResolvedValueOnce(null);

      await expect(anularSalidaAjuste(99)).rejects.toMatchObject({ statusCode: 404 });
    });

    it("lanza 404 si alguna línea es de tipo Venta (es una venta, no un ajuste)", async () => {
      prisma.salidaMaestro.findUnique.mockResolvedValueOnce({
        idVenta: 1,
        anulada: false,
        detalles: [{ sku: "FRE-001", cantidad: 1, idTipoSalida: 1 }],
      });

      await expect(anularSalidaAjuste(1)).rejects.toMatchObject({ statusCode: 404 });
    });

    it("rechaza con 400 si ya está anulada", async () => {
      prisma.salidaMaestro.findUnique.mockResolvedValueOnce({
        idVenta: 1,
        anulada: true,
        detalles: [{ sku: "FRE-001", cantidad: 1, idTipoSalida: 2 }],
      });

      await expect(anularSalidaAjuste(1)).rejects.toMatchObject({
        message: "La salida ya está anulada",
        statusCode: 400,
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("restaura el stock de cada línea y marca la salida como anulada", async () => {
      prisma.salidaMaestro.findUnique.mockResolvedValueOnce({
        idVenta: 1,
        anulada: false,
        detalles: [{ sku: "FRE-001", cantidad: 2, idTipoSalida: 2 }],
      });
      const { txUpdateInventario, txUpdateSalidaMaestro } = mockTransaccionAnular();
      prisma.salidaMaestro.findUnique.mockResolvedValueOnce({
        idVenta: 1,
        anulada: true,
        fechaSalida: new Date(),
        colaborador: null,
        detalles: [],
      });

      const resultado = await anularSalidaAjuste(1);

      expect(txUpdateInventario).toHaveBeenCalledWith({
        where: { sku: "FRE-001" },
        data: { cantidad: { increment: 2 } },
      });
      expect(txUpdateSalidaMaestro).toHaveBeenCalledWith({
        where: { idVenta: 1 },
        data: { anulada: true },
      });
      expect(resultado.anulada).toBe(true);
    });
  });

  it("SalidaAjusteError conserva el statusCode", () => {
    const error = new SalidaAjusteError("mensaje", 418);
    expect(error.statusCode).toBe(418);
  });
});
