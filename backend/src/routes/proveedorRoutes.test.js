const mockProveedorService = {
  listarProveedores: jest.fn(),
  crearProveedor: jest.fn(),
  editarProveedor: jest.fn(),
  cambiarEstadoProveedor: jest.fn(),
  eliminarProveedor: jest.fn(),
};

jest.mock("../services/proveedorService", () => ({
  ProveedorError: class ProveedorError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  ...mockProveedorService,
}));

const jwt = require("jsonwebtoken");
const request = require("supertest");
const app = require("../app");
const { ProveedorError } = require("../services/proveedorService");

function token(role) {
  return jwt.sign({ sub: 1, username: "usuario-test", role }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
}

describe("Rutas /api/proveedores", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("rechaza peticiones sin token con 401", async () => {
    const respuesta = await request(app).get("/api/proveedores");
    expect(respuesta.status).toBe(401);
  });

  describe("GET /api/proveedores", () => {
    it("T-039: rechaza a Operador con 403 (ni siquiera puede listar)", async () => {
      const respuesta = await request(app)
        .get("/api/proveedores")
        .set("Authorization", `Bearer ${token("Operador")}`);

      expect(respuesta.status).toBe(403);
      expect(mockProveedorService.listarProveedores).not.toHaveBeenCalled();
    });

    it("permite listar a Administrador", async () => {
      mockProveedorService.listarProveedores.mockResolvedValueOnce([
        { idProveedor: 1, nombre: "Repuestos Guate S.A." },
      ]);

      const respuesta = await request(app)
        .get("/api/proveedores")
        .set("Authorization", `Bearer ${token("Administrador")}`);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body).toEqual({ proveedores: [{ idProveedor: 1, nombre: "Repuestos Guate S.A." }] });
    });
  });

  describe("POST /api/proveedores", () => {
    it("T-039: rechaza a Operador con 403", async () => {
      const respuesta = await request(app)
        .post("/api/proveedores")
        .set("Authorization", `Bearer ${token("Operador")}`)
        .send({ nombre: "X", idPais: 1 });

      expect(respuesta.status).toBe(403);
      expect(mockProveedorService.crearProveedor).not.toHaveBeenCalled();
    });

    it("T-038: crea el proveedor cuando Administrador envía datos válidos", async () => {
      mockProveedorService.crearProveedor.mockResolvedValueOnce({
        idProveedor: 1,
        nombre: "Repuestos Guate S.A.",
      });

      const respuesta = await request(app)
        .post("/api/proveedores")
        .set("Authorization", `Bearer ${token("Administrador")}`)
        .send({ nombre: "Repuestos Guate S.A.", idPais: 1 });

      expect(respuesta.status).toBe(201);
      expect(respuesta.body).toEqual({ proveedor: { idProveedor: 1, nombre: "Repuestos Guate S.A." } });
    });

    it("traduce a 400 el ProveedorError de validación que lanza el servicio", async () => {
      mockProveedorService.crearProveedor.mockRejectedValueOnce(
        new ProveedorError("El país indicado no existe", 400),
      );

      const respuesta = await request(app)
        .post("/api/proveedores")
        .set("Authorization", `Bearer ${token("Administrador")}`)
        .send({ nombre: "X", idPais: 99 });

      expect(respuesta.status).toBe(400);
    });
  });

  describe("PUT /api/proveedores/:id", () => {
    it("T-039: rechaza a Operador con 403", async () => {
      const respuesta = await request(app)
        .put("/api/proveedores/1")
        .set("Authorization", `Bearer ${token("Operador")}`)
        .send({ nombre: "X" });

      expect(respuesta.status).toBe(403);
      expect(mockProveedorService.editarProveedor).not.toHaveBeenCalled();
    });

    it("rechaza un id no numérico con 400", async () => {
      const respuesta = await request(app)
        .put("/api/proveedores/abc")
        .set("Authorization", `Bearer ${token("Administrador")}`)
        .send({ nombre: "X" });

      expect(respuesta.status).toBe(400);
    });

    it("T-038: edita el proveedor cuando el id y el body son válidos", async () => {
      mockProveedorService.editarProveedor.mockResolvedValueOnce({
        idProveedor: 1,
        nombre: "Nuevo nombre",
      });

      const respuesta = await request(app)
        .put("/api/proveedores/1")
        .set("Authorization", `Bearer ${token("Administrador")}`)
        .send({ nombre: "Nuevo nombre" });

      expect(respuesta.status).toBe(200);
      expect(mockProveedorService.editarProveedor).toHaveBeenCalledWith(1, { nombre: "Nuevo nombre" });
    });
  });

  describe("PATCH /api/proveedores/:id/estado", () => {
    it("T-039: rechaza a Operador con 403", async () => {
      const respuesta = await request(app)
        .patch("/api/proveedores/1/estado")
        .set("Authorization", `Bearer ${token("Operador")}`)
        .send({ vigente: false });

      expect(respuesta.status).toBe(403);
      expect(mockProveedorService.cambiarEstadoProveedor).not.toHaveBeenCalled();
    });

    it("rechaza si vigente no es booleano", async () => {
      const respuesta = await request(app)
        .patch("/api/proveedores/1/estado")
        .set("Authorization", `Bearer ${token("Administrador")}`)
        .send({ vigente: "no" });

      expect(respuesta.status).toBe(400);
      expect(mockProveedorService.cambiarEstadoProveedor).not.toHaveBeenCalled();
    });

    it("da de baja el proveedor cuando Administrador envía vigente=false", async () => {
      mockProveedorService.cambiarEstadoProveedor.mockResolvedValueOnce({
        idProveedor: 1,
        nombre: "Repuestos Guate S.A.",
        vigente: false,
      });

      const respuesta = await request(app)
        .patch("/api/proveedores/1/estado")
        .set("Authorization", `Bearer ${token("Administrador")}`)
        .send({ vigente: false });

      expect(respuesta.status).toBe(200);
      expect(mockProveedorService.cambiarEstadoProveedor).toHaveBeenCalledWith(1, false);
      expect(respuesta.body.proveedor.vigente).toBe(false);
    });
  });

  describe("DELETE /api/proveedores/:id", () => {
    it("T-039: rechaza a Operador con 403", async () => {
      const respuesta = await request(app)
        .delete("/api/proveedores/1")
        .set("Authorization", `Bearer ${token("Operador")}`);

      expect(respuesta.status).toBe(403);
      expect(mockProveedorService.eliminarProveedor).not.toHaveBeenCalled();
    });

    it("rechaza un id no numérico con 400", async () => {
      const respuesta = await request(app)
        .delete("/api/proveedores/abc")
        .set("Authorization", `Bearer ${token("Administrador")}`);

      expect(respuesta.status).toBe(400);
    });

    it("elimina el proveedor y responde 204 cuando Administrador lo solicita", async () => {
      mockProveedorService.eliminarProveedor.mockResolvedValueOnce(undefined);

      const respuesta = await request(app)
        .delete("/api/proveedores/1")
        .set("Authorization", `Bearer ${token("Administrador")}`);

      expect(respuesta.status).toBe(204);
      expect(mockProveedorService.eliminarProveedor).toHaveBeenCalledWith(1);
    });

    it("traduce a 409 el ProveedorError si tiene historial asociado", async () => {
      mockProveedorService.eliminarProveedor.mockRejectedValueOnce(
        new ProveedorError("No se puede eliminar: tiene repuestos o compras asociadas. Solo se puede desactivar.", 409),
      );

      const respuesta = await request(app)
        .delete("/api/proveedores/1")
        .set("Authorization", `Bearer ${token("Administrador")}`);

      expect(respuesta.status).toBe(409);
    });
  });
});
