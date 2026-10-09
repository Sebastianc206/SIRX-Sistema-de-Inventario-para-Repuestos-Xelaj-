import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Providers } from "@/test/providers";
import UsuariosPage from "@/pages/UsuariosPage";
import { UsuarioApiError } from "@/services/usuarioService";
import type { UsuarioAdmin } from "@/types/usuario";

const { mockListarUsuarios, mockCambiarEstadoUsuario } = vi.hoisted(() => ({
  mockListarUsuarios: vi.fn(),
  mockCambiarEstadoUsuario: vi.fn(),
}));

vi.mock("@/services/usuarioService", async () => {
  const actual = await vi.importActual<typeof import("@/services/usuarioService")>(
    "@/services/usuarioService",
  );
  return {
    ...actual,
    listarUsuarios: mockListarUsuarios,
    cambiarEstadoUsuario: mockCambiarEstadoUsuario,
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    usuario: { idColaborador: 1, username: "admin", nombreCompleto: "Admin", role: "Administrador" },
    cerrarSesion: vi.fn(),
  }),
}));

const usuarios: UsuarioAdmin[] = [
  { idColaborador: 1, username: "admin", nombreCompleto: "Admin Sistema", role: "Administrador", vigente: true },
  { idColaborador: 2, username: "jperez", nombreCompleto: "Juan Pérez", role: "Operador", vigente: false },
];

function renderPage() {
  return render(<UsuariosPage />, { wrapper: Providers });
}

describe("UsuariosPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("lista los usuarios devueltos por el backend", async () => {
    mockListarUsuarios.mockResolvedValueOnce(usuarios);

    renderPage();

    expect(await screen.findByText("jperez")).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();
    expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
    expect(mockListarUsuarios).toHaveBeenCalledWith({ estado: undefined, idRol: undefined });
  });

  it("muestra un estado vacío cuando no hay usuarios para los filtros elegidos", async () => {
    mockListarUsuarios.mockResolvedValueOnce([]);

    renderPage();

    expect(await screen.findByText(/no hay usuarios que coincidan/i)).toBeInTheDocument();
  });

  it("muestra un banner de error si falla la carga del listado", async () => {
    mockListarUsuarios.mockRejectedValueOnce(new UsuarioApiError("Error interno del servidor", 500));

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Error interno del servidor");
  });

  it("vuelve a pedir el listado con el filtro de estado seleccionado", async () => {
    mockListarUsuarios.mockResolvedValue(usuarios);
    renderPage();
    await screen.findByText("admin");

    await userEvent.selectOptions(screen.getByLabelText(/estado/i), "inactivo");

    await waitFor(() =>
      expect(mockListarUsuarios).toHaveBeenLastCalledWith({ estado: "inactivo", idRol: undefined }),
    );
  });

  it("desactiva un usuario activo desde la tabla y refleja el nuevo estado", async () => {
    mockListarUsuarios.mockResolvedValueOnce(usuarios);
    mockCambiarEstadoUsuario.mockResolvedValueOnce({ ...usuarios[0], vigente: false });

    renderPage();
    await screen.findByText("admin");

    const filaAdmin = screen.getByText("admin").closest("tr");
    if (!filaAdmin) throw new Error("no se encontró la fila del admin");

    await userEvent.click(within(filaAdmin).getByRole("button", { name: /desactivar/i }));
    const dialogo = screen.getByRole("alertdialog", { name: /¿desactivar esta cuenta\?/i });
    expect(mockCambiarEstadoUsuario).not.toHaveBeenCalled();
    await userEvent.click(within(dialogo).getByRole("button", { name: /desactivar cuenta/i }));

    expect(mockCambiarEstadoUsuario).toHaveBeenCalledWith(1, false);
    expect(await within(filaAdmin).findByText("Inactivo")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/se desactivó la cuenta de admin/i);
  });

  it("abre el modal de creación al hacer click en 'Nuevo usuario'", async () => {
    mockListarUsuarios.mockResolvedValueOnce(usuarios);
    renderPage();
    await screen.findByText("admin");

    await userEvent.click(screen.getByRole("button", { name: /nuevo usuario/i }));

    expect(screen.getByRole("dialog", { name: /nuevo usuario operador/i })).toBeInTheDocument();
  });
});
