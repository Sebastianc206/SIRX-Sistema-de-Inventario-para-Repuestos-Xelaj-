import logoBlanco from "@/assets/brand/logo-rx-blanco.png";
import logoVerde from "@/assets/brand/logo-rx.png";
import marcaBlanca from "@/assets/brand/marca-rx-blanco.png";
import marcaVerde from "@/assets/brand/marca-rx.png";

// Logo oficial de SIRX / Repuestos Xelajú (ver design-system/sirx/MASTER.md,
// sección "Marca / Logo"). `tono="blanco"` va sobre fondos oscuros (pino-800 o
// más oscuro); `tono="verde"` sobre fondos claros. `compacta` usa la versión
// cuadrada. Altura mínima de uso: 24 px. Es decorativo (alt vacío): quien lo
// use debe poner junto el texto "SIRX" o un nombre accesible propio.
interface BrandLogoProps {
  alto?: number;
  tono?: "blanco" | "verde";
  compacta?: boolean;
  className?: string;
}

const ARCHIVOS = {
  blanco: { completa: logoBlanco, compacta: marcaBlanca },
  verde: { completa: logoVerde, compacta: marcaVerde },
};

export function BrandLogo({ alto = 32, tono = "blanco", compacta = false, className }: BrandLogoProps) {
  const src = compacta ? ARCHIVOS[tono].compacta : ARCHIVOS[tono].completa;
  // Proporciones reales de los archivos (1024x568 y 512x512): sin deformar.
  const ancho = compacta ? alto : Math.round((alto * 1024) / 568);
  return <img src={src} width={ancho} height={alto} alt="" aria-hidden="true" draggable={false} className={className} />;
}
