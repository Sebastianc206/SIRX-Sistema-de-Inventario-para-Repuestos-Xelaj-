const prisma = require("../utils/prismaClient");

// Ventas y ajustes/mermas comparten SalidaMaestro/SalidaDetalle (ver
// ventaService.js/salidaAjusteService.js) — "anular una salida" (restaurar
// el stock de cada línea y marcar anulada=true, en una sola transacción) es
// exactamente la misma operación para ambos, así que vive una sola vez acá.
// Cada dominio valida primero que el id le pertenece (tipo venta vs. ajuste)
// y que no esté ya anulada, traduciendo a su propia clase de error — esta
// función asume que esas validaciones ya pasaron y `salida` trae `detalles`.
async function restaurarStockYAnular(salida) {
  await prisma.$transaction(async (tx) => {
    for (const linea of salida.detalles) {
      // eslint-disable-next-line no-await-in-loop
      await tx.inventario.update({
        where: { sku: linea.sku },
        data: { cantidad: { increment: linea.cantidad } },
      });
    }

    await tx.salidaMaestro.update({
      where: { idVenta: salida.idVenta },
      data: { anulada: true },
    });
  });
}

module.exports = { restaurarStockYAnular };
