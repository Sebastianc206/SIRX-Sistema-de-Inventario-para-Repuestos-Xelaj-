const mockCategoriaService = {
  listarCategorias: jest.fn(),
  crearCategoria: jest.fn(),
  editarCategoria: jest.fn(),
  eliminarCategoria: jest.fn(),
  crearCategoriasEnLote: jest.fn(),
};

jest.mock("../services/categoriaService", () => ({
  CategoriaError: class CategoriaError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  ...mockCategoriaService,
}));

const jwt = require("jsonwebtoken");
const request = require("supertest");
const ExcelJS = require("exceljs");
const app = require("../app");
const { CategoriaError } = require("../services/categoriaService");

function token(role, idColaborador = 1) {
  return jwt.sign({ sub: idColaborador, username: "usuario-test", role }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
}

// Construye un .xlsx real en memoria para ejercitar el parser de verdad
// (categoriaRoutes.test.js solo mockea el servicio, no el controlador).
async function crearBufferExcel(descripciones, { encabezado = "descripcion" } = {}) {
  const workbook = new ExcelJS.Workbook();
  const hoja = workbook.addWorksheet("Categorias");
  hoja.addRow([encabezado]);
  descripciones.forEach((descripcion) => hoja.addRow([descripcion]));
  return workbook.xlsx.writeBuffer();
}

describe("Rutas /api/categorias", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("rechaza peticiones sin token con 401", async () => {
    const respuesta = await request(app).get("/api/categorias");
    expect(respuesta.status).toBe(401);
  });

  describe("GET /api/categorias", () => {
    it("permite listar tanto a Administrador como a Operador", async () => {
      mockCategoriaService.listarCategorias.mockResolvedValue([
        { idCategoria: 1, descripcion: "Frenos" },
      ]);

      const comoAdmin = await request(app)
        .get("/api/categorias")
        .set("Authorization", `Bearer ${token("Administrador")}`);
      const comoOperador = await request(app)
        .get("/api/categorias")
        .set("Authorization", `Bearer ${token("Operador")}`);

      expect(comoAdmin.status).toBe(200);
      expect(comoAdmin.body).toEqual({ categorias: [{ idCategoria: 1, descripcion: "Frenos" }] });
      expect(comoOperador.status).toBe(200);
    });
  });

  describe("POST /api/categorias", () => {
    it("rechaza a Operador con 403", async () => {
      const respuesta = await request(app)
        .post("/api/categorias")
        .set("Authorization", `Bearer ${token("Operador")}`)
        .send({ descripcion: "Filtros" });

      expect(respuesta.status).toBe(403);
      expect(mockCategoriaService.crearCategoria).not.toHaveBeenCalled();
    });

    it("traduce a 400 el CategoriaError de validación (descripción vacía) que lanza el servicio", async () => {
      // La validación de "descripcion" vive en categoriaService (T-099), no
      // en el controlador: acá solo se prueba que la ruta la propaga bien.
      // La regla en sí está cubierta en categoriaService.test.js.
      mockCategoriaService.crearCategoria.mockRejectedValueOnce(
        new CategoriaError("descripcion es requerida (máximo 100 caracteres)", 400),
      );

      const respuesta = await request(app)
        .post("/api/categorias")
        .set("Authorization", `Bearer ${token("Administrador")}`)
        .send({ descripcion: "   " });

      expect(respuesta.status).toBe(400);
    });

    it("crea la categoría cuando Administrador envía datos válidos", async () => {
      mockCategoriaService.crearCategoria.mockResolvedValueOnce({
        idCategoria: 5,
        descripcion: "Filtros",
      });

      const respuesta = await request(app)
        .post("/api/categorias")
        .set("Authorization", `Bearer ${token("Administrador")}`)
        .send({ descripcion: "Filtros" });

      expect(respuesta.status).toBe(201);
      expect(respuesta.body).toEqual({ categoria: { idCategoria: 5, descripcion: "Filtros" } });
    });

    it("traduce un CategoriaError de conflicto a 409", async () => {
      mockCategoriaService.crearCategoria.mockRejectedValueOnce(
        new CategoriaError("Ya existe una categoría con esa descripción", 409),
      );

      const respuesta = await request(app)
        .post("/api/categorias")
        .set("Authorization", `Bearer ${token("Administrador")}`)
        .send({ descripcion: "Frenos" });

      expect(respuesta.status).toBe(409);
      expect(respuesta.body).toEqual({ message: "Ya existe una categoría con esa descripción" });
    });
  });

  describe("PUT /api/categorias/:id", () => {
    it("rechaza un id no numérico con 400", async () => {
      const respuesta = await request(app)
        .put("/api/categorias/abc")
        .set("Authorization", `Bearer ${token("Administrador")}`)
        .send({ descripcion: "Frenos" });

      expect(respuesta.status).toBe(400);
    });

    it("edita la categoría cuando el id y el body son válidos", async () => {
      mockCategoriaService.editarCategoria.mockResolvedValueOnce({
        idCategoria: 1,
        descripcion: "Frenos y pastillas",
      });

      const respuesta = await request(app)
        .put("/api/categorias/1")
        .set("Authorization", `Bearer ${token("Administrador")}`)
        .send({ descripcion: "Frenos y pastillas" });

      expect(respuesta.status).toBe(200);
      expect(mockCategoriaService.editarCategoria).toHaveBeenCalledWith(1, {
        descripcion: "Frenos y pastillas",
      });
    });
  });

  describe("DELETE /api/categorias/:id", () => {
    it("rechaza a Operador con 403", async () => {
      const respuesta = await request(app)
        .delete("/api/categorias/1")
        .set("Authorization", `Bearer ${token("Operador")}`);

      expect(respuesta.status).toBe(403);
      expect(mockCategoriaService.eliminarCategoria).not.toHaveBeenCalled();
    });

    it("elimina y responde 204 cuando Administrador la borra sin repuestos asociados", async () => {
      mockCategoriaService.eliminarCategoria.mockResolvedValueOnce(undefined);

      const respuesta = await request(app)
        .delete("/api/categorias/1")
        .set("Authorization", `Bearer ${token("Administrador")}`);

      expect(respuesta.status).toBe(204);
    });

    it("traduce el conflicto de repuestos asociados a 409", async () => {
      mockCategoriaService.eliminarCategoria.mockRejectedValueOnce(
        new CategoriaError("No se puede eliminar: hay repuestos asignados a esta categoría", 409),
      );

      const respuesta = await request(app)
        .delete("/api/categorias/1")
        .set("Authorization", `Bearer ${token("Administrador")}`);

      expect(respuesta.status).toBe(409);
      expect(respuesta.body.message).toMatch(/repuestos asignados/);
    });
  });

  // T-101: validación de tipo y tamaño de archivo en la carga masiva.
  describe("POST /api/categorias/carga-masiva", () => {
    it("rechaza a Operador con 403 sin llegar a leer el archivo", async () => {
      const buffer = await crearBufferExcel(["Frenos"]);

      const respuesta = await request(app)
        .post("/api/categorias/carga-masiva")
        .set("Authorization", `Bearer ${token("Operador")}`)
        .attach("archivo", buffer, "categorias.xlsx");

      expect(respuesta.status).toBe(403);
      expect(mockCategoriaService.crearCategoriasEnLote).not.toHaveBeenCalled();
    });

    it("rechaza con 400 si no se adjunta ningún archivo", async () => {
      const respuesta = await request(app)
        .post("/api/categorias/carga-masiva")
        .set("Authorization", `Bearer ${token("Administrador")}`);

      expect(respuesta.status).toBe(400);
      expect(mockCategoriaService.crearCategoriasEnLote).not.toHaveBeenCalled();
    });

    it("rechaza con 400 un archivo que no es .xlsx (por extensión/mimetype)", async () => {
      const respuesta = await request(app)
        .post("/api/categorias/carga-masiva")
        .set("Authorization", `Bearer ${token("Administrador")}`)
        .attach("archivo", Buffer.from("no soy un excel"), {
          filename: "categorias.txt",
          contentType: "text/plain",
        });

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.message).toMatch(/\.xlsx/i);
      expect(mockCategoriaService.crearCategoriasEnLote).not.toHaveBeenCalled();
    });

    it("rechaza con 413 un archivo que supera el tamaño máximo", async () => {
      const archivoGrande = Buffer.alloc(6 * 1024 * 1024, "a"); // 6 MB > límite de 5 MB

      const respuesta = await request(app)
        .post("/api/categorias/carga-masiva")
        .set("Authorization", `Bearer ${token("Administrador")}`)
        .attach("archivo", archivoGrande, "categorias.xlsx");

      expect(respuesta.status).toBe(413);
      expect(mockCategoriaService.crearCategoriasEnLote).not.toHaveBeenCalled();
    });

    it("rechaza con 400 un .xlsx sin columna 'descripcion'", async () => {
      const buffer = await crearBufferExcel(["Frenos"], { encabezado: "nombre" });

      const respuesta = await request(app)
        .post("/api/categorias/carga-masiva")
        .set("Authorization", `Bearer ${token("Administrador")}`)
        .attach("archivo", buffer, "categorias.xlsx");

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.message).toMatch(/descripcion/i);
      expect(mockCategoriaService.crearCategoriasEnLote).not.toHaveBeenCalled();
    });

    it("rechaza con 400 un .xlsx sin filas de datos", async () => {
      const buffer = await crearBufferExcel([]);

      const respuesta = await request(app)
        .post("/api/categorias/carga-masiva")
        .set("Authorization", `Bearer ${token("Administrador")}`)
        .attach("archivo", buffer, "categorias.xlsx");

      expect(respuesta.status).toBe(400);
    });

    it("parsea el .xlsx real y delega la creación en el servicio", async () => {
      const buffer = await crearBufferExcel(["Frenos", "Filtros", ""]);
      mockCategoriaService.crearCategoriasEnLote.mockResolvedValueOnce({
        creadas: [
          { idCategoria: 1, descripcion: "Frenos" },
          { idCategoria: 2, descripcion: "Filtros" },
        ],
        errores: [],
      });

      const respuesta = await request(app)
        .post("/api/categorias/carga-masiva")
        .set("Authorization", `Bearer ${token("Administrador")}`)
        .attach("archivo", buffer, "categorias.xlsx");

      expect(respuesta.status).toBe(200);
      expect(mockCategoriaService.crearCategoriasEnLote).toHaveBeenCalledWith([
        { numeroFila: 2, descripcion: "Frenos" },
        { numeroFila: 3, descripcion: "Filtros" },
      ]);
      expect(respuesta.body.creadas).toHaveLength(2);
    });

    it("propaga el reporte de errores por fila que arma el servicio", async () => {
      const buffer = await crearBufferExcel(["Frenos"]);
      mockCategoriaService.crearCategoriasEnLote.mockResolvedValueOnce({
        creadas: [],
        errores: [{ fila: 2, descripcion: "Frenos", motivo: "Ya existe una categoría con esa descripción" }],
      });

      const respuesta = await request(app)
        .post("/api/categorias/carga-masiva")
        .set("Authorization", `Bearer ${token("Administrador")}`)
        .attach("archivo", buffer, "categorias.xlsx");

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.errores).toEqual([
        { fila: 2, descripcion: "Frenos", motivo: "Ya existe una categoría con esa descripción" },
      ]);
    });
  });
});
