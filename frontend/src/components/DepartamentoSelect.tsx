import { useEffect, useId, useState } from "react";
import { listarDepartamentos } from "@/services/catalogosAuxiliaresService";
import type { Departamento } from "@/types/catalogosAuxiliares";

interface DepartamentoSelectProps {
  value: number | undefined;
  onChange: (idDepartamento: number | undefined) => void;
  disabled?: boolean;
}

// Opcional (un proveedor extranjero puede no tener departamento).
export function DepartamentoSelect({ value, onChange, disabled }: DepartamentoSelectProps) {
  const selectId = useId();
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    listarDepartamentos()
      .then((datos) => {
        if (!cancelado) setDepartamentos(datos);
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
      <label htmlFor={selectId}>Departamento (opcional)</label>
      <select
        id={selectId}
        value={value ?? ""}
        disabled={disabled || cargando}
        onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))}
      >
        <option value="">{cargando ? "Cargando departamentos..." : "Sin departamento"}</option>
        {departamentos.map((departamento) => (
          <option key={departamento.idDepartamento} value={departamento.idDepartamento}>
            {departamento.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}
