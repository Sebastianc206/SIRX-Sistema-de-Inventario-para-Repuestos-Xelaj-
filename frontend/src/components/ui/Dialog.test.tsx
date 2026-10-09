import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DialogBody, Drawer, FormFooter } from "@/components/ui/Dialog";

function Ejemplo({ dirty = false, onClose = vi.fn() }: { dirty?: boolean; onClose?: () => void }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button onClick={() => setAbierto(true)}>Abrir</button>
      {abierto && (
        <Drawer
          title="Editar cosa"
          dirty={dirty}
          onClose={() => {
            onClose();
            setAbierto(false);
          }}
        >
          <form className="dialog-form" onSubmit={(e) => e.preventDefault()}>
            <DialogBody>
              <label>
                Nombre
                <input />
              </label>
            </DialogBody>
            <FormFooter enviando={false} />
          </form>
        </Drawer>
      )}
    </>
  );
}

describe("Drawer", () => {
  afterEach(() => cleanup());

  it("se expone como diálogo modal con nombre accesible y enfoca el primer campo", async () => {
    render(<Ejemplo />);
    await userEvent.click(screen.getByRole("button", { name: "Abrir" }));

    const dialogo = screen.getByRole("dialog", { name: "Editar cosa" });
    expect(dialogo).toHaveAttribute("aria-modal", "true");
    expect(screen.getByLabelText("Nombre")).toHaveFocus();
  });

  it("cierra con Escape y devuelve el foco al botón que lo abrió", async () => {
    const onClose = vi.fn();
    render(<Ejemplo onClose={onClose} />);
    const disparador = screen.getByRole("button", { name: "Abrir" });
    await userEvent.click(disparador);

    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await vi.waitFor(() => expect(disparador).toHaveFocus());
  });

  it("con cambios sin guardar pide confirmar antes de descartar", async () => {
    const onClose = vi.fn();
    render(<Ejemplo dirty onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Abrir" }));

    await userEvent.keyboard("{Escape}");
    const aviso = screen.getByRole("alertdialog", { name: /descartar los cambios/i });
    expect(onClose).not.toHaveBeenCalled();

    // "Seguir editando" conserva el drawer abierto.
    await userEvent.click(screen.getByRole("button", { name: /seguir editando/i }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Editar cosa" })).toBeInTheDocument();
    expect(aviso).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));
    await userEvent.click(screen.getByRole("button", { name: /descartar cambios/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("atrapa el foco: Tab desde el último control vuelve al primero", async () => {
    render(<Ejemplo />);
    await userEvent.click(screen.getByRole("button", { name: "Abrir" }));

    const dialogo = screen.getByRole("dialog");
    const guardar = screen.getByRole("button", { name: /guardar/i });
    guardar.focus();
    await userEvent.tab();

    expect(dialogo.contains(document.activeElement)).toBe(true);
    expect(guardar).not.toHaveFocus();
  });
});

describe("ConfirmDialog", () => {
  afterEach(() => cleanup());

  it("no se renderiza cerrado y enfoca la opción segura (Cancelar) al abrir", () => {
    const { rerender } = render(
      <ConfirmDialog open={false} title="¿Eliminar?" confirmLabel="Eliminar" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    rerender(<ConfirmDialog open title="¿Eliminar?" description="No se puede deshacer" confirmLabel="Eliminar" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("alertdialog", { name: "¿Eliminar?" })).toHaveAccessibleDescription("No se puede deshacer");
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
  });

  it("confirma, cancela y cancela con Escape", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog open title="¿Eliminar?" confirmLabel="Eliminar" onConfirm={onConfirm} onCancel={onCancel} />);

    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
