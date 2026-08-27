import { afterEach, describe, expect, it, vi } from "vitest";
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
  await userEvent.type(screen.getByLabelText(/usuario/i), usuario);
  await userEvent.type(screen.getByLabelText(/contraseña/i), contrasena);
  await userEvent.click(screen.getByRole("button", { name: /ingresar/i }));
}

describe("LoginPage", () => {
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
});
