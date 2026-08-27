import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RepuestoFormModal } from "@/components/RepuestoFormModal";
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

async function llenarCamposBasicos() {
  await userEvent.type(screen.getByLabelText(/^sku$/i), "SKU-001");
  await userEvent.type(screen.getByLabelText(/^nombre$/i), "Pastillas de freno");
  await screen.findByRole("option", { name: "Frenos" });
  await userEvent.selectOptions(screen.getByLabelText(/categoría/i), "1");
  await userEvent.type(screen.getByLabelText(/precio de venta/i), "125.50");
}

describe("RepuestoFormModal", () => {
  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("envía los datos del repuesto, incluida la categoría elegida en el selector", async () => {
    mockListarCategorias.mockResolvedValueOnce(categorias);
    const onSubmit = vi.fn().mockResolvedValueOnce(undefined);

    render(<RepuestoFormModal onClose={vi.fn()} onSubmit={onSubmit} />);

    await llenarCamposBasicos();
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      sku: "SKU-001",
      nombre: "Pastillas de freno",
      precioVenta: 125.5,
      inventarioMinimo: 0,
      idCategoria: 1,
    });
  });

  it("no envía el formulario si no se eligió categoría", async () => {
    mockListarCategorias.mockResolvedValueOnce(categorias);
    const onSubmit = vi.fn();

    render(<RepuestoFormModal onClose={vi.fn()} onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/^sku$/i), "SKU-001");
    await userEvent.type(screen.getByLabelText(/^nombre$/i), "Pastillas de freno");
    await userEvent.type(screen.getByLabelText(/precio de venta/i), "125.50");
    await screen.findByRole("option", { name: "Frenos" });

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/selecciona una categoría/i);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("muestra el error si onSubmit falla", async () => {
    mockListarCategorias.mockResolvedValueOnce(categorias);
    const onSubmit = vi.fn().mockRejectedValueOnce(new Error("El SKU ya existe"));

    render(<RepuestoFormModal onClose={vi.fn()} onSubmit={onSubmit} />);

    await llenarCamposBasicos();
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("El SKU ya existe");
  });

  it("cierra el modal al hacer click en Cancelar", async () => {
    mockListarCategorias.mockResolvedValueOnce(categorias);
    const onClose = vi.fn();

    render(<RepuestoFormModal onClose={onClose} onSubmit={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
