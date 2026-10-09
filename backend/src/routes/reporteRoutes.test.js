// Pruebas de /api/reportes de punta a punta: autenticación, roles, validación
// de parámetros, filtrado de campos sensibles, cálculos de agregación (con
// datos conocidos devueltos por la base simulada) y formato de los archivos
// (PDF, XLSX, CSV, ZIP). Solo se simula Prisma; todo lo demás es real.
const mockPrisma = {
  $queryRaw: jest.fn(),
  categoria: { findUnique: jest.fn() },
  marca: { findUnique: jest.fn() },
  colaborador: { findUnique: jest.fn() },
  configuracion: { findUnique: jest.fn() },
};

jest.mock("../utils/prismaClient", () => mockPrisma);

const jwt = require("jsonwebtoken");
const request = require("supertest");
const ExcelJS = require("exceljs");
const JSZip = require("jszip");
const app = require("../app");
const { calcularSugerido } = require("../services/reportes/definiciones/reposicion");
const { clasificarRotacion } = require("../services/reportes/definiciones/rotacion");

function token(role) {
  return jwt.sign({ sub: 1, username: "usuario-test", role }, process.env.JWT_SECRET, { expiresIn: "1h" });
}
const admin = () => ({ Authorization: `Bearer ${token("Administrador")}` });
const operador = () => ({ Authorization: `Bearer ${token("Operador")}` });

// Texto SQL plano (incluye fragmentos Prisma.sql anidados) para que la base
// simulada decida qué filas devolver según la consulta.
function sqlTexto(strings, values) {
  return strings.reduce((acc, parte, i) => {
    let valor = "";
    if (i < values.length) {
      const v = values[i];
      valor = v && Array.isArray(v.strings) ? sqlTexto(v.strings, v.values) : "?";
    }
    return acc + parte + valor;
  }, "");
}

function simularBase(respuestas) {
  mockPrisma.$queryRaw.mockImplementation(async (strings, ...values) => {
    const texto = sqlTexto(strings, values).replace(/\s+/g, " ");
    for (const [patron, filas] of respuestas) {
      if (texto.includes(patron)) return typeof filas === "function" ? filas() : filas;
    }
    throw new Error(`Consulta no simulada: ${texto.slice(0, 120)}`);
  });
}

const VENTAS_TOP = [
  { sku: "FRE-100", nombre: "Pastillas de freno", categoria: "Frenos", marca: "Brembo", unidades: 30, ingreso: 3000, ventas: 10 },
  { sku: "FIL-100", nombre: "Filtro de aceite", categoria: "Filtros", marca: "Bosch", unidades: 10, ingreso: 500, ventas: 8 },
];
const VENTAS_TOTAL = [{ unidades: 50, ingreso: 4000, productos: 3, ventas: 20 }];

function simularMasVendidos() {
  simularBase([
    ["GROUP BY d.sku, a.nombre, c.descripcion, m.nombre", VENTAS_TOP],
    ["COUNT(DISTINCT d.sku)::int AS productos", VENTAS_TOTAL],
  ]);
}

const FILAS_REPOSICION = [
  { sku: "FRE-100", nombre: "Pastillas de freno", categoria: "Frenos", cantidad: 2, umbral: 5, vendido: 60, costo: 100, proveedor: "Importadora Xelajú" },
  { sku: "FIL-100", nombre: "Filtro de aceite", categoria: "Filtros", cantidad: 0, umbral: 5, vendido: 0, costo: 20, proveedor: null },
];

describe("Rutas /api/reportes", () => {
  beforeEach(() => {
    mockPrisma.categoria.findUnique.mockResolvedValue({ idCategoria: 3, descripcion: "Frenos" });
    mockPrisma.marca.findUnique.mockResolvedValue({ idMarca: 7, nombre: "Brembo" });
    mockPrisma.colaborador.findUnique.mockResolvedValue({ nombres: "Ana", primerApel: "López" });
    mockPrisma.configuracion.findUnique.mockResolvedValue({ clave: "umbral_stock_bajo", valor: "5" });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("autenticación y roles", () => {
    it("rechaza peticiones sin token con 401", async () => {
      expect((await request(app).get("/api/reportes")).status).toBe(401);
      expect((await request(app).get("/api/reportes/mas-vendidos")).status).toBe(401);
      expect((await request(app).post("/api/reportes/descargar").send({})).status).toBe(401);
    });

    it("el catálogo muestra a cada rol solo los reportes que puede ver", async () => {
      const a = await request(app).get("/api/reportes").set(admin());
      const o = await request(app).get("/api/reportes").set(operador());
      expect(a.body.reportes.map((r) => r.id)).toEqual([
        "mas-vendidos",
        "existencias-valorizadas",
        "movimientos",
        "reposicion-sugerida",
        "rotacion-stock-muerto",
        "ventas-periodo",
        "utilidad-margen",
        "mermas-ajustes",
        "conteo-fisico",
      ]);
      expect(o.body.reportes.map((r) => r.id)).toEqual(["mas-vendidos", "reposicion-sugerida", "mermas-ajustes"]);
    });

    it.each(["existencias-valorizadas", "movimientos", "rotacion-stock-muerto", "ventas-periodo", "utilidad-margen"])(
      "Operador recibe 403 en %s y la base ni se consulta",
      async (id) => {
        const r = await request(app).get(`/api/reportes/${id}`).set(operador());
        expect(r.status).toBe(403);
        expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
      },
    );

    it("un id de reporte inexistente responde 404", async () => {
      expect((await request(app).get("/api/reportes/inventado").set(admin())).status).toBe(404);
    });
  });

  describe("validación de parámetros", () => {
    it.each([
      ["fechaDesde=2026-13-45"],
      ["fechaDesde=ayer"],
      ["fechaDesde=2026-10-08&fechaHasta=2026-10-01"],
      ["fechaDesde=2024-01-01&fechaHasta=2026-10-01"],
      ["top=101"],
      ["top=abc"],
      ["idCategoria=1%20OR%201=1"],
      ["orden=costo"],
    ])("responde 400 sin consultar la base: %s", async (consulta) => {
      const r = await request(app).get(`/api/reportes/mas-vendidos?${consulta}`).set(admin());
      expect(r.status).toBe(400);
      expect(r.body.message).toBeTruthy();
      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    });

    it("responde 400 si la categoría o la marca no existen", async () => {
      mockPrisma.categoria.findUnique.mockResolvedValue(null);
      const r = await request(app).get("/api/reportes/mas-vendidos?idCategoria=99").set(admin());
      expect(r.status).toBe(400);
      expect(r.body.message).toMatch(/categoría/);
    });

    it("Operador no puede ordenar por ingreso (403)", async () => {
      const r = await request(app).get("/api/reportes/mas-vendidos?orden=ingreso").set(operador());
      expect(r.status).toBe(403);
    });

    it("los valores del usuario viajan como parámetros enlazados, no dentro del texto SQL", async () => {
      simularMasVendidos();
      await request(app)
        .get("/api/reportes/mas-vendidos?idCategoria=3&idMarca=7&top=5&fechaDesde=2026-10-01&fechaHasta=2026-10-08")
        .set(admin());
      const llamadas = mockPrisma.$queryRaw.mock.calls;
      expect(llamadas.length).toBeGreaterThan(0);
      for (const [strings, ...values] of llamadas) {
        const plano = sqlTexto(strings, values);
        expect(plano).not.toMatch(/2026-10/);
        expect(plano).not.toMatch(/id_categoria = 3/);
        expect(plano).toMatch(/id_categoria = \?/);
      }
      const aplanar = (values) => values.flatMap((v) => (v && Array.isArray(v.values) ? aplanar(v.values) : [v]));
      const todosLosValores = llamadas.flatMap(([, ...values]) => aplanar(values));
      expect(todosLosValores).toContain(3);
      expect(todosLosValores.some((v) => v instanceof Date && v.toISOString() === "2026-10-01T06:00:00.000Z")).toBe(true);
    });

    it("un error inesperado responde 500 sin filtrar el mensaje interno", async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error("password authentication failed for user postgres"));
      const spy = jest.spyOn(console, "error").mockImplementation(() => {});
      const r = await request(app).get("/api/reportes/mas-vendidos").set(admin());
      spy.mockRestore();
      expect(r.status).toBe(500);
      expect(r.body).toEqual({ message: "Error interno del servidor" });
    });
  });

  describe("Productos más vendidos", () => {
    it("Administrador: calcula porcentajes y concentración con datos conocidos", async () => {
      simularMasVendidos();
      const r = await request(app).get("/api/reportes/mas-vendidos").set(admin());
      expect(r.status).toBe(200);
      expect(r.body.titulo).toBe("Productos más vendidos");
      expect(r.body.generadoPor).toBe("Ana López");

      const filas = r.body.tablas[0].filas;
      expect(filas[0]).toMatchObject({ posicion: 1, sku: "FRE-100", unidades: 30, pctUnidades: 60, ingreso: 3000, pctIngreso: 75 });
      expect(filas[1]).toMatchObject({ posicion: 2, unidades: 10, pctUnidades: 20, pctIngreso: 12.5 });

      const kpi = (nombre) => r.body.kpis.find((k) => k.etiqueta === nombre);
      expect(kpi("Unidades vendidas").valor).toBe(50);
      expect(kpi("Ingreso por ventas").valor).toBe(4000);
      expect(kpi("Peso del top 20").valor).toBe(80); // (30+10) / 50
      expect(r.body.grafica.items[0]).toEqual({ etiqueta: "Pastillas de freno", valor: 30 });
    });

    it("Operador: recibe unidades pero NINGÚN dato de ingreso", async () => {
      simularMasVendidos();
      const r = await request(app).get("/api/reportes/mas-vendidos").set(operador());
      expect(r.status).toBe(200);
      const texto = JSON.stringify(r.body);
      expect(texto).not.toMatch(/ingreso/i);
      expect(texto).not.toMatch(/3000|4000/);
      expect(r.body.tablas[0].columnas.map((c) => c.clave)).toEqual([
        "posicion", "sku", "nombre", "categoria", "unidades", "pctUnidades",
      ]);
      expect(r.body.tablas[0].filas[0]).toEqual({
        posicion: 1, sku: "FRE-100", nombre: "Pastillas de freno", categoria: "Frenos", unidades: 30, pctUnidades: 60,
      });
    });

    it("sin ventas devuelve el mensaje de estado vacío", async () => {
      simularBase([
        ["GROUP BY d.sku, a.nombre, c.descripcion, m.nombre", []],
        ["COUNT(DISTINCT d.sku)::int AS productos", [{ unidades: 0, ingreso: 0, productos: 0, ventas: 0 }]],
      ]);
      const r = await request(app).get("/api/reportes/mas-vendidos").set(admin());
      expect(r.body.vacio).toMatch(/ampliando/i);
      expect(r.body.tablas[0].filas).toEqual([]);
    });
  });

  describe("Existencias valorizadas (solo Administrador)", () => {
    it("valoriza a costo y a venta por categoría y marca el estado de stock", async () => {
      simularBase([
        ["GROUP BY c.descripcion", [
          { categoria: "Frenos", skus: 2, unidades: 10, valor_costo: 600, valor_venta: 1000 },
          { categoria: "Filtros", skus: 1, unidades: 4, valor_costo: 400, valor_venta: 500 },
        ]],
        ["ORDER BY valor_costo DESC, a.sku", [
          { sku: "FRE-100", nombre: "Pastillas", categoria: "Frenos", cantidad: 6, minimo_propio: null, costo: 100, venta: 160, valor_costo: 600, valor_venta: 960 },
          { sku: "FIL-100", nombre: "Filtro", categoria: "Filtros", cantidad: 4, minimo_propio: 2, costo: 100, venta: 125, valor_costo: 400, valor_venta: 500 },
          { sku: "FIL-101", nombre: "Filtro aire", categoria: "Filtros", cantidad: 0, minimo_propio: null, costo: 30, venta: 40, valor_costo: 0, valor_venta: 0 },
          { sku: "SUS-100", nombre: "Rótula", categoria: "Suspensión", cantidad: 3, minimo_propio: null, costo: 90, venta: 120, valor_costo: 270, valor_venta: 360 },
        ]],
      ]);
      const r = await request(app).get("/api/reportes/existencias-valorizadas").set(admin());
      expect(r.status).toBe(200);
      const kpi = (n) => r.body.kpis.find((k) => k.etiqueta === n);
      expect(kpi("Valor a costo").valor).toBe(1000);
      expect(kpi("Valor a precio de venta").valor).toBe(1500);
      expect(kpi("Margen potencial").valor).toBe(500);
      expect(kpi("Margen potencial").nota).toBe("33.3% sobre la venta");

      const [resumen, detalle] = r.body.tablas;
      expect(resumen.filas[0]).toMatchObject({ categoria: "Frenos", pctInventario: 60, margen: 400 });
      expect(resumen.totales).toMatchObject({ valorCosto: 1000, valorVenta: 1500, margen: 500, unidades: 14 });
      // umbral general 5: 6 > 5 en stock; 4 > propio 2 en stock; 0 agotado; 3 <= 5 bajo.
      expect(detalle.filas.map((f) => f.estado.texto)).toEqual(["En stock", "En stock", "Agotado", "Stock bajo"]);
    });
  });

  describe("Movimientos (solo Administrador)", () => {
    it("separa entradas/salidas y no suma los movimientos anulados", async () => {
      const fecha = new Date("2026-10-06T19:00:00Z");
      simularBase([
        ["GROUP BY mv.tipo, mv.anulada", [
          { tipo: "compra", anulada: false, lineas: 2, unidades: 20 },
          { tipo: "venta", anulada: false, lineas: 5, unidades: 8 },
          { tipo: "ajuste", anulada: false, lineas: 1, unidades: 2 },
          { tipo: "venta", anulada: true, lineas: 1, unidades: 4 },
        ]],
        ["ORDER BY mv.fecha DESC", [
          { fecha, tipo: "venta", etiqueta: "Venta", motivo: null, referencia: 27, sku: "FIL-100", nombre: "Filtro", cantidad: -2, usuario: "Ana López", anulada: false },
          { fecha, tipo: "compra", etiqueta: "Compra", motivo: "Importadora", referencia: 4, sku: "FIL-100", nombre: "Filtro", cantidad: 10, usuario: "Ana López", anulada: true },
        ]],
      ]);
      const r = await request(app).get("/api/reportes/movimientos?tipo=todos").set(admin());
      expect(r.status).toBe(200);
      const kpi = (n) => r.body.kpis.find((k) => k.etiqueta.startsWith(n));
      expect(kpi("Movimientos").valor).toBe(9);
      expect(kpi("Movimientos").nota).toBe("1 anulada");
      expect(kpi("Unidades que entraron").valor).toBe(20);
      expect(kpi("Unidades que salieron").valor).toBe(10);
      expect(kpi("Variación neta").valor).toBe(10);
      const filas = r.body.tablas[0].filas;
      expect(filas[0]).toMatchObject({ referencia: "V-27", cantidad: -2, estado: { texto: "Vigente" } });
      expect(filas[1]).toMatchObject({ referencia: "C-4", cantidad: 10, estado: { texto: "Anulada" } });
    });

    it("filtra por tipo con parámetro enlazado", async () => {
      simularBase([
        ["GROUP BY mv.tipo, mv.anulada", []],
        ["ORDER BY mv.fecha DESC", []],
      ]);
      const r = await request(app).get("/api/reportes/movimientos?tipo=compras").set(admin());
      expect(r.status).toBe(200);
      const valores = mockPrisma.$queryRaw.mock.calls.flatMap(([, ...v]) => v.flatMap((x) => (x && x.values ? x.values : [x])));
      expect(valores).toContain("compra");
      expect((await request(app).get("/api/reportes/movimientos?tipo=todo").set(admin())).status).toBe(400);
    });
  });

  describe("Reposición sugerida", () => {
    function simularReposicion() {
      simularBase([["ORDER BY (COALESCE(i.cantidad, 0) > 0)", FILAS_REPOSICION]]);
    }

    it("calcularSugerido: mínimo + 30 días de venta - existencia (mínimo 1; sin ventas = doble del mínimo)", () => {
      expect(calcularSugerido({ cantidad: 2, umbral: 5, vendido: 60, ventana: 30 })).toBe(63);
      expect(calcularSugerido({ cantidad: 0, umbral: 5, vendido: 0, ventana: 30 })).toBe(10);
      expect(calcularSugerido({ cantidad: 5, umbral: 5, vendido: 0, ventana: 30 })).toBe(5);
      expect(calcularSugerido({ cantidad: 0, umbral: 0, vendido: 0, ventana: 30 })).toBe(1);
      expect(calcularSugerido({ cantidad: 9, umbral: 3, vendido: 1, ventana: 90 })).toBe(1);
      expect(calcularSugerido({ cantidad: -4, umbral: 5, vendido: 0, ventana: 30 })).toBe(10);
    });

    it("Administrador: ve proveedor, costo estimado e inversión", async () => {
      simularReposicion();
      const r = await request(app).get("/api/reportes/reposicion-sugerida?ventana=30").set(admin());
      expect(r.status).toBe(200);
      const kpi = (n) => r.body.kpis.find((k) => k.etiqueta === n);
      expect(kpi("Agotados").valor).toBe(1);
      expect(kpi("Con stock bajo").valor).toBe(1);
      expect(kpi("Unidades sugeridas").valor).toBe(73); // 63 + 10
      expect(kpi("Inversión estimada").valor).toBe(6500); // 63*100 + 10*20
      expect(r.body.tablas[0].filas[0]).toMatchObject({
        sku: "FRE-100", sugerido: 63, proveedor: "Importadora Xelajú", costoEstimado: 6300,
        estado: { texto: "Stock bajo", tono: "warn" },
      });
    });

    it("Operador: ve qué reponer y cuánto, pero ningún costo ni proveedor", async () => {
      simularReposicion();
      const r = await request(app).get("/api/reportes/reposicion-sugerida").set(operador());
      expect(r.status).toBe(200);
      const texto = JSON.stringify(r.body);
      expect(texto).not.toMatch(/proveedor|Importadora|costo|inversi/i);
      expect(texto).not.toMatch(/6300|6500/);
      expect(r.body.tablas[0].filas[0].sugerido).toBe(63);
      expect(r.body.tablas[0].columnas.map((c) => c.clave)).not.toContain("costoEstimado");
    });

    it("sin productos bajo el mínimo muestra el estado vacío", async () => {
      simularBase([["ORDER BY (COALESCE(i.cantidad, 0) > 0)", []]]);
      const r = await request(app).get("/api/reportes/reposicion-sugerida").set(admin());
      expect(r.body.vacio).toMatch(/No hace falta reponer/);
    });
  });

  describe("Rotación y stock muerto (solo Administrador)", () => {
    it("clasificarRotacion: sin ventas, lenta (>180 días de cobertura) o saludable", () => {
      expect(clasificarRotacion({ vendido: 0, cobertura: null })).toBe("sin_rotacion");
      expect(clasificarRotacion({ vendido: 1, cobertura: 181 })).toBe("lenta");
      expect(clasificarRotacion({ vendido: 1, cobertura: 180 })).toBe("saludable");
      expect(clasificarRotacion({ vendido: 30, cobertura: 12 })).toBe("saludable");
    });

    it("calcula cobertura y capital inmovilizado, peor primero", async () => {
      simularBase([["JOIN inventario i ON i.sku = a.sku AND i.cantidad > 0", [
        { sku: "A", nombre: "Sano", categoria: "Frenos", cantidad: 10, costo: 10, vendido: 30, ultima_venta: new Date("2026-10-05T12:00:00Z") },
        { sku: "B", nombre: "Muerto", categoria: "Filtros", cantidad: 20, costo: 18, vendido: 0, ultima_venta: null },
        { sku: "C", nombre: "Lento", categoria: "Filtros", cantidad: 100, costo: 5, vendido: 3, ultima_venta: new Date("2026-09-20T12:00:00Z") },
      ]]]);
      const r = await request(app).get("/api/reportes/rotacion-stock-muerto?ventana=30").set(admin());
      expect(r.status).toBe(200);
      const filas = r.body.tablas[0].filas;
      expect(filas.map((f) => f.sku)).toEqual(["B", "C", "A"]);
      expect(filas[0]).toMatchObject({ cobertura: null, capital: 360, estado: { texto: "Sin rotación" } });
      expect(filas[1]).toMatchObject({ cobertura: 1000, estado: { texto: "Rotación lenta" } }); // 100 / (3/30)
      expect(filas[2]).toMatchObject({ cobertura: 10, estado: { texto: "Saludable" } });
      const kpi = (n) => r.body.kpis.find((k) => k.etiqueta.startsWith(n));
      expect(kpi("Capital inmovilizado").valor).toBe(360);
      expect(kpi("% del inventario valorizado").valor).toBeCloseTo((360 / (100 + 360 + 500)) * 100, 5);
    });
  });

  describe("Ventas por período y utilidad (solo Administrador)", () => {
    it("agrupa por período, calcula ticket promedio y variación contra el período anterior", async () => {
      const totales = [
        [{ ventas: 3, ingreso: 400, unidades: 7 }],
        [{ ventas: 2, ingreso: 200, unidades: 4 }],
      ];
      simularBase([
        ["date_trunc", [
          { periodo: "2026-10-01", ventas: 2, ingreso: 300, unidades: 5 },
          { periodo: "2026-10-02", ventas: 1, ingreso: 100, unidades: 2 },
        ]],
        ["FROM v", () => totales.shift()],
      ]);
      const r = await request(app)
        .get("/api/reportes/ventas-periodo?fechaDesde=2026-10-01&fechaHasta=2026-10-02&agrupacion=dia")
        .set(admin());
      expect(r.status).toBe(200);
      const kpi = (n) => r.body.kpis.find((k) => k.etiqueta === n);
      expect(kpi("Ingreso por ventas")).toMatchObject({ valor: 400, variacion: 100 });
      expect(kpi("Ticket promedio").valor).toBeCloseTo(133.33, 2);
      expect(kpi("Ticket promedio").variacion).toBeCloseTo(33.33, 1);
      expect(r.body.tablas[0].filas[0]).toMatchObject({ periodo: "01/10", ventas: 2, ingreso: 300, ticket: 150 });
      expect(r.body.tablas[0].totales).toMatchObject({ ventas: 3, ingreso: 400 });
      expect(r.body.comparacion.previo).toMatchObject({ ingreso: 200, ventas: 2 });
    });

    it("utilidad: ingreso - costo estimado = utilidad y margen sobre ingreso", async () => {
      simularBase([
        ["GROUP BY d.sku, a.nombre", [
          { sku: "A", nombre: "Pastillas", unidades: 10, ingreso: 1000, costo: 600 },
          { sku: "B", nombre: "Filtro", unidades: 4, ingreso: 200, costo: 160 },
        ]],
        ["COALESCE(SUM(d.cantidad * a.precio_costo), 0)::float8 AS costo", [{ unidades: 14, ingreso: 1200, costo: 760 }]],
      ]);
      const r = await request(app).get("/api/reportes/utilidad-margen").set(admin());
      expect(r.status).toBe(200);
      const kpi = (n) => r.body.kpis.find((k) => k.etiqueta === n);
      expect(kpi("Utilidad bruta").valor).toBe(440);
      expect(kpi("Margen bruto").valor).toBeCloseTo(36.667, 2);
      expect(r.body.tablas[0].filas[0]).toMatchObject({ utilidad: 400, margen: 40 });
      expect(r.body.tablas[0].filas[1]).toMatchObject({ utilidad: 40, margen: 20 });
    });
  });

  describe("Mermas y ajustes", () => {
    function simularMermas() {
      simularBase([
        ["GROUP BY t.descripcion", [
          { motivo: "Merma", lineas: 3, unidades: 5, valor: 150 },
          { motivo: "Garantía", lineas: 1, unidades: 1, valor: 30 },
        ]],
        ["GROUP BY col.nombres, col.primer_apel", [{ usuario: "Ana López", lineas: 4, unidades: 6, valor: 180 }]],
        ["ORDER BY s.fecha_salida DESC", [
          { fecha: new Date("2026-10-05T15:00:00Z"), sku: "FIL-100", nombre: "Filtro", motivo: "Merma", cantidad: 2, valor: 40, usuario: "Ana López", referencia: 22 },
        ]],
      ]);
    }

    it("Administrador: totales y valor perdido a costo", async () => {
      simularMermas();
      const r = await request(app).get("/api/reportes/mermas-ajustes").set(admin());
      expect(r.status).toBe(200);
      const kpi = (n) => r.body.kpis.find((k) => k.etiqueta.startsWith(n));
      expect(kpi("Unidades dadas de baja").valor).toBe(6);
      expect(kpi("Valor perdido").valor).toBe(180);
      expect(kpi("Motivo principal").valor).toBe("Merma");
      expect(r.body.tablas[2].filas[0]).toMatchObject({ referencia: "S-22", cantidad: -2, valor: 40 });
    });

    it("Operador: unidades y motivos, sin valor perdido en ninguna parte", async () => {
      simularMermas();
      const r = await request(app).get("/api/reportes/mermas-ajustes").set(operador());
      expect(r.status).toBe(200);
      const texto = JSON.stringify(r.body);
      expect(texto).not.toMatch(/Valor perdido|Valor a costo|precioCosto|"valor":(150|30|180|40)[,}]/);
      expect(r.body.tablas.flatMap((t) => t.columnas.map((c) => c.clave))).not.toContain("valor");
      expect(r.body.tablas[0].filas[0]).toEqual({ motivo: "Merma", lineas: 3, unidades: 5 });
      expect(r.body.grafica.items[0]).toEqual({ etiqueta: "Merma", valor: 5 });
    });
  });

  describe("descargas", () => {
    function simularVarios() {
      simularBase([
        ["GROUP BY d.sku, a.nombre, c.descripcion, m.nombre", VENTAS_TOP],
        ["COUNT(DISTINCT d.sku)::int AS productos", VENTAS_TOTAL],
        ["ORDER BY (COALESCE(i.cantidad, 0) > 0)", FILAS_REPOSICION],
      ]);
    }

    it("PDF: application/pdf, empieza con %PDF y nombre sirx_reporte-<tipo>_<fecha>.pdf", async () => {
      simularMasVendidos();
      const r = await request(app)
        .post("/api/reportes/descargar")
        .set(admin())
        .send({ formato: "pdf", reportes: [{ tipo: "mas-vendidos", filtros: { top: "5" } }] })
        .buffer(true)
        .parse((res, cb) => {
          const trozos = [];
          res.on("data", (t) => trozos.push(t));
          res.on("end", () => cb(null, Buffer.concat(trozos)));
        });
      expect(r.status).toBe(200);
      expect(r.headers["content-type"]).toMatch(/application\/pdf/);
      expect(r.headers["content-disposition"]).toMatch(/^attachment; filename="sirx_reporte-mas-vendidos_\d{4}-\d{2}-\d{2}\.pdf"$/);
      expect(r.body.subarray(0, 5).toString()).toBe("%PDF-");
      expect(r.body.subarray(-6).toString()).toContain("%%EOF");
    });

    it("XLSX: es un zip válido con hoja de resumen y datos numéricos con formato", async () => {
      simularMasVendidos();
      const r = await request(app)
        .post("/api/reportes/descargar")
        .set(admin())
        .send({ formato: "xlsx", reportes: [{ tipo: "mas-vendidos" }] })
        .parse((res, cb) => {
          const trozos = [];
          res.on("data", (t) => trozos.push(t));
          res.on("end", () => cb(null, Buffer.concat(trozos)));
        });
      expect(r.status).toBe(200);
      expect(r.headers["content-type"]).toMatch(/spreadsheetml\.sheet/);
      expect(r.body.subarray(0, 2).toString()).toBe("PK");

      const libro = new ExcelJS.Workbook();
      await libro.xlsx.load(r.body);
      expect(libro.worksheets.map((h) => h.name)).toEqual(["Resumen", "Mas vendidos"]);
      const hoja = libro.getWorksheet("Mas vendidos");
      expect(hoja.getRow(1).getCell(5).value).toBe("Unidades");
      expect(hoja.getRow(2).getCell(5).value).toBe(30);
      expect(hoja.getRow(2).getCell(7).value).toBe(3000);
      expect(hoja.getRow(2).getCell(7).numFmt).toContain("Q");
      expect(hoja.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
      expect(hoja.autoFilter).toBeTruthy();
    });

    it("CSV: UTF-8 con BOM, separado por comas y sin formato monetario", async () => {
      simularMasVendidos();
      const r = await request(app)
        .post("/api/reportes/descargar")
        .set(admin())
        .send({ formato: "csv", reportes: [{ tipo: "mas-vendidos" }] })
        .buffer(true)
        .parse((res, cb) => {
          const trozos = [];
          res.on("data", (t) => trozos.push(t));
          res.on("end", () => cb(null, Buffer.concat(trozos)));
        });
      expect(r.status).toBe(200);
      expect(r.headers["content-type"]).toMatch(/text\/csv; charset=utf-8/);
      expect([...r.body.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
      const lineas = r.body.toString("utf8").slice(1).split("\r\n");
      expect(lineas[0]).toBe("#,SKU,Producto,Categoría,Unidades,% unid.,Ingreso,% ingreso");
      expect(lineas[1]).toBe("1,FRE-100,Pastillas de freno,Frenos,30,60.0,3000.00,75.0");
    });

    it("varios reportes en CSV salen como ZIP con un CSV por reporte", async () => {
      simularVarios();
      const r = await request(app)
        .post("/api/reportes/descargar")
        .set(admin())
        .send({ formato: "csv", reportes: [{ tipo: "mas-vendidos" }, { tipo: "reposicion-sugerida" }] })
        .buffer(true)
        .parse((res, cb) => {
          const trozos = [];
          res.on("data", (t) => trozos.push(t));
          res.on("end", () => cb(null, Buffer.concat(trozos)));
        });
      expect(r.status).toBe(200);
      expect(r.headers["content-type"]).toMatch(/application\/zip/);
      expect(r.headers["content-disposition"]).toMatch(/sirx_reportes_\d{4}-\d{2}-\d{2}\.zip/);
      const zip = await JSZip.loadAsync(r.body);
      const nombres = Object.keys(zip.files).sort();
      expect(nombres).toHaveLength(2);
      expect(nombres[0]).toMatch(/^sirx_reporte-mas-vendidos_/);
      expect(nombres[1]).toMatch(/^sirx_reporte-reposicion-sugerida_/);
    });

    it("varios reportes en PDF salen combinados en un solo archivo", async () => {
      simularVarios();
      const r = await request(app)
        .post("/api/reportes/descargar")
        .set(admin())
        .send({ formato: "pdf", reportes: [{ tipo: "mas-vendidos" }, { tipo: "reposicion-sugerida" }] })
        .buffer(true)
        .parse((res, cb) => {
          const trozos = [];
          res.on("data", (t) => trozos.push(t));
          res.on("end", () => cb(null, Buffer.concat(trozos)));
        });
      expect(r.status).toBe(200);
      expect(r.headers["content-disposition"]).toMatch(/sirx_reporte-combinado_/);
      expect(r.body.subarray(0, 5).toString()).toBe("%PDF-");
    });

    it("Operador no puede descargar un reporte restringido (403) aunque pida otros permitidos", async () => {
      simularVarios();
      const r = await request(app)
        .post("/api/reportes/descargar")
        .set(operador())
        .send({ formato: "pdf", reportes: [{ tipo: "mas-vendidos" }, { tipo: "existencias-valorizadas" }] });
      expect(r.status).toBe(403);
    });

    it("Operador descarga un reporte permitido sin datos sensibles en el CSV", async () => {
      simularMasVendidos();
      const r = await request(app)
        .post("/api/reportes/descargar")
        .set(operador())
        .send({ formato: "csv", reportes: [{ tipo: "mas-vendidos" }] })
        .buffer(true)
        .parse((res, cb) => {
          const trozos = [];
          res.on("data", (t) => trozos.push(t));
          res.on("end", () => cb(null, Buffer.concat(trozos)));
        });
      expect(r.status).toBe(200);
      const texto = r.body.toString("utf8");
      expect(texto).not.toMatch(/ingreso|3000|75\.0/i);
    });

    it.each([
      [{ formato: "doc", reportes: [{ tipo: "mas-vendidos" }] }, /formato/],
      [{ formato: "pdf", reportes: [] }, /al menos un reporte/],
      [{ formato: "pdf" }, /al menos un reporte/],
      [{ formato: "pdf", reportes: [{ tipo: "mas-vendidos" }, { tipo: "mas-vendidos" }] }, /repitas/],
      [{ formato: "pdf", reportes: [{ filtros: {} }] }, /tipo/],
      [{ formato: "pdf", reportes: [{ tipo: "mas-vendidos", filtros: [1] }] }, /objeto/],
      [{ formato: "pdf", reportes: Array.from({ length: 11 }, (_, i) => ({ tipo: `r${i}` })) }, /hasta 10/],
      [{ formato: "pdf", reportes: [{ tipo: "mas-vendidos", filtros: { top: "9999" } }] }, /top/],
    ])("rechaza solicitudes inválidas con 400 (%j)", async (cuerpo, mensaje) => {
      const r = await request(app).post("/api/reportes/descargar").set(admin()).send(cuerpo);
      expect(r.status).toBe(400);
      expect(r.body.message).toMatch(mensaje);
    });

    it("un tipo de reporte desconocido responde 404", async () => {
      const r = await request(app)
        .post("/api/reportes/descargar")
        .set(admin())
        .send({ formato: "pdf", reportes: [{ tipo: "inventado" }] });
      expect(r.status).toBe(404);
    });
  });
});
