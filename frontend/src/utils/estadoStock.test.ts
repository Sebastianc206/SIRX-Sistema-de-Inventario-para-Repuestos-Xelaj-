import { describe, expect, it } from "vitest";
import { estadoStock } from "@/utils/estadoStock";

describe("estadoStock", () => {
  it("deriva agotado / bajo / en stock de cantidad vs umbral efectivo (borde incluido)", () => {
    expect(estadoStock(0, 5).texto).toBe("Agotado");
    expect(estadoStock(5, 5).texto).toBe("Stock bajo");
    expect(estadoStock(6, 5).texto).toBe("En stock");
    expect(estadoStock(1, 0).texto).toBe("En stock");
  });

  it("prefiere el estado calculado por el backend si viene", () => {
    // El backend ya aplicó el umbral efectivo; el cliente no lo recalcula.
    expect(estadoStock(50, 5, "bajo").texto).toBe("Stock bajo");
    expect(estadoStock(1, 5, "en_stock").clase).toBe("stock-badge--en-stock");
    expect(estadoStock(3, 5, "agotado").clase).toBe("stock-badge--agotado");
  });
});
