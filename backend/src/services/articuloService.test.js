jest.mock("../utils/prismaClient", () => ({
  articulo: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  categoria: { findUnique: jest.fn() },
  marca: { findUnique: jest.fn() },
  proveedor: { findUnique: jest.fn() },
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

  it("ArticuloError conserva el statusCode", () => {
    const error = new ArticuloError("mensaje", 418);
    expect(error.message).toBe("mensaje");
    expect(error.statusCode).toBe(418);
  });
});
