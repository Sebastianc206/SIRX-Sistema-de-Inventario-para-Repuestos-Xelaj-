const prisma = require("../utils/prismaClient");
const {
  umbralEfectivo,
  calcularEstadoStock,
  obtenerUmbralGeneral,
} = require("./umbralStockService");

const ID_TIPO_SALIDA_VENTA = 1;

// HU-12: un repuesto tiene alerta de stock bajo cuando su existencia ya
// llegó a (o quedó por debajo de) su umbral efectivo — el del producto si
// lo tiene, si no el general configurado por el Administrador (ver
// umbralStockService.js, única fuente de la regla). "Stock bajo" = 0 <
// cantidad <= umbral, "Agotado" = cantidad = 0. Acá se cuentan ambos como
// alerta. `inventarioMinimo` en cada alerta es el umbral efectivo.
async function listarAlertasStockBajo() {
  const [articulos, umbralGeneral] = await Promise.all([
    prisma.articulo.findMany({
      where: { estado: true },
      include: { inventario: true },
    }),
    obtenerUmbralGeneral(),
  ]);

  return articulos
    .map((a) => {
      const cantidadInventario = a.inventario?.cantidad ?? 0;
      const minimo = umbralEfectivo(a.inventarioMinimo ?? null, umbralGeneral);
      return {
        sku: a.sku,
        nombre: a.nombre,
        cantidadInventario,
        inventarioMinimo: minimo,
        estadoStock: calcularEstadoStock(cantidadInventario, minimo),
      };
    })
    .filter((a) => a.estadoStock !== "en_stock")
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
