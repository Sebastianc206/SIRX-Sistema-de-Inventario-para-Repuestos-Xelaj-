import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import LoginPage from "@/pages/LoginPage";
import { AuthApiError } from "@/services/authService";
import type { LogoutReason } from "@/context/AuthContext";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockIniciarSesion = vi.fn();
const mockLimpiarMotivoCierre = vi.fn();
let mockLogoutReason: LogoutReason = null;

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    iniciarSesion: mockIniciarSesion,
    logoutReason: mockLogoutReason,
    limpiarMotivoCierre: mockLimpiarMotivoCierre,
  }),
}));

function renderLoginPage() {
  return render(<LoginPage />, { wrapper: MemoryRouter });
}

async function completarYEnviar(usuario: string, contrasena: string) {
  await userEvent.type(screen.getByLabelText(/^usuario$/i), usuario);
  await userEvent.type(screen.getByLabelText(/^contraseña$/i), contrasena);
  await userEvent.click(screen.getByRole("button", { name: /ingresar/i }));
}

describe("LoginPage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    mockLogoutReason = null;
    vi.clearAllMocks();
    cleanup();
  });

  it("inicia sesión con credenciales válidas y navega al dashboard", async () => {
    mockIniciarSesion.mockResolvedValueOnce(undefined);

    renderLoginPage();
    await completarYEnviar("admin", "Admin123!");

    expect(mockIniciarSesion).toHaveBeenCalledWith("admin", "Admin123!");
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("muestra el mensaje del backend cuando las credenciales son inválidas (401)", async () => {
    mockIniciarSesion.mockRejectedValueOnce(new AuthApiError("Usuario o contraseña incorrectos", 401));

    renderLoginPage();
    await completarYEnviar("admin", "mal");

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("Usuario o contraseña incorrectos");
    expect(alerta).not.toHaveClass("login-error--locked");
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("resalta el mensaje de cuenta bloqueada (423) con un estilo distinto", async () => {
    mockIniciarSesion.mockRejectedValueOnce(
      new AuthApiError("Demasiados intentos fallidos. Cuenta bloqueada por 15 minutos.", 423),
    );

    renderLoginPage();
    await completarYEnviar("admin", "mal");

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(/bloqueada/i);
    expect(alerta).toHaveClass("login-error--locked");
  });

  it("muestra un mensaje genérico si el error no viene del backend", async () => {
    mockIniciarSesion.mockRejectedValueOnce(new Error("network down"));

    renderLoginPage();
    await completarYEnviar("admin", "Admin123!");

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo iniciar sesión");
  });

  it("muestra el aviso de cierre por inactividad cuando corresponde", () => {
    mockLogoutReason = "inactivity";

    renderLoginPage();

    expect(screen.getByRole("status")).toHaveTextContent(/inactividad/i);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("limpia el aviso de inactividad al reintentar el login", async () => {
    mockLogoutReason = "inactivity";
    mockIniciarSesion.mockResolvedValueOnce(undefined);

    renderLoginPage();
    expect(screen.getByRole("status")).toBeInTheDocument();

    await completarYEnviar("admin", "Admin123!");

    expect(mockLimpiarMotivoCierre).toHaveBeenCalled();
  });

  it("valida en línea los campos vacíos, marca aria-invalid y enfoca el primero", async () => {
    renderLoginPage();

    await userEvent.click(screen.getByRole("button", { name: /ingresar/i }));

    const usuario = screen.getByLabelText(/^usuario$/i);
    const contrasena = screen.getByLabelText(/^contraseña$/i);
    expect(screen.getByText("Ingresa tu nombre de usuario.")).toBeInTheDocument();
    expect(screen.getByText("Ingresa tu contraseña.")).toBeInTheDocument();
    expect(usuario).toHaveAttribute("aria-invalid", "true");
    expect(contrasena).toHaveAttribute("aria-invalid", "true");
    expect(usuario).toHaveFocus();
    expect(mockIniciarSesion).not.toHaveBeenCalled();

    await userEvent.type(usuario, "admin");
    expect(usuario).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByText("Ingresa tu nombre de usuario.")).not.toBeInTheDocument();
  });

  it("enfoca la contraseña si solo ella está vacía", async () => {
    renderLoginPage();

    await userEvent.type(screen.getByLabelText(/^usuario$/i), "admin");
    await userEvent.click(screen.getByRole("button", { name: /ingresar/i }));

    expect(screen.getByLabelText(/^contraseña$/i)).toHaveFocus();
    expect(mockIniciarSesion).not.toHaveBeenCalled();
  });

  it("alterna la visibilidad de la contraseña", async () => {
    renderLoginPage();
    const contrasena = screen.getByLabelText(/^contraseña$/i);
    expect(contrasena).toHaveAttribute("type", "password");

    await userEvent.click(screen.getByRole("button", { name: "Mostrar" }));
    expect(contrasena).toHaveAttribute("type", "text");

    await userEvent.click(screen.getByRole("button", { name: "Ocultar" }));
    expect(contrasena).toHaveAttribute("type", "password");
  });

  it("recuerda solo el usuario cuando se marca la casilla y el login es exitoso", async () => {
    mockIniciarSesion.mockResolvedValueOnce(undefined);

    renderLoginPage();
    await userEvent.click(screen.getByLabelText(/recordar usuario/i));
    await completarYEnviar("admin", "Admin123!");

    expect(localStorage.getItem("sirx-remembered-username")).toBe("admin");
    const guardado = JSON.stringify({ ...localStorage });
    expect(guardado).not.toContain("Admin123!");
  });

  it("precarga el usuario recordado y lo olvida al desmarcar la casilla", async () => {
    localStorage.setItem("sirx-remembered-username", "operador1");

    renderLoginPage();

    expect(screen.getByLabelText(/^usuario$/i)).toHaveValue("operador1");
    const casilla = screen.getByLabelText(/recordar usuario/i);
    expect(casilla).toBeChecked();

    await userEvent.click(casilla);
    expect(localStorage.getItem("sirx-remembered-username")).toBeNull();
  });
});
