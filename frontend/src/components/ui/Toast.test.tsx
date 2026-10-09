import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/components/ui/Toast";
import { useToast } from "@/components/ui/toastContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";

function Disparador() {
  const toast = useToast();
  return (
    <>
      <button onClick={() => toast.success("Guardado")}>ok</button>
      <button onClick={() => toast.error("Falló")}>mal</button>
    </>
  );
}

describe("Toast", () => {
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("éxito usa role=status y error role=alert", async () => {
    render(
      <ToastProvider>
        <Disparador />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "ok" }));
    await userEvent.click(screen.getByRole("button", { name: "mal" }));

    expect(screen.getByRole("status")).toHaveTextContent("Guardado");
    expect(screen.getByRole("alert")).toHaveTextContent("Falló");
  });

  it("se puede cerrar a mano", async () => {
    render(
      <ToastProvider>
        <Disparador />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "ok" }));
    await userEvent.click(screen.getByRole("button", { name: "Cerrar aviso" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("se descarta solo tras unos segundos", () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Disparador />
      </ToastProvider>,
    );
    act(() => {
      screen.getByRole("button", { name: "ok" }).click();
    });
    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("sin proveedor, useToast no rompe el render", async () => {
    render(<Disparador />);
    await userEvent.click(screen.getByRole("button", { name: "ok" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

function Bomba(): never {
  throw new Error("secreto interno");
}

describe("ErrorBoundary", () => {
  afterEach(() => cleanup());

  it("muestra una pantalla de error genérica sin filtrar el mensaje interno", () => {
    const consola = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <ErrorBoundary>
        <Bomba />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Algo salió mal");
    expect(screen.queryByText(/secreto interno/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ir al inicio/i })).toHaveAttribute("href", "/");
    consola.mockRestore();
  });
});
