import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const { mockUseAuth, mockListarRepuestos } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockListarRepuestos: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: mockUseAuth }));
vi.mock("@/services/repuestoService", () => ({ listarRepuestos: mockListarRepuestos }));

function comoRol(role: string) {
  mockUseAuth.mockReturnValue({
    usuario: { idColaborador: 1, username: "u", nombreCompleto: "Usuario Prueba", role },
    cargando: false,
    cerrarSesion: vi.fn(),
  });
}

function renderApp(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<h1>Pantalla de inicio</h1>} />
            <Route path="ventas" element={<h1>Pantalla de ventas</h1>} />
            <Route element={<ProtectedRoute roles={["Administrador"]} />}>
              <Route path="compras" element={<h1>Pantalla de compras</h1>} />
            </Route>
            <Route path="*" element={<h1>No encontrada</h1>} />
          </Route>
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("AppLayout", () => {
  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("Administrador ve toda la navegación y breadcrumbs de la ruta actual", () => {
    comoRol("Administrador");
    renderApp("/ventas");

    const nav = screen.getByRole("navigation", { name: "Principal" });
    expect(nav).toHaveTextContent("Compras");
    expect(nav).toHaveTextContent("Usuarios");
    expect(screen.getByRole("navigation", { name: "Ruta de navegación" })).toHaveTextContent("Ventas");
    expect(screen.getByRole("heading", { name: "Pantalla de ventas" })).toBeInTheDocument();
  });

  it("Operador no ve entradas de administración y es redirigido al inicio si fuerza la ruta", () => {
    comoRol("Operador");
    renderApp("/compras");

    const nav = screen.getByRole("navigation", { name: "Principal" });
    expect(nav).not.toHaveTextContent("Compras");
    expect(nav).not.toHaveTextContent("Proveedores");
    expect(nav).not.toHaveTextContent("Usuarios");
    expect(screen.getByRole("heading", { name: "Pantalla de inicio" })).toBeInTheDocument();
  });

  it("los grupos secundarios del menú están plegados y se abren con su encabezado", async () => {
    comoRol("Administrador");
    renderApp("/");

    const gestion = screen.getByRole("button", { name: "Gestión" });
    expect(gestion).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Compras" })).not.toBeInTheDocument();

    await userEvent.click(gestion);

    expect(gestion).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Compras" })).toBeInTheDocument();
  });

  it("el grupo que contiene la ruta actual arranca abierto", () => {
    comoRol("Administrador");
    renderApp("/compras");

    expect(screen.getByRole("button", { name: "Gestión" })).toHaveAttribute("aria-expanded", "true");
  });

  it("el botón del sidebar contrae el menú y recuerda el estado", async () => {
    comoRol("Administrador");
    localStorage.removeItem("sirx_sidebar_colapsado");
    renderApp("/");

    await userEvent.click(screen.getByRole("button", { name: /contraer menú lateral/i }));

    expect(screen.getByRole("button", { name: /expandir menú lateral/i })).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem("sirx_sidebar_colapsado")).toBe("true");
    localStorage.removeItem("sirx_sidebar_colapsado");
  });

  it("Ctrl+K abre la paleta, busca repuestos y navega a páginas con Enter", async () => {
    comoRol("Administrador");
    mockListarRepuestos.mockResolvedValue({
      articulos: [{ sku: "FRE-001", nombre: "Pastillas de freno", cantidadInventario: 4, inventarioMinimo: 5 }],
      paginacion: { pagina: 1, porPagina: 6, total: 1, totalPaginas: 1 },
    });
    renderApp("/");

    await userEvent.keyboard("{Control>}k{/Control}");
    const dialogo = screen.getByRole("dialog", { name: /buscar repuestos o ir a una página/i });
    expect(dialogo).toBeInTheDocument();

    const combo = screen.getByRole("combobox");
    await userEvent.type(combo, "ven");
    expect(screen.getByRole("option", { name: /^ventas/i })).toBeInTheDocument();

    await userEvent.type(combo, "{Enter}");
    expect(await screen.findByRole("heading", { name: "Pantalla de ventas" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("la paleta encuentra repuestos por SKU o nombre", async () => {
    comoRol("Operador");
    mockListarRepuestos.mockResolvedValue({
      articulos: [{ sku: "FRE-001", nombre: "Pastillas de freno", cantidadInventario: 4, inventarioMinimo: 5 }],
      paginacion: { pagina: 1, porPagina: 6, total: 1, totalPaginas: 1 },
    });
    renderApp("/");

    await userEvent.keyboard("{Control>}k{/Control}");
    await userEvent.type(screen.getByRole("combobox"), "fre");

    expect(await screen.findByRole("option", { name: /pastillas de freno/i })).toBeInTheDocument();
    expect(mockListarRepuestos).toHaveBeenCalledWith(expect.objectContaining({ busqueda: "fre" }));
    // El Operador no recibe acciones de administración en la paleta.
    expect(screen.queryByRole("option", { name: /nueva compra/i })).not.toBeInTheDocument();
  });
});
