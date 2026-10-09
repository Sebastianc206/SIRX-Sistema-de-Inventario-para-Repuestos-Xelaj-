import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Providers } from "@/test/providers";
import CategoriasPage from "@/pages/CategoriasPage";
import { CategoriaApiError } from "@/services/categoriaService";
import type { Categoria } from "@/types/categoria";

const { mockListarCategorias, mockEliminarCategoria } = vi.hoisted(() => ({
  mockListarCategorias: vi.fn(),
  mockEliminarCategoria: vi.fn(),
}));

vi.mock("@/services/categoriaService", async () => {
  const actual = await vi.importActual<typeof import("@/services/categoriaService")>(
    "@/services/categoriaService",
  );
  return {
    ...actual,
    listarCategorias: mockListarCategorias,
    eliminarCategoria: mockEliminarCategoria,
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    usuario: { idColaborador: 1, username: "admin", nombreCompleto: "Admin", role: "Administrador" },
    cerrarSesion: vi.fn(),
  }),
}));

const categorias: Categoria[] = [
  { idCategoria: 1, descripcion: "Frenos" },
  { idCategoria: 2, descripcion: "Filtros" },
];

function renderPage() {
  return render(<CategoriasPage />, { wrapper: Providers });
}

describe("CategoriasPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("lista las categorías devueltas por el backend", async () => {
    mockListarCategorias.mockResolvedValueOnce(categorias);

    renderPage();

    expect(await screen.findByText("Frenos")).toBeInTheDocument();
    expect(screen.getByText("Filtros")).toBeInTheDocument();
  });

  it("muestra un estado vacío cuando no hay categorías registradas", async () => {
    mockListarCategorias.mockResolvedValueOnce([]);

    renderPage();

    expect(await screen.findByText(/todavía no hay categorías registradas/i)).toBeInTheDocument();
  });

  it("muestra un banner de error si falla la carga del listado", async () => {
    mockListarCategorias.mockRejectedValueOnce(new CategoriaApiError("Error interno del servidor", 500));

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Error interno del servidor");
  });

  it("filtra la tabla localmente al buscar por descripción", async () => {
    mockListarCategorias.mockResolvedValueOnce(categorias);
    renderPage();
    await screen.findByText("Frenos");

    await userEvent.type(screen.getByLabelText(/buscar/i), "fil");

    expect(screen.queryByText("Frenos")).not.toBeInTheDocument();
    expect(screen.getByText("Filtros")).toBeInTheDocument();
  });

  it("abre el modal de creación al hacer click en 'Nueva categoría'", async () => {
    mockListarCategorias.mockResolvedValueOnce(categorias);
    renderPage();
    await screen.findByText("Frenos");

    await userEvent.click(screen.getByRole("button", { name: /nueva categoría/i }));

    expect(screen.getByRole("dialog", { name: /nueva categoría/i })).toBeInTheDocument();
  });

  it("pide confirmación antes de eliminar y luego elimina la fila", async () => {
    mockListarCategorias.mockResolvedValueOnce(categorias);
    mockEliminarCategoria.mockResolvedValueOnce(undefined);

    renderPage();
    await screen.findByText("Frenos");

    const filaFrenos = screen.getByText("Frenos").closest("tr");
    if (!filaFrenos) throw new Error("no se encontró la fila de Frenos");

    await userEvent.click(within(filaFrenos).getByRole("button", { name: /^eliminar$/i }));
    const dialogo = screen.getByRole("alertdialog", { name: /¿eliminar esta categoría\?/i });
    expect(mockEliminarCategoria).not.toHaveBeenCalled();

    await userEvent.click(within(dialogo).getByRole("button", { name: /sí, eliminar/i }));

    expect(mockEliminarCategoria).toHaveBeenCalledWith(1);
    expect(await screen.findByRole("status")).toHaveTextContent(/se eliminó la categoría "frenos"/i);
    expect(screen.queryByText("Frenos")).not.toBeInTheDocument();
  });

  it("muestra el error del backend si no se puede eliminar por tener repuestos asociados", async () => {
    mockListarCategorias.mockResolvedValueOnce(categorias);
    mockEliminarCategoria.mockRejectedValueOnce(
      new CategoriaApiError("No se puede eliminar: hay repuestos asignados a esta categoría", 409),
    );

    renderPage();
    await screen.findByText("Frenos");

    const filaFrenos = screen.getByText("Frenos").closest("tr");
    if (!filaFrenos) throw new Error("no se encontró la fila de Frenos");

    await userEvent.click(within(filaFrenos).getByRole("button", { name: /^eliminar$/i }));
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: /sí, eliminar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/repuestos asignados/i);
    expect(screen.getByText("Frenos")).toBeInTheDocument();
  });
});
