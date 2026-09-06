const prisma = require("../utils/prismaClient");

// Listados de solo lectura para los selectores del formulario de repuestos
// (HU-04). Marca, Proveedor y Modelo todavía no tienen su propio CRUD —
// eso sería una historia de usuario aparte ("gestión de marcas/proveedores")
// que no se ha pedido — así que por ahora solo se exponen para elegir un
// valor existente, no para crearlos desde acá.

async function listarMarcas() {
  const marcas = await prisma.marca.findMany({ orderBy: { nombre: "asc" } });
  return marcas.map((m) => ({ idMarca: m.idMarca, nombre: m.nombre }));
}

async function listarProveedores() {
  // Solo proveedores vigentes: no tiene sentido ofrecer como "proveedor
  // preferido" de un repuesto nuevo a uno que ya se dio de baja.
  const proveedores = await prisma.proveedor.findMany({
    where: { vigente: true },
    orderBy: { nombre: "asc" },
  });
  return proveedores.map((p) => ({ idProveedor: p.idProveedor, nombre: p.nombre }));
}

async function listarModelos() {
  const modelos = await prisma.modelo.findMany({ orderBy: { descripcion: "asc" } });
  return modelos.map((m) => ({ idModelo: m.idModelo, descripcion: m.descripcion }));
}

module.exports = { listarMarcas, listarProveedores, listarModelos };
