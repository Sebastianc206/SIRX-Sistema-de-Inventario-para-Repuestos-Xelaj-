jest.mock("../utils/prismaClient", () => ({
  articulo: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  categoria: { findUnique: jest.fn(), findFirst: jest.fn() },
  marca: { findUnique: jest.fn(), findFirst: jest.fn() },
  proveedor: { findUnique: jest.fn(), findFirst: jest.fn() },
  modelo: { findMany: jest.fn() },
  $transaction: jest.fn(),
}));

const prisma = require("../utils/prismaClient");
const {
  ArticuloError,
  listarArticulos,
  obtenerArticuloPorSku,
  crearArticulo,
  editarArticulo,
  cambiarEstadoArticulo,
  crearArticulosEnLote,
} = require("./articuloService");

const ARTICULO_BASE = {
  sku: "FRE-001",
  nombre: "Pastillas de freno",
  precioVenta: 150,
  precioCosto: 90,
  inventarioMinimo: 5,
  ubicacion: "Estante A1",
  estado: true,
  categoria: { idCategoria: 1, descripcion: "Frenos" },
  marca: { idMarca: 1, nombre: "Bosch" },
  proveedor: { idProveedor: 1, nombre: "Repuestos Guate S.A." },
  inventario: { cantidad: 12 },
  modelosCompatibles: [{ modelo: { idModelo: 1, descripcion: "Toyota Hilux 2015-2020" } }],
};

describe("articuloService", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("listarArticulos", () => {
    it("aplica paginación por defecto y arma la búsqueda por sku/nombre", async () => {
      prisma.articulo.count.mockResolvedValueOnce(1);
      prisma.articulo.findMany.mockResolvedValueOnce([ARTICULO_BASE]);

      const resultado = await listarArticulos({ busqueda: "freno", ocultarDatosSensibles: false });

      expect(prisma.articulo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { sku: { contains: "freno", mode: "insensitive" } },
              { nombre: { contains: "freno", mode: "insensitive" } },
            ],
          },
          skip: 0,
          take: 20,
        }),
      );
      expect(resultado.paginacion).toEqual({ pagina: 1, porPagina: 20, total: 1, totalPaginas: 1 });
    });

    it("nunca deja pedir más de 100 resultados por página", async () => {
      prisma.articulo.count.mockResolvedValueOnce(0);
      prisma.articulo.findMany.mockResolvedValueOnce([]);

      await listarArticulos({ porPagina: 500, ocultarDatosSensibles: false });

      expect(prisma.articulo.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
    });

    it("T-037: oculta precioCosto y proveedor cuando ocultarDatosSensibles es true", async () => {
      prisma.articulo.count.mockResolvedValueOnce(1);
      prisma.articulo.findMany.mockResolvedValueOnce([ARTICULO_BASE]);

      const resultado = await listarArticulos({ ocultarDatosSensibles: true });

      expect(resultado.articulos[0]).not.toHaveProperty("precioCosto");
      expect(resultado.articulos[0]).not.toHaveProperty("proveedor");
      expect(resultado.articulos[0].nombre).toBe("Pastillas de freno");
    });

    it("incluye precioCosto y proveedor para Administrador", async () => {
      prisma.articulo.count.mockResolvedValueOnce(1);
      prisma.articulo.findMany.mockResolvedValueOnce([ARTICULO_BASE]);

      const resultado = await listarArticulos({ ocultarDatosSensibles: false });

      expect(resultado.articulos[0].precioCosto).toBe(90);
      expect(resultado.articulos[0].proveedor).toEqual({ idProveedor: 1, nombre: "Repuestos Guate S.A." });
    });

    describe("HU-06: filtros combinables", () => {
      it("T-051: filtra por idCategoria", async () => {
        prisma.articulo.count.mockResolvedValueOnce(0);
        prisma.articulo.findMany.mockResolvedValueOnce([]);

        await listarArticulos({ idCategoria: 1, ocultarDatosSensibles: false });

        expect(prisma.articulo.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ where: { idCategoria: 1 } }),
        );
      });

      it("T-051: filtra por idMarca", async () => {
        prisma.articulo.count.mockResolvedValueOnce(0);
        prisma.articulo.findMany.mockResolvedValueOnce([]);

        await listarArticulos({ idMarca: 2, ocultarDatosSensibles: false });

        expect(prisma.articulo.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ where: { idMarca: 2 } }),
        );
      });

      it("T-051: filtra por modelo compatible", async () => {
        prisma.articulo.count.mockResolvedValueOnce(0);
        prisma.articulo.findMany.mockResolvedValueOnce([]);

        await listarArticulos({ idModelo: 5, ocultarDatosSensibles: false });

        expect(prisma.articulo.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ where: { modelosCompatibles: { some: { idModelo: 5 } } } }),
        );
      });

      it("T-054: combina búsqueda + estado + los tres filtros a la vez (criterio 3)", async () => {
        prisma.articulo.count.mockResolvedValueOnce(0);
        prisma.articulo.findMany.mockResolvedValueOnce([]);

        await listarArticulos({
          busqueda: "freno",
          estado: "activo",
          idCategoria: 1,
          idMarca: 2,
          idModelo: 5,
          ocultarDatosSensibles: false,
        });

        expect(prisma.articulo.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              OR: [
                { sku: { contains: "freno", mode: "insensitive" } },
                { nombre: { contains: "freno", mode: "insensitive" } },
              ],
              estado: true,
              idCategoria: 1,
              idMarca: 2,
              modelosCompatibles: { some: { idModelo: 5 } },
            },
          }),
        );
      });

      it("ignora un idCategoria/idMarca/idModelo no numérico (undefined desde el controlador)", async () => {
        prisma.articulo.count.mockResolvedValueOnce(0);
        prisma.articulo.findMany.mockResolvedValueOnce([]);

        await listarArticulos({
          idCategoria: undefined,
          idMarca: undefined,
          idModelo: undefined,
          ocultarDatosSensibles: false,
        });

        expect(prisma.articulo.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
      });
    });
  });

  describe("obtenerArticuloPorSku", () => {
    it("lanza 404 si el repuesto no existe", async () => {
      prisma.articulo.findUnique.mockResolvedValueOnce(null);

      await expect(obtenerArticuloPorSku("NO-EXISTE", { ocultarDatosSensibles: false })).rejects.toMatchObject(
        { message: "Repuesto no encontrado", statusCode: 404 },
      );
    });
  });

  describe("crearArticulo", () => {
    const datosValidos = {
      sku: "FRE-002",
      nombre: "Disco de freno",
      precioVenta: 200,
      precioCosto: 120,
      inventarioMinimo: 3,
      idCategoria: 1,
    };

    it("rechaza un sku inválido sin tocar la base de datos", async () => {
      await expect(crearArticulo({ ...datosValidos, sku: "con espacio" })).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(prisma.categoria.findUnique).not.toHaveBeenCalled();
    });

    it("rechaza precioVenta <= 0", async () => {
      await expect(crearArticulo({ ...datosValidos, precioVenta: 0 })).rejects.toMatchObject({
        message: "precioVenta debe ser un número mayor a 0",
        statusCode: 400,
      });
    });

    it("rechaza inventarioMinimo negativo", async () => {
      await expect(crearArticulo({ ...datosValidos, inventarioMinimo: -1 })).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("rechaza con 400 si la categoría indicada no existe", async () => {
      prisma.categoria.findUnique.mockResolvedValueOnce(null);

      await expect(crearArticulo(datosValidos)).rejects.toMatchObject({
        message: "La categoría indicada no existe",
        statusCode: 400,
      });
      expect(prisma.articulo.findUnique).not.toHaveBeenCalled();
    });

    it("T-036: rechaza con 409 si el sku ya existe", async () => {
      prisma.categoria.findUnique.mockResolvedValueOnce({ idCategoria: 1 });
      prisma.articulo.findUnique.mockResolvedValueOnce({ sku: "FRE-002" });

      await expect(crearArticulo(datosValidos)).rejects.toMatchObject({
        message: "Ya existe un repuesto con ese código (SKU)",
        statusCode: 409,
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("rechaza con 400 si un modelo compatible indicado no existe", async () => {
      prisma.categoria.findUnique.mockResolvedValueOnce({ idCategoria: 1 });
      prisma.modelo.findMany.mockResolvedValueOnce([]); // pidió 1 modelo, no encontró ninguno

      await expect(
        crearArticulo({ ...datosValidos, idsModelosCompatibles: [99] }),
      ).rejects.toMatchObject({
        message: "Uno o más modelos compatibles indicados no existen",
        statusCode: 400,
      });
    });

    it("crea el repuesto, su inventario en 0 y sus modelos compatibles en una sola transacción", async () => {
      prisma.categoria.findUnique.mockResolvedValueOnce({ idCategoria: 1 });
      prisma.modelo.findMany.mockResolvedValueOnce([{ idModelo: 1 }]);
      prisma.articulo.findUnique.mockResolvedValueOnce(null); // no existe todavía
      const txArticuloCreate = jest.fn();
      const txInventarioCreate = jest.fn();
      const txModeloCompatibleCreateMany = jest.fn();
      prisma.$transaction.mockImplementationOnce(async (callback) =>
        callback({
          articulo: { create: txArticuloCreate },
          inventario: { create: txInventarioCreate },
          modeloCompatible: { createMany: txModeloCompatibleCreateMany },
        }),
      );
      prisma.articulo.findUnique.mockResolvedValueOnce(ARTICULO_BASE); // obtenerArticuloPorSku final

      const resultado = await crearArticulo({ ...datosValidos, idsModelosCompatibles: [1] });

      expect(txArticuloCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ sku: "FRE-002" }) }),
      );
      expect(txInventarioCreate).toHaveBeenCalledWith({ data: { sku: "FRE-002", cantidad: 0 } });
      expect(txModeloCompatibleCreateMany).toHaveBeenCalledWith({
        data: [{ sku: "FRE-002", idModelo: 1 }],
      });
      // La respuesta de crear siempre incluye los datos sensibles (quien crea ya es Administrador).
      expect(resultado.precioCosto).toBe(90);
    });
  });

  describe("editarArticulo", () => {
    it("lanza 404 si el repuesto no existe", async () => {
      prisma.articulo.findUnique.mockResolvedValueOnce(null);

      await expect(editarArticulo("NO-EXISTE", { nombre: "X" })).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("valida los campos que sí vienen en el body, sin exigir los que no", async () => {
      prisma.articulo.findUnique.mockResolvedValueOnce({ sku: "FRE-001" });

      await expect(editarArticulo("FRE-001", { precioVenta: -5 })).rejects.toMatchObject({
        message: "precioVenta debe ser un número mayor a 0",
        statusCode: 400,
      });
    });

    it("actualiza solo los campos provistos y reemplaza el set de modelos compatibles", async () => {
      prisma.articulo.findUnique.mockResolvedValueOnce({ sku: "FRE-001" });
      prisma.modelo.findMany.mockResolvedValueOnce([{ idModelo: 2 }]);
      const txArticuloUpdate = jest.fn();
      const txDeleteMany = jest.fn();
      const txCreateMany = jest.fn();
      prisma.$transaction.mockImplementationOnce(async (callback) =>
        callback({
          articulo: { update: txArticuloUpdate },
          modeloCompatible: { deleteMany: txDeleteMany, createMany: txCreateMany },
        }),
      );
      prisma.articulo.findUnique.mockResolvedValueOnce(ARTICULO_BASE);

      await editarArticulo("FRE-001", { nombre: "Pastillas premium", idsModelosCompatibles: [2] });

      expect(txArticuloUpdate).toHaveBeenCalledWith({
        where: { sku: "FRE-001" },
        data: { nombre: "Pastillas premium" },
      });
      expect(txDeleteMany).toHaveBeenCalledWith({ where: { sku: "FRE-001" } });
      expect(txCreateMany).toHaveBeenCalledWith({ data: [{ sku: "FRE-001", idModelo: 2 }] });
    });
  });

  describe("cambiarEstadoArticulo", () => {
    it("lanza 404 si el repuesto no existe", async () => {
      prisma.articulo.findUnique.mockResolvedValueOnce(null);

      await expect(cambiarEstadoArticulo("NO-EXISTE", false)).rejects.toMatchObject({
        statusCode: 404,
      });
      expect(prisma.articulo.update).not.toHaveBeenCalled();
    });

    it("T-028: da de baja cambiando el estado, no borra el registro", async () => {
      prisma.articulo.findUnique.mockResolvedValueOnce({ sku: "FRE-001" });
      prisma.articulo.findUnique.mockResolvedValueOnce(ARTICULO_BASE);

      await cambiarEstadoArticulo("FRE-001", false);

      expect(prisma.articulo.update).toHaveBeenCalledWith({
        where: { sku: "FRE-001" },
        data: { estado: false },
      });
    });
  });

  describe("crearArticulosEnLote (HU-05)", () => {
    const filaValida = {
      numeroFila: 2,
      sku: "FRE-010",
      nombre: "Balatas",
      categoria: "Frenos",
      marca: undefined,
      precioVenta: 100,
      precioCosto: 60,
      inventarioMinimo: 2,
      ubicacion: undefined,
      proveedor: undefined,
    };

    function mockearCreacionExitosa() {
      prisma.categoria.findFirst.mockResolvedValueOnce({ idCategoria: 1 }); // resolverCategoriaPorNombre
      prisma.categoria.findUnique.mockResolvedValueOnce({ idCategoria: 1 }); // validarReferencias (dentro de crearArticulo)
      prisma.articulo.findUnique.mockResolvedValueOnce(null); // sku no existe todavía
      prisma.$transaction.mockImplementationOnce(async (callback) =>
        callback({
          articulo: { create: jest.fn() },
          inventario: { create: jest.fn() },
          modeloCompatible: { createMany: jest.fn() },
        }),
      );
      prisma.articulo.findUnique.mockResolvedValueOnce({ ...ARTICULO_BASE, sku: "FRE-010" }); // obtenerArticuloPorSku final
    }

    it("T-044: resuelve la categoría por nombre y crea la fila", async () => {
      mockearCreacionExitosa();

      const resultado = await crearArticulosEnLote([filaValida]);

      expect(prisma.categoria.findFirst).toHaveBeenCalledWith({
        where: { descripcion: { equals: "Frenos", mode: "insensitive" } },
      });
      expect(resultado.creadas).toEqual([{ sku: "FRE-010", nombre: "Pastillas de freno" }]);
      expect(resultado.errores).toEqual([]);
    });

    it("T-044: reporta la fila cuya categoría no existe, sin intentar crearla", async () => {
      prisma.categoria.findFirst.mockResolvedValueOnce(null);

      const resultado = await crearArticulosEnLote([{ ...filaValida, categoria: "NoExiste" }]);

      expect(resultado.creadas).toEqual([]);
      expect(resultado.errores).toEqual([
        { fila: 2, sku: "FRE-010", motivo: 'La categoría "NoExiste" no existe' },
      ]);
      expect(prisma.articulo.findUnique).not.toHaveBeenCalled();
    });

    it("T-045: una fila inválida no bloquea la carga del resto (criterio 3)", async () => {
      prisma.categoria.findFirst.mockResolvedValueOnce(null); // fila 1: falla
      mockearCreacionExitosa(); // fila 2: éxito

      const filaInvalida = { ...filaValida, numeroFila: 2, sku: "FRE-009", categoria: "NoExiste" };
      const filaBuena = { ...filaValida, numeroFila: 3, sku: "FRE-010" };

      const resultado = await crearArticulosEnLote([filaInvalida, filaBuena]);

      expect(resultado.errores).toEqual([
        { fila: 2, sku: "FRE-009", motivo: 'La categoría "NoExiste" no existe' },
      ]);
      expect(resultado.creadas).toEqual([{ sku: "FRE-010", nombre: "Pastillas de freno" }]);
    });
  });

  it("ArticuloError conserva el statusCode", () => {
    const error = new ArticuloError("mensaje", 418);
    expect(error.message).toBe("mensaje");
    expect(error.statusCode).toBe(418);
  });
});
