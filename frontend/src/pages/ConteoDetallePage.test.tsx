import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "@/components/ui/Toast";
import ConteoDetallePage from "@/pages/ConteoDetallePage";
import { calcularResumenLocal } from "@/utils/conteo";
import type { Conteo, LineaConteo } from "@/types/conteo";

const { mockObtener, mockGuardar, mockCerrar, mockCancelar, mockQuitar, mockEliminar, mockRepuestos } = vi.hoisted(() => ({
  mockObtener: vi.fn(),
  mockGuardar: vi.fn(),
  mockCerrar: vi.fn(),
  mockCancelar: vi.fn(),
  mockQuitar: vi.fn(),
  mockEliminar: vi.fn(),
  mockRepuestos: vi.fn(),
}));

vi.mock("@/services/conteoService", async () => {
  const actual = await vi.importActual<typeof import("@/services/conteoService")>("@/services/conteoService");
  return {
    ...actual,
    obtenerConteo: mockObtener,
    guardarLineasConteo: mockGuardar,
    cerrarConteo: mockCerrar,
    cancelarConteo: mockCancelar,
    quitarLineaConteo: mockQuitar,
    eliminarConteo: mockEliminar,
  };
});

vi.mock("@/services/repuestoService", () => ({
  listarRepuestos: mockRepuestos,
  RepuestoApiError: class extends Error {},
}));

vi.mock("@/services/reporteService", () => ({
  descargarReportes: vi.fn(),
  guardarArchivo: vi.fn(),
}));

function Envoltorio({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={["/conteos/5"]}>
      <ToastProvider>
        <Routes>
          <Route path="/conteos/:id" element={children} />
          <Route path="/conteos" element={<p>Lista de conteos</p>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>
  );
}

function linea(sku: string, sistema: number, contada: number, extra: Partial<LineaConteo> = {}): LineaConteo {
  const diferencia = contada - sistema;
  return {
    sku,
    nombre: `Producto ${sku}`,
    cantidadSistema: sistema,
    cantidadContada: contada,
    diferencia,
    nivel: diferencia === 0 ? "exacto" : "alto",
    costoUnitario: 10,
    valorDiferencia: diferencia * 10,
    stockActual: sistema,
    cambioDesdeConteo: false,
    ajusteAplicado: null,
    cantidadAntes: null,
    cantidadDespues: null,
    ...extra,
  };
}

function conteo(parcial: Partial<Conteo> = {}): Conteo {
  const lineas = parcial.lineas ?? [linea("BAT-1", 10, 10), linea("BAT-2", 20, 18)];
  return {
    idConteo: 5,
    nombre: "Conteo baterías",
    fechaConteo: "2026-10-08T18:00:00.000Z",
    estado: "borrador",
    categoria: { idCategoria: 106, descripcion: "Baterías" },
    creador: { idColaborador: 1, nombreCompleto: "Admin Sistema" },
    cierre: null,
    fechaCierre: null,
    lineas,
    resumen: calcularResumenLocal(lineas),
    alcance: { productosEnAlcance: 7, sinContar: 7 - lineas.length },
    cambiosDesdeConteo: lineas.filter((l) => l.cambioDesdeConteo && l.diferencia !== 0).length,
    ...parcial,
  };
}

describe("ConteoDetallePage", () => {
  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("calcula los KPIs: exactitud, diferencia agregada y cumplimiento de la meta", async () => {
    mockObtener.mockResolvedValue(conteo());
    render(<ConteoDetallePage />, { wrapper: Envoltorio });

    expect(await screen.findByRole("heading", { name: "Conteo baterías" })).toBeInTheDocument();
    // 1 de 2 sin diferencia = 50 %; |dif| 2 sobre 30 = 6,7 % > 5 %.
    expect(screen.getByText("50.0 %")).toBeInTheDocument();
    expect(screen.getByText("6.7 %")).toBeInTheDocument();
    expect(screen.getByText(/No cumple la meta \(5 % o menos\)/)).toBeInTheDocument();
    expect(screen.getByText("−2 faltan")).toBeInTheDocument();
    expect(screen.getByText("Exacto")).toBeInTheDocument();
    expect(screen.getByText(/Sin contar: 5 de 7/)).toBeInTheDocument();
  });

  it("un conteo dentro de la meta dice que cumple", async () => {
    mockObtener.mockResolvedValue(conteo({ lineas: [linea("BAT-1", 100, 100), linea("BAT-2", 100, 99)] }));
    render(<ConteoDetallePage />, { wrapper: Envoltorio });
    expect(await screen.findByText(/Cumple la meta \(5 % o menos\)/)).toBeInTheDocument();
  });

  it("al escanear un SKU (Enter) lo agrega con 1 y guarda solo (autoguardado)", async () => {
    mockObtener.mockResolvedValue(conteo({ lineas: [] }));
    mockRepuestos.mockResolvedValue({
      articulos: [{ sku: "BAT-9", nombre: "Batería nueva", cantidadInventario: 4, precioCosto: 50 }],
      paginacion: { pagina: 1, porPagina: 8, total: 1, totalPaginas: 1 },
    });
    mockGuardar.mockImplementation(async () => conteo({ lineas: [linea("BAT-9", 4, 1)] }));
    const user = userEvent.setup();
    render(<ConteoDetallePage />, { wrapper: Envoltorio });

    const buscador = await screen.findByRole("combobox", { name: /buscar o escanear/i });
    await user.type(buscador, "bat-9{Enter}");

    expect(await screen.findByLabelText("Cantidad contada de BAT-9")).toHaveValue(1);
    expect(screen.getByText("−3 faltan")).toBeInTheDocument();
    await waitFor(() => expect(mockGuardar).toHaveBeenCalledWith(5, [{ sku: "BAT-9", cantidad: 1 }]), { timeout: 3000 });
    expect(buscador).toHaveValue("");
    await waitFor(() => expect(screen.getByText("Guardado")).toBeInTheDocument());
  });

  it("avisa cuando el SKU no existe en el alcance del conteo", async () => {
    mockObtener.mockResolvedValue(conteo({ lineas: [] }));
    mockRepuestos.mockResolvedValue({ articulos: [], paginacion: { pagina: 1, porPagina: 8, total: 0, totalPaginas: 1 } });
    const user = userEvent.setup();
    render(<ConteoDetallePage />, { wrapper: Envoltorio });

    await user.type(await screen.findByRole("combobox", { name: /buscar o escanear/i }), "zzz{Enter}");
    expect(await screen.findByText(/No se encontró «zzz» en la categoría de este conteo/)).toBeInTheDocument();
    expect(mockGuardar).not.toHaveBeenCalled();
  });

  it("aplicar ajustes pide confirmación, llama al cierre una sola vez y pasa a Aplicado", async () => {
    mockObtener.mockResolvedValue(conteo());
    const lineasAplicadas = [linea("BAT-1", 10, 10, { ajusteAplicado: 0 }), linea("BAT-2", 20, 18, { ajusteAplicado: -2, cantidadAntes: 20, cantidadDespues: 18 })];
    mockCerrar.mockResolvedValue(conteo({ estado: "aplicado", lineas: lineasAplicadas, fechaCierre: "2026-10-08T20:00:00.000Z" }));
    const user = userEvent.setup();
    render(<ConteoDetallePage />, { wrapper: Envoltorio });

    await user.click(await screen.findByRole("button", { name: "Cerrar y aplicar ajustes" }));
    const dialogo = await screen.findByRole("alertdialog");
    expect(within(dialogo).getByText(/no podrá reabrirse ni aplicarse de nuevo/)).toBeInTheDocument();
    expect(mockCerrar).not.toHaveBeenCalled();

    await user.click(within(dialogo).getByRole("button", { name: "Cerrar y aplicar ajustes" }));
    await waitFor(() => expect(mockCerrar).toHaveBeenCalledTimes(1));
    expect(mockCerrar).toHaveBeenCalledWith(5, true, false);
    expect(await screen.findByText("Aplicado")).toBeInTheDocument();
    expect(screen.getByText("20 →", { exact: false })).toBeInTheDocument();
    // Ya no hay captura ni acción de cierre.
    expect(screen.queryByRole("combobox", { name: /buscar o escanear/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cerrar y aplicar ajustes" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Descargar reporte" })).toBeInTheDocument();
  });

  it("si el stock cambió desde que se contó, lo advierte y confirma el cambio al aplicar", async () => {
    mockObtener.mockResolvedValue(conteo({ lineas: [linea("BAT-2", 20, 18, { stockActual: 19, cambioDesdeConteo: true })] }));
    mockCerrar.mockResolvedValue(conteo({ estado: "aplicado" }));
    const user = userEvent.setup();
    render(<ConteoDetallePage />, { wrapper: Envoltorio });

    expect(await screen.findByText(/cambió de stock desde que se contó/)).toBeInTheDocument();
    expect(screen.getByText("ahora 19")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cerrar y aplicar ajustes" }));
    const dialogo = await screen.findByRole("alertdialog");
    await user.click(within(dialogo).getByRole("button", { name: "Cerrar y aplicar ajustes" }));
    await waitFor(() => expect(mockCerrar).toHaveBeenCalledWith(5, true, true));
  });

  it("cancelar el conteo requiere confirmar", async () => {
    mockObtener.mockResolvedValue(conteo());
    mockCancelar.mockResolvedValue(conteo({ estado: "cancelado" }));
    const user = userEvent.setup();
    render(<ConteoDetallePage />, { wrapper: Envoltorio });

    await user.click(await screen.findByRole("button", { name: "Más" }));
    await user.click(screen.getByRole("menuitem", { name: "Cancelar conteo" }));
    const dialogo = await screen.findByRole("alertdialog");
    expect(mockCancelar).not.toHaveBeenCalled();
    await user.click(within(dialogo).getByRole("button", { name: "Cancelar conteo" }));
    await waitFor(() => expect(mockCancelar).toHaveBeenCalledWith(5));
    expect(await screen.findByText("Cancelado", { selector: ".badge" })).toBeInTheDocument();
  });

  it("un conteo ya aplicado es de solo lectura (sin inputs de cantidad)", async () => {
    mockObtener.mockResolvedValue(conteo({ estado: "aplicado", fechaCierre: "2026-10-08T20:00:00.000Z" }));
    render(<ConteoDetallePage />, { wrapper: Envoltorio });
    await screen.findByText("Aplicado");
    expect(screen.queryByLabelText(/Cantidad contada de/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Quitar/ })).not.toBeInTheDocument();
  });

  it("muestra el error si el conteo no existe", async () => {
    mockObtener.mockRejectedValue(new Error("Conteo no encontrado"));
    render(<ConteoDetallePage />, { wrapper: Envoltorio });
    expect(await screen.findByText("Conteo no encontrado")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Conteos/ })).toHaveAttribute("href", "/conteos");
  });
});
