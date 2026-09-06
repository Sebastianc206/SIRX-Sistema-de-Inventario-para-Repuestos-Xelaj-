const prisma = require("../utils/prismaClient");

// Listados de solo lectura para selectores de otros formularios. Marca y
// Modelo (HU-04) todavía no tienen su propio CRUD — eso sería una historia
// aparte que no se ha pedido — así que por ahora solo se exponen para
// elegir un valor existente. Pais/Departamento/Municipio (HU-26) son datos
// de referencia geográfica: se cargan por seed, no hay una historia que
// pida administrarlos desde la aplicación.
//
// Nota: Proveedor tuvo su propio listado acá hasta HU-26 — ahora que tiene
// CRUD real, ese listado vive en proveedorService.js.

async function listarMarcas() {
  const marcas = await prisma.marca.findMany({ orderBy: { nombre: "asc" } });
  return marcas.map((m) => ({ idMarca: m.idMarca, nombre: m.nombre }));
}

async function listarModelos() {
  const modelos = await prisma.modelo.findMany({ orderBy: { descripcion: "asc" } });
  return modelos.map((m) => ({ idModelo: m.idModelo, descripcion: m.descripcion }));
}

async function listarPaises() {
  const paises = await prisma.pais.findMany({ orderBy: { nombre: "asc" } });
  return paises.map((p) => ({ idPais: p.idPais, nombre: p.nombre }));
}

async function listarDepartamentos() {
  const departamentos = await prisma.departamento.findMany({ orderBy: { nombre: "asc" } });
  return departamentos.map((d) => ({ idDepartamento: d.idDepartamento, nombre: d.nombre }));
}

async function listarMunicipios() {
  const municipios = await prisma.municipio.findMany({ orderBy: { nombre: "asc" } });
  return municipios.map((m) => ({
    idMunicipio: m.idMunicipio,
    nombre: m.nombre,
    idDepartamento: m.idDepartamento,
  }));
}

module.exports = {
  listarMarcas,
  listarModelos,
  listarPaises,
  listarDepartamentos,
  listarMunicipios,
};
