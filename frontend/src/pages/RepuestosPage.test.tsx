import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import RepuestosPage from "@/pages/RepuestosPage";
import { RepuestoApiError } from "@/services/repuestoService";
import type { Repuesto } from "@/types/repuesto";

const { mockListarRepuestos, mockCambiarEstadoRepuesto, mockUseAuth } = vi.hoisted(() => ({
  mockListarRepuestos: vi.fn(),
  mockCambiarEstadoRepuesto: vi.fn(),
  mockUseAuth: vi.fn(),
}));

vi.mock("@/services/repuestoService", async () => {
  const actual = await vi.importActual<typeof import("@/services/repuestoService")>(
    "@/services/repuestoService",
  );
  return {
    ...actual,
    listarRepuestos: mockListarRepuestos,
    cambiarEstadoRepuesto: mockCambiarEstadoRepuesto,
  };
});

vi.mock("@/services/catalogosAuxiliaresService", () => ({
  listarMarcas: vi.fn().mockResolvedValue([]),
  listarProveedores: vi.fn().mockResolvedValue([]),
  listarModelos: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/services/categoriaService", () => ({
  listarCategorias: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: mockUseAuth }));

function comoAdministrador() {
  mockUseAuth.mockReturnValue({
    usuario: { idColaborador: 1, username: "admin", nombreCompleto: "Admin", role: "Administrador" },
    cerrarSesion: vi.fn(),
  });
}

function comoOperador() {
  mockUseAuth.mockReturnValue({
    usuario: { idColaborador: 2, username: "operador", nombreCompleto: "Operador", role: "Operador" },
    cerrarSesion: vi.fn(),
  });
}

const REPUESTO_ADMIN: Repuesto = {
  sku: "FRE-001",
  nombre: "Pastillas de freno",
  precioVenta: 150,
  precioCosto: 90,
  inventarioMinimo: 5,
  ubicacion: "Estante A1",
  estado: true,
  categoria: { idCategoria: 1, descripcion: "Frenos" },
  marca: null,
  proveedor: { idProveedor: 1, nombre: "Repuestos Guate S.A." },
  modelosCompatibles: [],
  cantidadInventario: 12,
};

// El backend omite precioCosto/proveedor por completo para Operador (T-031)
// — el objeto que llega al frontend nunca tiene esas llaves en ese caso.
const REPUESTO_OPERADOR: Omit<Repuesto, "precioCosto" | "proveedor"> = {
  sku: "FRE-001",
  nombre: "Pastillas de freno",
  precioVenta: 150,
  inventarioMinimo: 5,
  ubicacion: "Estante A1",
  estado: true,
  categoria: { idCategoria: 1, descripcion: "Frenos" },
  marca: null,
  modelosCompatibles: [],
  cantidadInventario: 12,
};

function renderPage() {
  return render(<RepuestosPage />, { wrapper: MemoryRouter });
}

describe("RepuestosPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("lista los repuestos devueltos por el backend", async () => {
    comoAdministrador();
    mockListarRepuestos.mockResolvedValueOnce({
      articulos: [REPUESTO_ADMIN],
      paginacion: { pagina: 1, porPagina: 20, total: 1, totalPaginas: 1 },
    });

    renderPage();

    expect(await screen.findByText("Pastillas de freno")).toBeInTheDocument();
  });

  it("T-034: Administrador ve las columnas de precio de costo y proveedor", async () => {
    comoAdministrador();
    mockListarRepuestos.mockResolvedValueOnce({
      articulos: [REPUESTO_ADMIN],
      paginacion: { pagina: 1, porPagina: 20, total: 1, totalPaginas: 1 },
    });

    renderPage();
    await screen.findByText("Pastillas de freno");

    expect(screen.getByText("Precio costo")).toBeInTheDocument();
    expect(screen.getByText("Q90.00")).toBeInTheDocument();
    expect(screen.getByText("Repuestos Guate S.A.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Nuevo repuesto" })).toBeInTheDocument();
  });

  it("T-034/T-037: Operador no ve columnas ni botones de precio de costo/proveedor/edición", async () => {
    comoOperador();
    mockListarRepuestos.mockResolvedValueOnce({
      articulos: [REPUESTO_OPERADOR as Repuesto],
      paginacion: { pagina: 1, porPagina: 20, total: 1, totalPaginas: 1 },
    });

    renderPage();
    await screen.findByText("Pastillas de freno");

    expect(screen.queryByText("Precio costo")).not.toBeInTheDocument();
    expect(screen.queryByText("Proveedor")).not.toBeInTheDocument();
    expect(screen.queryByText("Repuestos Guate S.A.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Nuevo repuesto" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
  });

  it("T-035: pide confirmación antes de dar de baja y luego cambia el estado", async () => {
    comoAdministrador();
    mockListarRepuestos.mockResolvedValueOnce({
      articulos: [REPUESTO_ADMIN],
      paginacion: { pagina: 1, porPagina: 20, total: 1, totalPaginas: 1 },
    });
    mockCambiarEstadoRepuesto.mockResolvedValueOnce({ ...REPUESTO_ADMIN, estado: false });

    renderPage();
    await screen.findByText("Pastillas de freno");

    const fila = screen.getByText("Pastillas de freno").closest("tr");
    if (!fila) throw new Error("no se encontró la fila del repuesto");

    await userEvent.click(within(fila).getByRole("button", { name: /dar de baja/i }));
    expect(within(fila).getByText(/¿dar de baja\?/i)).toBeInTheDocument();
    expect(mockCambiarEstadoRepuesto).not.toHaveBeenCalled();

    await userEvent.click(within(fila).getByRole("button", { name: /confirmar/i }));

    expect(mockCambiarEstadoRepuesto).toHaveBeenCalledWith("FRE-001", false);
    expect(await screen.findByRole("status")).toHaveTextContent(/se dio de baja/i);
  });

  it("muestra un banner de error si falla la carga del listado", async () => {
    comoAdministrador();
    mockListarRepuestos.mockRejectedValueOnce(new RepuestoApiError("Error interno del servidor", 500));

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Error interno del servidor");
  });

  it("muestra el estado vacío cuando no hay repuestos", async () => {
    comoAdministrador();
    mockListarRepuestos.mockResolvedValueOnce({
      articulos: [],
      paginacion: { pagina: 1, porPagina: 20, total: 0, totalPaginas: 1 },
    });

    renderPage();

    expect(await screen.findByText(/todavía no hay repuestos registrados/i)).toBeInTheDocument();
  });
});
