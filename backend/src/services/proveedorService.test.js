jest.mock("../utils/prismaClient", () => ({
  proveedor: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  pais: { findUnique: jest.fn() },
  departamento: { findUnique: jest.fn() },
  municipio: { findUnique: jest.fn() },
  $transaction: jest.fn(),
}));

const prisma = require("../utils/prismaClient");
const {
  ProveedorError,
  listarProveedores,
  crearProveedor,
  editarProveedor,
} = require("./proveedorService");

const PROVEEDOR_BASE = {
  idProveedor: 1,
  nombre: "Repuestos Guate S.A.",
  direccion: "Zona 1",
  contacto: "5555-5555",
  vigente: true,
  idPais: 1,
  idDepartamento: 1,
  idMunicipio: 1,
};

describe("proveedorService", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("listarProveedores", () => {
    it("devuelve los proveedores ordenados alfabéticamente y formateados", async () => {
      prisma.proveedor.findMany.mockResolvedValueOnce([PROVEEDOR_BASE]);

      const resultado = await listarProveedores();

      expect(prisma.proveedor.findMany).toHaveBeenCalledWith({ orderBy: { nombre: "asc" } });
      expect(resultado).toEqual([
        {
          idProveedor: 1,
          nombre: "Repuestos Guate S.A.",
          direccion: "Zona 1",
          contacto: "5555-5555",
          vigente: true,
          idPais: 1,
          idDepartamento: 1,
          idMunicipio: 1,
        },
      ]);
    });
  });

  describe("crearProveedor", () => {
    const datosValidos = { nombre: "Repuestos Guate S.A.", idPais: 1 };

    it("rechaza un nombre vacío sin consultar la base de datos", async () => {
      await expect(crearProveedor({ nombre: "   ", idPais: 1 })).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(prisma.pais.findUnique).not.toHaveBeenCalled();
    });

    it("rechaza si no se indica idPais", async () => {
      await expect(crearProveedor({ nombre: "Proveedor X" })).rejects.toMatchObject({
        message: "idPais es requerido",
        statusCode: 400,
      });
    });

    it("rechaza con 400 si el país indicado no existe", async () => {
      prisma.pais.findUnique.mockResolvedValueOnce(null);

      await expect(crearProveedor(datosValidos)).rejects.toMatchObject({
        message: "El país indicado no existe",
        statusCode: 400,
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("rechaza con 400 si el municipio no pertenece al departamento indicado", async () => {
      prisma.pais.findUnique.mockResolvedValueOnce({ idPais: 1 });
      prisma.departamento.findUnique.mockResolvedValueOnce({ idDepartamento: 2 });
      prisma.municipio.findUnique.mockResolvedValueOnce({ idMunicipio: 1, idDepartamento: 1 });

      await expect(
        crearProveedor({ ...datosValidos, idDepartamento: 2, idMunicipio: 1 }),
      ).rejects.toMatchObject({
        message: "El municipio indicado no pertenece al departamento indicado",
        statusCode: 400,
      });
    });

    it("crea el proveedor con el siguiente id disponible", async () => {
      prisma.pais.findUnique.mockResolvedValueOnce({ idPais: 1 });
      const txCreate = jest.fn().mockResolvedValue(PROVEEDOR_BASE);
      prisma.$transaction.mockImplementationOnce(async (callback) =>
        callback({
          proveedor: {
            aggregate: jest.fn().mockResolvedValue({ _max: { idProveedor: 0 } }),
            create: txCreate,
          },
        }),
      );

      const resultado = await crearProveedor(datosValidos);

      expect(txCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ idProveedor: 1, nombre: "Repuestos Guate S.A." }),
        }),
      );
      expect(resultado.idProveedor).toBe(1);
    });
  });

  describe("editarProveedor", () => {
    it("lanza 404 si el proveedor no existe", async () => {
      prisma.proveedor.findUnique.mockResolvedValueOnce(null);

      await expect(editarProveedor(99, { nombre: "X" })).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("valida los campos que sí vienen en el body", async () => {
      prisma.proveedor.findUnique.mockResolvedValueOnce(PROVEEDOR_BASE);

      await expect(editarProveedor(1, { nombre: "" })).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("actualiza solo los campos provistos", async () => {
      prisma.proveedor.findUnique.mockResolvedValueOnce(PROVEEDOR_BASE);
      prisma.proveedor.update.mockResolvedValueOnce({ ...PROVEEDOR_BASE, nombre: "Nuevo nombre" });

      await editarProveedor(1, { nombre: "Nuevo nombre" });

      expect(prisma.proveedor.update).toHaveBeenCalledWith({
        where: { idProveedor: 1 },
        data: { nombre: "Nuevo nombre" },
      });
    });
  });

  it("ProveedorError conserva el statusCode", () => {
    const error = new ProveedorError("mensaje", 418);
    expect(error.message).toBe("mensaje");
    expect(error.statusCode).toBe(418);
  });
});
