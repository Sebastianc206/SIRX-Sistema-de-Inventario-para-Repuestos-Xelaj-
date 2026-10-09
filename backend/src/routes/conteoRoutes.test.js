const mockServicio = {
  listarConteos: jest.fn(),
  crearConteo: jest.fn(),
  obtenerConteo: jest.fn(),
  guardarLineas: jest.fn(),
  eliminarLinea: jest.fn(),
  cerrarConteo: jest.fn(),
  cancelarConteo: jest.fn(),
  eliminarConteo: jest.fn(),
};

jest.mock("../services/conteoService", () => ({
  ConteoError: class ConteoError extends Error {
    constructor(message, statusCode, extra) {
      super(message);
      this.statusCode = statusCode;
      this.extra = extra;
    }
  },
  ...mockServicio,
}));

const jwt = require("jsonwebtoken");
const request = require("supertest");
const app = require("../app");
const { ConteoError } = require("../services/conteoService");

function auth(role) {
  const t = jwt.sign({ sub: 3, username: "u-test", role }, process.env.JWT_SECRET, { expiresIn: "1h" });
  return { Authorization: `Bearer ${t}` };
}

const ENDPOINTS = [
  ["get", "/api/conteos"],
  ["post", "/api/conteos"],
  ["get", "/api/conteos/1"],
  ["put", "/api/conteos/1/lineas"],
  ["delete", "/api/conteos/1/lineas/A-1"],
  ["post", "/api/conteos/1/cerrar"],
  ["post", "/api/conteos/1/cancelar"],
  ["delete", "/api/conteos/1"],
];

describe("Rutas /api/conteos", () => {
  afterEach(() => jest.resetAllMocks());

  describe.each(ENDPOINTS)("%s %s", (metodo, ruta) => {
    it("401 sin token", async () => {
      expect((await request(app)[metodo](ruta)).status).toBe(401);
    });

    it("403 para Operador y el servicio nunca se invoca", async () => {
      const r = await request(app)[metodo](ruta).set(auth("Operador")).send({});
      expect(r.status).toBe(403);
      Object.values(mockServicio).forEach((fn) => expect(fn).not.toHaveBeenCalled());
    });
  });

  it("Administrador lista conteos con filtros numéricos saneados", async () => {
    mockServicio.listarConteos.mockResolvedValue({ conteos: [], paginacion: {} });
    const r = await request(app).get("/api/conteos?estado=borrador&pagina=2&porPagina=abc").set(auth("Administrador"));
    expect(r.status).toBe(200);
    expect(mockServicio.listarConteos).toHaveBeenCalledWith({ estado: "borrador", pagina: 2, porPagina: undefined });
  });

  it("POST crea (201) con el colaborador de la sesión", async () => {
    mockServicio.crearConteo.mockResolvedValue({ idConteo: 1 });
    const r = await request(app).post("/api/conteos").set(auth("Administrador")).send({ nombre: "Conteo" });
    expect(r.status).toBe(201);
    expect(r.body.conteo.idConteo).toBe(1);
    expect(mockServicio.crearConteo.mock.calls[0][1]).toEqual({ nombre: "Conteo" });
  });

  it("PUT lineas, cerrar, cancelar y borrar delegan en el servicio", async () => {
    mockServicio.guardarLineas.mockResolvedValue({ idConteo: 1 });
    mockServicio.cerrarConteo.mockResolvedValue({ idConteo: 1, estado: "aplicado" });
    mockServicio.cancelarConteo.mockResolvedValue({ idConteo: 1, estado: "cancelado" });
    mockServicio.eliminarLinea.mockResolvedValue({ idConteo: 1 });
    mockServicio.eliminarConteo.mockResolvedValue();
    const h = auth("Administrador");

    expect((await request(app).put("/api/conteos/1/lineas").set(h).send({ lineas: [{ sku: "A", cantidad: 1 }] })).status).toBe(200);
    expect(mockServicio.guardarLineas).toHaveBeenCalledWith("1", [{ sku: "A", cantidad: 1 }]);

    const c = await request(app).post("/api/conteos/1/cerrar").set(h).send({ aplicarAjustes: true });
    expect(c.body.conteo.estado).toBe("aplicado");
    expect(mockServicio.cerrarConteo).toHaveBeenCalledWith("1", 3, { aplicarAjustes: true });

    expect((await request(app).post("/api/conteos/1/cancelar").set(h)).body.conteo.estado).toBe("cancelado");
    expect((await request(app).delete("/api/conteos/1/lineas/A-1").set(h)).status).toBe(200);
    expect((await request(app).delete("/api/conteos/1").set(h)).status).toBe(204);
  });

  it("propaga los errores de negocio con su código y datos extra (409 CAMBIO_STOCK)", async () => {
    mockServicio.cerrarConteo.mockRejectedValue(new ConteoError("Cambió", 409, { codigo: "CAMBIO_STOCK", cambios: [] }));
    const r = await request(app).post("/api/conteos/1/cerrar").set(auth("Administrador")).send({ aplicarAjustes: true });
    expect(r.status).toBe(409);
    expect(r.body).toEqual({ message: "Cambió", codigo: "CAMBIO_STOCK", cambios: [] });
  });

  it("un error inesperado devuelve 500 genérico sin detalles internos", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockServicio.obtenerConteo.mockRejectedValue(new Error("select * from usuario secreto"));
    const r = await request(app).get("/api/conteos/1").set(auth("Administrador"));
    expect(r.status).toBe(500);
    expect(r.body).toEqual({ message: "Error interno del servidor" });
    console.error.mockRestore();
  });
});
