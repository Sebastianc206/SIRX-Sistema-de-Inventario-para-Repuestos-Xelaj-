const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const ROL_ADMINISTRADOR = { idRol: 1, descripcion: "Administrador" };
const ROL_OPERADOR = { idRol: 2, descripcion: "Operador" };

async function upsertUsuarioConPlaza({ idColaborador, nombres, primerApel, rol, username, password }) {
  await prisma.colaborador.upsert({
    where: { idColaborador },
    update: {},
    create: { idColaborador, nombres, primerApel },
  });

  const plazaVigente = await prisma.plaza.findFirst({
    where: { idColaborador, fechaFin: null },
  });

  if (!plazaVigente) {
    await prisma.plaza.create({
      data: {
        idPlaza: idColaborador,
        fechaInicio: new Date(),
        idRol: rol.idRol,
        idColaborador,
      },
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.usuario.upsert({
    where: { idColaborador },
    update: {},
    create: { idColaborador, usuario: username, contrasena: passwordHash },
  });
}

async function main() {
  await prisma.rol.upsert({
    where: { idRol: ROL_ADMINISTRADOR.idRol },
    update: {},
    create: ROL_ADMINISTRADOR,
  });
  await prisma.rol.upsert({
    where: { idRol: ROL_OPERADOR.idRol },
    update: {},
    create: ROL_OPERADOR,
  });

  await upsertUsuarioConPlaza({
    idColaborador: 1,
    nombres: "Admin",
    primerApel: "Sistema",
    rol: ROL_ADMINISTRADOR,
    username: "admin",
    password: process.env.ADMIN_PASSWORD || "Admin123!",
  });

  await upsertUsuarioConPlaza({
    idColaborador: 2,
    nombres: "Operador",
    primerApel: "Demo",
    rol: ROL_OPERADOR,
    username: "operador",
    password: process.env.OPERADOR_PASSWORD || "Operador123!",
  });

  console.log("Usuarios de prueba listos: admin / operador");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
