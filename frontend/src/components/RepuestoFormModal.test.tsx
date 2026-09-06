import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RepuestoFormModal } from "@/components/RepuestoFormModal";
import { RepuestoApiError } from "@/services/repuestoService";
import type { Categoria } from "@/types/categoria";
import type { Repuesto } from "@/types/repuesto";

const { mockListarCategorias, mockCrearRepuesto, mockEditarRepuesto } = vi.hoisted(() => ({
  mockListarCategorias: vi.fn(),
  mockCrearRepuesto: vi.fn(),
  mockEditarRepuesto: vi.fn(),
}));

vi.mock("@/services/categoriaService", async () => {
  const actual = await vi.importActual<typeof import("@/services/categoriaService")>(
    "@/services/categoriaService",
  );
  return { ...actual, listarCategorias: mockListarCategorias };
});

vi.mock("@/services/catalogosAuxiliaresService", () => ({
  listarMarcas: vi.fn().mockResolvedValue([]),
  listarProveedores: vi.fn().mockResolvedValue([]),
  listarModelos: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/services/repuestoService", async () => {
  const actual = await vi.importActual<typeof import("@/services/repuestoService")>(
    "@/services/repuestoService",
  );
  return { ...actual, crearRepuesto: mockCrearRepuesto, editarRepuesto: mockEditarRepuesto };
});

const categorias: Categoria[] = [
  { idCategoria: 1, descripcion: "Frenos" },
  { idCategoria: 2, descripcion: "Filtros" },
];

const REPUESTO_EXISTENTE: Repuesto = {
  sku: "FRE-001",
  nombre: "Pastillas de freno",
  precioVenta: 150,
  precioCosto: 90,
  inventarioMinimo: 5,
  ubicacion: "Estante A1",
  estado: true,
  categoria: { idCategoria: 1, descripcion: "Frenos" },
  marca: null,
  proveedor: null,
  modelosCompatibles: [],
  cantidadInventario: 12,
};

async function llenarCamposBasicos() {
  await userEvent.type(screen.getByLabelText(/^sku/i), "SKU-001");
  await userEvent.type(screen.getByLabelText(/^nombre$/i), "Pastillas de freno");
  await screen.findByRole("option", { name: "Frenos" });
  await userEvent.selectOptions(screen.getByLabelText(/categoría/i), "1");
  await userEvent.type(screen.getByLabelText(/precio de venta/i), "125.50");
  await userEvent.type(screen.getByLabelText(/precio de costo/i), "80");
}

describe("RepuestoFormModal", () => {
  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("T-033: crea el repuesto con todos los datos capturados", async () => {
    mockListarCategorias.mockResolvedValueOnce(categorias);
    mockCrearRepuesto.mockResolvedValueOnce(REPUESTO_EXISTENTE);
    const onGuardado = vi.fn();

    render(<RepuestoFormModal repuesto={null} onClose={vi.fn()} onGuardado={onGuardado} />);

    await llenarCamposBasicos();
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(mockCrearRepuesto).toHaveBeenCalledWith(
      expect.objectContaining({
        sku: "SKU-001",
        nombre: "Pastillas de freno",
        precioVenta: 125.5,
        precioCosto: 80,
        inventarioMinimo: 0,
        idCategoria: 1,
      }),
    );
    expect(onGuardado).toHaveBeenCalledWith("Repuesto creado correctamente.");
  });

  it("no envía el formulario si no se eligió categoría", async () => {
    mockListarCategorias.mockResolvedValueOnce(categorias);

    render(<RepuestoFormModal repuesto={null} onClose={vi.fn()} onGuardado={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/^sku/i), "SKU-001");
    await userEvent.type(screen.getByLabelText(/^nombre$/i), "Pastillas de freno");
    await userEvent.type(screen.getByLabelText(/precio de venta/i), "125.50");
    await userEvent.type(screen.getByLabelText(/precio de costo/i), "80");
    await screen.findByRole("option", { name: "Frenos" });

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/selecciona una categoría/i);
    expect(mockCrearRepuesto).not.toHaveBeenCalled();
  });

  it("T-036: muestra el mensaje de sku duplicado que devuelve la API", async () => {
    mockListarCategorias.mockResolvedValueOnce(categorias);
    mockCrearRepuesto.mockRejectedValueOnce(
      new RepuestoApiError("Ya existe un repuesto con ese código (SKU)", 409),
    );

    render(<RepuestoFormModal repuesto={null} onClose={vi.fn()} onGuardado={vi.fn()} />);

    await llenarCamposBasicos();
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/ya existe un repuesto/i);
  });

  it("cierra el modal al hacer click en Cancelar", async () => {
    mockListarCategorias.mockResolvedValueOnce(categorias);
    const onClose = vi.fn();

    render(<RepuestoFormModal repuesto={null} onClose={onClose} onGuardado={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("en modo edición precarga los campos y el SKU no es editable", async () => {
    mockListarCategorias.mockResolvedValueOnce(categorias);
    mockEditarRepuesto.mockResolvedValueOnce(REPUESTO_EXISTENTE);

    render(<RepuestoFormModal repuesto={REPUESTO_EXISTENTE} onClose={vi.fn()} onGuardado={vi.fn()} />);

    expect(screen.getByText("FRE-001")).toBeInTheDocument();
    expect(screen.queryByLabelText(/^sku/i)).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Pastillas de freno")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(mockEditarRepuesto).toHaveBeenCalledWith(
      "FRE-001",
      expect.objectContaining({ nombre: "Pastillas de freno", idCategoria: 1 }),
    );
  });
});
