const prisma = require("../utils/prismaClient");
const { siguienteId } = require("../utils/siguienteId");
const { esEnteroPositivo, esNumeroPositivo } = require("../utils/validadores");

const PAGINA_POR_DEFECTO = 1;
const POR_PAGINA_POR_DEFECTO = 20;
const POR_PAGINA_MAXIMO = 100;
const MAX_LINEAS = 50;

class CompraError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

function formatearLinea(detalle) {
  return {
    idDetalleCompra: detalle.idDetalleCompra,
    sku: detalle.sku,
    nombre: detalle.articulo?.nombre,
    cantidad: detalle.cantidad,
    precioCompra: detalle.precioCompra,
  };
}

// HU-08: precioCompra/montoTotalCompra son datos de costo — igual que
// precioCosto en Articulo, el rol Operador no debe recibirlos (CLAUDE.md,
// sección de seguridad transversal).
function formatearCompra(compra, { ocultarDatosSensibles }) {
  const base = {
    idCompra: compra.idCompra,
    fechaCompra: compra.fechaCompra,
    anulada: compra.anulada,
    proveedor: compra.proveedor
      ? { idProveedor: compra.proveedor.idProveedor, nombre: compra.proveedor.nombre }
      : null,
    colaborador: compra.colaborador
      ? { idColaborador: compra.colaborador.idColaborador, nombreCompleto: `${compra.colaborador.nombres} ${compra.colaborador.primerApel}` }
      : null,
    lineas: (compra.detalles ?? []).map((d) => ({
      idDetalleCompra: d.idDetalleCompra,
      sku: d.sku,
      nombre: d.articulo?.nombre,
      cantidad: d.cantidad,
    })),
  };

  if (ocultarDatosSensibles) {
    return base;
  }

  return {
    ...base,
    montoTotalCompra: compra.montoTotalCompra,
    lineas: (compra.detalles ?? []).map(formatearLinea),
  };
}

const INCLUDE_COMPRA_COMPLETA = {
  proveedor: true,
  colaborador: true,
  detalles: { include: { articulo: true } },
};

function validarLineas(lineas) {
  if (!Array.isArray(lineas) || lineas.length === 0) {
    throw new CompraError("Debes indicar al menos una línea de compra", 400);
  }
  if (lineas.length > MAX_LINEAS) {
    throw new CompraError(`No puedes registrar más de ${MAX_LINEAS} líneas en una sola compra`, 400);
  }
  for (const linea of lineas) {
    if (typeof linea.sku !== "string" || linea.sku.trim() === "") {
      throw new CompraError("Cada línea debe indicar un sku válido", 400);
    }
    if (!esEnteroPositivo(linea.cantidad)) {
      throw new CompraError(`La cantidad de la línea "${linea.sku}" debe ser un entero mayor a 0`, 400);
    }
    if (!esNumeroPositivo(linea.precioCompra)) {
      throw new CompraError(`El precio de compra de la línea "${linea.sku}" debe ser mayor a 0`, 400);
    }
  }
}

async function validarReferencias({ idProveedor, lineas }) {
  const proveedor = await prisma.proveedor.findUnique({ where: { idProveedor } });
  if (!proveedor) {
    throw new CompraError("El proveedor indicado no existe", 400);
  }

  const skus = [...new Set(lineas.map((l) => l.sku.trim()))];
  if (skus.length !== lineas.length) {
    throw new CompraError("No repitas el mismo sku en dos líneas de la misma compra", 400);
  }
  const articulos = await prisma.articulo.findMany({ where: { sku: { in: skus } } });
  if (articulos.length !== skus.length) {
    throw new CompraError("Uno o más repuestos indicados no existen", 400);
  }
}

// HU-08: registra una compra a proveedor con una o varias líneas de
// producto y, en la misma transacción, incrementa Inventario.cantidad por
// cada línea — la compra y el ajuste de stock no pueden quedar a medias.
async function crearCompra(idColaborador, datos) {
  const { idProveedor, fechaCompra, lineas = [] } = datos;

  if (idProveedor === undefined || idProveedor === null) {
    throw new CompraError("idProveedor es requerido", 400);
  }
  validarLineas(lineas);
  await validarReferencias({ idProveedor, lineas });

  const fecha = fechaCompra ? new Date(fechaCompra) : new Date();
  if (Number.isNaN(fecha.getTime())) {
    throw new CompraError("fechaCompra no es una fecha válida", 400);
  }

  const montoTotalCompra = lineas.reduce(
    (acumulado, l) => acumulado + Number(l.cantidad) * Number(l.precioCompra),
    0,
  );

  const idCompra = await prisma.$transaction(async (tx) => {
    const nuevoIdCompra = await siguienteId(tx, "compraMaestro", "idCompra");

    await tx.compraMaestro.create({
      data: {
        idCompra: nuevoIdCompra,
        fechaCompra: fecha,
        montoTotalCompra,
        idColaborador,
        idProveedor,
      },
    });

    for (const linea of lineas) {
      const sku = linea.sku.trim();
      // eslint-disable-next-line no-await-in-loop
      const idDetalleCompra = await siguienteId(tx, "compraDetalle", "idDetalleCompra");
      // eslint-disable-next-line no-await-in-loop
      await tx.compraDetalle.create({
        data: {
          idDetalleCompra,
          idCompra: nuevoIdCompra,
          sku,
          cantidad: Number(linea.cantidad),
          precioCompra: Number(linea.precioCompra),
          fecCompra: fecha,
        },
      });

      // eslint-disable-next-line no-await-in-loop
      await tx.inventario.update({
        where: { sku },
        data: { cantidad: { increment: Number(linea.cantidad) } },
      });
    }

    return nuevoIdCompra;
  });

  return obtenerCompraPorId(idCompra, { ocultarDatosSensibles: false });
}

async function obtenerCompraPorId(idCompra, { ocultarDatosSensibles }) {
  const compra = await prisma.compraMaestro.findUnique({
    where: { idCompra },
    include: INCLUDE_COMPRA_COMPLETA,
  });
  if (!compra) {
    throw new CompraError("Compra no encontrada", 404);
  }
  return formatearCompra(compra, { ocultarDatosSensibles });
}

// HU-08 (listado de apoyo): historial de compras, más reciente primero.
async function listarCompras({ pagina, porPagina, ocultarDatosSensibles }) {
  const paginaActual = Number.isInteger(pagina) && pagina > 0 ? pagina : PAGINA_POR_DEFECTO;
  const tamanoPagina =
    Number.isInteger(porPagina) && porPagina > 0
      ? Math.min(porPagina, POR_PAGINA_MAXIMO)
      : POR_PAGINA_POR_DEFECTO;

  const [total, compras] = await Promise.all([
    prisma.compraMaestro.count(),
    prisma.compraMaestro.findMany({
      include: INCLUDE_COMPRA_COMPLETA,
      orderBy: { fechaCompra: "desc" },
      skip: (paginaActual - 1) * tamanoPagina,
      take: tamanoPagina,
    }),
  ]);

  return {
    compras: compras.map((c) => formatearCompra(c, { ocultarDatosSensibles })),
    paginacion: {
      pagina: paginaActual,
      porPagina: tamanoPagina,
      total,
      totalPaginas: Math.max(1, Math.ceil(total / tamanoPagina)),
    },
  };
}

// HU-08/anular: reversión de una compra (Administrador). En una sola
// transacción decrementa el stock de cada línea (el inverso de crearCompra,
// que lo incrementó) y marca anulada=true — se rechaza si eso dejaría el
// stock de algún sku en negativo (ej. parte de esa compra ya se vendió) o
// si la compra ya estaba anulada.
async function anularCompra(idCompra) {
  const compra = await prisma.compraMaestro.findUnique({
    where: { idCompra },
    include: { detalles: true },
  });
  if (!compra) {
    throw new CompraError("Compra no encontrada", 404);
  }
  if (compra.anulada) {
    throw new CompraError("La compra ya está anulada", 400);
  }

  const skus = compra.detalles.map((d) => d.sku);
  const inventarios = await prisma.inventario.findMany({ where: { sku: { in: skus } } });
  const inventarioPorSku = new Map(inventarios.map((i) => [i.sku, i]));

  for (const linea of compra.detalles) {
    const inventario = inventarioPorSku.get(linea.sku);
    if (!inventario || inventario.cantidad < linea.cantidad) {
      throw new CompraError(
        `No se puede anular: el stock de "${linea.sku}" quedaría negativo (parte de esta compra ya se usó)`,
        400,
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const linea of compra.detalles) {
      // eslint-disable-next-line no-await-in-loop
      await tx.inventario.update({
        where: { sku: linea.sku },
        data: { cantidad: { decrement: linea.cantidad } },
      });
    }

    await tx.compraMaestro.update({
      where: { idCompra },
      data: { anulada: true },
    });
  });

  return obtenerCompraPorId(idCompra, { ocultarDatosSensibles: false });
}

module.exports = { CompraError, crearCompra, obtenerCompraPorId, listarCompras, anularCompra };
