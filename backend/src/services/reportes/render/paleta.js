// Paleta de los archivos descargables. Los valores son los de
// frontend/src/styles/tokens.css (fuente de verdad del design system); se
// duplican aquí porque el backend no puede leer CSS. Si cambian los tokens,
// actualizar este archivo (documentado en design-system/sirx/MASTER.md §9).
const PALETA = {
  pino100: "#e3f4ec",
  pino200: "#bde5d2",
  pino300: "#8dd1b2",
  pino500: "#1b9470",
  pino600: "#0b6e4f",
  pino700: "#095840",
  pino800: "#07422f",
  pino900: "#052a1e",
  laton: "#c9972f",
  papel: "#f4f5f1",
  superficie: "#ffffff",
  borde: "#d3d6cc",
  neutro200: "#e9ebe4",
  neutro500: "#5d6258",
  neutro600: "#474b43",
  neutro700: "#353831",
  tinta: "#171a16",
  // Estados (relleno claro + tinta oscura + color medio para el punto).
  ok: { bg: "#dff0e6", mid: "#2f7a58", text: "#124a31" },
  warn: { bg: "#fbecc8", mid: "#c08a2e", text: "#6a4608" },
  bad: { bg: "#f8dfda", mid: "#b4402f", text: "#7a2519" },
  info: { bg: "#dbeaf3", mid: "#2f6d8f", text: "#1b4560" },
  neutral: { bg: "#e9ebe4", mid: "#5d6258", text: "#353831" },
};

const sinHash = (hex) => hex.replace("#", "").toUpperCase();
const argb = (hex) => `FF${sinHash(hex)}`;

module.exports = { PALETA, argb, sinHash };
