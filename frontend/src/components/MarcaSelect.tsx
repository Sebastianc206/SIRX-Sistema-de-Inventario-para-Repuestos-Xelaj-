import { useEffect, useId, useState } from "react";
import { listarMarcas } from "@/services/catalogosAuxiliaresService";
import type { Marca } from "@/types/catalogosAuxiliares";

interface MarcaSelectProps {
  value: number | undefined;
  onChange: (idMarca: number | undefined) => void;
  disabled?: boolean;
}

// A diferencia de CategoriaSelect, Marca es opcional en Articulo (T-025):
// siempre incluye una opción "Sin marca". Todavía no existe un CRUD de
// marcas (fuera del alcance de HU-04), así que si el catálogo está vacío
// el selector simplemente no ofrece más que esa opción.
export function MarcaSelect({ value, onChange, disabled }: MarcaSelectProps) {
  const selectId = useId();
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    listarMarcas()
      .then((datos) => {
        if (!cancelado) setMarcas(datos);
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
      <label htmlFor={selectId}>Marca (opcional)</label>
      <select
        id={selectId}
        value={value ?? ""}
        disabled={disabled || cargando}
        onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))}
      >
        <option value="">{cargando ? "Cargando marcas..." : "Sin marca"}</option>
        {marcas.map((marca) => (
          <option key={marca.idMarca} value={marca.idMarca}>
            {marca.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}
