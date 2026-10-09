import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Providers } from "@/test/providers";
import ProveedoresPage from "@/pages/ProveedoresPage";
import { ProveedorApiError } from "@/services/proveedorService";
import type { Proveedor } from "@/types/proveedor";

const { mockListarProveedores, mockCambiarEstadoProveedor, mockEliminarProveedor } = vi.hoisted(() => ({
  mockListarProveedores: vi.fn(),
  mockCambiarEstadoProveedor: vi.fn(),
  mockEliminarProveedor: vi.fn(),
}));

vi.mock("@/services/proveedorService", async () => {
  const actual = await vi.importActual<typeof import("@/services/proveedorService")>(
    "@/services/proveedorService",
  );
  return {
    ...actual,
    listarProveedores: mockListarProveedores,
    cambiarEstadoProveedor: mockCambiarEstadoProveedor,
    eliminarProveedor: mockEliminarProveedor,
  };
});

vi.mock("@/services/catalogosAuxiliaresService", () => ({
  listarPaises: vi.fn().mockResolvedValue([]),
  listarDepartamentos: vi.fn().mockResolvedValue([]),
  listarMunicipios: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    usuario: { idColaborador: 1, username: "admin", nombreCompleto: "Admin", role: "Administrador" },
    cerrarSesion: vi.fn(),
  }),
}));

const proveedores: Proveedor[] = [
  {
    idProveedor: 1,
    nombre: "Repuestos Guate S.A.",
    direccion: "Zona 1",
    contacto: "5555-5555",
    vigente: true,
    idPais: 1,
    idDepartamento: null,
    idMunicipio: null,
  },
  {
    idProveedor: 2,
    nombre: "Importadora Xelajú",
    direccion: null,
    contacto: null,
    vigente: true,
    idPais: 1,
    idDepartamento: 1,
    idMunicipio: 1,
  },
];

function renderPage() {
  return render(<ProveedoresPage />, { wrapper: Providers });
}

describe("ProveedoresPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("lista los proveedores devueltos por el backend", async () => {
    mockListarProveedores.mockResolvedValueOnce(proveedores);

    renderPage();

    expect(await screen.findByText("Repuestos Guate S.A.")).toBeInTheDocument();
    expect(screen.getByText("Importadora Xelajú")).toBeInTheDocument();
  });

  it("muestra un estado vacío cuando no hay proveedores registrados", async () => {
    mockListarProveedores.mockResolvedValueOnce([]);

    renderPage();

    expect(await screen.findByText(/todavía no hay proveedores registrados/i)).toBeInTheDocument();
  });

  it("muestra un banner de error si falla la carga del listado", async () => {
    mockListarProveedores.mockRejectedValueOnce(new ProveedorApiError("Error interno del servidor", 500));

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Error interno del servidor");
  });

  it("filtra la tabla localmente al buscar por nombre", async () => {
    mockListarProveedores.mockResolvedValueOnce(proveedores);
    renderPage();
    await screen.findByText("Repuestos Guate S.A.");

    await userEvent.type(screen.getByLabelText(/buscar/i), "xelaj");

    expect(screen.queryByText("Repuestos Guate S.A.")).not.toBeInTheDocument();
    expect(screen.getByText("Importadora Xelajú")).toBeInTheDocument();
  });

  it("abre el modal de creación al hacer click en 'Nuevo proveedor'", async () => {
    mockListarProveedores.mockResolvedValueOnce(proveedores);
    renderPage();
    await screen.findByText("Repuestos Guate S.A.");

    await userEvent.click(screen.getByRole("button", { name: /nuevo proveedor/i }));

    expect(screen.getByRole("dialog", { name: /nuevo proveedor/i })).toBeInTheDocument();
  });

  it("da de baja un proveedor tras confirmar", async () => {
    mockListarProveedores.mockResolvedValueOnce(proveedores);
    mockCambiarEstadoProveedor.mockResolvedValueOnce({ ...proveedores[0], vigente: false });
    renderPage();
    const fila = (await screen.findByText("Repuestos Guate S.A.")).closest("tr") as HTMLElement;

    await userEvent.click(within(fila).getByRole("button", { name: /dar de baja/i }));
    const dialogo = screen.getByRole("alertdialog", { name: /¿dar de baja este proveedor\?/i });
    expect(mockCambiarEstadoProveedor).not.toHaveBeenCalled();

    await userEvent.click(within(dialogo).getByRole("button", { name: /^dar de baja$/i }));

    expect(mockCambiarEstadoProveedor).toHaveBeenCalledWith(1, false);
    expect(await screen.findByText(/se dio de baja el proveedor/i)).toBeInTheDocument();
  });

  it("muestra el badge de estado y permite reactivar un proveedor inactivo", async () => {
    mockListarProveedores.mockResolvedValueOnce([{ ...proveedores[0], vigente: false }]);
    mockCambiarEstadoProveedor.mockResolvedValueOnce({ ...proveedores[0], vigente: true });
    renderPage();
    const fila = (await screen.findByText("Repuestos Guate S.A.")).closest("tr") as HTMLElement;

    expect(within(fila).getByText("Inactivo")).toBeInTheDocument();

    await userEvent.click(within(fila).getByRole("button", { name: /activar/i }));
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: /^reactivar$/i }));

    expect(mockCambiarEstadoProveedor).toHaveBeenCalledWith(1, true);
    expect(await screen.findByText(/se reactivó el proveedor/i)).toBeInTheDocument();
  });

  it("no muestra el botón Eliminar mientras el proveedor sigue vigente", async () => {
    mockListarProveedores.mockResolvedValueOnce(proveedores);
    renderPage();
    const fila = (await screen.findByText("Repuestos Guate S.A.")).closest("tr") as HTMLElement;

    expect(within(fila).queryByRole("button", { name: /^eliminar$/i })).not.toBeInTheDocument();
  });

  it("elimina de verdad un proveedor inactivo sin historial asociado", async () => {
    mockListarProveedores.mockResolvedValueOnce([{ ...proveedores[0], vigente: false }]);
    mockEliminarProveedor.mockResolvedValueOnce(undefined);
    renderPage();
    const fila = (await screen.findByText("Repuestos Guate S.A.")).closest("tr") as HTMLElement;

    await userEvent.click(within(fila).getByRole("button", { name: /^eliminar$/i }));
    const dialogo = screen.getByRole("alertdialog", { name: /¿eliminar definitivamente\?/i });

    await userEvent.click(within(dialogo).getByRole("button", { name: /^eliminar$/i }));

    expect(mockEliminarProveedor).toHaveBeenCalledWith(1);
    expect(await screen.findByText(/se eliminó el proveedor/i)).toBeInTheDocument();
    expect(screen.queryByText("Repuestos Guate S.A.")).not.toBeInTheDocument();
  });

  it("muestra el mensaje del backend si el proveedor tiene historial asociado", async () => {
    mockListarProveedores.mockResolvedValueOnce([{ ...proveedores[0], vigente: false }]);
    mockEliminarProveedor.mockRejectedValueOnce(
      new ProveedorApiError(
        "No se puede eliminar: tiene repuestos o compras asociadas. Solo se puede desactivar.",
        409,
      ),
    );
    renderPage();
    const fila = (await screen.findByText("Repuestos Guate S.A.")).closest("tr") as HTMLElement;

    await userEvent.click(within(fila).getByRole("button", { name: /^eliminar$/i }));
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: /^eliminar$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se puede eliminar: tiene repuestos o compras asociadas. Solo se puede desactivar.",
    );
    expect(screen.getByText("Repuestos Guate S.A.")).toBeInTheDocument();
  });
});
