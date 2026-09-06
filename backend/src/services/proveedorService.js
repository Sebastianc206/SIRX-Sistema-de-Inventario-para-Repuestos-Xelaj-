const prisma = require("../utils/prismaClient");
const { siguienteId } = require("../utils/siguienteId");
const { esTextoValido, esTextoOpcionalValido } = require("../utils/validadores");

const NOMBRE_MAX_LENGTH = 150;
const DIRECCION_MAX_LENGTH = 255;
const CONTACTO_MAX_LENGTH = 255;

class ProveedorError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

function formatearProveedor(proveedor) {
  return {
    idProveedor: proveedor.idProveedor,
    nombre: proveedor.nombre,
    direccion: proveedor.direccion,
    contacto: proveedor.contacto,
    vigente: proveedor.vigente,
    idPais: proveedor.idPais,
    idDepartamento: proveedor.idDepartamento,
    idMunicipio: proveedor.idMunicipio,
  };
}

// T-099: se valida cada campo por separado; en editar cada uno es opcional
// (solo se exige si vino en el body) — mismo patrón que articuloService.
function validarCampos(datos, { requerido }) {
  const { nombre, direccion, contacto } = datos;

  if (requerido || nombre !== undefined) {
    if (!esTextoValido(nombre, { max: NOMBRE_MAX_LENGTH })) {
      throw new ProveedorError(`nombre es requerido (máximo ${NOMBRE_MAX_LENGTH} caracteres)`, 400);
    }
  }

  if (!esTextoOpcionalValido(direccion, { max: DIRECCION_MAX_LENGTH })) {
    throw new ProveedorError(`direccion debe tener máximo ${DIRECCION_MAX_LENGTH} caracteres`, 400);
  }

  if (!esTextoOpcionalValido(contacto, { max: CONTACTO_MAX_LENGTH })) {
    throw new ProveedorError(`contacto debe tener máximo ${CONTACTO_MAX_LENGTH} caracteres`, 400);
  }
}

async function validarReferencias({ idPais, idDepartamento, idMunicipio }) {
  if (idPais !== undefined) {
    const pais = await prisma.pais.findUnique({ where: { idPais } });
    if (!pais) {
      throw new ProveedorError("El país indicado no existe", 400);
    }
  }

  if (idDepartamento !== undefined && idDepartamento !== null) {
    const departamento = await prisma.departamento.findUnique({ where: { idDepartamento } });
    if (!departamento) {
      throw new ProveedorError("El departamento indicado no existe", 400);
    }
  }

  if (idMunicipio !== undefined && idMunicipio !== null) {
    const municipio = await prisma.municipio.findUnique({ where: { idMunicipio } });
    if (!municipio) {
      throw new ProveedorError("El municipio indicado no existe", 400);
    }
    // Consistencia: un municipio pertenece a un solo departamento (ver
    // Municipio.idDepartamento en el esquema) — si además se indicó un
    // departamento, deben coincidir.
    if (idDepartamento !== undefined && idDepartamento !== null && municipio.idDepartamento !== idDepartamento) {
      throw new ProveedorError("El municipio indicado no pertenece al departamento indicado", 400);
    }
  }
}

async function listarProveedores() {
  const proveedores = await prisma.proveedor.findMany({ orderBy: { nombre: "asc" } });
  return proveedores.map(formatearProveedor);
}

async function crearProveedor(datos) {
  const { idPais, idDepartamento, idMunicipio, direccion, contacto } = datos;

  validarCampos(datos, { requerido: true });

  if (idPais === undefined || idPais === null) {
    throw new ProveedorError("idPais es requerido", 400);
  }

  await validarReferencias({ idPais, idDepartamento, idMunicipio });

  const proveedor = await prisma.$transaction(async (tx) => {
    const idProveedor = await siguienteId(tx, "proveedor", "idProveedor");
    return tx.proveedor.create({
      data: {
        idProveedor,
        nombre: datos.nombre.trim(),
        direccion: direccion?.trim() || null,
        contacto: contacto?.trim() || null,
        idPais,
        idDepartamento: idDepartamento ?? null,
        idMunicipio: idMunicipio ?? null,
      },
    });
  });

  return formatearProveedor(proveedor);
}

async function editarProveedor(idProveedor, datos) {
  const proveedor = await prisma.proveedor.findUnique({ where: { idProveedor } });
  if (!proveedor) {
    throw new ProveedorError("Proveedor no encontrado", 404);
  }

  validarCampos(datos, { requerido: false });

  const { idPais, idDepartamento, idMunicipio } = datos;
  await validarReferencias({ idPais, idDepartamento, idMunicipio });

  const dataActualizada = {};
  if (datos.nombre !== undefined) dataActualizada.nombre = datos.nombre.trim();
  if (datos.direccion !== undefined) dataActualizada.direccion = datos.direccion?.trim() || null;
  if (datos.contacto !== undefined) dataActualizada.contacto = datos.contacto?.trim() || null;
  if (idPais !== undefined) dataActualizada.idPais = idPais;
  if (idDepartamento !== undefined) dataActualizada.idDepartamento = idDepartamento;
  if (idMunicipio !== undefined) dataActualizada.idMunicipio = idMunicipio;

  const actualizado = await prisma.proveedor.update({ where: { idProveedor }, data: dataActualizada });
  return formatearProveedor(actualizado);
}

module.exports = { ProveedorError, listarProveedores, crearProveedor, editarProveedor };
