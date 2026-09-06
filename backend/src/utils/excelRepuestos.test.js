const ExcelJS = require("exceljs");
const { generarPlantillaRepuestos, extraerFilasDeExcel } = require("./excelRepuestos");

const ENCABEZADOS_COMPLETOS = [
  "SKU",
  "Nombre",
  "Categoria",
  "Marca",
  "Precio Venta",
  "Precio Costo",
  "Inventario Minimo",
  "Ubicacion",
  "Proveedor",
];

async function crearBuffer(encabezados, filas) {
  const workbook = new ExcelJS.Workbook();
  const hoja = workbook.addWorksheet("Repuestos");
  hoja.addRow(encabezados);
  filas.forEach((fila) => hoja.addRow(fila));
  return workbook.xlsx.writeBuffer();
}

describe("excelRepuestos", () => {
  describe("generarPlantillaRepuestos", () => {
    it("T-042: produce un .xlsx con las columnas esperadas (parseable de vuelta)", async () => {
      const buffer = await generarPlantillaRepuestos();

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const hoja = workbook.worksheets[0];

      const encabezados = [];
      hoja.getRow(1).eachCell({ includeEmpty: false }, (celda) => encabezados.push(String(celda.value)));

      expect(encabezados.join(" ")).toMatch(/SKU/i);
      expect(encabezados.join(" ")).toMatch(/Nombre/i);
      expect(encabezados.join(" ")).toMatch(/Categoria/i);
      expect(encabezados.join(" ")).toMatch(/Precio Venta/i);
      expect(encabezados.join(" ")).toMatch(/Precio Costo/i);
      expect(encabezados.join(" ")).toMatch(/Inventario Minimo/i);
    });

    it("regresión: la plantilla que se ofrece descargar se puede volver a subir tal cual", async () => {
      // Round-trip real: genera la plantilla (con el marcador " *" en las
      // columnas requeridas) y la pasa por el mismo parser que usa el
      // endpoint de carga masiva — si el encabezado generado no calza con
      // el que el parser espera, esto falla.
      const buffer = await generarPlantillaRepuestos();

      const filas = await extraerFilasDeExcel(buffer);

      expect(filas).toHaveLength(1); // la fila de ejemplo
      expect(filas[0].sku).toBe("EJEMPLO-001");
      expect(filas[0].categoria).toBe("Frenos");
    });
  });

  describe("extraerFilasDeExcel", () => {
    it("T-049: rechaza con 400 un archivo que no es un .xlsx válido", async () => {
      await expect(extraerFilasDeExcel(Buffer.from("no soy un excel"))).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("T-049: rechaza con 400 si faltan columnas requeridas", async () => {
      const buffer = await crearBuffer(["SKU", "Nombre"], [["FRE-001", "Pastillas"]]);

      await expect(extraerFilasDeExcel(buffer)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("reconoce los encabezados sin distinguir mayúsculas, acentos ni guion bajo/espacio", async () => {
      const buffer = await crearBuffer(
        ["sku", "NOMBRE", "categoría", "precio_venta", "PRECIO COSTO", "inventario minimo"],
        [["FRE-001", "Pastillas", "Frenos", 150.5, 90, 5]],
      );

      const filas = await extraerFilasDeExcel(buffer);

      expect(filas).toEqual([
        {
          numeroFila: 2,
          sku: "FRE-001",
          nombre: "Pastillas",
          categoria: "Frenos",
          marca: undefined,
          precioVenta: 150.5,
          precioCosto: 90,
          inventarioMinimo: 5,
          ubicacion: undefined,
          proveedor: undefined,
        },
      ]);
    });

    it("T-049: rechaza con 400 un archivo sin filas de datos", async () => {
      const buffer = await crearBuffer(ENCABEZADOS_COMPLETOS, []);

      await expect(extraerFilasDeExcel(buffer)).rejects.toMatchObject({ statusCode: 400 });
    });

    it("trata una celda opcional con string vacío ('') igual que una celda en blanco", async () => {
      // Regresión: una celda "tocada pero vacía" puede serializarse como ""
      // en vez de null — no debe rechazarse como si fuera un texto inválido.
      const buffer = await crearBuffer(ENCABEZADOS_COMPLETOS, [
        ["FRE-001", "Pastillas", "Frenos", "", 150.5, 90, 5, "", ""],
      ]);

      const [fila] = await extraerFilasDeExcel(buffer);

      expect(fila.marca).toBeUndefined();
      expect(fila.ubicacion).toBeUndefined();
      expect(fila.proveedor).toBeUndefined();
    });

    it("ignora filas completamente vacías entre datos", async () => {
      const buffer = await crearBuffer(ENCABEZADOS_COMPLETOS, [
        ["FRE-001", "Pastillas", "Frenos", "", 150.5, 90, 5, "", ""],
        [],
        ["FRE-002", "Disco", "Frenos", "", 200, 120, 3, "", ""],
      ]);

      const filas = await extraerFilasDeExcel(buffer);

      expect(filas).toHaveLength(2);
      expect(filas.map((f) => f.sku)).toEqual(["FRE-001", "FRE-002"]);
    });

    it("rechaza con 400 un archivo con más de 1000 filas", async () => {
      const filasDeSobra = Array.from({ length: 1001 }, (_, i) => [
        `SKU-${i}`,
        "Nombre",
        "Frenos",
        "",
        100,
        50,
        1,
        "",
        "",
      ]);
      const buffer = await crearBuffer(ENCABEZADOS_COMPLETOS, filasDeSobra);

      await expect(extraerFilasDeExcel(buffer)).rejects.toMatchObject({ statusCode: 400 });
    });
  });
});
