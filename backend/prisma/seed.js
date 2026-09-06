const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const { esPasswordValida } = require("../src/utils/validadores");

const prisma = new PrismaClient();

const ROL_ADMINISTRADOR = { idRol: 1, descripcion: "Administrador" };
const ROL_OPERADOR = { idRol: 2, descripcion: "Operador" };

// HU-26: Proveedor.idPais es obligatorio, así que sin datos geográficos de
// referencia no se puede crear ni un solo proveedor. No existe (todavía)
// una historia que pida administrar país/departamento/municipio desde la
// aplicación, así que se cargan acá — un conjunto mínimo centrado en
// Quetzaltenango (sede de Repuestos Xelajú), no el catálogo completo de
// Guatemala. Se puede ampliar con otro seed más adelante si hace falta.
const PAISES = [
  { idPais: 1, nombre: "Guatemala" },
  { idPais: 2, nombre: "México" },
  { idPais: 3, nombre: "El Salvador" },
  { idPais: 4, nombre: "Honduras" },
  { idPais: 5, nombre: "Estados Unidos" },
];

const DEPARTAMENTOS = [
  { idDepartamento: 1, nombre: "Quetzaltenango" },
  { idDepartamento: 2, nombre: "Guatemala" },
  { idDepartamento: 3, nombre: "San Marcos" },
];

const MUNICIPIOS = [
  { idMunicipio: 1, nombre: "Quetzaltenango", idDepartamento: 1 },
  { idMunicipio: 2, nombre: "Guatemala", idDepartamento: 2 },
  { idMunicipio: 3, nombre: "San Marcos", idDepartamento: 3 },
];

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

// T-104: la política de contraseñas aplica también a las cuentas de
// prueba — nada distinto a lo que crearUsuarioOperador exige para
// cualquier usuario creado por la app.
function requerirPasswordSegura(nombreVariable, valor) {
  if (!esPasswordValida(valor)) {
    throw new Error(
      `${nombreVariable} no cumple la política de contraseñas (mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo).`,
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

  for (const pais of PAISES) {
    // eslint-disable-next-line no-await-in-loop -- lista fija y pequeña, no
    // hay nada que paralelizar de forma segura frente a upserts por id.
    await prisma.pais.upsert({ where: { idPais: pais.idPais }, update: {}, create: pais });
  }
  for (const departamento of DEPARTAMENTOS) {
    // eslint-disable-next-line no-await-in-loop
    await prisma.departamento.upsert({
      where: { idDepartamento: departamento.idDepartamento },
      update: {},
      create: departamento,
    });
  }
  for (const municipio of MUNICIPIOS) {
    // eslint-disable-next-line no-await-in-loop
    await prisma.municipio.upsert({
      where: { idMunicipio: municipio.idMunicipio },
      update: {},
      create: municipio,
    });
  }

  await upsertUsuarioConPlaza({
    idColaborador: 1,
    nombres: "Admin",
    primerApel: "Sistema",
    rol: ROL_ADMINISTRADOR,
    username: "admin",
    password: requerirPasswordSegura("ADMIN_PASSWORD", requerirVariableEntorno("ADMIN_PASSWORD")),
  });

  await upsertUsuarioConPlaza({
    idColaborador: 2,
    nombres: "Operador",
    primerApel: "Demo",
    rol: ROL_OPERADOR,
    username: "operador",
    password: requerirPasswordSegura("OPERADOR_PASSWORD", requerirVariableEntorno("OPERADOR_PASSWORD")),
  });

  console.log("Usuarios de prueba listos: admin / operador");
  console.log("Datos geográficos de referencia (país/departamento/municipio) listos.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
