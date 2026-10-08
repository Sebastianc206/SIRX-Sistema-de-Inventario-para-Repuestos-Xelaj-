const prisma = require("../utils/prismaClient");

const ID_TIPO_SALIDA_VENTA = 1;

// HU-12: un repuesto tiene alerta de stock bajo cuando su existencia ya
// llegó a (o quedó por debajo de) su inventarioMinimo — mismo mapeo que la
// UI de catálogo (CONTEXTO_SIRX.md §8): "Stock bajo" = 0 < cantidad <=
// mínimo, "Agotado" = cantidad = 0. Acá se cuentan ambos como alerta.
async function listarAlertasStockBajo() {
  const articulos = await prisma.articulo.findMany({
    where: { estado: true },
    include: { inventario: true },
  });

  return articulos
    .filter((a) => (a.inventario?.cantidad ?? 0) <= a.inventarioMinimo)
    .map((a) => ({
      sku: a.sku,
      nombre: a.nombre,
      cantidadInventario: a.inventario?.cantidad ?? 0,
      inventarioMinimo: a.inventarioMinimo,
    }))
    .sort((a, b) => a.cantidadInventario - b.cantidadInventario);
}

// HU-15: tablero principal. ventasHoy es un dato financiero (ingreso del
// día) — CLAUDE.md pide que Operador no vea datos financieros, así que solo
// se calcula/devuelve cuando ocultarDatosSensibles es false.
async function obtenerResumenDashboard({ ocultarDatosSensibles }) {
  const inicioHoy = new Date();
  inicioHoy.setHours(0, 0, 0, 0);

  const [skusActivos, alertasStockBajo, ventasHoy] = await Promise.all([
    prisma.articulo.count({ where: { estado: true } }),
    listarAlertasStockBajo(),
    ocultarDatosSensibles
      ? Promise.resolve(null)
      : prisma.salidaMaestro.aggregate({
          // idTipoSalida vive en SalidaDetalle desde la migración
          // `20260914000000_tipo_salida_por_linea` (ver ventaService.js) —
          // una salida cuenta como venta cuando todas sus líneas lo son.
          where: {
            detalles: { every: { idTipoSalida: ID_TIPO_SALIDA_VENTA } },
            fechaSalida: { gte: inicioHoy },
            anulada: false,
          },
          _sum: { montoTotalVenta: true },
          _count: true,
        }),
  ]);

  return {
    skusActivos,
    alertasStockBajo,
    ventasHoy: ocultarDatosSensibles
      ? null
      : { total: ventasHoy._sum.montoTotalVenta ?? 0, cantidad: ventasHoy._count },
  };
}

module.exports = { listarAlertasStockBajo, obtenerResumenDashboard };
