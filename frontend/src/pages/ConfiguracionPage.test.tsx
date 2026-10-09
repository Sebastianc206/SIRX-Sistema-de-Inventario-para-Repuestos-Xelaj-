import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Providers } from "@/test/providers";
import ConfiguracionPage from "@/pages/ConfiguracionPage";

const { mockObtener, mockPrevisualizar, mockGuardar, mockMasivo } = vi.hoisted(() => ({
  mockObtener: vi.fn(),
  mockPrevisualizar: vi.fn(),
  mockGuardar: vi.fn(),
  mockMasivo: vi.fn(),
}));

vi.mock("@/services/configuracionService", async () => {
  const actual = await vi.importActual<typeof import("@/services/configuracionService")>("@/services/configuracionService");
  return {
    ...actual,
    obtenerConfiguracionStock: mockObtener,
    previsualizarImpacto: mockPrevisualizar,
    guardarUmbralGeneral: mockGuardar,
    aplicarUmbralMasivo: mockMasivo,
  };
});

vi.mock("@/services/categoriaService", () => ({
  listarCategorias: vi.fn().mockResolvedValue([{ idCategoria: 1, descripcion: "Frenos" }]),
  CategoriaApiError: class extends Error {},
}));

const IMPACTO = { totalActivos: 10, enBajo: 3, agotados: 1, conUmbralPropio: 2 };

function preparar() {
  mockObtener.mockResolvedValue({ umbralGeneral: 5, impacto: IMPACTO });
  mockPrevisualizar.mockResolvedValue({ ...IMPACTO, enBajo: 6 });
  mockGuardar.mockResolvedValue({ umbralGeneral: 12, impacto: IMPACTO });
  mockMasivo.mockResolvedValue({ actualizados: 4 });
}

describe("ConfiguracionPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("muestra el umbral general guardado y su vista de impacto", async () => {
    preparar();
    render(<ConfiguracionPage />, { wrapper: Providers });

    const campo = await screen.findByLabelText(/umbral general \(unidades\)/i);
    await waitFor(() => expect(campo).toHaveValue("5"));
    expect(await screen.findByText(/en stock bajo/i, { selector: "p.config-impacto-cifra" })).toBeInTheDocument();
  });

  it("al cambiar el valor recalcula el impacto con debounce y permite guardar", async () => {
    preparar();
    render(<ConfiguracionPage />, { wrapper: Providers });
    const campo = await screen.findByLabelText(/umbral general \(unidades\)/i);
    await waitFor(() => expect(campo).toHaveValue("5"));

    await userEvent.clear(campo);
    await userEvent.type(campo, "12");

    await waitFor(() => expect(mockPrevisualizar).toHaveBeenCalledWith(12));
    await userEvent.click(screen.getByRole("button", { name: /guardar umbral general/i }));

    await waitFor(() => expect(mockGuardar).toHaveBeenCalledWith(12));
  });

  it("rechaza valores no enteros o fuera de rango y deshabilita Guardar", async () => {
    preparar();
    render(<ConfiguracionPage />, { wrapper: Providers });
    const campo = await screen.findByLabelText(/umbral general \(unidades\)/i);
    await waitFor(() => expect(campo).toHaveValue("5"));

    await userEvent.clear(campo);
    await userEvent.type(campo, "2.5");
    expect(await screen.findByText(/número entero entre 0 y 10000/i, { selector: ".field-error" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /guardar umbral general/i })).toBeDisabled();

    await userEvent.clear(campo);
    await userEvent.type(campo, "99999");
    expect(screen.getByRole("button", { name: /guardar umbral general/i })).toBeDisabled();
    expect(mockGuardar).not.toHaveBeenCalled();
  });

  it("ajuste en bloque por categoría pide confirmación antes de aplicar", async () => {
    preparar();
    render(<ConfiguracionPage />, { wrapper: Providers });
    await screen.findByLabelText(/umbral general \(unidades\)/i);

    await screen.findByRole("option", { name: "Frenos" });
    await userEvent.selectOptions(screen.getByRole("combobox", { name: /^categoría$/i }), "1");
    await userEvent.type(screen.getByLabelText(/umbral propio \(unidades\)/i), "9");
    await userEvent.click(screen.getByRole("button", { name: /aplicar en bloque/i }));

    expect(mockMasivo).not.toHaveBeenCalled(); // primero confirma
    await userEvent.click(await screen.findByRole("button", { name: /aplicar cambio/i }));

    await waitFor(() => expect(mockMasivo).toHaveBeenCalledWith({ umbral: 9, idCategoria: 1 }));
  });

  it("ajuste en bloque por SKUs con 'usar el general' envía umbral null", async () => {
    preparar();
    render(<ConfiguracionPage />, { wrapper: Providers });
    await screen.findByLabelText(/umbral general \(unidades\)/i);

    await userEvent.click(screen.getByLabelText(/una lista de skus/i));
    await userEvent.type(screen.getByLabelText(/^skus/i), "FRE-001, FIL-002 FRE-001");
    await userEvent.click(screen.getByLabelText(/usar el umbral general/i));
    await userEvent.click(screen.getByRole("button", { name: /aplicar en bloque/i }));
    await userEvent.click(await screen.findByRole("button", { name: /aplicar cambio/i }));

    await waitFor(() => expect(mockMasivo).toHaveBeenCalledWith({ umbral: null, skus: ["FRE-001", "FIL-002"] }));
  });
});
