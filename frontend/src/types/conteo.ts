// Contratos de /api/conteos (solo Administrador). Las reglas de estados,
// exactitud y concurrencia con ventas viven en backend/src/services/conteoService.js.
export type EstadoConteo = "borrador" | "cerrado" | "aplicado" | "cancelado";
export type NivelDiferencia = "exacto" | "leve" | "alto";

export interface ResumenConteo {
  productosContados: number;
  productosExactos: number;
  productosConDiferencia: number;
  // null = todavía no hay productos contados.
  exactitudPct: number | null;
  unidadesSistema: number;
  unidadesSobrantes: number;
  unidadesFaltantes: number;
  unidadesDiferenciaAbs: number;
  diferenciaPct: number | null;
  metaPct: number;
  cumpleMeta: boolean | null;
  valorDiferenciaNeto: number;
  valorDiferenciaAbsoluto: number;
}

export interface LineaConteo {
  sku: string;
  nombre?: string;
  // Stock registrado al momento de contar el SKU (la diferencia se mide contra esto).
  cantidadSistema: number;
  cantidadContada: number;
  diferencia: number;
  nivel: NivelDiferencia;
  // precioCosto vigente (la API de conteos es solo Administrador).
  costoUnitario: number;
  valorDiferencia: number;
  stockActual: number;
  // El stock vigente ya no es el que había al contar (hubo ventas/compras).
  cambioDesdeConteo: boolean;
  ajusteAplicado: number | null;
  cantidadAntes: number | null;
  cantidadDespues: number | null;
}

export interface PersonaConteo {
  idColaborador: number;
  nombreCompleto: string;
}

export interface CabeceraConteo {
  idConteo: number;
  nombre: string;
  fechaConteo: string;
  estado: EstadoConteo;
  categoria: { idCategoria: number; descripcion: string } | null;
  creador: PersonaConteo | null;
  cierre: PersonaConteo | null;
  fechaCierre: string | null;
}

export interface ConteoResumido extends CabeceraConteo {
  resumen: ResumenConteo;
}

export interface Conteo extends CabeceraConteo {
  lineas: LineaConteo[];
  resumen: ResumenConteo;
  alcance: { productosEnAlcance: number; sinContar: number };
  // Líneas con diferencia cuyo stock cambió desde que se contaron.
  cambiosDesdeConteo: number;
}

export interface CrearConteoInput {
  nombre: string;
  fechaConteo?: string;
  idCategoria?: number;
}

export interface ListarConteosResultado {
  conteos: ConteoResumido[];
  paginacion: { pagina: number; porPagina: number; total: number; totalPaginas: number };
}
