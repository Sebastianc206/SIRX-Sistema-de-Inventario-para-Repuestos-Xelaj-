import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, cleanup } from "@testing-library/react";
import { AuthProvider, INACTIVITY_TIMEOUT_MS } from "@/context/AuthContext";
import { useAuth } from "@/hooks/useAuth";
import * as authService from "@/services/authService";
import type { Usuario } from "@/types/auth";

vi.mock("@/services/authService", async () => {
  const actual = await vi.importActual<typeof import("@/services/authService")>(
    "@/services/authService",
  );
  return { ...actual, fetchCurrentUser: vi.fn(), login: vi.fn() };
});

const usuarioDePrueba: Usuario = {
  idColaborador: 1,
  username: "admin",
  nombreCompleto: "Admin Prueba",
  role: "Administrador",
};

function Consumidor() {
  const { usuario, logoutReason } = useAuth();
  return (
    <div>
      <span data-testid="usuario">{usuario ? usuario.username : "sin-sesion"}</span>
      <span data-testid="motivo">{logoutReason ?? "ninguno"}</span>
    </div>
  );
}

async function iniciarSesionValida() {
  localStorage.setItem("sirx_token", "token-valido");
  vi.mocked(authService.fetchCurrentUser).mockResolvedValueOnce(usuarioDePrueba);

  render(
    <AuthProvider>
      <Consumidor />
    </AuthProvider>,
  );

  await act(async () => {
    await Promise.resolve();
  });

  expect(screen.getByTestId("usuario")).toHaveTextContent("admin");
}

describe("AuthProvider — cierre de sesión por inactividad", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    cleanup();
  });

  it("cierra la sesión automáticamente al superar el tiempo de inactividad", async () => {
    await iniciarSesionValida();

    await act(async () => {
      vi.advanceTimersByTime(INACTIVITY_TIMEOUT_MS + 1000);
    });

    expect(screen.getByTestId("usuario")).toHaveTextContent("sin-sesion");
    expect(screen.getByTestId("motivo")).toHaveTextContent("inactivity");
    expect(localStorage.getItem("sirx_token")).toBeNull();
  });

  it("no cierra la sesión si hay actividad del usuario antes de vencer el tiempo", async () => {
    await iniciarSesionValida();

    await act(async () => {
      vi.advanceTimersByTime(INACTIVITY_TIMEOUT_MS - 1000);
    });
    expect(screen.getByTestId("usuario")).toHaveTextContent("admin");

    await act(async () => {
      window.dispatchEvent(new Event("keydown"));
      vi.advanceTimersByTime(INACTIVITY_TIMEOUT_MS - 1000);
    });

    expect(screen.getByTestId("usuario")).toHaveTextContent("admin");
  });

  it("no arranca el temporizador si no hay sesión iniciada", async () => {
    render(
      <AuthProvider>
        <Consumidor />
      </AuthProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId("usuario")).toHaveTextContent("sin-sesion");

    await act(async () => {
      vi.advanceTimersByTime(INACTIVITY_TIMEOUT_MS + 1000);
    });

    expect(screen.getByTestId("usuario")).toHaveTextContent("sin-sesion");
    expect(screen.getByTestId("motivo")).toHaveTextContent("ninguno");
  });
});
