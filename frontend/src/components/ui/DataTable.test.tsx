import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Badge, StockBadge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";

interface Fila {
  id: number;
  nombre: string;
  precio: number;
}

const FILAS: Fila[] = [
  { id: 1, nombre: "Bujía", precio: 30 },
  { id: 2, nombre: "Amortiguador", precio: 450 },
  { id: 3, nombre: "Filtro", precio: 45 },
];

const COLUMNAS: Column<Fila>[] = [
  { key: "nombre", header: "Nombre", primary: true, sortValue: (f) => f.nombre, cell: (f) => f.nombre },
  { key: "precio", header: "Precio", align: "right", sortValue: (f) => f.precio, cell: (f) => `Q${f.precio}` },
];

function nombresEnPantalla(): string[] {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((fila) => within(fila).getAllByRole("cell").find((c) => c.dataset.label === "Nombre")?.textContent ?? "");
}

describe("DataTable", () => {
  afterEach(() => cleanup());

  it("expone caption, scope=col y aria-sort en columnas ordenables", () => {
    render(<DataTable caption="Listado de cosas" columns={COLUMNAS} rows={FILAS} rowKey={(f) => f.id} />);

    expect(screen.getByRole("table", { name: "Listado de cosas" })).toBeInTheDocument();
    const encabezados = screen.getAllByRole("columnheader");
    encabezados.forEach((th) => expect(th).toHaveAttribute("scope", "col"));
    expect(encabezados[0]).toHaveAttribute("aria-sort", "none");
  });

  it("ordena asc/desc/sin orden al hacer clic y actualiza aria-sort", async () => {
    render(<DataTable caption="Cosas" columns={COLUMNAS} rows={FILAS} rowKey={(f) => f.id} />);
    const boton = screen.getByRole("button", { name: /^nombre/i });
    const th = screen.getAllByRole("columnheader")[0];

    await userEvent.click(boton);
    expect(th).toHaveAttribute("aria-sort", "ascending");
    expect(nombresEnPantalla()).toEqual(["Amortiguador", "Bujía", "Filtro"]);

    await userEvent.click(boton);
    expect(th).toHaveAttribute("aria-sort", "descending");
    expect(nombresEnPantalla()).toEqual(["Filtro", "Bujía", "Amortiguador"]);

    await userEvent.click(boton);
    expect(th).toHaveAttribute("aria-sort", "none");
    expect(nombresEnPantalla()).toEqual(["Bujía", "Amortiguador", "Filtro"]);
  });

  it("ordena numéricamente por precio", async () => {
    render(<DataTable caption="Cosas" columns={COLUMNAS} rows={FILAS} rowKey={(f) => f.id} />);
    await userEvent.click(screen.getByRole("button", { name: /^precio/i }));
    expect(nombresEnPantalla()).toEqual(["Bujía", "Filtro", "Amortiguador"]);
  });

  it("selecciona filas y 'todas' con casillas accesibles", async () => {
    function Con() {
      const [sel, setSel] = useState<ReadonlySet<string | number>>(new Set());
      return (
        <>
          <p data-testid="n">{sel.size}</p>
          <DataTable caption="Cosas" columns={COLUMNAS} rows={FILAS} rowKey={(f) => f.id} selectable selected={sel} onSelectedChange={setSel} rowLabel={(f) => f.nombre} />
        </>
      );
    }
    render(<Con />);

    await userEvent.click(screen.getByRole("checkbox", { name: "Seleccionar Bujía" }));
    expect(screen.getByTestId("n")).toHaveTextContent("1");

    await userEvent.click(screen.getByRole("checkbox", { name: /seleccionar todas/i }));
    expect(screen.getByTestId("n")).toHaveTextContent("3");

    await userEvent.click(screen.getByRole("checkbox", { name: /seleccionar todas/i }));
    expect(screen.getByTestId("n")).toHaveTextContent("0");
  });

  it("muestra acciones por fila con nombre accesible", async () => {
    const onEditar = vi.fn();
    render(
      <DataTable
        caption="Cosas"
        columns={COLUMNAS}
        rows={FILAS}
        rowKey={(f) => f.id}
        rowActions={(f) => <IconButton icon="edit" label={`Editar ${f.nombre}`} onClick={() => onEditar(f.id)} />}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Editar Filtro" }));
    expect(onEditar).toHaveBeenCalledWith(3);
  });

  it("muestra el esqueleto mientras carga sin filas, y el estado vacío con CTA al terminar", () => {
    const { rerender } = render(<DataTable caption="Cosas" columns={COLUMNAS} rows={[]} rowKey={(f) => f.id} loading />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText("Cargando...")).toBeInTheDocument();

    rerender(
      <DataTable
        caption="Cosas"
        columns={COLUMNAS}
        rows={[]}
        rowKey={(f) => f.id}
        empty={<EmptyState title="Sin cosas" description="Crea la primera" action={<button>Crear</button>} />}
      />,
    );
    expect(screen.getByText("Sin cosas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear" })).toBeInTheDocument();
  });
});

describe("Badge", () => {
  afterEach(() => cleanup());

  it("StockBadge deriva el estado de existencia vs mínimo (texto, no solo color)", () => {
    render(
      <>
        <StockBadge cantidad={0} minimo={5} />
        <StockBadge cantidad={5} minimo={5} />
        <StockBadge cantidad={12} minimo={5} />
      </>,
    );
    expect(screen.getByText("0 · Agotado")).toHaveClass("badge--danger");
    expect(screen.getByText("5 · Stock bajo")).toHaveClass("badge--warning");
    expect(screen.getByText("12 · En stock")).toHaveClass("badge--success");
  });

  it("Badge acepta tono y texto", () => {
    render(<Badge tone="info">En tránsito</Badge>);
    expect(screen.getByText("En tránsito")).toHaveClass("badge--info");
  });
});
