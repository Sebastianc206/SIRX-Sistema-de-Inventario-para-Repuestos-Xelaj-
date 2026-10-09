import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Providers } from "@/test/providers";
import ConteosPage from "@/pages/ConteosPage";
import type { ConteoResumido, ResumenConteo } from "@/types/conteo";

const { mockListar, mockCrear } = vi.hoisted(() => ({ mockListar: vi.fn(), mockCrear: vi.fn() }));

vi.mock("@/services/conteoService", async () => {
  const actual = await vi.importActual<typeof import("@/services/conteoService")>("@/services/conteoService");
  return { ...actual, listarConteos: mockListar, crearConteo: mockCrear };
});

vi.mock("@/services/categoriaService", () => ({
  listarCategorias: vi.fn().mockResolvedValue([{ idCategoria: 106, descripcion: "Baterías" }]),
  CategoriaApiError: class extends Error {},
}));

const RESUMEN: ResumenConteo = {
  productosContados: 5,
  productosExactos: 3,
  productosConDiferencia: 2,
  exactitudPct: 60,
  unidadesSistema: 52,
  unidadesSobrantes: 1,
  unidadesFaltantes: 2,
  unidadesDiferenciaAbs: 3,
  diferenciaPct: 5.77,
  metaPct: 5,
  cumpleMeta: false,
  valorDiferenciaNeto: -686.39,
  valorDiferenciaAbsoluto: 2176.33,
};

function conteo(parcial: Partial<ConteoResumido>): ConteoResumido {
  return {
    idConteo: 1,
    nombre: "Conteo A",
    fechaConteo: "2026-10-08T18:00:00.000Z",
    estado: "aplicado",
    categoria: { idCategoria: 106, descripcion: "Baterías" },
    creador: null,
    cierre: null,
    fechaCierre: null,
    resumen: RESUMEN,
    ...parcial,
  };
}

const PAGINACION = { pagina: 1, porPagina: 100, total: 2, totalPaginas: 1 };

describe("ConteosPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("lista los conteos con estado, exactitud y cumplimiento de la meta", async () => {
    mockListar.mockResolvedValue({
      conteos: [
        conteo({}),
        conteo({ idConteo: 2, nombre: "Conteo B", estado: "borrador", categoria: null, resumen: { ...RESUMEN, exactitudPct: 100, diferenciaPct: 0, cumpleMeta: true } }),
      ],
      paginacion: PAGINACION,
    });
    render(<ConteosPage />, { wrapper: Providers });

    expect(await screen.findByRole("link", { name: "Conteo A" })).toHaveAttribute("href", "/conteos/1");
    expect(screen.getByText("Todo el catálogo")).toBeInTheDocument();
    expect(screen.getByText("Aplicado")).toBeInTheDocument();
    expect(screen.getByText("En curso", { selector: ".badge" })).toBeInTheDocument();
    expect(screen.getByText(/No cumple/)).toBeInTheDocument();
    expect(screen.getByText(/^Cumple/)).toBeInTheDocument();
    expect(screen.getAllByText("60.0 %").length).toBeGreaterThan(0);
  });

  it("estado vacío con una acción clara y filtro por estado", async () => {
    mockListar.mockResolvedValue({ conteos: [], paginacion: { ...PAGINACION, total: 0 } });
    const user = userEvent.setup();
    render(<ConteosPage />, { wrapper: Providers });

    expect(await screen.findByText("Aún no hay conteos")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Aplicados" }));
    await waitFor(() => expect(mockListar).toHaveBeenLastCalledWith("aplicado"));
    expect(await screen.findByText("No hay conteos con ese estado")).toBeInTheDocument();
  });

  it("muestra el error de carga con reintento", async () => {
    mockListar.mockRejectedValueOnce(new Error("Sin conexión"));
    mockListar.mockResolvedValue({ conteos: [], paginacion: { ...PAGINACION, total: 0 } });
    const user = userEvent.setup();
    render(<ConteosPage />, { wrapper: Providers });

    expect(await screen.findByText("Sin conexión")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Aún no hay conteos")).toBeInTheDocument();
  });

  it("crea un conteo desde el modal (nombre, fecha y alcance)", async () => {
    mockListar.mockResolvedValue({ conteos: [], paginacion: { ...PAGINACION, total: 0 } });
    mockCrear.mockResolvedValue({ idConteo: 9 });
    const user = userEvent.setup();
    render(<ConteosPage />, { wrapper: Providers });

    await screen.findByText("Aún no hay conteos");
    await user.click(screen.getAllByRole("button", { name: "Nuevo conteo" })[0]);
    const nombre = await screen.findByLabelText("Nombre");
    await user.clear(nombre);
    await user.type(nombre, "Conteo de prueba");
    await user.selectOptions(screen.getByLabelText("Alcance"), "106");
    await user.click(screen.getByRole("button", { name: "Crear y empezar a contar" }));

    await waitFor(() => expect(mockCrear).toHaveBeenCalledTimes(1));
    expect(mockCrear.mock.calls[0][0]).toMatchObject({ nombre: "Conteo de prueba", idCategoria: 106 });
    expect(mockCrear.mock.calls[0][0].fechaConteo).toMatch(/^\d{4}-\d{2}-\d{2}T12:00:00-06:00$/);
  });
});
