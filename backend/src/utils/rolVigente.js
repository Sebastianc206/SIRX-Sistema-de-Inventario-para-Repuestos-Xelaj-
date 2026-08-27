const prisma = require("./prismaClient");

// El rol no vive en Usuario: se obtiene de la Plaza vigente del colaborador
// (aquella sin Fecha_Fin). Si tuviera varias vigentes, se toma la más reciente.
// Acepta un cliente opcional para poder usarse dentro de una transacción.
async function obtenerRolVigente(idColaborador, client = prisma) {
  const plazaVigente = await client.plaza.findFirst({
    where: { idColaborador, fechaFin: null },
    orderBy: { fechaInicio: "desc" },
    include: { rol: true },
  });

  return plazaVigente?.rol ?? null;
}

module.exports = { obtenerRolVigente };
