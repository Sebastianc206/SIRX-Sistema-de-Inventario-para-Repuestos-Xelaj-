import { useEffect, useId, useState } from "react";
import { listarProveedores } from "@/services/proveedorService";
import type { Proveedor } from "@/types/proveedor";

interface ProveedorRequeridoSelectProps {
  value: number | undefined;
  onChange: (idProveedor: number | undefined) => void;
  disabled?: boolean;
}

// HU-08: a diferencia del proveedor preferido de un repuesto (opcional,
// ver ProveedorSelect), en una compra el proveedor es obligatorio.
export function ProveedorRequeridoSelect({ value, onChange, disabled }: ProveedorRequeridoSelectProps) {
  const selectId = useId();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    listarProveedores({ vigente: true })
      .then((datos) => {
        if (!cancelado) setProveedores(datos);
      })
      .catch(() => {
        // Selector best-effort: si falla la carga, queda sin opciones.
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
      <label htmlFor={selectId}>Proveedor</label>
      <select
        id={selectId}
        value={value ?? ""}
        disabled={disabled || cargando}
        required
        onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))}
      >
        <option value="">{cargando ? "Cargando proveedores..." : "Selecciona un proveedor"}</option>
        {proveedores.map((proveedor) => (
          <option key={proveedor.idProveedor} value={proveedor.idProveedor}>
            {proveedor.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}
