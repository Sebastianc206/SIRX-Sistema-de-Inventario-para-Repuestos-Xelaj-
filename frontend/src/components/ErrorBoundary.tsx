import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

interface ErrorBoundaryProps {
  children: ReactNode;
  // Cuando cambia (p. ej. la ruta), el error se descarta y se reintenta.
  resetKey?: string;
  // "pagina": dentro del shell. "global": pantalla completa.
  nivel?: "pagina" | "global";
}

interface ErrorBoundaryState {
  hayError: boolean;
}

// Captura errores de render para que un fallo en una pantalla no deje la app
// en blanco. A propósito NO muestra el mensaje ni el stack del error al
// usuario (requisito de seguridad: nada interno hacia el cliente); solo se
// registra en consola para quien depure.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hayError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hayError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary:", error, info.componentStack);
  }

  componentDidUpdate(prev: ErrorBoundaryProps) {
    if (this.state.hayError && prev.resetKey !== this.props.resetKey) {
      this.setState({ hayError: false });
    }
  }

  render() {
    if (!this.state.hayError) return this.props.children;
    const global = this.props.nivel === "global";
    return (
      <div className={`error-screen${global ? " error-screen--global" : ""}`} role="alert">
        <span className="error-screen-icon">
          <Icon name="alert" size={30} />
        </span>
        <h1>Algo salió mal</h1>
        <p>Ocurrió un error inesperado al mostrar esta pantalla. Tus datos guardados no se vieron afectados.</p>
        <div className="error-screen-actions">
          <button type="button" className="btn btn--primary btn--md" onClick={() => this.setState({ hayError: false })}>
            Reintentar
          </button>
          <a className="btn btn--secondary btn--md" href="/">
            Ir al inicio
          </a>
        </div>
      </div>
    );
  }
}
