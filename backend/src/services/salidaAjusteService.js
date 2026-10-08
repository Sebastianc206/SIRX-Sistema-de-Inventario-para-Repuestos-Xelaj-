const prisma = require("../utils/prismaClient");
const { siguienteId } = require("../utils/siguienteId");
const { esEnteroPositivo } = require("../utils/validadores");
const { construirRangoFecha } = require("../utils/rangoFechas");
const { restaurarStockYAnular } = require("./salidaComunService");

const ID_TIPO_SALIDA_VENTA = 1;
const MAX_LINEAS = 50;

class SalidaAjusteError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

// HU-09: salidas de inventario que NO son una venta (ajuste, merma, uso
// interno, garantía) — se registran con las mismas tablas que una venta
// (SalidaMaestro/SalidaDetalle) pero sin cliente ni precio de línea. Desde
// la migración `20260914000000_tipo_salida_por_linea`, el motivo vive en
// SalidaDetalle (no en el maestro): cada línea puede tener un motivo
// distinto (una fila de merma y otra de garantía en la misma salida).
function formatearSalidaAjuste(salida) {
  return {
    idVenta: salida.idVenta,
    fechaSalida: salida.fechaSalida,
    anulada: salida.anulada,
    colaborador: salida.colaborador
      ? {
          idColaborador: salida.colaborador.idColaborador,
          nombreCompleto: `${salida.colaborador.nombres} ${salida.colaborador.primerApel}`,
        }
      : null,
    lineas: (salida.detalles ?? []).map((d) => ({
      idDetalleSalida: d.idDetalleSalida,
      sku: d.sku,
      nombre: d.articulo?.nombre,
      cantidad: d.cantidad,
      tipoSalida: d.tipoSalida
        ? { idTipoSalida: d.tipoSalida.idTipoSalida, descripcion: d.tipoSalida.descripcion }
        : null,
    })),
  };
}

const INCLUDE_SALIDA_COMPLETA = {
  colaborador: true,
  detalles: { include: { articulo: true, tipoSalida: true } },
};

function validarLineas(lineas) {
  if (!Array.isArray(lineas) || lineas.length === 0) {
    throw new SalidaAjusteError("Debes indicar al menos una línea de salida", 400);
  }
  if (lineas.length > MAX_LINEAS) {
    throw new SalidaAjusteError(`No puedes registrar más de ${MAX_LINEAS} líneas en una sola salida`, 400);
  }
  for (const linea of lineas) {
    if (typeof linea.sku !== "string" || linea.sku.trim() === "") {
      throw new SalidaAjusteError("Cada línea debe indicar un sku válido", 400);
    }
    if (!esEnteroPositivo(linea.cantidad)) {
      throw new SalidaAjusteError(`La cantidad de la línea "${linea.sku}" debe ser un entero mayor a 0`, 400);
    }
    if (!Number.isInteger(linea.idTipoSalida)) {
      throw new SalidaAjusteError(`La línea "${linea.sku}" debe indicar un motivo (idTipoSalida)`, 400);
    }
  }
}

async function validarReferenciasYStock({ lineas }) {
  const idsTipoSalida = [...new Set(lineas.map((l) => l.idTipoSalida))];
  const tiposSalida = await prisma.tipoSalida.findMany({ where: { idTipoSalida: { in: idsTipoSalida } } });
  const tipoSalidaPorId = new Map(tiposSalida.map((t) => [t.idTipoSalida, t]));

  for (const linea of lineas) {
    if (!tipoSalidaPorId.has(linea.idTipoSalida)) {
      throw new SalidaAjusteError(`El motivo indicado en la línea "${linea.sku}" no existe`, 400);
    }
    if (linea.idTipoSalida === ID_TIPO_SALIDA_VENTA) {
      throw new SalidaAjusteError(
        `La línea "${linea.sku}" no puede usar el motivo "Venta" — usa /api/ventas`,
        400,
      );
    }
  }

  const skus = [...new Set(lineas.map((l) => l.sku.trim()))];
  if (skus.length !== lineas.length) {
    throw new SalidaAjusteError("No repitas el mismo sku en dos líneas de la misma salida", 400);
  }

  const inventarios = await prisma.inventario.findMany({ where: { sku: { in: skus } } });
  const inventarioPorSku = new Map(inventarios.map((i) => [i.sku, i]));

  for (const linea of lineas) {
    const sku = linea.sku.trim();
    const inventario = inventarioPorSku.get(sku);
    if (!inventario) {
      throw new SalidaAjusteError(`El repuesto "${sku}" no existe`, 400);
    }
    if (inventario.cantidad < Number(linea.cantidad)) {
      throw new SalidaAjusteError(
        `Stock insuficiente para "${sku}": hay ${inventario.cantidad} y se pidieron ${linea.cantidad}`,
        400,
      );
    }
  }
}

// HU-09: registra una salida por ajuste/merma con una o varias líneas (cada
// una con su propio motivo) y, en la misma transacción, descuenta
// Inventario.cantidad de cada una.
async function crearSalidaAjuste(idColaborador, datos) {
  const { fechaSalida, lineas = [] } = datos;

  validarLineas(lineas);
  await validarReferenciasYStock({ lineas });

  const fecha = fechaSalida ? new Date(fechaSalida) : new Date();
  if (Number.isNaN(fecha.getTime())) {
    throw new SalidaAjusteError("fechaSalida no es una fecha válida", 400);
  }

  const idVenta = await prisma.$transaction(async (tx) => {
    const nuevoIdVenta = await siguienteId(tx, "salidaMaestro", "idVenta");

    await tx.salidaMaestro.create({
      data: {
        idVenta: nuevoIdVenta,
        fechaSalida: fecha,
        idColaborador,
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
          idTipoSalida: linea.idTipoSalida,
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

  return obtenerSalidaAjustePorId(idVenta);
}

// Una salida cuenta como "ajuste" (no venta) cuando NINGUNA de sus líneas
// usa el motivo Venta — ver nota en schema.prisma. Como cada flujo
// (ventaService / este servicio) escribe el mismo motivo en todas las
// líneas que crea, en la práctica un registro nunca queda mezclado, pero
// filtrar así es correcto igual si eso cambiara.
async function obtenerSalidaAjustePorId(idVenta) {
  const salida = await prisma.salidaMaestro.findUnique({
    where: { idVenta },
    include: INCLUDE_SALIDA_COMPLETA,
  });
  if (!salida || salida.detalles.some((d) => d.idTipoSalida === ID_TIPO_SALIDA_VENTA)) {
    throw new SalidaAjusteError("Salida no encontrada", 404);
  }
  return formatearSalidaAjuste(salida);
}

// HU-09 (listado de apoyo): historial de salidas no-venta, recientes primero.
// fechaDesde/fechaHasta filtran por fechaSalida — mismo criterio que
// ventaService.listarVentas.
async function listarSalidasAjuste({ fechaDesde, fechaHasta } = {}) {
  const fechaSalida = construirRangoFecha(fechaDesde, fechaHasta, SalidaAjusteError);

  const salidas = await prisma.salidaMaestro.findMany({
    where: {
      detalles: { every: { idTipoSalida: { not: ID_TIPO_SALIDA_VENTA } } },
      ...(fechaSalida ? { fechaSalida } : {}),
    },
    include: INCLUDE_SALIDA_COMPLETA,
    orderBy: { fechaSalida: "desc" },
    take: 200,
  });
  return salidas.map(formatearSalidaAjuste);
}

// HU-09/14: reversión de un ajuste/merma (Administrador) — misma operación
// que anular una venta (restaurar stock + marcar anulada), compartida en
// salidaComunService.js porque ambas usan SalidaMaestro/SalidaDetalle.
async function anularSalidaAjuste(idVenta) {
  const salida = await prisma.salidaMaestro.findUnique({
    where: { idVenta },
    include: { detalles: true },
  });
  if (!salida || salida.detalles.some((d) => d.idTipoSalida === ID_TIPO_SALIDA_VENTA)) {
    throw new SalidaAjusteError("Salida no encontrada", 404);
  }
  if (salida.anulada) {
    throw new SalidaAjusteError("La salida ya está anulada", 400);
  }

  await restaurarStockYAnular(salida);

  return obtenerSalidaAjustePorId(idVenta);
}

async function listarTiposSalidaAjuste() {
  const tipos = await prisma.tipoSalida.findMany({
    where: { idTipoSalida: { not: ID_TIPO_SALIDA_VENTA } },
    orderBy: { descripcion: "asc" },
  });
  return tipos.map((t) => ({ idTipoSalida: t.idTipoSalida, descripcion: t.descripcion }));
}

module.exports = {
  SalidaAjusteError,
  crearSalidaAjuste,
  obtenerSalidaAjustePorId,
  listarSalidasAjuste,
  listarTiposSalidaAjuste,
  anularSalidaAjuste,
};
