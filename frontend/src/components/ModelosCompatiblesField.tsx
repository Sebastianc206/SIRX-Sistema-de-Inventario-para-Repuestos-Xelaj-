import { useEffect, useId, useState } from "react";
import { listarModelos } from "@/services/catalogosAuxiliaresService";
import type { Modelo } from "@/types/catalogosAuxiliares";

interface ModelosCompatiblesFieldProps {
  value: number[];
  onChange: (idsModelos: number[]) => void;
  disabled?: boolean;
}

// Modelo compatible es una relación muchos-a-muchos (Modelo_Compatible),
// no un solo valor: se captura como una lista de checkboxes en vez de un
// <select>. Es opcional — un repuesto puede no aplicar a ningún modelo
// específico (ej. un consumible genérico).
export function ModelosCompatiblesField({ value, onChange, disabled }: ModelosCompatiblesFieldProps) {
  const legendId = useId();
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    listarModelos()
      .then((datos) => {
        if (!cancelado) setModelos(datos);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  function alternar(idModelo: number) {
    if (value.includes(idModelo)) {
      onChange(value.filter((id) => id !== idModelo));
    } else {
      onChange([...value, idModelo]);
    }
  }

  return (
    <fieldset>
      <legend id={legendId}>Modelos compatibles (opcional)</legend>
      {cargando ? (
        <p className="modal-helper-text">Cargando modelos...</p>
      ) : modelos.length === 0 ? (
        <p className="modal-helper-text">Todavía no hay modelos registrados en el catálogo.</p>
      ) : (
        modelos.map((modelo) => (
          <label key={modelo.idModelo} className="modal-radio-option">
            <input
              type="checkbox"
              checked={value.includes(modelo.idModelo)}
              disabled={disabled}
              onChange={() => alternar(modelo.idModelo)}
            />
            {modelo.descripcion}
          </label>
        ))
      )}
    </fieldset>
  );
}
