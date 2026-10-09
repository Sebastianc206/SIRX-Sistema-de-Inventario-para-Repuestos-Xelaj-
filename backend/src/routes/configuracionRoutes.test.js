jest.mock("../utils/prismaClient", () => ({
  configuracion: { findUnique: jest.fn(), upsert: jest.fn() },
  articulo: { findMany: jest.fn(), updateMany: jest.fn() },
  categoria: { findUnique: jest.fn() },
}));

const jwt = require("jsonwebtoken");
const request = require("supertest");
const prisma = require("../utils/prismaClient");
const app = require("../app");

function token(role) {
  return jwt.sign({ sub: 1, username: "usuario-test", role }, process.env.JWT_SECRET, { expiresIn: "1h" });
}
const admin = () => ({ Authorization: `Bearer ${token("Administrador")}` });
const operador = () => ({ Authorization: `Bearer ${token("Operador")}` });

describe("Rutas /api/configuracion/stock", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("401 sin token", async () => {
    expect((await request(app).get("/api/configuracion/stock")).status).toBe(401);
  });

  it("Operador recibe 403 en todos los endpoints", async () => {
    expect((await request(app).get("/api/configuracion/stock").set(operador())).status).toBe(403);
    expect((await request(app).get("/api/configuracion/stock/impacto?umbral=3").set(operador())).status).toBe(403);
    expect((await request(app).put("/api/configuracion/stock").set(operador()).send({ umbralGeneral: 3 })).status).toBe(403);
    expect(
      (await request(app).post("/api/configuracion/stock/umbral-masivo").set(operador()).send({ umbral: 3, skus: ["A"] })).status,
    ).toBe(403);
    expect(prisma.configuracion.upsert).not.toHaveBeenCalled();
    expect(prisma.articulo.updateMany).not.toHaveBeenCalled();
  });

  it("Administrador obtiene el umbral general e impacto", async () => {
    prisma.configuracion.findUnique.mockResolvedValue({ valor: "5" });
    prisma.articulo.findMany.mockResolvedValue([
      { inventarioMinimo: null, inventario: { cantidad: 2 } },
      { inventarioMinimo: null, inventario: { cantidad: 50 } },
    ]);

    const r = await request(app).get("/api/configuracion/stock").set(admin());

    expect(r.status).toBe(200);
    expect(r.body).toEqual({
      umbralGeneral: 5,
      impacto: { totalActivos: 2, enBajo: 1, agotados: 0, conUmbralPropio: 0 },
    });
  });

  it("PUT guarda un umbral válido", async () => {
    prisma.configuracion.upsert.mockResolvedValue({});
    prisma.configuracion.findUnique.mockResolvedValue({ valor: "12" });
    prisma.articulo.findMany.mockResolvedValue([]);

    const r = await request(app).put("/api/configuracion/stock").set(admin()).send({ umbralGeneral: 12 });

    expect(r.status).toBe(200);
    expect(r.body.umbralGeneral).toBe(12);
  });

  it.each([[-1], [2.5], ["abc"], ["7"], [null], [100000], [undefined]])(
    "PUT rechaza umbralGeneral=%p con 400",
    async (valor) => {
      const r = await request(app).put("/api/configuracion/stock").set(admin()).send({ umbralGeneral: valor });
      expect(r.status).toBe(400);
      expect(r.body.message).toBeDefined();
      expect(prisma.configuracion.upsert).not.toHaveBeenCalled();
    },
  );

  it("impacto valida el query string", async () => {
    expect((await request(app).get("/api/configuracion/stock/impacto?umbral=abc").set(admin())).status).toBe(400);
    expect((await request(app).get("/api/configuracion/stock/impacto").set(admin())).status).toBe(400);
    expect((await request(app).get("/api/configuracion/stock/impacto?umbral=-3").set(admin())).status).toBe(400);
    prisma.articulo.findMany.mockResolvedValue([]);
    const ok = await request(app).get("/api/configuracion/stock/impacto?umbral=9").set(admin());
    expect(ok.status).toBe(200);
    expect(ok.body.umbral).toBe(9);
  });

  it("umbral masivo por SKUs y por categoría", async () => {
    prisma.articulo.updateMany.mockResolvedValue({ count: 3 });
    prisma.categoria.findUnique.mockResolvedValue({ idCategoria: 2 });

    const porSkus = await request(app)
      .post("/api/configuracion/stock/umbral-masivo")
      .set(admin())
      .send({ umbral: 4, skus: ["A", "B", "C"] });
    expect(porSkus.status).toBe(200);
    expect(porSkus.body).toEqual({ actualizados: 3 });

    const porCategoria = await request(app)
      .post("/api/configuracion/stock/umbral-masivo")
      .set(admin())
      .send({ umbral: null, idCategoria: 2 });
    expect(porCategoria.status).toBe(200);
  });

  it("umbral masivo valida el cuerpo y no filtra errores internos", async () => {
    const sinObjetivo = await request(app).post("/api/configuracion/stock/umbral-masivo").set(admin()).send({ umbral: 3 });
    expect(sinObjetivo.status).toBe(400);

    const malUmbral = await request(app)
      .post("/api/configuracion/stock/umbral-masivo")
      .set(admin())
      .send({ umbral: "x", skus: ["A"] });
    expect(malUmbral.status).toBe(400);

    jest.spyOn(console, "error").mockImplementation(() => {});
    prisma.configuracion.findUnique.mockRejectedValue(new Error("fallo interno secreto: tabla xyz"));
    const interno = await request(app).get("/api/configuracion/stock").set(admin());
    expect(interno.status).toBe(500);
    expect(JSON.stringify(interno.body)).not.toContain("secreto");
    console.error.mockRestore();
  });
});
