import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UsuarioFormModal } from "@/components/UsuarioFormModal";
import { UsuarioApiError } from "@/services/usuarioService";
import type { UsuarioAdmin } from "@/types/usuario";

const { mockCrearUsuario, mockEditarUsuario } = vi.hoisted(() => ({
  mockCrearUsuario: vi.fn(),
  mockEditarUsuario: vi.fn(),
}));

vi.mock("@/services/usuarioService", async () => {
  const actual = await vi.importActual<typeof import("@/services/usuarioService")>(
    "@/services/usuarioService",
  );
  return { ...actual, crearUsuario: mockCrearUsuario, editarUsuario: mockEditarUsuario };
});

const usuarioExistente: UsuarioAdmin = {
  idColaborador: 5,
  username: "jperez",
  nombreCompleto: "Juan Pérez",
  role: "Operador",
  vigente: true,
};

describe("UsuarioFormModal", () => {
  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("modo crear: envía los campos del formulario y avisa el éxito", async () => {
    mockCrearUsuario.mockResolvedValueOnce({ ...usuarioExistente, idColaborador: 9 });
    const onGuardado = vi.fn();

    render(<UsuarioFormModal usuario={null} onClose={vi.fn()} onGuardado={onGuardado} />);

    await userEvent.type(screen.getByLabelText(/^nombres$/i), "Maria");
    await userEvent.type(screen.getByLabelText(/primer apellido/i), "Lopez");
    await userEvent.type(screen.getByLabelText(/^usuario$/i), "mlopez");
    await userEvent.type(screen.getByLabelText(/contraseña/i), "Mostrador123!");
    await userEvent.click(screen.getByRole("radio", { name: "Operador" }));
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(mockCrearUsuario).toHaveBeenCalledWith({
      nombres: "Maria",
      primerApel: "Lopez",
      segundoApel: undefined,
      correo: undefined,
      numeroCelular: undefined,
      username: "mlopez",
      password: "Mostrador123!",
      idRol: 2,
      vigente: true,
    });
    expect(onGuardado).toHaveBeenCalledWith("Usuario creado correctamente.");
  });

  it("modo crear: muestra el error del backend si el username ya existe", async () => {
    mockCrearUsuario.mockRejectedValueOnce(new UsuarioApiError("El nombre de usuario ya está en uso", 409));

    render(<UsuarioFormModal usuario={null} onClose={vi.fn()} onGuardado={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/^nombres$/i), "Maria");
    await userEvent.type(screen.getByLabelText(/primer apellido/i), "Lopez");
    await userEvent.type(screen.getByLabelText(/^usuario$/i), "jperez");
    await userEvent.type(screen.getByLabelText(/contraseña/i), "Mostrador123!");
    await userEvent.click(screen.getByRole("radio", { name: "Operador" }));
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("El nombre de usuario ya está en uso");
  });

  it("modo editar: precarga el rol/estado actuales y no pide datos personales", async () => {
    render(<UsuarioFormModal usuario={usuarioExistente} onClose={vi.fn()} onGuardado={vi.fn()} />);

    expect(screen.getByRole("radio", { name: "Operador" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Activo" })).toBeChecked();
    expect(screen.queryByLabelText(/^nombres$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/contraseña/i)).not.toBeInTheDocument();
    expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
  });

  it("modo editar: envía el nuevo rol y estado al guardar", async () => {
    mockEditarUsuario.mockResolvedValueOnce({ ...usuarioExistente, role: "Administrador" });
    const onGuardado = vi.fn();

    render(<UsuarioFormModal usuario={usuarioExistente} onClose={vi.fn()} onGuardado={onGuardado} />);

    await userEvent.click(screen.getByRole("radio", { name: "Administrador" }));
    await userEvent.click(screen.getByRole("radio", { name: "Inactivo" }));
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(mockEditarUsuario).toHaveBeenCalledWith(5, { idRol: 1, vigente: false });
    expect(onGuardado).toHaveBeenCalledWith("Usuario actualizado correctamente.");
  });

  it("cierra el modal al hacer click en Cancelar", async () => {
    const onClose = vi.fn();
    render(<UsuarioFormModal usuario={usuarioExistente} onClose={onClose} onGuardado={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
