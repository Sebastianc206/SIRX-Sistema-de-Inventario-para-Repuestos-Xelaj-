jest.mock("../utils/prismaClient", () => ({
  categoria: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  articulo: {
    count: jest.fn(),
  },
  $transaction: jest.fn(),
}));

const prisma = require("../utils/prismaClient");
const {
  CategoriaError,
  listarCategorias,
  obtenerCategoriaPorId,
  crearCategoria,
  editarCategoria,
  eliminarCategoria,
} = require("./categoriaService");

describe("categoriaService", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("listarCategorias", () => {
    it("devuelve las categorías ordenadas alfabéticamente y formateadas", async () => {
      prisma.categoria.findMany.mockResolvedValueOnce([
        { idCategoria: 2, descripcion: "Frenos" },
        { idCategoria: 1, descripcion: "Baterías" },
      ]);

      const resultado = await listarCategorias();

      expect(prisma.categoria.findMany).toHaveBeenCalledWith({
        orderBy: { descripcion: "asc" },
      });
      expect(resultado).toEqual([
        { idCategoria: 2, descripcion: "Frenos" },
        { idCategoria: 1, descripcion: "Baterías" },
      ]);
    });
  });

  describe("obtenerCategoriaPorId", () => {
    it("lanza 404 si la categoría no existe", async () => {
      prisma.categoria.findUnique.mockResolvedValueOnce(null);

      await expect(obtenerCategoriaPorId(99)).rejects.toMatchObject({
        message: "Categoría no encontrada",
        statusCode: 404,
      });
    });

    it("devuelve la categoría formateada si existe", async () => {
      prisma.categoria.findUnique.mockResolvedValueOnce({ idCategoria: 1, descripcion: "Frenos" });

      const resultado = await obtenerCategoriaPorId(1);

      expect(resultado).toEqual({ idCategoria: 1, descripcion: "Frenos" });
    });
  });

  describe("crearCategoria", () => {
    it("crea la categoría con el siguiente id disponible", async () => {
      prisma.categoria.findFirst.mockResolvedValueOnce(null);
      prisma.$transaction.mockImplementationOnce(async (callback) => {
        const tx = {
          categoria: {
            aggregate: jest.fn().mockResolvedValue({ _max: { idCategoria: 3 } }),
            create: jest.fn().mockResolvedValue({ idCategoria: 4, descripcion: "Filtros" }),
          },
        };
        return callback(tx);
      });

      const resultado = await crearCategoria({ descripcion: "  Filtros  " });

      expect(prisma.categoria.findFirst).toHaveBeenCalledWith({
        where: { descripcion: { equals: "Filtros", mode: "insensitive" } },
      });
      expect(resultado).toEqual({ idCategoria: 4, descripcion: "Filtros" });
    });

    it("rechaza con 409 si ya existe una categoría con esa descripción", async () => {
      prisma.categoria.findFirst.mockResolvedValueOnce({ idCategoria: 1, descripcion: "Frenos" });

      await expect(crearCategoria({ descripcion: "frenos" })).rejects.toMatchObject({
        message: "Ya existe una categoría con esa descripción",
        statusCode: 409,
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("editarCategoria", () => {
    it("lanza 404 si la categoría no existe", async () => {
      prisma.categoria.findUnique.mockResolvedValueOnce(null);

      await expect(editarCategoria(1, { descripcion: "Frenos" })).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("rechaza con 409 si el nuevo nombre choca con otra categoría", async () => {
      prisma.categoria.findUnique.mockResolvedValueOnce({ idCategoria: 1, descripcion: "Frenos" });
      prisma.categoria.findFirst.mockResolvedValueOnce({ idCategoria: 2, descripcion: "Filtros" });

      await expect(editarCategoria(1, { descripcion: "Filtros" })).rejects.toMatchObject({
        message: "Ya existe una categoría con esa descripción",
        statusCode: 409,
      });
      expect(prisma.categoria.findFirst).toHaveBeenCalledWith({
        where: {
          descripcion: { equals: "Filtros", mode: "insensitive" },
          idCategoria: { not: 1 },
        },
      });
    });

    it("actualiza la descripción cuando no hay conflicto", async () => {
      prisma.categoria.findUnique.mockResolvedValueOnce({ idCategoria: 1, descripcion: "Frenos" });
      prisma.categoria.findFirst.mockResolvedValueOnce(null);
      prisma.categoria.update.mockResolvedValueOnce({ idCategoria: 1, descripcion: "Frenos y pastillas" });

      const resultado = await editarCategoria(1, { descripcion: "Frenos y pastillas" });

      expect(prisma.categoria.update).toHaveBeenCalledWith({
        where: { idCategoria: 1 },
        data: { descripcion: "Frenos y pastillas" },
      });
      expect(resultado).toEqual({ idCategoria: 1, descripcion: "Frenos y pastillas" });
    });
  });

  describe("eliminarCategoria", () => {
    it("lanza 404 si la categoría no existe", async () => {
      prisma.categoria.findUnique.mockResolvedValueOnce(null);

      await expect(eliminarCategoria(1)).rejects.toMatchObject({ statusCode: 404 });
      expect(prisma.articulo.count).not.toHaveBeenCalled();
    });

    it("rechaza con 409 si hay repuestos asignados a la categoría", async () => {
      prisma.categoria.findUnique.mockResolvedValueOnce({ idCategoria: 1, descripcion: "Frenos" });
      prisma.articulo.count.mockResolvedValueOnce(3);

      await expect(eliminarCategoria(1)).rejects.toMatchObject({
        message: "No se puede eliminar: hay repuestos asignados a esta categoría",
        statusCode: 409,
      });
      expect(prisma.categoria.delete).not.toHaveBeenCalled();
    });

    it("elimina la categoría cuando no tiene repuestos asignados", async () => {
      prisma.categoria.findUnique.mockResolvedValueOnce({ idCategoria: 1, descripcion: "Frenos" });
      prisma.articulo.count.mockResolvedValueOnce(0);

      await eliminarCategoria(1);

      expect(prisma.categoria.delete).toHaveBeenCalledWith({ where: { idCategoria: 1 } });
    });
  });

  it("CategoriaError conserva el statusCode", () => {
    const error = new CategoriaError("mensaje", 418);
    expect(error.message).toBe("mensaje");
    expect(error.statusCode).toBe(418);
  });
});
