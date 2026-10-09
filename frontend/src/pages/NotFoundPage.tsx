import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="not-found">
      <h1 className="sr-only">Página no encontrada</h1>
      <EmptyState
        icon="search"
        title="Página no encontrada"
        description="La dirección no existe o se movió."
        action={
          <div className="not-found-actions">
            <Link to="/" className="btn btn--primary btn--md">
              Ir al inicio
            </Link>
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Volver atrás
            </Button>
          </div>
        }
      />
    </div>
  );
}
