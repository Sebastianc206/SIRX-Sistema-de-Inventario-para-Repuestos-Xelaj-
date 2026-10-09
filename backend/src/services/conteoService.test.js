jest.mock("../utils/prismaClient", () => ({
  categoria: { findUnique: jest.fn() },
  articulo: { count: jest.fn() },
  conteoFisico: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  $transaction: jest.fn(),
}));

const prisma = require("../utils/prismaClient");
const svc = require("./conteoService");

// Transacción simulada: reproduce lo que el servicio pide a `tx`.
function mockTx({ estado = "borrador", idCategoria = null, lineas = [], articulos = [], existentes = [], stockTras = {} } = {}) {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue(estado === null ? [] : [{ estado, idCategoria }]),
    articulo: { findMany: jest.fn().mockResolvedValue(articulos) },
    conteoDetalle: {
      findMany: jest.fn().mockImplementation(async (args) => (args.include ? lineas : existentes)),
      aggregate: jest.fn().mockResolvedValue({ _max: { idDetalleConteo: 10 } }),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    conteoFisico: {
      aggregate: jest.fn().mockResolvedValue({ _max: { idConteo: 4 } }),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    inventario: {
      update: jest.fn().mockImplementation(async ({ where, data }) => ({
        sku: where.sku,
        cantidad: stockTras[where.sku] ?? data.cantidad.increment,
      })),
    },
  };
  prisma.$transaction.mockImplementationOnce(async (cb) => cb(tx));
  return tx;
}

// obtenerConteo (se llama al final de cada operación) se resuelve con un conteo vacío.
function mockObtener() {
  prisma.conteoFisico.findUnique.mockResolvedValue({
    idConteo: 5, nombre: "T", fechaConteo: new Date(), estado: "aplicado", idCategoria: null,
    categoria: null, creador: null, cierre: null, fechaCierre: null, detalles: [],
  });
  prisma.articulo.count.mockResolvedValue(0);
}

const linea = (sku, sistema, contada, stockActual = sistema) => ({
  idDetalleConteo: Number(sku.replace(/\D/g, "")) || 1,
  sku,
  cantidadSistema: sistema,
  cantidadContada: contada,
  articulo: { nombre: sku, precioCosto: 10, inventario: { cantidad: stockActual } },
});

describe("conteoService", () => {
  beforeEach(() => mockObtener());
  afterEach(() => jest.resetAllMocks());

  describe("calcularResumen (exactitud y meta del 5 %)", () => {
    it("calcula exactitud, diferencia agregada y valorización con datos conocidos", () => {
      // sistema: 100+50+50 = 200 ; |dif| = 0 + 4 + 6 = 10 -> 5 % (cumple, es <= 5)
      const r = svc.calcularResumen([
        { cantidadSistema: 100, cantidadContada: 100, costo: 2 },
        { cantidadSistema: 50, cantidadContada: 46, costo: 10 }, // -4
        { cantidadSistema: 50, cantidadContada: 56, costo: 5 }, // +6
      ]);
      expect(r).toMatchObject({
        productosContados: 3, productosExactos: 1, productosConDiferencia: 2,
        unidadesFaltantes: 4, unidadesSobrantes: 6, unidadesDiferenciaAbs: 10,
        exactitudPct: 33.33, diferenciaPct: 5, metaPct: 5, cumpleMeta: true,
        valorDiferenciaNeto: -10, valorDiferenciaAbsoluto: 70,
      });
    });

    it("no cumple la meta si la diferencia agregada supera el 5 %", () => {
      const r = svc.calcularResumen([{ cantidadSistema: 100, cantidadContada: 93 }]);
      expect(r.diferenciaPct).toBe(7);
      expect(r.cumpleMeta).toBe(false);
    });

    it("sin líneas no inventa porcentajes", () => {
      expect(svc.calcularResumen([])).toMatchObject({ exactitudPct: null, diferenciaPct: null, cumpleMeta: null });
    });

    it("sistema en 0 con unidades contadas es 100 % de diferencia", () => {
      expect(svc.calcularResumen([{ cantidadSistema: 0, cantidadContada: 3 }]).diferenciaPct).toBe(100);
    });
  });

  describe("clasificarDiferencia", () => {
    it.each([
      [0, 10, "exacto"],
      [-1, 20, "leve"],
      [-2, 20, "alto"],
      [1, 0, "alto"],
    ])("dif %i sobre %i -> %s", (dif, sis, esperado) => {
      expect(svc.clasificarDiferencia(dif, sis)).toBe(esperado);
    });
  });

  describe("crearConteo", () => {
    it.each([[undefined], [""], ["ab"], ["x".repeat(81)], [123]])("rechaza nombre inválido %p", async (nombre) => {
      await expect(svc.crearConteo(1, { nombre })).rejects.toMatchObject({ statusCode: 400 });
    });

    it("rechaza categoría inexistente, id con tipo inválido o fecha inválida", async () => {
      prisma.categoria.findUnique.mockResolvedValueOnce(null);
      await expect(svc.crearConteo(1, { nombre: "Conteo", idCategoria: 99 })).rejects.toMatchObject({ statusCode: 400 });
      await expect(svc.crearConteo(1, { nombre: "Conteo", idCategoria: "1; DROP" })).rejects.toMatchObject({ statusCode: 400 });
      await expect(svc.crearConteo(1, { nombre: "Conteo", fechaConteo: "no-fecha" })).rejects.toMatchObject({ statusCode: 400 });
    });

    it("crea un borrador con el siguiente id y el colaborador de la sesión", async () => {
      prisma.categoria.findUnique.mockResolvedValueOnce({ idCategoria: 2 });
      const tx = mockTx();
      await svc.crearConteo(9, { nombre: "  Frenos octubre ", idCategoria: 2 });
      expect(tx.conteoFisico.create.mock.calls[0][0].data).toMatchObject({
        idConteo: 5, nombre: "Frenos octubre", estado: "borrador", idCategoria: 2, idColaborador: 9,
      });
    });
  });

  describe("listarConteos", () => {
    it("rechaza estados desconocidos", async () => {
      await expect(svc.listarConteos({ estado: "x" })).rejects.toMatchObject({ statusCode: 400 });
    });

    it("devuelve el resumen de cada conteo", async () => {
      prisma.conteoFisico.count.mockResolvedValue(1);
      prisma.conteoFisico.findMany.mockResolvedValue([
        { idConteo: 1, nombre: "A", estado: "borrador", detalles: [{ cantidadSistema: 10, cantidadContada: 10, articulo: { precioCosto: 1 } }] },
      ]);
      const r = await svc.listarConteos({});
      expect(r.conteos[0].resumen).toMatchObject({ productosContados: 1, exactitudPct: 100, cumpleMeta: true });
      expect(r.paginacion.total).toBe(1);
    });
  });

  describe("guardarLineas", () => {
    const art = (sku, extra = {}) => ({ sku, estado: true, idCategoria: 1, inventario: { cantidad: 8 }, ...extra });

    it.each([
      [[]],
      [[{ sku: "A-1", cantidad: -1 }]],
      [[{ sku: "A-1", cantidad: 1.5 }]],
      [[{ sku: "A-1", cantidad: "3" }]],
      [[{ sku: "A-1", cantidad: 1_000_001 }]],
      [[{ sku: "A 1", cantidad: 1 }]],
      [[{ sku: "A-1", cantidad: 1 }, { sku: "A-1", cantidad: 2 }]],
      [Array.from({ length: 201 }, (_, i) => ({ sku: `S-${i}`, cantidad: 1 }))],
    ])("rechaza líneas inválidas con 400 (%#)", async (lineas) => {
      await expect(svc.guardarLineas(1, lineas)).rejects.toMatchObject({ statusCode: 400 });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("rechaza un id de conteo inválido", async () => {
      await expect(svc.guardarLineas("abc", [{ sku: "A-1", cantidad: 1 }])).rejects.toMatchObject({ statusCode: 400 });
    });

    it("409 si el conteo ya no es borrador", async () => {
      mockTx({ estado: "aplicado" });
      await expect(svc.guardarLineas(1, [{ sku: "A-1", cantidad: 1 }])).rejects.toMatchObject({ statusCode: 409 });
    });

    it("404 si el conteo no existe", async () => {
      mockTx({ estado: null });
      await expect(svc.guardarLineas(1, [{ sku: "A-1", cantidad: 1 }])).rejects.toMatchObject({ statusCode: 404 });
    });

    it("rechaza SKU inexistente, inactivo o fuera de la categoría del conteo", async () => {
      mockTx({ articulos: [] });
      await expect(svc.guardarLineas(1, [{ sku: "A-1", cantidad: 1 }])).rejects.toMatchObject({ statusCode: 400 });
      mockTx({ articulos: [art("A-1", { estado: false })] });
      await expect(svc.guardarLineas(1, [{ sku: "A-1", cantidad: 1 }])).rejects.toMatchObject({ statusCode: 400 });
      mockTx({ idCategoria: 1, articulos: [art("A-1", { idCategoria: 2 })] });
      await expect(svc.guardarLineas(1, [{ sku: "A-1", cantidad: 1 }])).rejects.toThrow(/categoría/);
    });

    it("crea la línea con foto del stock del sistema y refresca la foto al recontar", async () => {
      const tx = mockTx({
        articulos: [art("A-1"), art("A-2")],
        existentes: [{ idDetalleConteo: 3, sku: "A-2", cantidadContada: 4 }],
      });
      await svc.guardarLineas(1, [{ sku: "A-1", cantidad: 6 }, { sku: "A-2", cantidad: 5 }]);
      expect(tx.conteoDetalle.create.mock.calls[0][0].data).toMatchObject({ sku: "A-1", cantidadSistema: 8, cantidadContada: 6 });
      expect(tx.conteoDetalle.update.mock.calls[0][0]).toMatchObject({
        where: { idDetalleConteo: 3 },
        data: { cantidadContada: 5, cantidadSistema: 8 },
      });
    });

    it("no toca la línea si la cantidad no cambió", async () => {
      const tx = mockTx({ articulos: [art("A-1")], existentes: [{ idDetalleConteo: 3, sku: "A-1", cantidadContada: 6 }] });
      await svc.guardarLineas(1, [{ sku: "A-1", cantidad: 6 }]);
      expect(tx.conteoDetalle.update).not.toHaveBeenCalled();
    });
  });

  describe("cerrarConteo", () => {
    it("exige aplicarAjustes booleano", async () => {
      await expect(svc.cerrarConteo(1, 1, {})).rejects.toMatchObject({ statusCode: 400 });
      await expect(svc.cerrarConteo(1, 1, { aplicarAjustes: "si" })).rejects.toMatchObject({ statusCode: 400 });
    });

    it("idempotencia: un conteo ya aplicado/cerrado/cancelado no se vuelve a cerrar ni a aplicar", async () => {
      for (const estado of ["aplicado", "cerrado", "cancelado"]) {
        const tx = mockTx({ estado });
        await expect(svc.cerrarConteo(1, 1, { aplicarAjustes: true })).rejects.toMatchObject({ statusCode: 409 });
        expect(tx.inventario.update).not.toHaveBeenCalled();
        expect(tx.conteoFisico.update).not.toHaveBeenCalled();
      }
    });

    it("rechaza cerrar un conteo sin productos", async () => {
      mockTx({ lineas: [] });
      await expect(svc.cerrarConteo(1, 1, { aplicarAjustes: true })).rejects.toMatchObject({ statusCode: 400 });
    });

    it("aplica ajustes positivos y negativos con increment y deja antes/después", async () => {
      const tx = mockTx({
        lineas: [linea("A-1", 10, 13), linea("A-2", 5, 3), linea("A-3", 7, 7)],
        stockTras: { "A-1": 13, "A-2": 3 },
      });
      await svc.cerrarConteo(1, 42, { aplicarAjustes: true });

      expect(tx.inventario.update).toHaveBeenCalledTimes(2); // A-3 no tiene diferencia
      expect(tx.inventario.update.mock.calls[0][0]).toMatchObject({ where: { sku: "A-1" }, data: { cantidad: { increment: 3 } } });
      expect(tx.inventario.update.mock.calls[1][0]).toMatchObject({ where: { sku: "A-2" }, data: { cantidad: { increment: -2 } } });

      const datos = tx.conteoDetalle.update.mock.calls.map((c) => c[0].data);
      expect(datos).toContainEqual({ ajuste: 3, cantidadAntes: 10, cantidadDespues: 13 });
      expect(datos).toContainEqual({ ajuste: -2, cantidadAntes: 5, cantidadDespues: 3 });
      expect(datos).toContainEqual({ ajuste: 0, cantidadAntes: 7, cantidadDespues: 7 });

      expect(tx.conteoFisico.update.mock.calls[0][0].data).toMatchObject({ estado: "aplicado", idColaboradorCierre: 42 });
    });

    it("aplicarAjustes=false cierra como informe sin tocar Inventario", async () => {
      const tx = mockTx({ lineas: [linea("A-1", 10, 13)] });
      await svc.cerrarConteo(1, 42, { aplicarAjustes: false });
      expect(tx.inventario.update).not.toHaveBeenCalled();
      expect(tx.conteoFisico.update.mock.calls[0][0].data.estado).toBe("cerrado");
    });

    it("409 CAMBIO_STOCK si el stock cambió desde que se contó, salvo que se confirme", async () => {
      // Se contó con sistema 10 y desde entonces se vendieron 2 (stock actual 8).
      const lineas = [linea("A-1", 10, 9, 8)];
      const tx = mockTx({ lineas });
      await expect(svc.cerrarConteo(1, 1, { aplicarAjustes: true })).rejects.toMatchObject({
        statusCode: 409,
        extra: { codigo: "CAMBIO_STOCK", cambios: [{ sku: "A-1", cantidadSistema: 10, stockActual: 8 }] },
      });
      expect(tx.inventario.update).not.toHaveBeenCalled();

      const tx2 = mockTx({ lineas, stockTras: { "A-1": 7 } });
      await svc.cerrarConteo(1, 1, { aplicarAjustes: true, confirmarCambios: true });
      // Se suma la diferencia (-1) al stock vigente (8): queda 7, la venta se conserva.
      expect(tx2.inventario.update.mock.calls[0][0].data.cantidad).toEqual({ increment: -1 });
    });

    it("409 STOCK_NEGATIVO si el ajuste dejaría el stock bajo cero (la transacción se revierte)", async () => {
      mockTx({ lineas: [linea("A-1", 10, 0, 3)], stockTras: { "A-1": -7 } });
      await expect(svc.cerrarConteo(1, 1, { aplicarAjustes: true, confirmarCambios: true })).rejects.toMatchObject({
        statusCode: 409,
        extra: { codigo: "STOCK_NEGATIVO" },
      });
    });
  });

  describe("cancelar y eliminar", () => {
    it("cancela un borrador y rechaza cancelar uno ya cerrado", async () => {
      const tx = mockTx();
      await svc.cancelarConteo(1, 3);
      expect(tx.conteoFisico.update.mock.calls[0][0].data).toMatchObject({ estado: "cancelado" });
      mockTx({ estado: "aplicado" });
      await expect(svc.cancelarConteo(1, 3)).rejects.toMatchObject({ statusCode: 409 });
    });

    it("solo elimina borradores o cancelados; los aplicados se conservan", async () => {
      const tx = mockTx({ estado: "cancelado" });
      await svc.eliminarConteo(1);
      expect(tx.conteoFisico.delete).toHaveBeenCalled();
      const tx2 = mockTx({ estado: "aplicado" });
      await expect(svc.eliminarConteo(1)).rejects.toMatchObject({ statusCode: 409 });
      expect(tx2.conteoFisico.delete).not.toHaveBeenCalled();
    });
  });

  describe("obtenerConteo", () => {
    it("404 si no existe", async () => {
      prisma.conteoFisico.findUnique.mockResolvedValueOnce(null);
      await expect(svc.obtenerConteo(99)).rejects.toMatchObject({ statusCode: 404 });
    });

    it("marca cambioDesdeConteo y calcula valor de la diferencia", async () => {
      prisma.conteoFisico.findUnique.mockResolvedValueOnce({
        idConteo: 5, nombre: "T", estado: "borrador", idCategoria: null, categoria: null, creador: null, cierre: null,
        detalles: [linea("A-1", 10, 8, 7)],
      });
      prisma.articulo.count.mockResolvedValueOnce(4);
      const c = await svc.obtenerConteo(5);
      expect(c.lineas[0]).toMatchObject({ diferencia: -2, valorDiferencia: -20, cambioDesdeConteo: true, nivel: "alto" });
      expect(c.alcance).toEqual({ productosEnAlcance: 4, sinContar: 3 });
      expect(c.cambiosDesdeConteo).toBe(1);
    });
  });
});
