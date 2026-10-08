const prisma = require("../utils/prismaClient");
const { siguienteId } = require("../utils/siguienteId");
const { esEnteroPositivo, esNumeroPositivo } = require("../utils/validadores");
const { construirRangoFecha } = require("../utils/rangoFechas");
const { restaurarStockYAnular } = require("./salidaComunService");

const PAGINA_POR_DEFECTO = 1;
const POR_PAGINA_POR_DEFECTO = 20;
const POR_PAGINA_MAXIMO = 100;
const MAX_LINEAS = 50;
const ID_TIPO_SALIDA_VENTA = 1;

class VentaError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

// HU-13/14: montoTotalVenta y precioVenta por línea NO son datos sensibles
// en el sentido de CLAUDE.md (precioVenta ya es visible a Operador en el
// catálogo) — a diferencia de compras, acá no se oculta nada por rol.
function formatearVenta(venta) {
  return {
    idVenta: venta.idVenta,
    fechaSalida: venta.fechaSalida,
    montoTotalVenta: venta.montoTotalVenta,
    anulada: venta.anulada,
    cliente: venta.cliente ? { idCliente: venta.cliente.idCliente, nombre: venta.cliente.nombre } : null,
    colaborador: venta.colaborador
      ? {
          idColaborador: venta.colaborador.idColaborador,
          nombreCompleto: `${venta.colaborador.nombres} ${venta.colaborador.primerApel}`,
        }
      : null,
    lineas: (venta.detalles ?? []).map((d) => ({
      idDetalleSalida: d.idDetalleSalida,
      sku: d.sku,
      nombre: d.articulo?.nombre,
      cantidad: d.cantidad,
      precioVenta: d.precioVenta,
    })),
  };
}

const INCLUDE_VENTA_COMPLETA = {
  cliente: true,
  colaborador: true,
  detalles: { include: { articulo: true } },
};

function validarLineas(lineas) {
  if (!Array.isArray(lineas) || lineas.length === 0) {
    throw new VentaError("Debes indicar al menos una línea de venta", 400);
  }
  if (lineas.length > MAX_LINEAS) {
    throw new VentaError(`No puedes registrar más de ${MAX_LINEAS} líneas en una sola venta`, 400);
  }
  for (const linea of lineas) {
    if (typeof linea.sku !== "string" || linea.sku.trim() === "") {
      throw new VentaError("Cada línea debe indicar un sku válido", 400);
    }
    if (!esEnteroPositivo(linea.cantidad)) {
      throw new VentaError(`La cantidad de la línea "${linea.sku}" debe ser un entero mayor a 0`, 400);
    }
    if (!esNumeroPositivo(linea.precioVenta)) {
      throw new VentaError(`El precio de venta de la línea "${linea.sku}" debe ser mayor a 0`, 400);
    }
  }
}

async function validarReferenciasYStock({ idCliente, lineas }) {
  if (idCliente !== undefined && idCliente !== null) {
    const cliente = await prisma.cliente.findUnique({ where: { idCliente } });
    if (!cliente) {
      throw new VentaError("El cliente indicado no existe", 400);
    }
  }

  const skus = [...new Set(lineas.map((l) => l.sku.trim()))];
  if (skus.length !== lineas.length) {
    throw new VentaError("No repitas el mismo sku en dos líneas de la misma venta", 400);
  }

  const inventarios = await prisma.inventario.findMany({ where: { sku: { in: skus } } });
  const inventarioPorSku = new Map(inventarios.map((i) => [i.sku, i]));

  for (const linea of lineas) {
    const sku = linea.sku.trim();
    const inventario = inventarioPorSku.get(sku);
    if (!inventario) {
      throw new VentaError(`El repuesto "${sku}" no existe`, 400);
    }
    if (inventario.cantidad < Number(linea.cantidad)) {
      throw new VentaError(
        `Stock insuficiente para "${sku}": hay ${inventario.cantidad} y se pidieron ${linea.cantidad}`,
        400,
      );
    }
  }
}

// HU-13: venta de mostrador con una o varias líneas de producto. En una
// sola transacción: calcula el total, crea SalidaMaestro/SalidaDetalle y
// descuenta Inventario.cantidad de cada línea.
async function crearVenta(idColaborador, datos) {
  const { idCliente, fechaSalida, lineas = [] } = datos;

  validarLineas(lineas);
  await validarReferenciasYStock({ idCliente, lineas });

  const fecha = fechaSalida ? new Date(fechaSalida) : new Date();
  if (Number.isNaN(fecha.getTime())) {
    throw new VentaError("fechaSalida no es una fecha válida", 400);
  }

  const montoTotalVenta = lineas.reduce(
    (acumulado, l) => acumulado + Number(l.cantidad) * Number(l.precioVenta),
    0,
  );

  const idVenta = await prisma.$transaction(async (tx) => {
    const nuevoIdVenta = await siguienteId(tx, "salidaMaestro", "idVenta");

    await tx.salidaMaestro.create({
      data: {
        idVenta: nuevoIdVenta,
        fechaSalida: fecha,
        montoTotalVenta,
        idColaborador,
        idCliente: idCliente ?? null,
      },
    });

    for (const linea of lineas) {
      const sku = linea.sku.trim();
      // eslint-disable-next-line no-await-in-loop
      const idDetalleSalida = await siguienteId(tx, "salidaDetalle", "idDetalleSalida");
      // eslint-disable-next-line no-await-in-loop
      await tx.salidaDetalle.create({
        data: {
          idDetalleSalida,
          idSalida: nuevoIdVenta,
          sku,
          cantidad: Number(linea.cantidad),
          precioVenta: Number(linea.precioVenta),
          idTipoSalida: ID_TIPO_SALIDA_VENTA,
          fecCompra: fecha,
        },
      });

      // eslint-disable-next-line no-await-in-loop
      await tx.inventario.update({
        where: { sku },
        data: { cantidad: { decrement: Number(linea.cantidad) } },
      });
    }

    return nuevoIdVenta;
  });

  return obtenerVentaPorId(idVenta);
}

// Una salida cuenta como "venta" cuando TODAS sus líneas usan el motivo
// Venta — ver nota en schema.prisma. crearVenta siempre escribe ese mismo
// motivo en cada línea que crea, así que en la práctica nunca queda
// mezclado con ajustes/mermas.
async function obtenerVentaPorId(idVenta) {
  const venta = await prisma.salidaMaestro.findUnique({
    where: { idVenta },
    include: INCLUDE_VENTA_COMPLETA,
  });
  if (!venta || !venta.detalles.every((d) => d.idTipoSalida === ID_TIPO_SALIDA_VENTA)) {
    throw new VentaError("Venta no encontrada", 404);
  }
  return formatearVenta(venta);
}

// HU-14: historial de ventas, más reciente primero. fechaDesde/fechaHasta
// filtran por fechaSalida — resuelto acá (no en el frontend) para que la
// consulta escale con la paginación en vez de traer todo y filtrar en memoria.
async function listarVentas({ pagina, porPagina, fechaDesde, fechaHasta }) {
  const paginaActual = Number.isInteger(pagina) && pagina > 0 ? pagina : PAGINA_POR_DEFECTO;
  const tamanoPagina =
    Number.isInteger(porPagina) && porPagina > 0
      ? Math.min(porPagina, POR_PAGINA_MAXIMO)
      : POR_PAGINA_POR_DEFECTO;

  const fechaSalida = construirRangoFecha(fechaDesde, fechaHasta, VentaError);

  const where = {
    detalles: { every: { idTipoSalida: ID_TIPO_SALIDA_VENTA } },
    ...(fechaSalida ? { fechaSalida } : {}),
  };
  const [total, ventas] = await Promise.all([
    prisma.salidaMaestro.count({ where }),
    prisma.salidaMaestro.findMany({
      where,
      include: INCLUDE_VENTA_COMPLETA,
      orderBy: { fechaSalida: "desc" },
      skip: (paginaActual - 1) * tamanoPagina,
      take: tamanoPagina,
    }),
  ]);

  return {
    ventas: ventas.map(formatearVenta),
    paginacion: {
      pagina: paginaActual,
      porPagina: tamanoPagina,
      total,
      totalPaginas: Math.max(1, Math.ceil(total / tamanoPagina)),
    },
  };
}

// HU-14: reversión de venta (Administrador). En una sola transacción,
// restaura el stock de cada línea y marca la venta como anulada — nunca se
// borra el registro (baja lógica). No se puede anular dos veces.
async function anularVenta(idVenta) {
  const venta = await prisma.salidaMaestro.findUnique({
    where: { idVenta },
    include: { detalles: true },
  });
  if (!venta || !venta.detalles.every((d) => d.idTipoSalida === ID_TIPO_SALIDA_VENTA)) {
    throw new VentaError("Venta no encontrada", 404);
  }
  if (venta.anulada) {
    throw new VentaError("La venta ya está anulada", 400);
  }

  await restaurarStockYAnular(venta);

  return obtenerVentaPorId(idVenta);
}

module.exports = { VentaError, crearVenta, obtenerVentaPorId, listarVentas, anularVenta };
