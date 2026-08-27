import { useEffect, useId, useState } from "react";
import { listarCategorias, CategoriaApiError } from "@/services/categoriaService";
import type { Categoria } from "@/types/categoria";

interface CategoriaSelectProps {
  value: number | undefined;
  onChange: (idCategoria: number) => void;
  disabled?: boolean;
}

// Selector reutilizable de categoría (T-058): lo usa el formulario de
// repuesto para asignar la categoría del catálogo, y queda disponible para
// cualquier otra pantalla que necesite elegir una categoría existente.
export function CategoriaSelect({ value, onChange, disabled }: CategoriaSelectProps) {
  const selectId = useId();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      setCargando(true);
      setError(null);
      try {
        const datos = await listarCategorias();
        if (!cancelado) setCategorias(datos);
      } catch (err) {
        if (!cancelado) {
          setError(
            err instanceof CategoriaApiError ? err.message : "No se pudo cargar el catálogo de categorías",
          );
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, []);

  if (error) {
    return (
      <div className="login-field">
        <label htmlFor={selectId}>Categoría</label>
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="login-field">
      <label htmlFor={selectId}>Categoría</label>
      <select
        id={selectId}
        value={value ?? ""}
        disabled={disabled || cargando}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        <option value="" disabled>
          {cargando ? "Cargando categorías..." : "Selecciona una categoría"}
        </option>
        {categorias.map((categoria) => (
          <option key={categoria.idCategoria} value={categoria.idCategoria}>
            {categoria.descripcion}
          </option>
        ))}
      </select>
    </div>
  );
}
