const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin123!";
  const operadorPassword = process.env.OPERADOR_PASSWORD || "Operador123!";

  const adminHash = await bcrypt.hash(adminPassword, 10);
  const operadorHash = await bcrypt.hash(operadorPassword, 10);

  await prisma.usuario.upsert({
    where: { username: "admin" },
    update: {},
    create: { username: "admin", passwordHash: adminHash, role: "ADMINISTRADOR" },
  });

  await prisma.usuario.upsert({
    where: { username: "operador" },
    update: {},
    create: { username: "operador", passwordHash: operadorHash, role: "OPERADOR" },
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
