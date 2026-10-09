const { Prisma } = require("@prisma/client");

// Piezas SQL y constantes compartidas por las definiciones de reportes.
// IMPORTANTE: todo valor variable entra por la plantilla etiquetada de
// Prisma.sql (parámetros enlazados, nunca concatenación de texto).

const ID_TIPO_SALIDA_VENTA = 1;
const ADMIN = "Administrador";
const OPERADOR = "Operador";

// Filtros opcionales por categoría/marca sobre el alias `a` (articulo).
function filtroArticulo(filtros) {
  return Prisma.sql`${filtros.idCategoria ? Prisma.sql`AND a.id_categoria = ${filtros.idCategoria}` : Prisma.empty} ${
    filtros.idMarca ? Prisma.sql`AND a.id_marca = ${filtros.idMarca}` : Prisma.empty
  }`;
}

// Ventas válidas: líneas de tipo Venta cuyo maestro no está anulado.
function baseVentas(filtros, { desde, hasta }) {
  return Prisma.sql`
    FROM salida_detalle d
    JOIN salida_maestro s ON s.id_venta = d.id_salida
    JOIN articulo a ON a.sku = d.sku
    JOIN categoria c ON c.id_categoria = a.id_categoria
    LEFT JOIN marca m ON m.id_marca = a.id_marca
    WHERE d.id_tipo_salida = ${ID_TIPO_SALIDA_VENTA}
      AND s.anulada = false
      AND s.fecha_salida >= ${desde}
      AND s.fecha_salida < ${hasta}
      ${filtroArticulo(filtros)}`;
}

function pct(parte, total) {
  return total > 0 ? (parte / total) * 100 : 0;
}

function recortar(texto, max) {
  const t = String(texto ?? "");
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

// Estado de stock → celda de badge (texto + tono; nunca solo color).
function celdaEstadoStock(estado) {
  if (estado === "agotado") return { texto: "Agotado", tono: "bad" };
  if (estado === "bajo") return { texto: "Stock bajo", tono: "warn" };
  return { texto: "En stock", tono: "ok" };
}

module.exports = {
  ID_TIPO_SALIDA_VENTA,
  ADMIN,
  OPERADOR,
  filtroArticulo,
  baseVentas,
  pct,
  recortar,
  celdaEstadoStock,
};
