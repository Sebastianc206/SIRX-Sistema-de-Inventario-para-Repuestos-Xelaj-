import { describe, expect, it } from "vitest";
import { calcularResumenLocal, clasificarDiferencia, textoDiferencia } from "@/utils/conteo";
import type { LineaConteo } from "@/types/conteo";

function linea(sistema: number, contada: number, costo = 1): LineaConteo {
  const diferencia = contada - sistema;
  return {
    sku: `S-${sistema}-${contada}`,
    cantidadSistema: sistema,
    cantidadContada: contada,
    diferencia,
    nivel: clasificarDiferencia(diferencia, sistema),
    costoUnitario: costo,
    valorDiferencia: diferencia * costo,
    stockActual: sistema,
    cambioDesdeConteo: false,
    ajusteAplicado: null,
    cantidadAntes: null,
    cantidadDespues: null,
  };
}

describe("utils/conteo (espejo del cálculo del backend)", () => {
  it("mismos resultados que el backend con datos conocidos (5 % exacto cumple)", () => {
    const r = calcularResumenLocal([linea(100, 100, 2), linea(50, 46, 10), linea(50, 56, 5)]);
    expect(r).toMatchObject({
      productosContados: 3,
      productosExactos: 1,
      exactitudPct: 33.33,
      unidadesFaltantes: 4,
      unidadesSobrantes: 6,
      diferenciaPct: 5,
      cumpleMeta: true,
      valorDiferenciaNeto: -10,
      valorDiferenciaAbsoluto: 70,
    });
  });

  it("sin productos no hay porcentajes ni veredicto", () => {
    expect(calcularResumenLocal([])).toMatchObject({ exactitudPct: null, diferenciaPct: null, cumpleMeta: null });
  });

  it("clasifica por magnitud y siempre con texto", () => {
    expect(clasificarDiferencia(0, 10)).toBe("exacto");
    expect(clasificarDiferencia(-1, 20)).toBe("leve");
    expect(clasificarDiferencia(-2, 20)).toBe("alto");
    expect(clasificarDiferencia(3, 0)).toBe("alto");
    expect(textoDiferencia(0)).toBe("Exacto");
    expect(textoDiferencia(3)).toBe("+3 sobran");
    expect(textoDiferencia(-2)).toBe("−2 faltan");
  });
});
