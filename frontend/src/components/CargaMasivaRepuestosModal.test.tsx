import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CargaMasivaRepuestosModal } from "@/components/CargaMasivaRepuestosModal";
import { RepuestoApiError } from "@/services/repuestoService";

const { mockDescargarPlantilla, mockCargarMasivo } = vi.hoisted(() => ({
  mockDescargarPlantilla: vi.fn(),
  mockCargarMasivo: vi.fn(),
}));

vi.mock("@/services/repuestoService", async () => {
  const actual = await vi.importActual<typeof import("@/services/repuestoService")>(
    "@/services/repuestoService",
  );
  return {
    ...actual,
    descargarPlantillaRepuestos: mockDescargarPlantilla,
    cargarRepuestosMasivo: mockCargarMasivo,
  };
});

function crearArchivoFalso() {
  return new File(["contenido"], "repuestos.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

describe("CargaMasivaRepuestosModal", () => {
  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("T-047: descarga la plantilla al hacer click en el botón", async () => {
    mockDescargarPlantilla.mockResolvedValueOnce(undefined);

    render(<CargaMasivaRepuestosModal onClose={vi.fn()} onCargaCompleta={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /descargar plantilla/i }));

    expect(mockDescargarPlantilla).toHaveBeenCalled();
  });

  it("no envía si no se seleccionó ningún archivo", async () => {
    render(<CargaMasivaRepuestosModal onClose={vi.fn()} onCargaCompleta={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /^cargar$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/selecciona un archivo/i);
    expect(mockCargarMasivo).not.toHaveBeenCalled();
  });

  it("T-048: muestra el resumen con filas exitosas y filas con error, y refresca el listado", async () => {
    mockCargarMasivo.mockResolvedValueOnce({
      creadas: [{ sku: "FRE-001", nombre: "Pastillas" }],
      errores: [{ fila: 3, sku: "XXX-001", motivo: 'La categoría "NoExiste" no existe' }],
    });
    const onCargaCompleta = vi.fn();

    render(<CargaMasivaRepuestosModal onClose={vi.fn()} onCargaCompleta={onCargaCompleta} />);

    const inputArchivo = screen.getByLabelText(/archivo excel/i);
    await userEvent.upload(inputArchivo, crearArchivoFalso());
    await userEvent.click(screen.getByRole("button", { name: /^cargar$/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(/1 repuesto creado/i);
    expect(screen.getByRole("alert")).toHaveTextContent(/1 fila con error/i);
    expect(screen.getByText('La categoría "NoExiste" no existe')).toBeInTheDocument();
    expect(onCargaCompleta).toHaveBeenCalled();
  });

  it("no refresca el listado si ninguna fila se creó", async () => {
    mockCargarMasivo.mockResolvedValueOnce({
      creadas: [],
      errores: [{ fila: 2, sku: "XXX-001", motivo: "error" }],
    });
    const onCargaCompleta = vi.fn();

    render(<CargaMasivaRepuestosModal onClose={vi.fn()} onCargaCompleta={onCargaCompleta} />);

    await userEvent.upload(screen.getByLabelText(/archivo excel/i), crearArchivoFalso());
    await userEvent.click(screen.getByRole("button", { name: /^cargar$/i }));

    await screen.findByRole("status");
    expect(onCargaCompleta).not.toHaveBeenCalled();
  });

  it("muestra el error del backend si falla el procesamiento del archivo", async () => {
    mockCargarMasivo.mockRejectedValueOnce(
      new RepuestoApiError("El archivo debe tener las columnas: SKU, Nombre", 400),
    );

    render(<CargaMasivaRepuestosModal onClose={vi.fn()} onCargaCompleta={vi.fn()} />);

    await userEvent.upload(screen.getByLabelText(/archivo excel/i), crearArchivoFalso());
    await userEvent.click(screen.getByRole("button", { name: /^cargar$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/debe tener las columnas/i);
  });

  it("cierra el modal al hacer click en Cancelar", async () => {
    const onClose = vi.fn();

    render(<CargaMasivaRepuestosModal onClose={onClose} onCargaCompleta={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
