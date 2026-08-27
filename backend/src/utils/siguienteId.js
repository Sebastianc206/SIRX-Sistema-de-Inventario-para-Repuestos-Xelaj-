// Las tablas de este esquema no usan SERIAL/IDENTITY (ver prisma/schema.prisma):
// los IDs los asigna la aplicación. Calcula MAX(campo) + 1 dentro de la
// transacción recibida. No serializa contra escrituras concurrentes (no hay
// locking explícito), pero el volumen esperado (altas de usuario hechas por
// un administrador) hace ese riesgo aceptable para este proyecto.
async function siguienteId(tx, modelo, campo) {
  const resultado = await tx[modelo].aggregate({ _max: { [campo]: true } });
  return (resultado._max[campo] ?? 0) + 1;
}

module.exports = { siguienteId };
