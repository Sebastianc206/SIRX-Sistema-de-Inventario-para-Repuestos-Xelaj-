import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Providers } from "@/test/providers";
import ReportesPage from "@/pages/ReportesPage";
import type { DefinicionReporte, Reporte } from "@/types/reporte";

const { mockListar, mockVista, mockDescargar, mockGuardar, mockUseAuth } = vi.hoisted(() => ({
  mockListar: vi.fn(),
  mockVista: vi.fn(),
  mockDescargar: vi.fn(),
  mockGuardar: vi.fn(),
  mockUseAuth: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: mockUseAuth }));

vi.mock("@/services/reporteService", async () => {
  const actual = await vi.importActual<typeof import("@/services/reporteService")>("@/services/reporteService");
  return {
    ...actual,
    listarReportes: mockListar,
    obtenerVistaPrevia: mockVista,
    descargarReportes: mockDescargar,
    guardarArchivo: mockGuardar,
  };
});

vi.mock("@/services/categoriaService", () => ({
  listarCategorias: vi.fn().mockResolvedValue([{ idCategoria: 1, descripcion: "Frenos" }]),
}));
vi.mock("@/services/catalogosAuxiliaresService", () => ({
  listarMarcas: vi.fn().mockResolvedValue([{ idMarca: 1, nombre: "Bosch" }]),
}));

const MAS_VENDIDOS: DefinicionReporte = {
  id: "mas-vendidos",
  titulo: "Productos más vendidos",
  descripcion: "Qué repuestos rotan más.",
  icono: "trendUp",
  filtros: ["fechaDesde", "fechaHasta", "idCategoria", "top", "orden"],
  soloAdministrador: false,
};
const EXISTENCIAS: DefinicionReporte = {
  id: "existencias-valorizadas",
  titulo: "Existencias valorizadas",
  descripcion: "Cuánto dinero hay en inventario.",
  icono: "box",
  filtros: ["idCategoria"],
  soloAdministrador: true,
};

function reporte(extra: Partial<Reporte> = {}): Reporte {
  return {
    id: "mas-vendidos",
    titulo: "Productos más vendidos",
    descripcion: "",
    generadoEn: "2026-10-08T20:00:00Z",
    generadoPor: "Ana López",
    filtrosAplicados: [{ etiqueta: "Período", valor: "01/10/2026 al 08/10/2026 (8 días)" }],
    kpis: [{ etiqueta: "Unidades vendidas", valor: 50, tipo: "entero" }],
    tablas: [
      {
        id: "ranking",
        titulo: "Ranking de productos",
        columnas: [
          { clave: "nombre", etiqueta: "Producto", tipo: "texto" },
          { clave: "unidades", etiqueta: "Unidades", tipo: "entero" },
        ],
        filas: [{ nombre: "Pastillas de freno", unidades: 30 }],
        totalFilas: 1,
        truncada: false,
      },
    ],
    grafica: { tipo: "barras", titulo: "Unidades por producto", formato: "entero", items: [{ etiqueta: "Pastillas de freno", valor: 30 }] },
    notas: [],
    vacio: null,
    ...extra,
  };
}

function entrarComo(role: string) {
  mockUseAuth.mockReturnValue({ usuario: { idColaborador: 1, username: "u", nombreCompleto: "U", role } });
}

describe("ReportesPage", () => {
  beforeEach(() => {
    mockListar.mockResolvedValue([MAS_VENDIDOS, EXISTENCIAS]);
    mockVista.mockResolvedValue(reporte());
    mockDescargar.mockResolvedValue({ blob: new Blob(["x"]), nombre: "sirx_reporte-combinado_2026-10-08.pdf" });
    entrarComo("Administrador");
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("muestra la galería con descripción y la vista previa del primer reporte (KPIs, gráfica y tabla)", async () => {
    render(<ReportesPage />, { wrapper: Providers });

    expect(await screen.findByRole("button", { name: "Productos más vendidos" })).toBeInTheDocument();
    expect(screen.getByText("Cuánto dinero hay en inventario.")).toBeInTheDocument();
    expect(screen.getByText("Solo administrador")).toBeInTheDocument();

    expect(await screen.findByText("Unidades vendidas")).toBeInTheDocument();
    expect(await screen.findByText("Ranking de productos")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Unidades por producto" })).toBeInTheDocument();
    expect(mockVista).toHaveBeenCalledWith("mas-vendidos", expect.objectContaining({ top: "20", orden: "unidades" }), expect.anything());
  });

  it("cambiar de atajo de fecha vuelve a pedir la vista previa con el nuevo rango", async () => {
    render(<ReportesPage />, { wrapper: Providers });
    await screen.findByText("Ranking de productos");
    mockVista.mockClear();

    await userEvent.click(screen.getByRole("button", { name: "7 días" }));

    await waitFor(() => expect(mockVista).toHaveBeenCalled());
    const filtros = mockVista.mock.calls[0][1];
    expect(filtros.fechaDesde <= filtros.fechaHasta).toBe(true);
    expect(screen.getByRole("button", { name: "7 días" })).toHaveAttribute("aria-pressed", "true");
  });

  it("selecciona varios reportes y los descarga juntos en el formato elegido", async () => {
    render(<ReportesPage />, { wrapper: Providers });
    await screen.findByText("Ranking de productos");

    expect(screen.queryByRole("button", { name: /descargar seleccionados/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: /seleccionar productos más vendidos/i }));
    await userEvent.click(screen.getByRole("checkbox", { name: /seleccionar existencias valorizadas/i }));
    await userEvent.click(screen.getAllByRole("button", { name: "Excel" })[0]);
    await userEvent.click(screen.getByRole("button", { name: /descargar seleccionados/i }));

    await waitFor(() => expect(mockDescargar).toHaveBeenCalledTimes(1));
    const [formato, lista] = mockDescargar.mock.calls[0];
    expect(formato).toBe("xlsx");
    expect(lista.map((r: { tipo: string }) => r.tipo)).toEqual(["mas-vendidos", "existencias-valorizadas"]);
    await waitFor(() => expect(mockGuardar).toHaveBeenCalled());
  });

  it("descarga el reporte abierto en PDF con sus filtros", async () => {
    render(<ReportesPage />, { wrapper: Providers });
    await screen.findByText("Ranking de productos");

    const grupo = screen.getByRole("group", { name: /^descargar productos más vendidos$/i });
    await userEvent.click(within(grupo).getByRole("button", { name: "PDF" }));

    await waitFor(() => expect(mockDescargar).toHaveBeenCalledWith("pdf", [{ tipo: "mas-vendidos", filtros: expect.objectContaining({ top: "20" }) }]));
  });

  it("muestra el estado vacío con sugerencia de ampliar el rango", async () => {
    mockVista.mockResolvedValue(reporte({ kpis: [], vacio: "No hay ventas en este rango. Prueba ampliando las fechas." }));
    render(<ReportesPage />, { wrapper: Providers });

    expect(await screen.findByText("Sin datos para este reporte")).toBeInTheDocument();
    expect(screen.getByText(/prueba ampliando las fechas/i)).toBeInTheDocument();
  });

  it("muestra el error de la API con opción de reintentar", async () => {
    mockVista.mockRejectedValueOnce(new Error("Error interno del servidor")).mockResolvedValue(reporte());
    render(<ReportesPage />, { wrapper: Providers });

    expect(await screen.findByText("Error interno del servidor")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Ranking de productos")).toBeInTheDocument();
  });

  it("Operador: no ve la opción de ordenar por ingreso y solo los reportes que llegan del catálogo", async () => {
    entrarComo("Operador");
    mockListar.mockResolvedValue([MAS_VENDIDOS]);
    render(<ReportesPage />, { wrapper: Providers });

    await screen.findByText("Ranking de productos");
    expect(screen.queryByText("Existencias valorizadas")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Ordenar por")).not.toBeInTheDocument();
    expect(screen.queryByText("Solo administrador")).not.toBeInTheDocument();
  });
});
