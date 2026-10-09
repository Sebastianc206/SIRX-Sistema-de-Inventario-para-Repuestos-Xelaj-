const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// DATOS DE CARGA — SOLO PARA PRUEBAS DE RENDIMIENTO (no es demo ni producción).
//
// Genera N repuestos sintéticos para probar la pantalla de Ventas/Repuestos
// con catálogos grandes (100 / 500 / 1000+). Todos llevan el prefijo de SKU
// "LOAD-" para identificarlos y borrarlos con facilidad.
//
// Uso (desde backend/):
//   node prisma/seedCargaMasiva.js              -> crea 600 repuestos LOAD-*
//   node prisma/seedCargaMasiva.js --cantidad=1500
//   node prisma/seedCargaMasiva.js --borrar     -> elimina TODO lo LOAD-*
//
// Requiere haber corrido antes `npm run prisma:seed` y `npm run prisma:seed:demo`
// (usa las categorías y marcas ya existentes). Es idempotente: re-ejecutarlo
// no duplica (skipDuplicates por SKU).
//
// --borrar también elimina las líneas de venta/compra/ajuste de prueba que
// hayan tocado SKUs LOAD-* (y las ventas/compras que queden vacías), para
// dejar la base como estaba. No toca ningún otro dato.

const PREFIJO = "LOAD-";
const DEFECTO = 600;

const NOMBRES = [
  "Pastillas de freno",
  "Disco de freno",
  "Filtro de aceite",
  "Filtro de aire",
  "Filtro de combustible",
  "Amortiguador",
  "Bujía",
  "Correa de distribución",
  "Batería",
  "Aceite sintético",
  "Rotula",
  "Terminal de dirección",
  "Bomba de agua",
  "Radiador",
  "Banda serpentina",
  "Sensor de oxígeno",
  "Kit de embrague",
  "Cable de bujía",
];
const POSICIONES = ["delantero", "trasero", "izquierdo", "derecho", "universal"];

function argCantidad() {
  const a = process.argv.find((x) => x.startsWith("--cantidad="));
  const n = a ? Number(a.split("=")[1]) : DEFECTO;
  return Number.isInteger(n) && n > 0 && n <= 20000 ? n : DEFECTO;
}

// Pseudoaleatorio determinista (mismos datos en cada corrida).
function lcg(semilla) {
  let s = semilla;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

async function crear() {
  const cantidad = argCantidad();
  const [categorias, marcas] = await Promise.all([prisma.categoria.findMany(), prisma.marca.findMany()]);
  if (categorias.length === 0) {
    throw new Error("No hay categorías: corre primero `npm run prisma:seed:demo`.");
  }
  const azar = lcg(42);
  const articulos = [];
  const inventario = [];

  for (let i = 1; i <= cantidad; i += 1) {
    const sku = `${PREFIJO}${String(i).padStart(5, "0")}`;
    const nombre = `${NOMBRES[i % NOMBRES.length]} ${POSICIONES[i % POSICIONES.length]} #${i}`;
    const categoria = categorias[Math.floor(azar() * categorias.length)];
    const marca = marcas.length > 0 && azar() > 0.15 ? marcas[Math.floor(azar() * marcas.length)] : null;
    const costo = Math.round((20 + azar() * 480) * 100) / 100;
    const venta = Math.round(costo * (1.25 + azar() * 0.5) * 100) / 100;
    const r = azar();
    // 12% agotados, 18% con pocas unidades, el resto con stock holgado.
    const cantidadInv = r < 0.12 ? 0 : r < 0.3 ? 1 + Math.floor(azar() * 6) : 7 + Math.floor(azar() * 190);

    articulos.push({
      sku,
      nombre,
      // ~10% con umbral propio; el resto usa el general (null).
      inventarioMinimo: azar() < 0.1 ? Math.floor(azar() * 15) : null,
      precioVenta: venta,
      precioCosto: costo,
      ubicacion: `Estante ${String.fromCharCode(65 + (i % 8))}${1 + (i % 12)}`,
      idCategoria: categoria.idCategoria,
      idMarca: marca ? marca.idMarca : null,
    });
    inventario.push({ sku, cantidad: cantidadInv });
  }

  const a = await prisma.articulo.createMany({ data: articulos, skipDuplicates: true });
  const inv = await prisma.inventario.createMany({ data: inventario, skipDuplicates: true });
  console.log(`Datos de carga: ${a.count} repuestos y ${inv.count} registros de inventario creados (prefijo ${PREFIJO}).`);
}

async function borrar() {
  const enPrefijo = { sku: { startsWith: PREFIJO } };
  await prisma.$transaction(async (tx) => {
    const ventas = await tx.salidaDetalle.findMany({ where: enPrefijo, select: { idSalida: true } });
    const compras = await tx.compraDetalle.findMany({ where: enPrefijo, select: { idCompra: true } });
    const idsVentas = [...new Set(ventas.map((v) => v.idSalida))];
    const idsCompras = [...new Set(compras.map((c) => c.idCompra))];

    const d1 = await tx.salidaDetalle.deleteMany({ where: enPrefijo });
    const d2 = await tx.compraDetalle.deleteMany({ where: enPrefijo });

    // Solo se borran maestros que quedaron sin líneas (los mixtos se respetan).
    const huerfanasVentas = await tx.salidaMaestro.findMany({
      where: { idVenta: { in: idsVentas }, detalles: { none: {} } },
      select: { idVenta: true },
    });
    const huerfanasCompras = await tx.compraMaestro.findMany({
      where: { idCompra: { in: idsCompras }, detalles: { none: {} } },
      select: { idCompra: true },
    });
    await tx.salidaMaestro.deleteMany({ where: { idVenta: { in: huerfanasVentas.map((v) => v.idVenta) } } });
    await tx.compraMaestro.deleteMany({ where: { idCompra: { in: huerfanasCompras.map((c) => c.idCompra) } } });

    await tx.modeloCompatible.deleteMany({ where: enPrefijo });
    const inv = await tx.inventario.deleteMany({ where: enPrefijo });
    const art = await tx.articulo.deleteMany({ where: enPrefijo });
    console.log(
      `Borrado: ${art.count} repuestos, ${inv.count} inventarios, ${d1.count} líneas de salida, ` +
        `${d2.count} líneas de compra, ${huerfanasVentas.length} ventas y ${huerfanasCompras.length} compras vacías.`,
    );
  });
}

(process.argv.includes("--borrar") ? borrar() : crear())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
