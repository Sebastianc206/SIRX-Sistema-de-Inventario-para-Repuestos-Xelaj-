import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoriaFormModal } from "@/components/CategoriaFormModal";
import { CategoriaApiError } from "@/services/categoriaService";
import type { Categoria } from "@/types/categoria";

const { mockCrearCategoria, mockEditarCategoria } = vi.hoisted(() => ({
  mockCrearCategoria: vi.fn(),
  mockEditarCategoria: vi.fn(),
}));

vi.mock("@/services/categoriaService", async () => {
  const actual = await vi.importActual<typeof import("@/services/categoriaService")>(
    "@/services/categoriaService",
  );
  return { ...actual, crearCategoria: mockCrearCategoria, editarCategoria: mockEditarCategoria };
});

const categoriaExistente: Categoria = { idCategoria: 3, descripcion: "Frenos" };

describe("CategoriaFormModal", () => {
  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("modo crear: envía la descripción y avisa el éxito", async () => {
    mockCrearCategoria.mockResolvedValueOnce({ idCategoria: 9, descripcion: "Filtros" });
    const onGuardado = vi.fn();

    render(<CategoriaFormModal categoria={null} onClose={vi.fn()} onGuardado={onGuardado} />);

    await userEvent.type(screen.getByLabelText(/descripción/i), "Filtros");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(mockCrearCategoria).toHaveBeenCalledWith({ descripcion: "Filtros" });
    expect(onGuardado).toHaveBeenCalledWith("Categoría creada correctamente.");
  });

  it("modo crear: no llama al backend si la descripción está vacía", async () => {
    render(<CategoriaFormModal categoria={null} onClose={vi.fn()} onGuardado={vi.fn()} />);

    // El input es "required", pero forzamos submit vía requestSubmit para
    // ejercitar también la validación propia del componente.
    const form = screen.getByRole("button", { name: /guardar/i }).closest("form");
    form?.requestSubmit();

    expect(mockCrearCategoria).not.toHaveBeenCalled();
  });

  it("modo crear: muestra el error del backend si la descripción ya existe", async () => {
    mockCrearCategoria.mockRejectedValueOnce(
      new CategoriaApiError("Ya existe una categoría con esa descripción", 409),
    );

    render(<CategoriaFormModal categoria={null} onClose={vi.fn()} onGuardado={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/descripción/i), "Frenos");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ya existe una categoría con esa descripción",
    );
  });

  it("modo editar: precarga la descripción actual", () => {
    render(<CategoriaFormModal categoria={categoriaExistente} onClose={vi.fn()} onGuardado={vi.fn()} />);

    expect(screen.getByLabelText(/descripción/i)).toHaveValue("Frenos");
    expect(screen.getByRole("heading", { name: /editar categoría/i })).toBeInTheDocument();
  });

  it("modo editar: envía la nueva descripción al guardar", async () => {
    mockEditarCategoria.mockResolvedValueOnce({ idCategoria: 3, descripcion: "Frenos y pastillas" });
    const onGuardado = vi.fn();

    render(<CategoriaFormModal categoria={categoriaExistente} onClose={vi.fn()} onGuardado={onGuardado} />);

    const input = screen.getByLabelText(/descripción/i);
    await userEvent.clear(input);
    await userEvent.type(input, "Frenos y pastillas");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(mockEditarCategoria).toHaveBeenCalledWith(3, { descripcion: "Frenos y pastillas" });
    expect(onGuardado).toHaveBeenCalledWith("Categoría actualizada correctamente.");
  });

  it("cierra el modal al hacer click en Cancelar", async () => {
    const onClose = vi.fn();
    render(<CategoriaFormModal categoria={categoriaExistente} onClose={onClose} onGuardado={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
