const prisma = require("../utils/prismaClient");
const { siguienteId } = require("../utils/siguienteId");
const { esTextoValido, esSkuValido } = require("../utils/validadores");

// Conteo físico de inventario (criterio de éxito del acta: diferencia <= 5 %
// entre el sistema y el conteo físico).
//
// ESTADOS: borrador -> aplicado (se cerró y se corrigió Inventario)
//                   -> cerrado  (se cerró SIN corregir: solo informe)
//                   -> cancelado.
// Todo estado distinto de borrador es final: no se reabre ni se vuelve a
// aplicar (cada operación bloquea la fila con SELECT ... FOR UPDATE y exige
// estado = borrador dentro de la transacción).
//
// REGLA DE CONCURRENCIA CON VENTAS: cada línea guarda `cantidadSistema`, el
// stock registrado en el instante en que se contó el SKU. La diferencia del
// conteo es contada - cantidadSistema y queda congelada. Al aplicar, la
// diferencia se SUMA al stock vigente (increment), nunca se pisa el stock
// con lo contado: así las ventas/compras posteriores al conteo del SKU se
// conservan. Si el stock vigente cambió desde que se contó (alguna línea con
// ajuste distinto de 0), el cierre responde 409 CAMBIO_STOCK con la lista, y
// solo se aplica si el Administrador lo confirma (`confirmarCambios`). Si el
// ajuste dejara un stock negativo se rechaza todo (409) y no se aplica nada.
//
// TRAZABILIDAD: el ajuste NO se escribe en salida_* ni compra_*: las salidas
// solo restan, las compras exigen proveedor y precio. Queda en
// conteo_detalle (ajuste, cantidadAntes, cantidadDespues) y
// movimientoService lo lista como "Conteo físico" en Movimientos.

const META_EXACTITUD_PCT = 5; // meta del acta: diferencia agregada <= 5 %
const ESTADOS = ["borrador", "cerrado", "aplicado", "cancelado"];
const MAX_LINEAS_POR_PETICION = 200;
const MAX_CANTIDAD = 1_000_000;
const MAX_NOMBRE = 80;
const POR_PAGINA_DEFECTO = 20;
const POR_PAGINA_MAXIMO = 100;

class ConteoError extends Error {
  constructor(message, statusCode, extra) {
    super(message);
    this.statusCode = statusCode;
    this.extra = extra;
  }
}

function redondear2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Nivel de diferencia de UNA línea (color + texto en la UI, nunca solo
// color): exacto = 0; leve = hasta la meta (5 %) del stock del sistema;
// alto = por encima. Con sistema 0 cualquier diferencia es alta.
function clasificarDiferencia(diferencia, cantidadSistema) {
  if (diferencia === 0) return "exacto";
  if (cantidadSistema <= 0) return "alto";
  return (Math.abs(diferencia) / cantidadSistema) * 100 <= META_EXACTITUD_PCT ? "leve" : "alto";
}

// Función pura: KPIs de exactitud sobre líneas {cantidadSistema,
// cantidadContada, costo?}.
//   exactitud = productos con diferencia 0 / productos contados
//   diferencia agregada = sum|contada - sistema| / sum(sistema)
// Cumple la meta si la diferencia agregada es <= META_EXACTITUD_PCT.
function calcularResumen(lineas) {
  const contados = lineas.length;
  let exactos = 0;
  let sobrantes = 0;
  let faltantes = 0;
  let unidadesSistema = 0;
  let unidadesAbsolutas = 0;
  let valorNeto = 0;
  let valorAbsoluto = 0;

  for (const l of lineas) {
    const dif = l.cantidadContada - l.cantidadSistema;
    unidadesSistema += l.cantidadSistema;
    unidadesAbsolutas += Math.abs(dif);
    if (dif === 0) exactos += 1;
    else if (dif > 0) sobrantes += dif;
    else faltantes += -dif;
    const costo = Number(l.costo ?? 0);
    valorNeto += dif * costo;
    valorAbsoluto += Math.abs(dif) * costo;
  }

  let diferenciaPct = null;
  if (contados > 0) {
    diferenciaPct = unidadesSistema > 0 ? (unidadesAbsolutas / unidadesSistema) * 100 : unidadesAbsolutas > 0 ? 100 : 0;
  }

  return {
    productosContados: contados,
    productosExactos: exactos,
    productosConDiferencia: contados - exactos,
    exactitudPct: contados > 0 ? redondear2((exactos / contados) * 100) : null,
    unidadesSistema,
    unidadesSobrantes: sobrantes,
    unidadesFaltantes: faltantes,
    unidadesDiferenciaAbs: unidadesAbsolutas,
    diferenciaPct: diferenciaPct === null ? null : redondear2(diferenciaPct),
    metaPct: META_EXACTITUD_PCT,
    cumpleMeta: diferenciaPct === null ? null : diferenciaPct <= META_EXACTITUD_PCT,
    valorDiferenciaNeto: redondear2(valorNeto),
    valorDiferenciaAbsoluto: redondear2(valorAbsoluto),
  };
}

function nombreCompleto(col) {
  return col ? { idColaborador: col.idColaborador, nombreCompleto: `${col.nombres} ${col.primerApel}`.trim() } : null;
}

function formatearCabecera(c) {
  return {
    idConteo: c.idConteo,
    nombre: c.nombre,
    fechaConteo: c.fechaConteo,
    estado: c.estado,
    categoria: c.categoria ? { idCategoria: c.categoria.idCategoria, descripcion: c.categoria.descripcion } : null,
    creador: nombreCompleto(c.creador),
    cierre: nombreCompleto(c.cierre),
    fechaCierre: c.fechaCierre,
  };
}

const INCLUDE_CABECERA = { categoria: true, creador: true, cierre: true };

function parseId(valor) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 1) throw new ConteoError("El id del conteo no es válido", 400);
  return n;
}

// Bloquea la fila del conteo hasta el fin de la transacción y devuelve su
// estado vigente (serializa guardar/cerrar/cancelar). Parámetro enlazado.
async function bloquearConteo(tx, id) {
  const filas = await tx.$queryRaw`SELECT estado, id_categoria AS "idCategoria" FROM conteo_fisico WHERE id_conteo = ${id} FOR UPDATE`;
  if (!filas || filas.length === 0) throw new ConteoError("Conteo no encontrado", 404);
  return filas[0];
}

function exigirBorrador(estado) {
  if (estado !== "borrador") {
    throw new ConteoError(`El conteo ya está ${estado}; no se puede modificar`, 409);
  }
}

function validarFecha(valor) {
  if (valor === undefined || valor === null || valor === "") return new Date();
  if (typeof valor !== "string") throw new ConteoError("fechaConteo no es una fecha válida", 400);
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) throw new ConteoError("fechaConteo no es una fecha válida", 400);
  return fecha;
}

async function crearConteo(idColaborador, datos) {
  const { nombre, fechaConteo, idCategoria } = datos ?? {};
  if (!esTextoValido(nombre, { min: 3, max: MAX_NOMBRE })) {
    throw new ConteoError(`El nombre es obligatorio (3 a ${MAX_NOMBRE} caracteres)`, 400);
  }
  const fecha = validarFecha(fechaConteo);

  let categoriaId = null;
  if (idCategoria !== undefined && idCategoria !== null && idCategoria !== "") {
    if (!Number.isInteger(idCategoria) || idCategoria < 1) {
      throw new ConteoError("idCategoria debe ser un entero positivo", 400);
    }
    const categoria = await prisma.categoria.findUnique({ where: { idCategoria } });
    if (!categoria) throw new ConteoError("La categoría indicada no existe", 400);
    categoriaId = idCategoria;
  }

  const id = await prisma.$transaction(async (tx) => {
    const nuevoId = await siguienteId(tx, "conteoFisico", "idConteo");
    await tx.conteoFisico.create({
      data: {
        idConteo: nuevoId,
        nombre: nombre.trim(),
        fechaConteo: fecha,
        estado: "borrador",
        idCategoria: categoriaId,
        idColaborador,
      },
    });
    return nuevoId;
  });

  return obtenerConteo(id);
}

async function listarConteos({ estado, pagina, porPagina } = {}) {
  if (estado !== undefined && estado !== "" && !ESTADOS.includes(estado)) {
    throw new ConteoError(`estado debe ser uno de: ${ESTADOS.join(", ")}`, 400);
  }
  const paginaActual = Number.isInteger(pagina) && pagina > 0 ? pagina : 1;
  const tamano =
    Number.isInteger(porPagina) && porPagina > 0 ? Math.min(porPagina, POR_PAGINA_MAXIMO) : POR_PAGINA_DEFECTO;
  const where = estado ? { estado } : {};

  const [total, conteos] = await Promise.all([
    prisma.conteoFisico.count({ where }),
    prisma.conteoFisico.findMany({
      where,
      include: {
        ...INCLUDE_CABECERA,
        detalles: { select: { cantidadSistema: true, cantidadContada: true, articulo: { select: { precioCosto: true } } } },
      },
      orderBy: [{ fechaConteo: "desc" }, { idConteo: "desc" }],
      skip: (paginaActual - 1) * tamano,
      take: tamano,
    }),
  ]);

  return {
    conteos: conteos.map((c) => ({
      ...formatearCabecera(c),
      resumen: calcularResumen(c.detalles.map((d) => ({ ...d, costo: d.articulo?.precioCosto }))),
    })),
    paginacion: { pagina: paginaActual, porPagina: tamano, total, totalPaginas: Math.max(1, Math.ceil(total / tamano)) },
  };
}

function formatearLinea(d) {
  const diferencia = d.cantidadContada - d.cantidadSistema;
  const costo = Number(d.articulo?.precioCosto ?? 0);
  const stockActual = d.articulo?.inventario?.cantidad ?? 0;
  return {
    sku: d.sku,
    nombre: d.articulo?.nombre,
    cantidadSistema: d.cantidadSistema,
    cantidadContada: d.cantidadContada,
    diferencia,
    nivel: clasificarDiferencia(diferencia, d.cantidadSistema),
    costoUnitario: costo,
    valorDiferencia: redondear2(diferencia * costo),
    stockActual,
    cambioDesdeConteo: stockActual !== d.cantidadSistema,
    ajusteAplicado: d.ajuste ?? null,
    cantidadAntes: d.cantidadAntes ?? null,
    cantidadDespues: d.cantidadDespues ?? null,
    fecContado: d.fecContado,
  };
}

// Detalle completo: cabecera + líneas + KPIs. Solo Administrador (incluye
// valorización con precioCosto).
async function obtenerConteo(idConteo) {
  const id = parseId(idConteo);
  const conteo = await prisma.conteoFisico.findUnique({
    where: { idConteo: id },
    include: {
      ...INCLUDE_CABECERA,
      detalles: {
        include: { articulo: { include: { inventario: true } } },
        orderBy: { fecContado: "desc" },
      },
    },
  });
  if (!conteo) throw new ConteoError("Conteo no encontrado", 404);

  const lineas = conteo.detalles.map(formatearLinea);
  const resumen = calcularResumen(conteo.detalles.map((d) => ({ ...d, costo: d.articulo?.precioCosto })));
  const totalAlcance = await prisma.articulo.count({
    where: { estado: true, ...(conteo.idCategoria ? { idCategoria: conteo.idCategoria } : {}) },
  });

  return {
    ...formatearCabecera(conteo),
    lineas,
    resumen,
    alcance: { productosEnAlcance: totalAlcance, sinContar: Math.max(0, totalAlcance - lineas.length) },
    cambiosDesdeConteo: lineas.filter((l) => l.cambioDesdeConteo && l.diferencia !== 0).length,
  };
}

function validarLineas(lineas) {
  if (!Array.isArray(lineas) || lineas.length === 0) {
    throw new ConteoError("Debes indicar al menos una línea", 400);
  }
  if (lineas.length > MAX_LINEAS_POR_PETICION) {
    throw new ConteoError(`No puedes enviar más de ${MAX_LINEAS_POR_PETICION} líneas por petición`, 400);
  }
  const vistos = new Set();
  return lineas.map((l) => {
    if (!l || typeof l !== "object" || !esSkuValido(l.sku)) {
      throw new ConteoError("Cada línea debe indicar un sku válido", 400);
    }
    const sku = l.sku.trim();
    if (vistos.has(sku)) throw new ConteoError(`No repitas el sku "${sku}" en la misma petición`, 400);
    vistos.add(sku);
    if (typeof l.cantidad !== "number" || !Number.isInteger(l.cantidad) || l.cantidad < 0 || l.cantidad > MAX_CANTIDAD) {
      throw new ConteoError(`La cantidad contada de "${sku}" debe ser un entero entre 0 y ${MAX_CANTIDAD}`, 400);
    }
    return { sku, cantidad: l.cantidad };
  });
}

// Registra (upsert) cantidades contadas. Al contar un SKU se toma foto del
// stock del sistema; si se recuenta con otra cantidad la foto se refresca.
async function guardarLineas(idConteo, lineas) {
  const id = parseId(idConteo);
  const limpias = validarLineas(lineas);

  await prisma.$transaction(async (tx) => {
    const { estado, idCategoria } = await bloquearConteo(tx, id);
    exigirBorrador(estado);

    const skus = limpias.map((l) => l.sku);
    const articulos = await tx.articulo.findMany({
      where: { sku: { in: skus } },
      include: { inventario: true },
    });
    const porSku = new Map(articulos.map((a) => [a.sku, a]));
    for (const { sku } of limpias) {
      const art = porSku.get(sku);
      if (!art) throw new ConteoError(`El repuesto "${sku}" no existe`, 400);
      if (!art.estado) throw new ConteoError(`El repuesto "${sku}" está inactivo`, 400);
      if (idCategoria && art.idCategoria !== idCategoria) {
        throw new ConteoError(`El repuesto "${sku}" no pertenece a la categoría de este conteo`, 400);
      }
    }

    const existentes = await tx.conteoDetalle.findMany({ where: { idConteo: id, sku: { in: skus } } });
    const existentePorSku = new Map(existentes.map((e) => [e.sku, e]));

    for (const { sku, cantidad } of limpias) {
      const previo = existentePorSku.get(sku);
      const stock = porSku.get(sku).inventario?.cantidad ?? 0;
      if (previo) {
        if (previo.cantidadContada !== cantidad) {
          // eslint-disable-next-line no-await-in-loop
          await tx.conteoDetalle.update({
            where: { idDetalleConteo: previo.idDetalleConteo },
            data: { cantidadContada: cantidad, cantidadSistema: stock, fecContado: new Date() },
          });
        }
      } else {
        // eslint-disable-next-line no-await-in-loop
        const idDetalle = await siguienteId(tx, "conteoDetalle", "idDetalleConteo");
        // eslint-disable-next-line no-await-in-loop
        await tx.conteoDetalle.create({
          data: { idDetalleConteo: idDetalle, idConteo: id, sku, cantidadSistema: stock, cantidadContada: cantidad },
        });
      }
    }
  });

  return obtenerConteo(id);
}

async function eliminarLinea(idConteo, sku) {
  const id = parseId(idConteo);
  if (!esSkuValido(sku)) throw new ConteoError("El sku no es válido", 400);
  await prisma.$transaction(async (tx) => {
    const { estado } = await bloquearConteo(tx, id);
    exigirBorrador(estado);
    const { count } = await tx.conteoDetalle.deleteMany({ where: { idConteo: id, sku: sku.trim() } });
    if (count === 0) throw new ConteoError("Ese producto no está en el conteo", 404);
  });
  return obtenerConteo(id);
}

// Cierra el conteo. aplicarAjustes=false -> estado "cerrado" (informe, el
// inventario no se toca). aplicarAjustes=true -> corrige Inventario con las
// diferencias en la misma transacción y queda "aplicado".
async function cerrarConteo(idConteo, idColaborador, { aplicarAjustes, confirmarCambios } = {}) {
  const id = parseId(idConteo);
  if (typeof aplicarAjustes !== "boolean") {
    throw new ConteoError("aplicarAjustes debe ser verdadero o falso", 400);
  }
  if (confirmarCambios !== undefined && typeof confirmarCambios !== "boolean") {
    throw new ConteoError("confirmarCambios debe ser verdadero o falso", 400);
  }

  await prisma.$transaction(async (tx) => {
    const { estado } = await bloquearConteo(tx, id);
    exigirBorrador(estado);

    const lineas = await tx.conteoDetalle.findMany({
      where: { idConteo: id },
      include: { articulo: { include: { inventario: true } } },
      orderBy: { sku: "asc" },
    });
    if (lineas.length === 0) throw new ConteoError("Registra al menos un producto antes de cerrar el conteo", 400);

    const ahora = new Date();

    if (aplicarAjustes) {
      const cambios = lineas
        .filter((l) => l.cantidadContada - l.cantidadSistema !== 0)
        .filter((l) => (l.articulo?.inventario?.cantidad ?? 0) !== l.cantidadSistema)
        .map((l) => ({
          sku: l.sku,
          nombre: l.articulo?.nombre,
          cantidadSistema: l.cantidadSistema,
          stockActual: l.articulo?.inventario?.cantidad ?? 0,
        }));
      if (cambios.length > 0 && confirmarCambios !== true) {
        throw new ConteoError(
          "El stock de algunos productos cambió desde que se contaron (ventas, compras o ajustes). Revisa y confirma para aplicar la diferencia sobre el stock actual.",
          409,
          { codigo: "CAMBIO_STOCK", cambios },
        );
      }

      for (const l of lineas) {
        const ajuste = l.cantidadContada - l.cantidadSistema;
        if (ajuste === 0) {
          const actual = l.articulo?.inventario?.cantidad ?? 0;
          // eslint-disable-next-line no-await-in-loop
          await tx.conteoDetalle.update({
            where: { idDetalleConteo: l.idDetalleConteo },
            data: { ajuste: 0, cantidadAntes: actual, cantidadDespues: actual },
          });
        } else {
          // eslint-disable-next-line no-await-in-loop
          const inv = await tx.inventario.update({
            where: { sku: l.sku },
            data: { cantidad: { increment: ajuste }, fecTransac: ahora },
          });
          if (inv.cantidad < 0) {
            throw new ConteoError(
              `El ajuste de "${l.sku}" dejaría el stock en negativo (${inv.cantidad}). Vuelve a contar ese producto y reintenta; no se aplicó ningún ajuste.`,
              409,
              { codigo: "STOCK_NEGATIVO", sku: l.sku },
            );
          }
          // eslint-disable-next-line no-await-in-loop
          await tx.conteoDetalle.update({
            where: { idDetalleConteo: l.idDetalleConteo },
            data: { ajuste, cantidadAntes: inv.cantidad - ajuste, cantidadDespues: inv.cantidad },
          });
        }
      }
    }

    await tx.conteoFisico.update({
      where: { idConteo: id },
      data: {
        estado: aplicarAjustes ? "aplicado" : "cerrado",
        idColaboradorCierre: idColaborador,
        fechaCierre: ahora,
      },
    });
  });

  return obtenerConteo(id);
}

async function cancelarConteo(idConteo, idColaborador) {
  const id = parseId(idConteo);
  await prisma.$transaction(async (tx) => {
    const { estado } = await bloquearConteo(tx, id);
    exigirBorrador(estado);
    await tx.conteoFisico.update({
      where: { idConteo: id },
      data: { estado: "cancelado", idColaboradorCierre: idColaborador, fechaCierre: new Date() },
    });
  });
  return obtenerConteo(id);
}

// Solo borradores y cancelados (nunca tocaron el inventario) pueden borrarse.
async function eliminarConteo(idConteo) {
  const id = parseId(idConteo);
  await prisma.$transaction(async (tx) => {
    const { estado } = await bloquearConteo(tx, id);
    if (estado !== "borrador" && estado !== "cancelado") {
      throw new ConteoError("Un conteo cerrado o aplicado se conserva como registro de auditoría", 409);
    }
    await tx.conteoDetalle.deleteMany({ where: { idConteo: id } });
    await tx.conteoFisico.delete({ where: { idConteo: id } });
  });
}

module.exports = {
  ConteoError,
  META_EXACTITUD_PCT,
  ESTADOS,
  calcularResumen,
  clasificarDiferencia,
  crearConteo,
  listarConteos,
  obtenerConteo,
  guardarLineas,
  eliminarLinea,
  cerrarConteo,
  cancelarConteo,
  eliminarConteo,
};
