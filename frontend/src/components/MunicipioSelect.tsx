import { useEffect, useId, useState } from "react";
import { listarMunicipios } from "@/services/catalogosAuxiliaresService";
import type { Municipio } from "@/types/catalogosAuxiliares";

interface MunicipioSelectProps {
  value: number | undefined;
  onChange: (idMunicipio: number | undefined) => void;
  // Filtra la lista al departamento elegido (el backend valida esta misma
  // consistencia — ver proveedorService.validarReferencias). Sin
  // departamento seleccionado, se muestran todos los municipios.
  idDepartamento: number | undefined;
  disabled?: boolean;
}

// Opcional (un proveedor extranjero puede no tener municipio).
export function MunicipioSelect({ value, onChange, idDepartamento, disabled }: MunicipioSelectProps) {
  const selectId = useId();
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    listarMunicipios()
      .then((datos) => {
        if (!cancelado) setMunicipios(datos);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const opciones = idDepartamento
    ? municipios.filter((m) => m.idDepartamento === idDepartamento)
    : municipios;

  return (
    <div className="login-field">
      <label htmlFor={selectId}>Municipio (opcional)</label>
      <select
        id={selectId}
        value={value ?? ""}
        disabled={disabled || cargando}
        onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))}
      >
        <option value="">{cargando ? "Cargando municipios..." : "Sin municipio"}</option>
        {opciones.map((municipio) => (
          <option key={municipio.idMunicipio} value={municipio.idMunicipio}>
            {municipio.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}
