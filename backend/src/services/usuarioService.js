const bcrypt = require("bcryptjs");
const prisma = require("../utils/prismaClient");
const { obtenerRolVigente } = require("../utils/rolVigente");
const { siguienteId } = require("../utils/siguienteId");

class UsuarioError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

function formatearUsuario(usuario, colaborador, rol) {
  return {
    idColaborador: usuario.idColaborador,
    username: usuario.usuario,
    nombreCompleto: `${colaborador.nombres} ${colaborador.primerApel}`,
    role: rol?.descripcion ?? null,
    vigente: usuario.vigente,
  };
}

async function obtenerUsuarioPorId(idColaborador) {
  const usuario = await prisma.usuario.findUnique({
    where: { idColaborador },
    include: { colaborador: true },
  });

  if (!usuario) {
    throw new UsuarioError("Usuario no encontrado", 404);
  }

  const rol = await obtenerRolVigente(idColaborador);
  return formatearUsuario(usuario, usuario.colaborador, rol);
}

async function crearUsuarioOperador({
  nombres,
  primerApel,
  segundoApel,
  correo,
  numeroCelular,
  username,
  password,
  idRol,
  vigente,
}) {
  const rol = await prisma.rol.findUnique({ where: { idRol } });
  if (!rol) {
    throw new UsuarioError("El rol indicado no existe", 400);
  }

  const usuarioExistente = await prisma.usuario.findUnique({ where: { usuario: username } });
  if (usuarioExistente) {
    throw new UsuarioError("El nombre de usuario ya está en uso", 409);
  }

  const contrasenaHash = await bcrypt.hash(password, 10);

  const { usuario, colaborador } = await prisma.$transaction(async (tx) => {
    const idColaborador = await siguienteId(tx, "colaborador", "idColaborador");

    const colaboradorCreado = await tx.colaborador.create({
      data: { idColaborador, nombres, primerApel, segundoApel, correo, numeroCelular },
    });

    const idPlaza = await siguienteId(tx, "plaza", "idPlaza");
    await tx.plaza.create({
      data: { idPlaza, fechaInicio: new Date(), idRol, idColaborador },
    });

    const usuarioCreado = await tx.usuario.create({
      data: {
        idColaborador,
        usuario: username,
        contrasena: contrasenaHash,
        vigente: vigente ?? true,
      },
    });

    return { usuario: usuarioCreado, colaborador: colaboradorCreado };
  });

  return formatearUsuario(usuario, colaborador, rol);
}

async function editarUsuario(idColaborador, { idRol, vigente }) {
  const usuario = await prisma.usuario.findUnique({ where: { idColaborador } });
  if (!usuario) {
    throw new UsuarioError("Usuario no encontrado", 404);
  }

  if (idRol !== undefined) {
    const rol = await prisma.rol.findUnique({ where: { idRol } });
    if (!rol) {
      throw new UsuarioError("El rol indicado no existe", 400);
    }

    await prisma.$transaction(async (tx) => {
      const plazaVigente = await tx.plaza.findFirst({ where: { idColaborador, fechaFin: null } });

      if (plazaVigente && plazaVigente.idRol === idRol) {
        return;
      }

      // Cambiar de rol no reescribe la Plaza vigente: la cierra (Fecha_Fin)
      // y abre una nueva, para conservar el historial de plazas del colaborador.
      if (plazaVigente) {
        await tx.plaza.update({
          where: { idPlaza: plazaVigente.idPlaza },
          data: { fechaFin: new Date() },
        });
      }

      const idPlaza = await siguienteId(tx, "plaza", "idPlaza");
      await tx.plaza.create({
        data: { idPlaza, fechaInicio: new Date(), idRol, idColaborador },
      });
    });
  }

  if (vigente !== undefined) {
    await prisma.usuario.update({ where: { idColaborador }, data: { vigente } });
  }

  return obtenerUsuarioPorId(idColaborador);
}

async function cambiarEstadoUsuario(idColaborador, vigente) {
  const usuario = await prisma.usuario.findUnique({ where: { idColaborador } });
  if (!usuario) {
    throw new UsuarioError("Usuario no encontrado", 404);
  }

  await prisma.usuario.update({ where: { idColaborador }, data: { vigente } });
  return obtenerUsuarioPorId(idColaborador);
}

async function listarUsuarios({ estado, idRol }) {
  const whereUsuario = {};
  if (estado === "activo") whereUsuario.vigente = true;
  if (estado === "inactivo") whereUsuario.vigente = false;

  if (idRol !== undefined) {
    const plazasDelRol = await prisma.plaza.findMany({
      where: { fechaFin: null, idRol },
      select: { idColaborador: true },
    });
    const idsColaboradores = plazasDelRol.map((p) => p.idColaborador);
    // Lista vacía -> filtro que no matchea nada, en vez de traer todos los usuarios.
    whereUsuario.idColaborador = { in: idsColaboradores.length ? idsColaboradores : [-1] };
  }

  const usuarios = await prisma.usuario.findMany({
    where: whereUsuario,
    include: { colaborador: true },
    orderBy: { idColaborador: "asc" },
  });

  const idsColaboradores = usuarios.map((u) => u.idColaborador);
  const plazasVigentes = await prisma.plaza.findMany({
    where: { idColaborador: { in: idsColaboradores }, fechaFin: null },
    include: { rol: true },
  });
  const rolPorColaborador = new Map(plazasVigentes.map((p) => [p.idColaborador, p.rol]));

  return usuarios.map((u) =>
    formatearUsuario(u, u.colaborador, rolPorColaborador.get(u.idColaborador) ?? null),
  );
}

module.exports = {
  UsuarioError,
  crearUsuarioOperador,
  editarUsuario,
  cambiarEstadoUsuario,
  listarUsuarios,
  obtenerUsuarioPorId,
};
