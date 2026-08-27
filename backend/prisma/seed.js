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

// T-102: sin valores de contraseña hardcodeados como fallback. Si el .env
// no define ADMIN_PASSWORD/OPERADOR_PASSWORD, el seed falla explícitamente
// en vez de crear cuentas con una contraseña conocida de antemano por
// cualquiera que lea el repositorio.
function requerirVariableEntorno(nombre) {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(
      `Falta la variable de entorno ${nombre}. Definila en backend/.env antes de correr el seed (ver backend/.env.example).`,
    );
  }
  return valor;
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
    password: requerirVariableEntorno("ADMIN_PASSWORD"),
  });

  await upsertUsuarioConPlaza({
    idColaborador: 2,
    nombres: "Operador",
    primerApel: "Demo",
    rol: ROL_OPERADOR,
    username: "operador",
    password: requerirVariableEntorno("OPERADOR_PASSWORD"),
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
