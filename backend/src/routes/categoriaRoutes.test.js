const mockCategoriaService = {
  listarCategorias: jest.fn(),
  crearCategoria: jest.fn(),
  editarCategoria: jest.fn(),
  eliminarCategoria: jest.fn(),
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
const app = require("../app");
const { CategoriaError } = require("../services/categoriaService");

function token(role, idColaborador = 1) {
  return jwt.sign({ sub: idColaborador, username: "usuario-test", role }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
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

    it("rechaza descripción vacía con 400 antes de llamar al servicio", async () => {
      const respuesta = await request(app)
        .post("/api/categorias")
        .set("Authorization", `Bearer ${token("Administrador")}`)
        .send({ descripcion: "   " });

      expect(respuesta.status).toBe(400);
      expect(mockCategoriaService.crearCategoria).not.toHaveBeenCalled();
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
});
