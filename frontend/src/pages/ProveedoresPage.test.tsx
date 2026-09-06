import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ProveedoresPage from "@/pages/ProveedoresPage";
import { ProveedorApiError } from "@/services/proveedorService";
import type { Proveedor } from "@/types/proveedor";

const { mockListarProveedores } = vi.hoisted(() => ({ mockListarProveedores: vi.fn() }));

vi.mock("@/services/proveedorService", async () => {
  const actual = await vi.importActual<typeof import("@/services/proveedorService")>(
    "@/services/proveedorService",
  );
  return { ...actual, listarProveedores: mockListarProveedores };
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
  return render(<ProveedoresPage />, { wrapper: MemoryRouter });
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
});
