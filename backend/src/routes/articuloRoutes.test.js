const mockArticuloService = {
  listarArticulos: jest.fn(),
  obtenerArticuloPorSku: jest.fn(),
  crearArticulo: jest.fn(),
  editarArticulo: jest.fn(),
  cambiarEstadoArticulo: jest.fn(),
  crearArticulosEnLote: jest.fn(),
};

jest.mock("../services/articuloService", () => ({
  ArticuloError: class ArticuloError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  ...mockArticuloService,
}));

const jwt = require("jsonwebtoken");
const request = require("supertest");
const ExcelJS = require("exceljs");
const app = require("../app");
const { ArticuloError } = require("../services/articuloService");

// HU-05: igual que en categoriaRoutes.test.js, solo se mockea el servicio —
// el parseo real del .xlsx (excelRepuestos.js) se ejercita de verdad acá.
async function crearBufferExcel(filas, { encabezados } = {}) {
  const workbook = new ExcelJS.Workbook();
  const hoja = workbook.addWorksheet("Repuestos");
  hoja.addRow(
    encabezados ?? [
      "SKU",
      "Nombre",
      "Categoria",
      "Marca",
      "Precio Venta",
      "Precio Costo",
      "Inventario Minimo",
      "Ubicacion",
      "Proveedor",
    ],
  );
  filas.forEach((fila) => hoja.addRow(fila));
  return workbook.xlsx.writeBuffer();
}

function token(role) {
  return jwt.sign({ sub: 1, username: "usuario-test", role }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
}

describe("Rutas /api/repuestos", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("rechaza peticiones sin token con 401", async () => {
    const respuesta = await request(app).get("/api/repuestos");
    expect(respuesta.status).toBe(401);
  });

  describe("GET /api/repuestos", () => {
    it("HU-04 criterio 5: permite listar tanto a Administrador como a Operador", async () => {
      mockArticuloService.listarArticulos.mockResolvedValue({
        articulos: [],
        paginacion: { pagina: 1, porPagina: 20, total: 0, totalPaginas: 1 },
      });

      const comoAdmin = await request(app)
        .get("/api/repuestos")
        .set("Authorization", `Bearer ${token("Administrador")}`);
      const comoOperador = await request(app)
        .get("/api/repuestos")
        .set("Authorization", `Bearer ${token("Operador")}`);

      expect(comoAdmin.status).toBe(200);
      expect(comoOperador.status).toBe(200);
    });

    it("T-037: le pide al servicio ocultar datos sensibles cuando el rol es Operador", async () => {
      mockArticuloService.listarArticulos.mockResolvedValue({
        articulos: [],
        paginacion: { pagina: 1, porPagina: 20, total: 0, totalPaginas: 1 },
      });

      await request(app).get("/api/repuestos").set("Authorization", `Bearer ${token("Operador")}`);

      expect(mockArticuloService.listarArticulos).toHaveBeenCalledWith(
        expect.objectContaining({ ocultarDatosSensibles: true }),
      );

      await request(app).get("/api/repuestos").set("Authorization", `Bearer ${token("Administrador")}`);

      expect(mockArticuloService.listarArticulos).toHaveBeenLastCalledWith(
        expect.objectContaining({ ocultarDatosSensibles: false }),
      );
    });

    it("pasa pagina/porPagina/busqueda/estado desde el query string", async () => {
      mockArticuloService.listarArticulos.mockResolvedValue({
        articulos: [],
        paginacion: { pagina: 2, porPagina: 10, total: 0, totalPaginas: 1 },
      });

      await request(app)
        .get("/api/repuestos?pagina=2&porPagina=10&busqueda=freno&estado=activo")
        .set("Authorization", `Bearer ${token("Administrador")}`);

      expect(mockArticuloService.listarArticulos).toHaveBeenCalledWith(
        expect.objectContaining({ pagina: 2, porPagina: 10, busqueda: "freno", estado: "activo" }),
      );
    });
  });

  describe("GET /api/repuestos/:sku", () => {
    it("responde 404 cuando el servicio lanza ArticuloError(404)", async () => {
      mockArticuloService.obtenerArticuloPorSku.mockRejectedValueOnce(
        new ArticuloError("Repuesto no encontrado", 404),
      );

      const respuesta = await request(app)
        .get("/api/repuestos/NO-EXISTE")
        .set("Authorization", `Bearer ${token("Operador")}`);

      expect(respuesta.status).toBe(404);
    });
  });

  describe("POST /api/repuestos", () => {
    it("rechaza a Operador con 403", async () => {
      const respuesta = await request(app)
        .post("/api/repuestos")
        .set("Authorization", `Bearer ${token("Operador")}`)
        .send({ sku: "FRE-001" });

      expect(respuesta.status).toBe(403);
      expect(mockArticuloService.crearArticulo).not.toHaveBeenCalled();
    });

    it("crea el repuesto cuando Administrador envía datos válidos", async () => {
      mockArticuloService.crearArticulo.mockResolvedValueOnce({ sku: "FRE-001", nombre: "Pastillas" });

      const respuesta = await request(app)
        .post("/api/repuestos")
        .set("Authorization", `Bearer ${token("Administrador")}`)
        .send({ sku: "FRE-001", nombre: "Pastillas" });

      expect(respuesta.status).toBe(201);
      expect(respuesta.body).toEqual({ articulo: { sku: "FRE-001", nombre: "Pastillas" } });
    });

    it("T-036: traduce a 409 el ArticuloError de sku duplicado", async () => {
      mockArticuloService.crearArticulo.mockRejectedValueOnce(
        new ArticuloError("Ya existe un repuesto con ese código (SKU)", 409),
      );

      const respuesta = await request(app)
        .post("/api/repuestos")
        .set("Authorization", `Bearer ${token("Administrador")}`)
        .send({ sku: "FRE-001" });

      expect(respuesta.status).toBe(409);
    });
  });

  describe("PUT /api/repuestos/:sku", () => {
    it("rechaza a Operador con 403", async () => {
      const respuesta = await request(app)
        .put("/api/repuestos/FRE-001")
        .set("Authorization", `Bearer ${token("Operador")}`)
        .send({ nombre: "X" });

      expect(respuesta.status).toBe(403);
      expect(mockArticuloService.editarArticulo).not.toHaveBeenCalled();
    });

    it("edita cuando Administrador envía datos válidos", async () => {
      mockArticuloService.editarArticulo.mockResolvedValueOnce({ sku: "FRE-001", nombre: "Pastillas premium" });

      const respuesta = await request(app)
        .put("/api/repuestos/FRE-001")
        .set("Authorization", `Bearer ${token("Administrador")}`)
        .send({ nombre: "Pastillas premium" });

      expect(respuesta.status).toBe(200);
      expect(mockArticuloService.editarArticulo).toHaveBeenCalledWith("FRE-001", { nombre: "Pastillas premium" });
    });
  });

  describe("PATCH /api/repuestos/:sku/estado", () => {
    it("rechaza a Operador con 403", async () => {
      const respuesta = await request(app)
        .patch("/api/repuestos/FRE-001/estado")
        .set("Authorization", `Bearer ${token("Operador")}`)
        .send({ estado: false });

      expect(respuesta.status).toBe(403);
    });

    it("rechaza con 400 si estado no es booleano", async () => {
      const respuesta = await request(app)
        .patch("/api/repuestos/FRE-001/estado")
        .set("Authorization", `Bearer ${token("Administrador")}`)
        .send({ estado: "no" });

      expect(respuesta.status).toBe(400);
      expect(mockArticuloService.cambiarEstadoArticulo).not.toHaveBeenCalled();
    });

    it("T-028: da de baja (estado=false) cuando Administrador lo solicita", async () => {
      mockArticuloService.cambiarEstadoArticulo.mockResolvedValueOnce({ sku: "FRE-001", estado: false });

      const respuesta = await request(app)
        .patch("/api/repuestos/FRE-001/estado")
        .set("Authorization", `Bearer ${token("Administrador")}`)
        .send({ estado: false });

      expect(respuesta.status).toBe(200);
      expect(mockArticuloService.cambiarEstadoArticulo).toHaveBeenCalledWith("FRE-001", false);
    });
  });

  describe("GET /api/repuestos/plantilla-carga-masiva", () => {
    it("T-042: rechaza a Operador con 403", async () => {
      const respuesta = await request(app)
        .get("/api/repuestos/plantilla-carga-masiva")
        .set("Authorization", `Bearer ${token("Operador")}`);

      expect(respuesta.status).toBe(403);
    });

    it("T-042: entrega un .xlsx descargable a Administrador", async () => {
      const respuesta = await request(app)
        .get("/api/repuestos/plantilla-carga-masiva")
        .set("Authorization", `Bearer ${token("Administrador")}`);

      expect(respuesta.status).toBe(200);
      expect(respuesta.headers["content-type"]).toMatch(/spreadsheetml/);
      expect(respuesta.headers["content-disposition"]).toMatch(/attachment/);
      expect(respuesta.headers["content-disposition"]).toMatch(/plantilla-repuestos\.xlsx/);
    });
  });

  describe("POST /api/repuestos/carga-masiva", () => {
    it("T-039-like: rechaza a Operador con 403 sin llegar a leer el archivo", async () => {
      const buffer = await crearBufferExcel([["FRE-001", "Pastillas", "Frenos", "", 100, 60, 5, "", ""]]);

      const respuesta = await request(app)
        .post("/api/repuestos/carga-masiva")
        .set("Authorization", `Bearer ${token("Operador")}`)
        .attach("archivo", buffer, "repuestos.xlsx");

      expect(respuesta.status).toBe(403);
      expect(mockArticuloService.crearArticulosEnLote).not.toHaveBeenCalled();
    });

    it("rechaza con 400 si no se adjunta ningún archivo", async () => {
      const respuesta = await request(app)
        .post("/api/repuestos/carga-masiva")
        .set("Authorization", `Bearer ${token("Administrador")}`);

      expect(respuesta.status).toBe(400);
      expect(mockArticuloService.crearArticulosEnLote).not.toHaveBeenCalled();
    });

    it("T-049: rechaza con 400 un archivo que no es .xlsx", async () => {
      const respuesta = await request(app)
        .post("/api/repuestos/carga-masiva")
        .set("Authorization", `Bearer ${token("Administrador")}`)
        .attach("archivo", Buffer.from("no soy un excel"), {
          filename: "repuestos.txt",
          contentType: "text/plain",
        });

      expect(respuesta.status).toBe(400);
      expect(mockArticuloService.crearArticulosEnLote).not.toHaveBeenCalled();
    });

    it("T-049: rechaza con 400 un .xlsx sin las columnas requeridas", async () => {
      const buffer = await crearBufferExcel([["FRE-001", "Pastillas"]], {
        encabezados: ["SKU", "Nombre"],
      });

      const respuesta = await request(app)
        .post("/api/repuestos/carga-masiva")
        .set("Authorization", `Bearer ${token("Administrador")}`)
        .attach("archivo", buffer, "repuestos.xlsx");

      expect(respuesta.status).toBe(400);
      expect(mockArticuloService.crearArticulosEnLote).not.toHaveBeenCalled();
    });

    it("T-043/T-046: parsea el .xlsx real y delega la creación en el servicio", async () => {
      const buffer = await crearBufferExcel([
        ["FRE-001", "Pastillas", "Frenos", "", 150.5, 90, 5, "", ""],
        ["FRE-002", "Disco", "Frenos", "", 200, 120, 3, "", ""],
      ]);
      mockArticuloService.crearArticulosEnLote.mockResolvedValueOnce({
        creadas: [
          { sku: "FRE-001", nombre: "Pastillas" },
          { sku: "FRE-002", nombre: "Disco" },
        ],
        errores: [],
      });

      const respuesta = await request(app)
        .post("/api/repuestos/carga-masiva")
        .set("Authorization", `Bearer ${token("Administrador")}`)
        .attach("archivo", buffer, "repuestos.xlsx");

      expect(respuesta.status).toBe(200);
      expect(mockArticuloService.crearArticulosEnLote).toHaveBeenCalledWith([
        expect.objectContaining({ numeroFila: 2, sku: "FRE-001", categoria: "Frenos" }),
        expect.objectContaining({ numeroFila: 3, sku: "FRE-002" }),
      ]);
      expect(respuesta.body.creadas).toHaveLength(2);
    });

    it("T-046: propaga el resumen con filas exitosas y filas con error", async () => {
      const buffer = await crearBufferExcel([["FRE-003", "X", "NoExiste", "", 1, 1, 0, "", ""]]);
      mockArticuloService.crearArticulosEnLote.mockResolvedValueOnce({
        creadas: [],
        errores: [{ fila: 2, sku: "FRE-003", motivo: 'La categoría "NoExiste" no existe' }],
      });

      const respuesta = await request(app)
        .post("/api/repuestos/carga-masiva")
        .set("Authorization", `Bearer ${token("Administrador")}`)
        .attach("archivo", buffer, "repuestos.xlsx");

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.errores).toEqual([
        { fila: 2, sku: "FRE-003", motivo: 'La categoría "NoExiste" no existe' },
      ]);
    });
  });
});
