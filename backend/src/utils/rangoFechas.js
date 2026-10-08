// Filtro de rango de fechas reutilizado por ventas, ajustes y los dos
// listados de MovimientosPage (historial por producto y comparación de
// ventas) — los 4 puntos de HU-10/13/14 que necesitan "Desde/Hasta"
// resuelto en el backend. `fechaHasta` se extiende al final del día
// (23:59:59.999) para que el usuario pueda elegir la fecha de hoy y
// seguir viendo los movimientos de hoy mismo.
function construirRangoFecha(fechaDesde, fechaHasta, ErrorClase) {
  const rango = {};

  if (fechaDesde) {
    const desde = new Date(fechaDesde);
    if (Number.isNaN(desde.getTime())) {
      throw new ErrorClase("fechaDesde no es una fecha válida", 400);
    }
    rango.gte = desde;
  }

  if (fechaHasta) {
    const hasta = new Date(fechaHasta);
    if (Number.isNaN(hasta.getTime())) {
      throw new ErrorClase("fechaHasta no es una fecha válida", 400);
    }
    hasta.setHours(23, 59, 59, 999);
    rango.lte = hasta;
  }

  return Object.keys(rango).length > 0 ? rango : undefined;
}

module.exports = { construirRangoFecha };
