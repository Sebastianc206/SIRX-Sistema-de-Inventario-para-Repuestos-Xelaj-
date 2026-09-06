import { useEffect, useId, useState } from "react";
import { listarPaises } from "@/services/catalogosAuxiliaresService";
import type { Pais } from "@/types/catalogosAuxiliares";

interface PaisSelectProps {
  value: number | undefined;
  onChange: (idPais: number | undefined) => void;
  disabled?: boolean;
}

// País es obligatorio en Proveedor (a diferencia de departamento/municipio,
// que son opcionales — útil para un proveedor extranjero). Los datos vienen
// de un seed de referencia (HU-26), no de un CRUD propio.
export function PaisSelect({ value, onChange, disabled }: PaisSelectProps) {
  const selectId = useId();
  const [paises, setPaises] = useState<Pais[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    listarPaises()
      .then((datos) => {
        if (!cancelado) setPaises(datos);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <div className="login-field">
      <label htmlFor={selectId}>País</label>
      <select
        id={selectId}
        value={value ?? ""}
        disabled={disabled || cargando}
        onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))}
      >
        <option value="" disabled>
          {cargando ? "Cargando países..." : "Selecciona un país"}
        </option>
        {paises.map((pais) => (
          <option key={pais.idPais} value={pais.idPais}>
            {pais.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}
