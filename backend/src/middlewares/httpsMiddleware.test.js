const request = require("supertest");
const app = require("../app");

// T-103: se prueba a través de la app real (con trust proxy configurado)
// en vez de mockear req/res, para no perder de vista la interacción con
// Express al calcular req.secure/req.hostname.
describe("forzarHttps (vía app)", () => {
  it("no redirige en localhost aunque no venga X-Forwarded-Proto", async () => {
    const respuesta = await request(app).get("/health").set("Host", "localhost:3000");

    expect(respuesta.status).toBe(200);
  });

  it("no redirige en 127.0.0.1 (host por defecto de supertest)", async () => {
    const respuesta = await request(app).get("/health");

    expect(respuesta.status).toBe(200);
  });

  it("redirige 301 a https cuando el host no es local y falta X-Forwarded-Proto: https", async () => {
    const respuesta = await request(app)
      .get("/health")
      .set("Host", "sirx-backend.onrender.com")
      .redirects(0);

    expect(respuesta.status).toBe(301);
    expect(respuesta.headers.location).toBe("https://sirx-backend.onrender.com/health");
  });

  it("conserva la ruta y el query string al redirigir", async () => {
    const respuesta = await request(app)
      .get("/api/categorias?estado=activo")
      .set("Host", "sirx-backend.onrender.com")
      .redirects(0);

    expect(respuesta.status).toBe(301);
    expect(respuesta.headers.location).toBe("https://sirx-backend.onrender.com/api/categorias?estado=activo");
  });

  it("no redirige cuando X-Forwarded-Proto ya es https (detrás del proxy de Render)", async () => {
    const respuesta = await request(app)
      .get("/health")
      .set("Host", "sirx-backend.onrender.com")
      .set("X-Forwarded-Proto", "https");

    expect(respuesta.status).toBe(200);
  });
});
