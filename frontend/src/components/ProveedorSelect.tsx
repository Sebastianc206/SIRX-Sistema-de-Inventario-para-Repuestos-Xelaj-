import { useEffect, useId, useState } from "react";
import { listarProveedores } from "@/services/proveedorService";
import type { Proveedor } from "@/types/proveedor";

interface ProveedorSelectProps {
  value: number | undefined;
  onChange: (idProveedor: number | undefined) => void;
  disabled?: boolean;
}

// Proveedor preferido del repuesto: opcional, y es uno de los dos datos
// (junto con precioCosto) que el rol Operador nunca ve — coherente con que
// este selector solo se use dentro del formulario de creación/edición, que
// ya está restringido a Administrador por la ruta. Desde HU-26, Proveedor
// tiene su propio CRUD real (antes era un listado auxiliar de solo lectura).
export function ProveedorSelect({ value, onChange, disabled }: ProveedorSelectProps) {
  const selectId = useId();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    listarProveedores()
      .then((datos) => {
        if (!cancelado) setProveedores(datos);
      })
      .catch(() => {
        // El selector es best-effort: si falla la carga, simplemente queda
        // sin opciones (proveedor sigue siendo un campo opcional del repuesto).
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
      <label htmlFor={selectId}>Proveedor preferido (opcional)</label>
      <select
        id={selectId}
        value={value ?? ""}
        disabled={disabled || cargando}
        onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))}
      >
        <option value="">{cargando ? "Cargando proveedores..." : "Sin proveedor asignado"}</option>
        {proveedores.map((proveedor) => (
          <option key={proveedor.idProveedor} value={proveedor.idProveedor}>
            {proveedor.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}
