const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// Carga de DATOS DE DEMOSTRACIÓN — separada a propósito de prisma/seed.js
// (que crea lo mínimo indispensable para que la app arranque: roles,
// usuarios y geografía de referencia). Este script inventa un catálogo
// pequeño pero realista para probar en el navegador las historias ya
// implementadas (HU-04 catálogo, HU-05 carga masiva, HU-06 búsqueda y
// filtros, HU-26 proveedores) sin tener que dar de alta cada fila a mano.
//
// No se pensó para producción: no crea clientes, compras ni ventas reales,
// solo catálogo. Requiere haber corrido `npm run prisma:seed` antes (usa
// los países/departamentos/municipios de ahí para los proveedores).
//
// Uso: npm run prisma:seed:demo

const CATEGORIAS = [
  { idCategoria: 1, descripcion: "Frenos" },
  { idCategoria: 2, descripcion: "Filtros" },
  { idCategoria: 3, descripcion: "Lubricantes" },
  { idCategoria: 4, descripcion: "Suspensión" },
];

const MARCAS = [
  { idMarca: 1, nombre: "Bosch" },
  { idMarca: 2, nombre: "Gates" },
  { idMarca: 3, nombre: "Fram" },
  { idMarca: 4, nombre: "Monroe" },
];

const MODELOS = [
  { idModelo: 1, descripcion: "Toyota Hilux 2015-2020" },
  { idModelo: 2, descripcion: "Toyota Corolla 2018-2022" },
  { idModelo: 3, descripcion: "Honda Civic 2016-2021" },
];

// idPais/idDepartamento/idMunicipio referencian el seed geográfico de
// prisma/seed.js (Guatemala=1; Quetzaltenango dep=1/mun=1; Guatemala dep=2/mun=2).
const PROVEEDORES = [
  {
    idProveedor: 1,
    nombre: "Repuestos Guate S.A.",
    direccion: "Zona 4, Ciudad de Guatemala",
    contacto: "2222-3333",
    idPais: 1,
    idDepartamento: 2,
    idMunicipio: 2,
  },
  {
    idProveedor: 2,
    nombre: "Importadora Xelajú",
    direccion: "Zona 3, Quetzaltenango",
    contacto: "7777-4444",
    idPais: 1,
    idDepartamento: 1,
    idMunicipio: 1,
  },
];

// Tabla de referencia para el futuro módulo de ventas (todavía no
// implementado) — se siembra ya para que esa historia no dependa de crear
// esto a mano; no se usa en ningún endpoint hoy.
const TIPOS_SALIDA = [
  { idTipoSalida: 1, descripcion: "Venta" },
  { idTipoSalida: 2, descripcion: "Merma" },
  { idTipoSalida: 3, descripcion: "Uso interno" },
  { idTipoSalida: 4, descripcion: "Garantía" },
];

// Mezcla deliberada de niveles de stock: varios quedan por debajo de su
// inventarioMinimo para poder demostrar la alerta visual (⚠) de
// RepuestosPage sin tener que registrar movimientos de inventario a mano
// (esa historia todavía no existe).
const ARTICULOS = [
  {
    sku: "FRE-100",
    nombre: "Pastillas de freno delanteras",
    idCategoria: 1,
    idMarca: 1,
    idProveedor: 1,
    precioVenta: 180,
    precioCosto: 110,
    inventarioMinimo: 5,
    ubicacion: "Estante A1",
    cantidad: 12,
    modelos: [1],
  },
  {
    sku: "FRE-101",
    nombre: "Discos de freno traseros",
    idCategoria: 1,
    idMarca: 4,
    idProveedor: 1,
    precioVenta: 320,
    precioCosto: 210,
    inventarioMinimo: 3,
    ubicacion: "Estante A2",
    cantidad: 2, // stock bajo
    modelos: [2],
  },
  {
    sku: "FRE-102",
    nombre: "Banda de freno de mano",
    idCategoria: 1,
    idMarca: 1,
    idProveedor: null,
    precioVenta: 95,
    precioCosto: 55,
    inventarioMinimo: 4,
    ubicacion: "Estante A1",
    cantidad: 0, // sin stock
    modelos: [],
  },
  {
    sku: "FIL-100",
    nombre: "Filtro de aceite",
    idCategoria: 2,
    idMarca: 3,
    idProveedor: 2,
    precioVenta: 45,
    precioCosto: 22,
    inventarioMinimo: 10,
    ubicacion: "Estante B1",
    cantidad: 25,
    modelos: [1, 2, 3],
  },
  {
    sku: "FIL-101",
    nombre: "Filtro de aire",
    idCategoria: 2,
    idMarca: 3,
    idProveedor: 2,
    precioVenta: 60,
    precioCosto: 30,
    inventarioMinimo: 8,
    ubicacion: "Estante B1",
    cantidad: 4, // stock bajo
    modelos: [1],
  },
  {
    sku: "FIL-102",
    nombre: "Filtro de combustible",
    idCategoria: 2,
    idMarca: 1,
    idProveedor: null,
    precioVenta: 55,
    precioCosto: 28,
    inventarioMinimo: 6,
    ubicacion: "Estante B2",
    cantidad: 15,
    modelos: [3],
  },
  {
    sku: "LUB-100",
    nombre: "Aceite sintético 5W-30 (galón)",
    idCategoria: 3,
    idMarca: null,
    idProveedor: 2,
    precioVenta: 220,
    precioCosto: 150,
    inventarioMinimo: 4,
    ubicacion: "Bodega",
    cantidad: 8,
    modelos: [],
  },
  {
    sku: "LUB-101",
    nombre: "Grasa multipropósito",
    idCategoria: 3,
    idMarca: null,
    idProveedor: null,
    precioVenta: 35,
    precioCosto: 18,
    inventarioMinimo: 5,
    ubicacion: "Bodega",
    cantidad: 20,
    modelos: [],
  },
  {
    sku: "SUS-100",
    nombre: "Amortiguador delantero",
    idCategoria: 4,
    idMarca: 4,
    idProveedor: 2,
    precioVenta: 450,
    precioCosto: 290,
    inventarioMinimo: 2,
    ubicacion: "Estante C1",
    cantidad: 1, // stock bajo
    modelos: [3],
  },
  {
    sku: "SUS-101",
    nombre: "Rótula de suspensión",
    idCategoria: 4,
    idMarca: null,
    idProveedor: null,
    precioVenta: 150,
    precioCosto: 90,
    inventarioMinimo: 3,
    ubicacion: "Estante C1",
    cantidad: 6,
    modelos: [1],
  },
];

async function main() {
  for (const categoria of CATEGORIAS) {
    // eslint-disable-next-line no-await-in-loop -- lista fija y pequeña.
    await prisma.categoria.upsert({
      where: { idCategoria: categoria.idCategoria },
      update: {},
      create: categoria,
    });
  }

  for (const marca of MARCAS) {
    // eslint-disable-next-line no-await-in-loop
    await prisma.marca.upsert({ where: { idMarca: marca.idMarca }, update: {}, create: marca });
  }

  for (const modelo of MODELOS) {
    // eslint-disable-next-line no-await-in-loop
    await prisma.modelo.upsert({ where: { idModelo: modelo.idModelo }, update: {}, create: modelo });
  }

  for (const proveedor of PROVEEDORES) {
    // eslint-disable-next-line no-await-in-loop
    await prisma.proveedor.upsert({
      where: { idProveedor: proveedor.idProveedor },
      update: {},
      create: proveedor,
    });
  }

  for (const tipoSalida of TIPOS_SALIDA) {
    // eslint-disable-next-line no-await-in-loop
    await prisma.tipoSalida.upsert({
      where: { idTipoSalida: tipoSalida.idTipoSalida },
      update: {},
      create: tipoSalida,
    });
  }

  for (const articulo of ARTICULOS) {
    const { cantidad, modelos, ...datosArticulo } = articulo;

    // eslint-disable-next-line no-await-in-loop
    await prisma.articulo.upsert({
      where: { sku: articulo.sku },
      update: {},
      create: datosArticulo,
    });

    // eslint-disable-next-line no-await-in-loop
    await prisma.inventario.upsert({
      where: { sku: articulo.sku },
      update: {},
      create: { sku: articulo.sku, cantidad },
    });

    for (const idModelo of modelos) {
      // eslint-disable-next-line no-await-in-loop
      await prisma.modeloCompatible.upsert({
        where: { sku_idModelo: { sku: articulo.sku, idModelo } },
        update: {},
        create: { sku: articulo.sku, idModelo },
      });
    }
  }

  console.log(
    `Datos de demostración listos: ${CATEGORIAS.length} categorías, ${MARCAS.length} marcas, ` +
      `${MODELOS.length} modelos, ${PROVEEDORES.length} proveedores, ${ARTICULOS.length} repuestos.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
