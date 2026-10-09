import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { VirtualGrid } from "@/components/ui/VirtualGrid";

const ITEMS = Array.from({ length: 1000 }, (_, i) => ({ id: `item-${i}`, nombre: `Repuesto ${i}` }));

describe("VirtualGrid", () => {
  afterEach(cleanup);

  it("monta solo las filas visibles de una lista de 1000 elementos", () => {
    render(
      <VirtualGrid
        items={ITEMS}
        itemKey={(i) => i.id}
        rowHeight={50}
        gap={0}
        renderItem={(i) => <div data-testid="fila">{i.nombre}</div>}
      />,
    );

    const montadas = screen.getAllByTestId("fila").length;
    expect(montadas).toBeGreaterThan(0);
    expect(montadas).toBeLessThan(40); // alto por defecto 480px / 50 + overscan, nunca 1000
    expect(screen.getByText("Repuesto 0")).toBeInTheDocument();
    expect(screen.queryByText("Repuesto 999")).not.toBeInTheDocument();
  });

  it("reserva el alto total para que el scroll represente toda la lista", () => {
    const { container } = render(
      <VirtualGrid items={ITEMS} itemKey={(i) => i.id} rowHeight={50} gap={10} renderItem={(i) => <div>{i.nombre}</div>} />,
    );
    const interno = container.querySelector(".vgrid-inner") as HTMLElement;
    // 1000 filas * (50 + 10) - 10 de la última separación.
    expect(interno.style.height).toBe("59990px");
  });

  it("calcula columnas según el ancho mínimo (vista de tarjetas)", () => {
    const columnas: number[] = [];
    render(
      <VirtualGrid
        items={ITEMS}
        itemKey={(i) => i.id}
        rowHeight={100}
        gap={8}
        minColWidth={184}
        onColumnsChange={(c) => columnas.push(c)}
        renderItem={(i) => <div>{i.nombre}</div>}
      />,
    );
    // jsdom no mide: ancho por defecto 800 -> floor((800+8)/(184+8)) = 4 columnas.
    expect(columnas[columnas.length - 1]).toBe(4);
  });
});
