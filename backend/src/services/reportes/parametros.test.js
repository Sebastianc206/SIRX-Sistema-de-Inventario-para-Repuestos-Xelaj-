const { resolverRango, normalizarFiltros, describirFiltros } = require("./parametros");
const { ReporteError } = require("./errores");

describe("parametros de reportes", () => {
  describe("resolverRango", () => {
    it("usa los últimos 30 días (hora de Guatemala) cuando no hay fechas", () => {
      const hoy = new Date("2026-10-08T20:00:00Z"); // 14:00 en Guatemala
      const r = resolverRango({}, hoy);
      expect(r.hastaISO).toBe("2026-10-08");
      expect(r.desdeISO).toBe("2026-09-09");
      expect(r.dias).toBe(30);
    });

    it("interpreta las fechas como días de Guatemala (UTC-6) y deja hasta exclusivo", () => {
      const r = resolverRango({ fechaDesde: "2026-10-01", fechaHasta: "2026-10-03" });
      expect(r.desde.toISOString()).toBe("2026-10-01T06:00:00.000Z");
      expect(r.hasta.toISOString()).toBe("2026-10-04T06:00:00.000Z");
      expect(r.dias).toBe(3);
      // El período previo mide lo mismo y termina donde empieza el actual.
      expect(r.previoHasta.toISOString()).toBe(r.desde.toISOString());
      expect(r.previoDesde.toISOString()).toBe("2026-09-28T06:00:00.000Z");
    });

    it.each([
      ["01/10/2026", "2026-10-03"],
      ["2026-10-01", "hoy"],
      ["2026-02-31", "2026-03-05"],
      ["2026-13-01", "2026-13-02"],
      ["'; DROP TABLE articulo;--", "2026-10-03"],
    ])("rechaza fechas con formato inválido (%s, %s)", (desde, hasta) => {
      expect(() => resolverRango({ fechaDesde: desde, fechaHasta: hasta })).toThrow(ReporteError);
    });

    it("rechaza desde > hasta y rangos mayores a 366 días", () => {
      expect(() => resolverRango({ fechaDesde: "2026-10-05", fechaHasta: "2026-10-01" })).toThrow(/posterior/);
      expect(() => resolverRango({ fechaDesde: "2025-01-01", fechaHasta: "2026-10-01" })).toThrow(/366/);
      expect(resolverRango({ fechaDesde: "2025-10-08", fechaHasta: "2026-10-08" }).dias).toBe(366);
    });
  });

  describe("normalizarFiltros", () => {
    it("solo procesa los filtros declarados e ignora el resto", () => {
      const f = normalizarFiltros(["idCategoria"], { idCategoria: "3", idMarca: "9", top: "5" });
      expect(f).toEqual({ idCategoria: 3 });
    });

    it("acota top entre 1 y 100 y usa 20 por defecto", () => {
      expect(normalizarFiltros(["top"], {})).toEqual({ top: 20 });
      expect(normalizarFiltros(["top"], { top: "100" })).toEqual({ top: 100 });
      expect(() => normalizarFiltros(["top"], { top: "101" })).toThrow(/entre 1 y 100/);
      expect(() => normalizarFiltros(["top"], { top: "0" })).toThrow(ReporteError);
      expect(() => normalizarFiltros(["top"], { top: "-5" })).toThrow(ReporteError);
      expect(() => normalizarFiltros(["top"], { top: "1e3" })).toThrow(ReporteError);
    });

    it("valida listas cerradas (ventana, agrupación, tipo, agruparPor, orden)", () => {
      expect(normalizarFiltros(["ventana"], { ventana: "60" })).toEqual({ ventana: 60 });
      expect(() => normalizarFiltros(["ventana"], { ventana: "45" })).toThrow(/30, 60 o 90/);
      expect(() => normalizarFiltros(["agrupacion"], { agrupacion: "anio" })).toThrow(ReporteError);
      expect(() => normalizarFiltros(["tipo"], { tipo: "x" })).toThrow(ReporteError);
      expect(() => normalizarFiltros(["agruparPor"], { agruparPor: "marca" })).toThrow(ReporteError);
      expect(() => normalizarFiltros(["orden"], { orden: "costo" })).toThrow(ReporteError);
    });

    it("rechaza ids que no son enteros positivos", () => {
      expect(() => normalizarFiltros(["idCategoria"], { idCategoria: "abc" })).toThrow(ReporteError);
      expect(() => normalizarFiltros(["idMarca"], { idMarca: "1 OR 1=1" })).toThrow(ReporteError);
      expect(() => normalizarFiltros(["idMarca"], { idMarca: ["1", "2"] })).toThrow(ReporteError);
    });
  });

  it("describirFiltros arma líneas legibles para el encabezado", () => {
    const filtros = normalizarFiltros(["rango", "idCategoria", "top"], {
      fechaDesde: "2026-10-01",
      fechaHasta: "2026-10-08",
      idCategoria: "2",
    });
    const lineas = describirFiltros(filtros, { categoria: "Frenos" });
    expect(lineas).toEqual([
      { etiqueta: "Período", valor: "01/10/2026 al 08/10/2026 (8 días)" },
      { etiqueta: "Categoría", valor: "Frenos" },
      { etiqueta: "Top", valor: "20" },
    ]);
  });
});
