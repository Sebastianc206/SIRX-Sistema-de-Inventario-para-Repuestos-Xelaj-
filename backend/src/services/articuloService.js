const prisma = require("../utils/prismaClient");
const {
  esTextoValido,
  esTextoOpcionalValido,
  esSkuValido,
  esNumeroPositivo,
} = require("../utils/validadores");
const {
  normalizarUmbralPropio,
  umbralEfectivo,
  calcularEstadoStock,
  obtenerUmbralGeneral,
} = require("./umbralStockService");

const NOMBRE_MAX_LENGTH = 150;
const UBICACION_MAX_LENGTH = 100;
const PAGINA_POR_DEFECTO = 1;
const POR_PAGINA_POR_DEFECTO = 20;
const POR_PAGINA_MAXIMO = 100;

class ArticuloError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

// T-031/T-037: precio_costo y el proveedor preferido son datos que el rol
// Operador nunca debe recibir, ni en el listado ni en el detalle de un
// repuesto — se omiten del objeto acá, no se enmascaran con null, para que
// no quede ni la llave en el JSON de respuesta.
//
// Umbral de stock bajo: `inventarioMinimo` en la respuesta es SIEMPRE el
// umbral efectivo (propio si existe, si no el general) — así los clientes
// que ya leían ese campo siguen funcionando. `inventarioMinimoPropio` es el
// valor propio (null = usa el general) y `estadoStock` el estado ya
// calculado en backend (umbralStockService.js).
function formatearArticulo(articulo, { ocultarDatosSensibles, umbralGeneral }) {
  const minimoEfectivo = umbralEfectivo(articulo.inventarioMinimo ?? null, umbralGeneral);
  const cantidadInventario = articulo.inventario?.cantidad ?? 0;
  const base = {
    sku: articulo.sku,
    nombre: articulo.nombre,
    precioVenta: articulo.precioVenta,
    inventarioMinimo: minimoEfectivo,
    inventarioMinimoPropio: articulo.inventarioMinimo ?? null,
    estadoStock: calcularEstadoStock(cantidadInventario, minimoEfectivo),
    ubicacion: articulo.ubicacion,
    estado: articulo.estado,
    categoria: articulo.categoria
      ? { idCategoria: articulo.categoria.idCategoria, descripcion: articulo.categoria.descripcion }
      : null,
    marca: articulo.marca ? { idMarca: articulo.marca.idMarca, nombre: articulo.marca.nombre } : null,
    modelosCompatibles: (articulo.modelosCompatibles ?? []).map((mc) => ({
      idModelo: mc.modelo.idModelo,
      descripcion: mc.modelo.descripcion,
    })),
    cantidadInventario,
  };

  if (ocultarDatosSensibles) {
    return base;
  }

  return {
    ...base,
    precioCosto: articulo.precioCosto,
    proveedor: articulo.proveedor
      ? { idProveedor: articulo.proveedor.idProveedor, nombre: articulo.proveedor.nombre }
      : null,
  };
}

const INCLUDE_ARTICULO_COMPLETO = {
  categoria: true,
  marca: true,
  proveedor: true,
  inventario: true,
  modelosCompatibles: { include: { modelo: true } },
};

function umbralPropioDeEntrada(valor) {
  try {
    return normalizarUmbralPropio(valor);
  } catch (error) {
    throw new ArticuloError(error.message, 400);
  }
}

// T-099: se valida cada campo por separado (no solo "vino algo") y se
// reutiliza tanto en crear como en editar; en editar cada campo es opcional
// (solo se exige si vino en el body).
function validarCampos(datos, { requerido }) {
  const { nombre, precioVenta, precioCosto, inventarioMinimo, ubicacion } = datos;

  if (requerido || nombre !== undefined) {
    if (!esTextoValido(nombre, { max: NOMBRE_MAX_LENGTH })) {
      throw new ArticuloError(`nombre es requerido (máximo ${NOMBRE_MAX_LENGTH} caracteres)`, 400);
    }
  }

  if (requerido || precioVenta !== undefined) {
    if (!esNumeroPositivo(precioVenta)) {
      throw new ArticuloError("precioVenta debe ser un número mayor a 0", 400);
    }
  }

  if (requerido || precioCosto !== undefined) {
    if (!esNumeroPositivo(precioCosto)) {
      throw new ArticuloError("precioCosto debe ser un número mayor a 0", 400);
    }
  }

  // Opcional: vacío/null = usar el umbral general de stock bajo.
  if (inventarioMinimo !== undefined) {
    umbralPropioDeEntrada(inventarioMinimo);
  }

  if (!esTextoOpcionalValido(ubicacion, { max: UBICACION_MAX_LENGTH })) {
    throw new ArticuloError(`ubicacion debe tener máximo ${UBICACION_MAX_LENGTH} caracteres`, 400);
  }
}

async function validarReferencias({ idCategoria, idMarca, idProveedor, idsModelosCompatibles }) {
  if (idCategoria !== undefined) {
    const categoria = await prisma.categoria.findUnique({ where: { idCategoria } });
    if (!categoria) {
      throw new ArticuloError("La categoría indicada no existe", 400);
    }
  }

  if (idMarca !== undefined && idMarca !== null) {
    const marca = await prisma.marca.findUnique({ where: { idMarca } });
    if (!marca) {
      throw new ArticuloError("La marca indicada no existe", 400);
    }
  }

  if (idProveedor !== undefined && idProveedor !== null) {
    const proveedor = await prisma.proveedor.findUnique({ where: { idProveedor } });
    if (!proveedor) {
      throw new ArticuloError("El proveedor indicado no existe", 400);
    }
  }

  if (idsModelosCompatibles !== undefined && idsModelosCompatibles.length > 0) {
    const modelos = await prisma.modelo.findMany({
      where: { idModelo: { in: idsModelosCompatibles } },
    });
    if (modelos.length !== new Set(idsModelosCompatibles).size) {
      throw new ArticuloError("Uno o más modelos compatibles indicados no existen", 400);
    }
  }
}

// HU-06: la búsqueda por texto (nombre/sku) y los filtros por categoría,
// marca y modelo compatible se combinan con AND entre ellos (cada uno
// reduce el resultado del anterior) — así "frenos" + categoría "Frenos"
// + marca "Bosch" es una intersección, no una alternativa.
async function listarArticulos({
  pagina,
  porPagina,
  busqueda,
  estado,
  idCategoria,
  idMarca,
  idModelo,
  soloConExistencias,
  orden,
  ocultarDatosSensibles,
}) {
  const paginaActual = Number.isInteger(pagina) && pagina > 0 ? pagina : PAGINA_POR_DEFECTO;
  const tamanoPagina =
    Number.isInteger(porPagina) && porPagina > 0
      ? Math.min(porPagina, POR_PAGINA_MAXIMO)
      : POR_PAGINA_POR_DEFECTO;

  const where = {};
  if (busqueda && busqueda.trim() !== "") {
    const termino = busqueda.trim();
    where.OR = [
      { sku: { contains: termino, mode: "insensitive" } },
      { nombre: { contains: termino, mode: "insensitive" } },
    ];
  }
  if (estado === "activo") where.estado = true;
  if (estado === "inactivo") where.estado = false;
  if (Number.isInteger(idCategoria)) where.idCategoria = idCategoria;
  if (Number.isInteger(idMarca)) where.idMarca = idMarca;
  if (Number.isInteger(idModelo)) where.modelosCompatibles = { some: { idModelo } };
  // Punto de venta: solo lo que realmente se puede vender ahora.
  if (soloConExistencias === true) where.inventario = { is: { cantidad: { gt: 0 } } };

  const desde = (paginaActual - 1) * tamanoPagina;
  const consultar = (filtro, saltar, tomar) =>
    prisma.articulo.findMany({
      where: filtro,
      include: INCLUDE_ARTICULO_COMPLETO,
      orderBy: [{ nombre: "asc" }, { sku: "asc" }],
      skip: saltar,
      take: tomar,
    });

  const [total, umbralGeneral] = await Promise.all([
    prisma.articulo.count({ where }),
    obtenerUmbralGeneral(),
  ]);

  let articulos;
  if (orden === "existencias" && soloConExistencias !== true) {
    // "Con existencias primero": segmento 1 = cantidad > 0, segmento 2 = el
    // resto (agotados/sin fila de inventario), cada uno por nombre. Se
    // pagina sobre la concatenación con dos consultas Prisma (sin SQL crudo).
    const conStock = { AND: [where, { inventario: { is: { cantidad: { gt: 0 } } } }] };
    const sinStock = { AND: [where, { NOT: { inventario: { is: { cantidad: { gt: 0 } } } } }] };
    const totalConStock = await prisma.articulo.count({ where: conStock });
    const partes = [];
    if (desde < totalConStock) {
      partes.push(...(await consultar(conStock, desde, tamanoPagina)));
    }
    const faltan = tamanoPagina - partes.length;
    if (faltan > 0) {
      partes.push(...(await consultar(sinStock, Math.max(0, desde - totalConStock), faltan)));
    }
    articulos = partes;
  } else {
    articulos = await consultar(where, desde, tamanoPagina);
  }

  return {
    articulos: articulos.map((a) => formatearArticulo(a, { ocultarDatosSensibles, umbralGeneral })),
    paginacion: {
      pagina: paginaActual,
      porPagina: tamanoPagina,
      total,
      totalPaginas: Math.max(1, Math.ceil(total / tamanoPagina)),
    },
  };
}

async function obtenerArticuloPorSku(sku, { ocultarDatosSensibles }) {
  const [articulo, umbralGeneral] = await Promise.all([
    prisma.articulo.findUnique({ where: { sku }, include: INCLUDE_ARTICULO_COMPLETO }),
    obtenerUmbralGeneral(),
  ]);

  if (!articulo) {
    throw new ArticuloError("Repuesto no encontrado", 404);
  }

  return formatearArticulo(articulo, { ocultarDatosSensibles, umbralGeneral });
}

async function crearArticulo(datos) {
  const { sku, idCategoria, idMarca, idProveedor, ubicacion, idsModelosCompatibles = [] } = datos;

  if (!esSkuValido(sku)) {
    throw new ArticuloError(
      "sku es requerido (solo letras, números, puntos, guiones y guion bajo)",
      400,
    );
  }
  validarCampos(datos, { requerido: true });

  if (idCategoria === undefined || idCategoria === null) {
    throw new ArticuloError("idCategoria es requerido", 400);
  }

  await validarReferencias({ idCategoria, idMarca, idProveedor, idsModelosCompatibles });

  const skuLimpio = sku.trim();
  const existente = await prisma.articulo.findUnique({ where: { sku: skuLimpio } });
  if (existente) {
    throw new ArticuloError("Ya existe un repuesto con ese código (SKU)", 409);
  }

  await prisma.$transaction(async (tx) => {
    await tx.articulo.create({
      data: {
        sku: skuLimpio,
        nombre: datos.nombre.trim(),
        precioVenta: Number(datos.precioVenta),
        precioCosto: Number(datos.precioCosto),
        inventarioMinimo: umbralPropioDeEntrada(datos.inventarioMinimo),
        ubicacion: ubicacion?.trim() || null,
        idCategoria,
        idMarca: idMarca ?? null,
        idProveedor: idProveedor ?? null,
      },
    });

    // Todo repuesto nuevo arranca con 0 en existencias: el módulo de
    // movimientos de inventario (otra historia, todavía no construida) es
    // el que las incrementa con las compras que se vayan registrando.
    await tx.inventario.create({ data: { sku: skuLimpio, cantidad: 0 } });

    if (idsModelosCompatibles.length > 0) {
      await tx.modeloCompatible.createMany({
        data: idsModelosCompatibles.map((idModelo) => ({ sku: skuLimpio, idModelo })),
      });
    }
  });

  return obtenerArticuloPorSku(skuLimpio, { ocultarDatosSensibles: false });
}

async function editarArticulo(sku, datos) {
  const articulo = await prisma.articulo.findUnique({ where: { sku } });
  if (!articulo) {
    throw new ArticuloError("Repuesto no encontrado", 404);
  }

  validarCampos(datos, { requerido: false });

  const { idCategoria, idMarca, idProveedor, idsModelosCompatibles } = datos;
  await validarReferencias({ idCategoria, idMarca, idProveedor, idsModelosCompatibles });

  const dataActualizada = {};
  if (datos.nombre !== undefined) dataActualizada.nombre = datos.nombre.trim();
  if (datos.precioVenta !== undefined) dataActualizada.precioVenta = Number(datos.precioVenta);
  if (datos.precioCosto !== undefined) dataActualizada.precioCosto = Number(datos.precioCosto);
  if (datos.inventarioMinimo !== undefined)
    dataActualizada.inventarioMinimo = umbralPropioDeEntrada(datos.inventarioMinimo);
  if (datos.ubicacion !== undefined) dataActualizada.ubicacion = datos.ubicacion?.trim() || null;
  if (idCategoria !== undefined) dataActualizada.idCategoria = idCategoria;
  if (idMarca !== undefined) dataActualizada.idMarca = idMarca;
  if (idProveedor !== undefined) dataActualizada.idProveedor = idProveedor;

  await prisma.$transaction(async (tx) => {
    if (Object.keys(dataActualizada).length > 0) {
      await tx.articulo.update({ where: { sku }, data: dataActualizada });
    }

    // Reemplazo completo del set de modelos compatibles: más simple y
    // suficiente para el volumen esperado que calcular un diff altas/bajas.
    if (idsModelosCompatibles !== undefined) {
      await tx.modeloCompatible.deleteMany({ where: { sku } });
      if (idsModelosCompatibles.length > 0) {
        await tx.modeloCompatible.createMany({
          data: idsModelosCompatibles.map((idModelo) => ({ sku, idModelo })),
        });
      }
    }
  });

  return obtenerArticuloPorSku(sku, { ocultarDatosSensibles: false });
}

// HU-05: en la plantilla de carga masiva, categoría/marca/proveedor se
// identifican por nombre (una persona llenando un Excel no conoce los ids
// internos) — hay que resolverlos a id antes de poder reusar crearArticulo.
async function resolverCategoriaPorNombre(nombre) {
  const categoria = await prisma.categoria.findFirst({
    where: { descripcion: { equals: nombre.trim(), mode: "insensitive" } },
  });
  if (!categoria) {
    throw new ArticuloError(`La categoría "${nombre.trim()}" no existe`, 400);
  }
  return categoria.idCategoria;
}

async function resolverMarcaPorNombre(nombre) {
  const marca = await prisma.marca.findFirst({
    where: { nombre: { equals: nombre.trim(), mode: "insensitive" } },
  });
  if (!marca) {
    throw new ArticuloError(`La marca "${nombre.trim()}" no existe`, 400);
  }
  return marca.idMarca;
}

async function resolverProveedorPorNombre(nombre) {
  const proveedor = await prisma.proveedor.findFirst({
    where: { nombre: { equals: nombre.trim(), mode: "insensitive" } },
  });
  if (!proveedor) {
    throw new ArticuloError(`El proveedor "${nombre.trim()}" no existe`, 400);
  }
  return proveedor.idProveedor;
}

// T-044/T-045: cada fila se valida y se crea con las mismas reglas que
// crearArticulo (sku duplicado incluido) — una fila inválida se reporta y
// no aborta el resto del archivo. No se paraleliza (no-await-in-loop): las
// filas comparten validación de sku duplicado con la base de datos y entre
// sí, igual que crearCategoriasEnLote.
async function crearArticulosEnLote(filas) {
  const creadas = [];
  const errores = [];

  for (const fila of filas) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const idCategoria = await resolverCategoriaPorNombre(fila.categoria);
      // eslint-disable-next-line no-await-in-loop
      const idMarca = fila.marca ? await resolverMarcaPorNombre(fila.marca) : undefined;
      // eslint-disable-next-line no-await-in-loop
      const idProveedor = fila.proveedor ? await resolverProveedorPorNombre(fila.proveedor) : undefined;

      // eslint-disable-next-line no-await-in-loop
      const articulo = await crearArticulo({
        sku: fila.sku,
        nombre: fila.nombre,
        precioVenta: fila.precioVenta,
        precioCosto: fila.precioCosto,
        inventarioMinimo: fila.inventarioMinimo,
        ubicacion: fila.ubicacion,
        idCategoria,
        idMarca,
        idProveedor,
      });
      creadas.push({ sku: articulo.sku, nombre: articulo.nombre });
    } catch (error) {
      errores.push({
        fila: fila.numeroFila,
        sku: fila.sku,
        motivo: error instanceof ArticuloError ? error.message : "Error interno del servidor",
      });
    }
  }

  return { creadas, errores };
}

async function cambiarEstadoArticulo(sku, estado) {
  const articulo = await prisma.articulo.findUnique({ where: { sku } });
  if (!articulo) {
    throw new ArticuloError("Repuesto no encontrado", 404);
  }

  await prisma.articulo.update({ where: { sku }, data: { estado } });
  return obtenerArticuloPorSku(sku, { ocultarDatosSensibles: false });
}

// Eliminación real (opción adicional a la baja lógica de arriba, no un
// reemplazo): solo para repuestos ya inactivos y sin historial asociado —
// una línea de compra/venta/ajuste o un modelo compatible registrado son
// datos que no se pueden perder, así que en ese caso se rechaza y el
// usuario solo puede seguir usando "Dar de baja". Inventario se borra en la
// misma transacción porque es 1—1 con Articulo (su FK no tiene cascada).
async function eliminarArticulo(sku) {
  const articulo = await prisma.articulo.findUnique({ where: { sku } });
  if (!articulo) {
    throw new ArticuloError("Repuesto no encontrado", 404);
  }
  if (articulo.estado) {
    throw new ArticuloError("Solo se pueden eliminar repuestos inactivos — primero dalo de baja", 400);
  }

  const [comprasAsociadas, salidasAsociadas, modelosAsociados] = await Promise.all([
    prisma.compraDetalle.count({ where: { sku } }),
    prisma.salidaDetalle.count({ where: { sku } }),
    prisma.modeloCompatible.count({ where: { sku } }),
  ]);
  if (comprasAsociadas > 0 || salidasAsociadas > 0 || modelosAsociados > 0) {
    throw new ArticuloError(
      "No se puede eliminar: tiene compras/ventas asociadas. Solo se puede desactivar.",
      409,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.inventario.deleteMany({ where: { sku } });
    await tx.articulo.delete({ where: { sku } });
  });
}

module.exports = {
  ArticuloError,
  listarArticulos,
  obtenerArticuloPorSku,
  crearArticulo,
  editarArticulo,
  cambiarEstadoArticulo,
  crearArticulosEnLote,
  eliminarArticulo,
};
