// Forma de los datos del formulario de repuesto (T-058). Refleja los campos
// propios de Articulo en el esquema (prisma/schema.prisma) que el usuario
// captura a mano; sku/nombre/precioVenta/inventarioMinimo/idCategoria.
// El backend y la pantalla de listado de repuestos (CRUD de Articulo) son
// tareas aparte, todavía no implementadas — este formulario queda listo
// para conectarse a ese endpoint cuando exista.
export interface RepuestoFormInput {
  sku: string;
  nombre: string;
  precioVenta: number;
  inventarioMinimo: number;
  idCategoria: number;
}
