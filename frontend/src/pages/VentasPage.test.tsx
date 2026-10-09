import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Providers } from "@/test/providers";
import VentasPage from "@/pages/VentasPage";
import type { Repuesto } from "@/types/repuesto";

const { mockListar, mockObtener, mockCrearVenta } = vi.hoisted(() => ({
  mockListar: vi.fn(),
  mockObtener: vi.fn(),
  mockCrearVenta: vi.fn(),
}));

vi.mock("@/services/repuestoService", async () => {
  const actual = await vi.importActual<typeof import("@/services/repuestoService")>("@/services/repuestoService");
  return { ...actual, listarRepuestos: mockListar, obtenerRepuesto: mockObtener };
});

vi.mock("@/services/ventaService", async () => {
  const actual = await vi.importActual<typeof import("@/services/ventaService")>("@/services/ventaService");
  return { ...actual, crearVenta: mockCrearVenta };
});

vi.mock("@/services/categoriaService", () => ({
  listarCategorias: vi.fn().mockResolvedValue([{ idCategoria: 1, descripcion: "Frenos" }]),
}));

vi.mock("@/services/catalogosAuxiliaresService", () => ({
  listarMarcas: vi.fn().mockResolvedValue([{ idMarca: 1, nombre: "Bosch" }]),
}));

function repuesto(sku: string, cantidad: number, extra: Partial<Repuesto> = {}): Repuesto {
  return {
    sku,
    nombre: `Repuesto ${sku}`,
    precioVenta: 100,
    inventarioMinimo: 5,
    inventarioMinimoPropio: null,
    estadoStock: cantidad <= 0 ? "agotado" : cantidad <= 5 ? "bajo" : "en_stock",
    ubicacion: null,
    estado: true,
    categoria: { idCategoria: 1, descripcion: "Frenos" },
    marca: { idMarca: 1, nombre: "Bosch" },
    modelosCompatibles: [],
    cantidadInventario: cantidad,
    ...extra,
  };
}

function respuesta(articulos: Repuesto[], total = articulos.length) {
  return { articulos, paginacion: { pagina: 1, porPagina: 50, total, totalPaginas: 1 } };
}

function renderPage() {
  return render(<VentasPage />, { wrapper: Providers });
}

describe("VentasPage (punto de venta escalable)", () => {
  beforeEach(() => {
    localStorage.clear();
    mockListar.mockResolvedValue(respuesta([repuesto("FRE-001", 12), repuesto("FRE-002", 0)]));
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("carga la primera página en servidor, activos y con existencias primero", async () => {
    renderPage();

    expect(await screen.findByRole("option", { name: /Repuesto FRE-001/ })).toBeInTheDocument();
    expect(mockListar).toHaveBeenCalledWith(
      expect.objectContaining({ estado: "activo", orden: "existencias", pagina: 1, porPagina: 50 }),
    );
  });

  it("busca en el servidor con debounce al escribir (no por cada tecla)", async () => {
    renderPage();
    await screen.findByRole("option", { name: /FRE-001/ });
    mockListar.mockClear();

    await userEvent.type(screen.getByLabelText(/buscar repuesto por sku/i), "freno");

    await waitFor(() => expect(mockListar).toHaveBeenCalledWith(expect.objectContaining({ busqueda: "freno", pagina: 1 })));
    // 5 teclas -> una sola petición con el texto completo (debounce).
    expect(mockListar.mock.calls.filter(([f]) => f.busqueda === "freno")).toHaveLength(1);
    expect(mockListar.mock.calls.some(([f]) => f.busqueda === "fre")).toBe(false);
  });

  it("'Solo con existencias' filtra en servidor y quita el orden", async () => {
    renderPage();
    await screen.findByRole("option", { name: /FRE-001/ });

    await userEvent.click(screen.getByRole("button", { name: /filtros/i }));
    await userEvent.click(screen.getByLabelText(/solo con existencias/i));

    await waitFor(() =>
      expect(mockListar).toHaveBeenLastCalledWith(expect.objectContaining({ soloConExistencias: true, orden: undefined })),
    );
  });

  it("el filtro de categoría se envía como idCategoria", async () => {
    renderPage();
    await screen.findByRole("option", { name: /FRE-001/ });
    await userEvent.click(screen.getByRole("button", { name: /filtros/i }));
    await screen.findByRole("option", { name: "Frenos" });

    await userEvent.selectOptions(screen.getByLabelText(/categoría/i), "1");

    await waitFor(() => expect(mockListar).toHaveBeenLastCalledWith(expect.objectContaining({ idCategoria: 1 })));
  });

  it("Enter con un SKU exacto lo agrega al carrito y limpia la búsqueda", async () => {
    renderPage();
    await screen.findByRole("option", { name: /FRE-001/ });
    const buscador = screen.getByLabelText(/buscar repuesto por sku/i);

    await userEvent.type(buscador, "fre-001");
    await waitFor(() => expect(mockListar).toHaveBeenLastCalledWith(expect.objectContaining({ busqueda: "fre-001" })));
    await userEvent.type(buscador, "{Enter}");

    const carrito = screen.getByRole("form", { name: /carrito/i });
    expect(await within(carrito).findByText("Repuesto FRE-001")).toBeInTheDocument();
    await waitFor(() => expect(buscador).toHaveValue(""));
  });

  it("Enter con un SKU que no está en la página cargada lo busca por código exacto", async () => {
    mockObtener.mockResolvedValueOnce(repuesto("ZZZ-999", 3));
    renderPage();
    await screen.findByRole("option", { name: /FRE-001/ });
    const buscador = screen.getByLabelText(/buscar repuesto por sku/i);
    mockListar.mockResolvedValue(respuesta([repuesto("ZZZ-9990", 4), repuesto("ZZZ-9991", 4)]));

    await userEvent.type(buscador, "ZZZ-999");
    await waitFor(() => expect(mockListar).toHaveBeenLastCalledWith(expect.objectContaining({ busqueda: "ZZZ-999" })));
    await screen.findByRole("option", { name: /ZZZ-9990/ });
    await userEvent.type(buscador, "{Enter}");

    await waitFor(() => expect(mockObtener).toHaveBeenCalledWith("ZZZ-999"));
    const carrito = screen.getByRole("form", { name: /carrito/i });
    expect(await within(carrito).findByText("Repuesto ZZZ-999")).toBeInTheDocument();
  });

  it("las flechas resaltan un resultado y Enter lo agrega", async () => {
    renderPage();
    await screen.findByRole("option", { name: /FRE-001/ });
    const buscador = screen.getByLabelText(/buscar repuesto por sku/i);

    await userEvent.type(buscador, "{ArrowDown}");
    expect(buscador).toHaveAttribute("aria-activedescendant", "pos-op-FRE-001");
    await userEvent.type(buscador, "{Enter}");

    const carrito = screen.getByRole("form", { name: /carrito/i });
    expect(await within(carrito).findByText("Repuesto FRE-001")).toBeInTheDocument();
  });

  it("un repuesto agotado no se agrega", async () => {
    renderPage();
    const agotado = await screen.findByRole("option", { name: /FRE-002/ });
    expect(agotado).toHaveAttribute("aria-disabled", "true");

    await userEvent.click(agotado);

    const carrito = screen.getByRole("form", { name: /carrito/i });
    expect(within(carrito).queryByText("Repuesto FRE-002")).not.toBeInTheDocument();
  });

  it("registrar la venta mantiene el contrato de POST /api/ventas", async () => {
    mockCrearVenta.mockResolvedValueOnce({ idVenta: 7, montoTotalVenta: 100 });
    renderPage();
    await userEvent.click(await screen.findByRole("option", { name: /FRE-001/ }));

    await userEvent.click(screen.getByRole("button", { name: /registrar venta/i }));

    await waitFor(() =>
      expect(mockCrearVenta).toHaveBeenCalledWith({ lineas: [{ sku: "FRE-001", cantidad: 1, precioVenta: 100 }] }),
    );
  });

  it("los filtros están plegados tras el botón Filtros y no hay vista de tarjetas", async () => {
    renderPage();
    await screen.findByRole("option", { name: /FRE-001/ });
    const boton = screen.getByRole("button", { name: /filtros/i });
    expect(boton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: /vista de tarjetas/i })).not.toBeInTheDocument();

    await userEvent.click(boton);

    expect(boton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText(/categoría/i)).toBeVisible();
  });
});
