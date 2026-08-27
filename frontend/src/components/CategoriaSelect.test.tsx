import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoriaSelect } from "@/components/CategoriaSelect";
import { CategoriaApiError } from "@/services/categoriaService";
import type { Categoria } from "@/types/categoria";

const { mockListarCategorias } = vi.hoisted(() => ({ mockListarCategorias: vi.fn() }));

vi.mock("@/services/categoriaService", async () => {
  const actual = await vi.importActual<typeof import("@/services/categoriaService")>(
    "@/services/categoriaService",
  );
  return { ...actual, listarCategorias: mockListarCategorias };
});

const categorias: Categoria[] = [
  { idCategoria: 1, descripcion: "Frenos" },
  { idCategoria: 2, descripcion: "Filtros" },
];

describe("CategoriaSelect", () => {
  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("carga y lista las categorías disponibles", async () => {
    mockListarCategorias.mockResolvedValueOnce(categorias);

    render(<CategoriaSelect value={undefined} onChange={vi.fn()} />);

    expect(await screen.findByRole("option", { name: "Frenos" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Filtros" })).toBeInTheDocument();
  });

  it("notifica el id numérico elegido al cambiar la selección", async () => {
    mockListarCategorias.mockResolvedValueOnce(categorias);
    const onChange = vi.fn();

    render(<CategoriaSelect value={undefined} onChange={onChange} />);
    await screen.findByRole("option", { name: "Frenos" });

    await userEvent.selectOptions(screen.getByLabelText(/categoría/i), "2");

    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("muestra un banner de error si falla la carga del catálogo", async () => {
    mockListarCategorias.mockRejectedValueOnce(new CategoriaApiError("Error interno del servidor", 500));

    render(<CategoriaSelect value={undefined} onChange={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Error interno del servidor");
  });
});
