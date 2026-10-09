import type { IconName } from "@/components/ui/Icon";

// Fuente única de la navegación: sidebar, breadcrumbs, paleta de comandos y
// títulos de página salen de esta lista. Los roles aquí son solo para
// MOSTRAR u ocultar entradas (UX); la seguridad real vive en las rutas
// protegidas (ProtectedRoute) y en la API.
// "Principal": lo de todos los días. "Gestión": trabajo de inventario menos frecuente
// (plegable en el menú). "Administración": solo Administrador (plegable).
export type NavGroup = "Principal" | "Gestión" | "Administración";

export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  group: NavGroup;
  // Sin `roles` = cualquier rol autenticado.
  roles?: string[];
  // Palabras extra para la paleta de comandos.
  keywords?: string;
}

export const ADMIN = "Administrador";

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Inicio", icon: "home", group: "Principal", keywords: "dashboard tablero resumen" },
  { to: "/ventas", label: "Ventas", icon: "cart", group: "Principal", keywords: "pos mostrador caja vender" },
  { to: "/repuestos", label: "Repuestos", icon: "package", group: "Principal", keywords: "catalogo productos sku stock" },
  { to: "/reportes", label: "Reportes", icon: "barChart", group: "Principal", keywords: "informes descargar pdf excel csv mas vendidos existencias valorizadas rotacion utilidad mermas reposicion" },
  { to: "/compras", label: "Compras", icon: "receipt", group: "Gestión", roles: [ADMIN], keywords: "proveedor entrada reponer" },
  { to: "/ajustes", label: "Ajustes", icon: "sliders", group: "Gestión", keywords: "merma salida garantia uso interno" },
  { to: "/movimientos", label: "Movimientos", icon: "arrows", group: "Gestión", roles: [ADMIN], keywords: "historial kardex auditoria" },
  { to: "/conteos", label: "Conteo físico", icon: "clipboard", group: "Gestión", roles: [ADMIN], keywords: "inventario fisico auditoria diferencias exactitud existencias contar" },
  { to: "/categorias", label: "Categorías", icon: "tag", group: "Gestión", roles: [ADMIN] },
  { to: "/proveedores", label: "Proveedores", icon: "truck", group: "Gestión", roles: [ADMIN] },
  { to: "/usuarios", label: "Usuarios", icon: "users", group: "Administración", roles: [ADMIN], keywords: "cuentas roles operadores" },
  { to: "/configuracion", label: "Configuración", icon: "cog", group: "Administración", roles: [ADMIN], keywords: "umbral stock bajo alerta minimo ajustes" },
];

export const GRUPOS_ORDEN: NavGroup[] = ["Principal", "Gestión", "Administración"];

export function itemsVisibles(role: string | undefined): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.roles || (role !== undefined && item.roles.includes(role)));
}

export interface Crumb {
  label: string;
  to?: string;
}

export function encontrarItem(pathname: string): NavItem | undefined {
  const limpio = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  // Subrutas de detalle (/conteos/12) heredan la entrada de su lista.
  return NAV_ITEMS.find((item) => item.to === limpio) ?? NAV_ITEMS.find((item) => item.to !== "/" && limpio.startsWith(`${item.to}/`));
}

export function migasDePan(pathname: string): Crumb[] {
  const item = encontrarItem(pathname);
  if (!item) return [{ label: "Inicio", to: "/" }, { label: "Página no encontrada" }];
  // Sin migas redundantes: las páginas principales solo muestran su nombre;
  // las de gestión/administración añaden su grupo como contexto.
  if (item.group === "Principal") return [{ label: item.label }];
  return [{ label: item.group }, { label: item.label }];
}
