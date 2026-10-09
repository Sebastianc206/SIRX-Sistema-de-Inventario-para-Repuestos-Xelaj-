import { useEffect, useState } from "react";
import { Field, Input, Select } from "@/components/ui/Field";
import { listarCategorias } from "@/services/categoriaService";
import { listarMarcas } from "@/services/catalogosAuxiliaresService";
import { listarConteos } from "@/services/conteoService";
import { ETIQUETA_ESTADO, fechaConteo } from "@/utils/conteo";
import type { ConteoResumido } from "@/types/conteo";
import { ATAJOS_FECHA, atajoActivo } from "@/utils/reportes";
import type { Categoria } from "@/types/categoria";
import type { Marca } from "@/types/catalogosAuxiliares";
import type { FiltroReporte, FiltrosReporte } from "@/types/reporte";

interface ReporteFiltrosProps {
  disponibles: FiltroReporte[];
  filtros: FiltrosReporte;
  esAdmin: boolean;
  onChange: (cambio: FiltrosReporte) => void;
}

// Catálogos de categoría/marca: se piden una vez por sesión de página.
let cacheCatalogos: Promise<[Categoria[], Marca[]]> | null = null;
function cargarCatalogos(): Promise<[Categoria[], Marca[]]> {
  if (!cacheCatalogos) {
    cacheCatalogos = Promise.all([listarCategorias().catch(() => [] as Categoria[]), listarMarcas().catch(() => [] as Marca[])]).then((r) => {
      // Un fallo (vacío) no se recuerda: el siguiente montaje reintenta.
      if (r[0].length === 0 && r[1].length === 0) cacheCatalogos = null;
      return r;
    });
  }
  return cacheCatalogos;
}

// Filtros propios de cada reporte: solo aparecen los que el reporte declara.
export function ReporteFiltros({ disponibles, filtros, esAdmin, onChange }: ReporteFiltrosProps) {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const usa = (f: FiltroReporte) => disponibles.includes(f);
  const necesitaCatalogos = usa("idCategoria") || usa("idMarca");

  useEffect(() => {
    if (!necesitaCatalogos) return undefined;
    let vigente = true;
    cargarCatalogos().then(([c, m]) => {
      if (!vigente) return;
      setCategorias(c);
      setMarcas(m);
    });
    return () => {
      vigente = false;
    };
  }, [necesitaCatalogos]);

  const [conteos, setConteos] = useState<ConteoResumido[]>([]);
  const usaConteo = usa("idConteo");
  const idConteoActual = filtros.idConteo;

  // Reporte "Conteo físico": lista los conteos (menos los cancelados) y
  // preselecciona el más reciente para que la vista previa aparezca sola.
  useEffect(() => {
    if (!usaConteo) return undefined;
    let vigente = true;
    listarConteos()
      .then((r) => {
        if (!vigente) return;
        const lista = r.conteos.filter((c) => c.estado !== "cancelado");
        setConteos(lista);
        if (!idConteoActual && lista.length > 0) onChange({ idConteo: String(lista[0].idConteo) });
      })
      .catch(() => vigente && setConteos([]));
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usaConteo]);

  const activo = atajoActivo(filtros);
  const rangoInvalido = !!filtros.fechaDesde && !!filtros.fechaHasta && filtros.fechaDesde > filtros.fechaHasta;

  return (
    <div className="rep-filtros" role="group" aria-label="Filtros del reporte">
      {usa("fechaDesde") && (
        <div className="rep-filtros-rango">
          <div className="rep-atajos" role="group" aria-label="Atajos de fecha">
            {ATAJOS_FECHA.map((a) => (
              <button
                key={a.id}
                type="button"
                className="segmented-btn rep-atajo"
                aria-pressed={activo === a.id}
                onClick={() => onChange(a.rango())}
              >
                {a.etiqueta}
              </button>
            ))}
          </div>
          <div className="rep-fechas">
            <Field label="Desde">
              {(p) => (
                <Input {...p} type="date" value={filtros.fechaDesde ?? ""} max={filtros.fechaHasta} onChange={(e) => onChange({ fechaDesde: e.target.value })} />
              )}
            </Field>
            <Field label="Hasta" error={rangoInvalido ? "La fecha final debe ser igual o posterior a la inicial" : undefined}>
              {(p) => (
                <Input {...p} type="date" value={filtros.fechaHasta ?? ""} min={filtros.fechaDesde} onChange={(e) => onChange({ fechaHasta: e.target.value })} />
              )}
            </Field>
          </div>
        </div>
      )}

      <div className="rep-filtros-grid">
        {usa("idCategoria") && (
          <Field label="Categoría">
            {(p) => (
              <Select {...p} value={filtros.idCategoria ?? ""} onChange={(e) => onChange({ idCategoria: e.target.value })}>
                <option value="">Todas</option>
                {categorias.map((c) => (
                  <option key={c.idCategoria} value={c.idCategoria}>
                    {c.descripcion}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        {usa("idMarca") && (
          <Field label="Marca">
            {(p) => (
              <Select {...p} value={filtros.idMarca ?? ""} onChange={(e) => onChange({ idMarca: e.target.value })}>
                <option value="">Todas</option>
                {marcas.map((m) => (
                  <option key={m.idMarca} value={m.idMarca}>
                    {m.nombre}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        {usaConteo && (
          <Field label="Conteo físico" hint={conteos.length === 0 ? "Aún no hay conteos. Crea uno en Gestión > Conteo físico." : undefined}>
            {(p) => (
              <Select {...p} value={filtros.idConteo ?? ""} onChange={(e) => onChange({ idConteo: e.target.value })}>
                {conteos.length === 0 && <option value="">Sin conteos</option>}
                {conteos.map((c) => (
                  <option key={c.idConteo} value={c.idConteo}>
                    {c.nombre} · {fechaConteo(c.fechaConteo)} · {ETIQUETA_ESTADO[c.estado]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        {usa("top") && (
          <Field label="Mostrar los primeros">
            {(p) => (
              <Select {...p} value={filtros.top ?? "20"} onChange={(e) => onChange({ top: e.target.value })}>
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n} productos
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        {usa("orden") && esAdmin && (
          <Field label="Ordenar por">
            {(p) => (
              <Select {...p} value={filtros.orden ?? "unidades"} onChange={(e) => onChange({ orden: e.target.value })}>
                <option value="unidades">Unidades vendidas</option>
                <option value="ingreso">Ingreso</option>
              </Select>
            )}
          </Field>
        )}
        {usa("ventana") && (
          <Field label="Rotación de los últimos">
            {(p) => (
              <Select {...p} value={filtros.ventana ?? "30"} onChange={(e) => onChange({ ventana: e.target.value })}>
                <option value="30">30 días</option>
                <option value="60">60 días</option>
                <option value="90">90 días</option>
              </Select>
            )}
          </Field>
        )}
        {usa("agrupacion") && (
          <Field label="Agrupar por">
            {(p) => (
              <Select {...p} value={filtros.agrupacion ?? "dia"} onChange={(e) => onChange({ agrupacion: e.target.value })}>
                <option value="dia">Día</option>
                <option value="semana">Semana</option>
                <option value="mes">Mes</option>
              </Select>
            )}
          </Field>
        )}
        {usa("agruparPor") && (
          <Field label="Ver utilidad por">
            {(p) => (
              <Select {...p} value={filtros.agruparPor ?? "producto"} onChange={(e) => onChange({ agruparPor: e.target.value })}>
                <option value="producto">Producto</option>
                <option value="categoria">Categoría</option>
              </Select>
            )}
          </Field>
        )}
        {usa("tipo") && (
          <Field label="Tipo de movimiento">
            {(p) => (
              <Select {...p} value={filtros.tipo ?? "todos"} onChange={(e) => onChange({ tipo: e.target.value })}>
                <option value="todos">Todos</option>
                <option value="compras">Compras</option>
                <option value="ventas">Ventas</option>
                <option value="ajustes">Ajustes y mermas</option>
              </Select>
            )}
          </Field>
        )}
      </div>
    </div>
  );
}
