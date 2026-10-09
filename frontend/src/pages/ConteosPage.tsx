import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ConteoNuevoModal } from "@/components/ConteoNuevoModal";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/toastContext";
import { useAsync } from "@/hooks/useAsync";
import { listarCategorias } from "@/services/categoriaService";
import { listarConteos } from "@/services/conteoService";
import type { Categoria } from "@/types/categoria";
import type { ConteoResumido, EstadoConteo } from "@/types/conteo";
import { ETIQUETA_ESTADO, TONO_ESTADO, fechaConteo, pct } from "@/utils/conteo";

const FILTROS: { id: EstadoConteo | "todos"; etiqueta: string }[] = [
  { id: "todos", etiqueta: "Todos" },
  { id: "borrador", etiqueta: "En curso" },
  { id: "aplicado", etiqueta: "Aplicados" },
  { id: "cerrado", etiqueta: "Cerrados" },
  { id: "cancelado", etiqueta: "Cancelados" },
];

// Lista de conteos físicos (solo Administrador). Acción primaria: "Nuevo
// conteo". El detalle/captura vive en /conteos/:id.
export default function ConteosPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [filtro, setFiltro] = useState<EstadoConteo | "todos">("todos");
  const [creando, setCreando] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  const lista = useAsync(() => listarConteos(filtro === "todos" ? undefined : filtro), [filtro], "No se pudieron cargar los conteos");
  const conteos = lista.data?.conteos ?? [];

  useEffect(() => {
    listarCategorias()
      .then(setCategorias)
      .catch(() => setCategorias([]));
  }, []);

  const columnas: Column<ConteoResumido>[] = [
    {
      key: "nombre",
      header: "Conteo",
      primary: true,
      sortValue: (c) => c.nombre,
      cell: (c) => (
        <div>
          <Link to={`/conteos/${c.idConteo}`} className="conteo-link">
            {c.nombre}
          </Link>
          <div className="muted conteo-sub">{c.categoria ? c.categoria.descripcion : "Todo el catálogo"}</div>
        </div>
      ),
    },
    { key: "estado", header: "Estado", cell: (c) => <Badge tone={TONO_ESTADO[c.estado]}>{ETIQUETA_ESTADO[c.estado]}</Badge> },
    { key: "fecha", header: "Fecha", sortValue: (c) => c.fechaConteo, cell: (c) => fechaConteo(c.fechaConteo) },
    { key: "contados", header: "Contados", align: "right", sortValue: (c) => c.resumen.productosContados, cell: (c) => <span className="tabular">{c.resumen.productosContados}</span> },
    {
      key: "exactitud",
      header: "Exactitud",
      align: "right",
      sortValue: (c) => c.resumen.exactitudPct,
      cell: (c) => <span className="tabular">{c.estado === "cancelado" ? "—" : pct(c.resumen.exactitudPct)}</span>,
    },
    {
      key: "meta",
      header: "Meta del 5 %",
      cell: (c) =>
        c.estado === "cancelado" || c.resumen.cumpleMeta === null ? (
          <span className="muted">{"—"}</span>
        ) : (
          <Badge tone={c.resumen.cumpleMeta ? "success" : "danger"}>
            {c.resumen.cumpleMeta ? "Cumple" : "No cumple"} · {pct(c.resumen.diferenciaPct)}
          </Badge>
        ),
    },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        title="Conteo físico"
        description="Compara lo contado en bodega con lo registrado y corrige el inventario."
        actions={
          <Button icon="plus" onClick={() => setCreando(true)}>
            Nuevo conteo
          </Button>
        }
      />

      <div className="segmented conteo-filtros" role="group" aria-label="Filtrar por estado">
        {FILTROS.map((f) => (
          <button key={f.id} type="button" className="segmented-btn" aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}>
            {f.etiqueta}
          </button>
        ))}
      </div>

      {lista.error && (
        <Alert tone="error" action={<Button size="sm" variant="secondary" onClick={lista.recargar}>Reintentar</Button>}>
          {lista.error}
        </Alert>
      )}

      {!lista.error && (
        <DataTable
          caption="Conteos físicos"
          columns={columnas}
          rows={conteos}
          rowKey={(c) => c.idConteo}
          loading={lista.cargando}
          empty={
            filtro === "todos" ? (
              <EmptyState
                icon="clipboard"
                title="Aún no hay conteos"
                description="Un conteo compara lo que hay en bodega con lo que dice el sistema y mide la exactitud del inventario."
                action={
                  <Button icon="plus" onClick={() => setCreando(true)}>
                    Nuevo conteo
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon="clipboard"
                title="No hay conteos con ese estado"
                action={
                  <Button variant="secondary" onClick={() => setFiltro("todos")}>
                    Ver todos
                  </Button>
                }
              />
            )
          }
        />
      )}

      {creando && (
        <ConteoNuevoModal
          categorias={categorias}
          onClose={() => setCreando(false)}
          onCreado={(conteo) => {
            toast.success("Conteo creado. Empieza a registrar lo que cuentes.");
            navigate(`/conteos/${conteo.idConteo}`);
          }}
        />
      )}
    </div>
  );
}
