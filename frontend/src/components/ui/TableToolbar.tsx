import { useId, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

interface TableToolbarProps {
  searchLabel: string;
  searchPlaceholder: string;
  searchValue: string;
  onSearchChange: (valor: string) => void;
  // Selectores de filtro (estilo "chip"): se muestran plegados tras el botón
  // "Filtros"; los activos siguen visibles como chips removibles.
  filters?: ReactNode;
  // Cantidad de filtros activos (se muestra en el botón "Filtros").
  activeFilterCount?: number;
  // Con 1-2 filtros no vale la pena plegarlos: se muestran en la barra.
  inlineFilters?: boolean;
  // Controles a la derecha (menú "Más", acción primaria...).
  trailing?: ReactNode;
}

interface FilterToggleProps {
  open: boolean;
  onToggle: () => void;
  count?: number;
  controls: string;
}

// Botón "Filtros" que despliega/pliega el panel de filtros avanzados.
export function FilterToggle({ open, onToggle, count = 0, controls }: FilterToggleProps) {
  return (
    <button type="button" className={`filter-toggle${count > 0 ? " filter-toggle--active" : ""}`} aria-expanded={open} aria-controls={controls} onClick={onToggle}>
      <Icon name="filter" size={18} />
      Filtros
      {count > 0 && <span className="filter-toggle-count">{count}</span>}
    </button>
  );
}

// Barra superior unificada de toda tabla de datos: búsqueda + botón de
// filtros + controles a la derecha. Máximo 4-5 controles de primer nivel.
export function TableToolbar({ searchLabel, searchPlaceholder, searchValue, onSearchChange, filters, activeFilterCount = 0, inlineFilters = false, trailing }: TableToolbarProps) {
  const [abierto, setAbierto] = useState(false);
  const idPanel = useId();
  return (
    <>
      <div className="toolbar" role="search">
        <label className="toolbar-search">
          <Icon name="search" size={18} />
          <input
            type="search"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchLabel}
          />
        </label>
        {filters && inlineFilters && <div className="toolbar-inline-filters">{filters}</div>}
        {filters && !inlineFilters && <FilterToggle open={abierto} onToggle={() => setAbierto((v) => !v)} count={activeFilterCount} controls={idPanel} />}
        {trailing && <div className="toolbar-trailing">{trailing}</div>}
      </div>
      {filters && !inlineFilters && (
        <div id={idPanel} className="toolbar-panel" hidden={!abierto}>
          {filters}
        </div>
      )}
    </>
  );
}

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  children: ReactNode;
}

// Filtro con apariencia de chip: <label> envolvente + <select> nativo
// (accesible por teclado y en móvil sin reinventar el control).
export function FilterSelect({ label, value, onChange, children }: FilterSelectProps) {
  return (
    <label className={`filter-chip${value ? " filter-chip--active" : ""}`}>
      <span className="filter-chip-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
      <Icon name="chevronDown" size={14} className="filter-chip-caret" />
    </label>
  );
}

export interface ChipItem {
  id: string;
  label: string;
  onRemove: () => void;
}

export function FilterChips({ chips, onClear }: { chips: ChipItem[]; onClear: () => void }) {
  if (chips.length === 0) return null;
  return (
    <div className="chip-row" role="group" aria-label="Filtros activos">
      <ul className="chip-list">
        {chips.map((chip) => (
          <li key={chip.id}>
            <span className="chip">
              {chip.label}
              <button type="button" className="chip-remove" aria-label={`Quitar filtro ${chip.label}`} onClick={chip.onRemove}>
                <Icon name="x" size={12} />
              </button>
            </span>
          </li>
        ))}
      </ul>
      <Button variant="ghost" size="sm" onClick={onClear}>
        Limpiar filtros
      </Button>
    </div>
  );
}

export function BulkBar({ count, children, onClear }: { count: number; children: ReactNode; onClear: () => void }) {
  if (count === 0) return null;
  return (
    <div className="bulk-bar" role="region" aria-label="Acciones sobre la selección">
      <span className="bulk-bar-count" aria-live="polite">
        {count} seleccionado{count === 1 ? "" : "s"}
      </span>
      <div className="bulk-bar-actions">{children}</div>
      <Button variant="ghost" size="sm" onClick={onClear}>
        Limpiar selección
      </Button>
    </div>
  );
}
