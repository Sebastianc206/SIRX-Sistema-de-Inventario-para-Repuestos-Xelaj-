import type { SVGProps } from "react";

// Set único de íconos SVG (trazo de 1.8px, viewBox 24). Decorativos por
// defecto (aria-hidden): el texto/aria-label del control que los contiene es
// el que comunica el significado. Nada de emojis como íconos.
const PATHS = {
  more: "M5 12h.01M12 12h.01M19 12h.01",
  home: "M3 11.5 12 4l9 7.5M5.5 10v9.5a.5.5 0 0 0 .5.5h4v-6h4v6h4a.5.5 0 0 0 .5-.5V10",
  package: "m12 3 8 4.2v9.6L12 21l-8-4.2V7.2L12 3Zm0 9 8-4.8M12 12 4 7.2M12 12v9",
  cart: "M3 4h2.2l2 11h10.4l2-8H6.2M9.5 20h.01M17 20h.01",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6M9 12h6",
  sliders: "M4 7h9m4 0h3M4 17h3m4 0h9M13 4v6m-6 4v6",
  users: "M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm10 8v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.2a3.5 3.5 0 0 1 0 6.6",
  tag: "M3 12V4h8l10 10-8 8L3 12Zm5-4h.01",
  truck: "M2 6h12v10H2V6Zm12 4h4l3 3v3h-7m-9 3.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm11 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  arrows: "M7 4 3 8l4 4M3 8h14m0 4 4 4-4 4m4-4H7",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 3-4.2-4.2",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  x: "M6 6l12 12M18 6 6 18",
  check: "m5 12.5 4.5 4.5L19 7.5",
  chevronDown: "m6 9 6 6 6-6",
  chevronUp: "m6 15 6-6 6 6",
  chevronLeft: "m15 5-7 7 7 7",
  chevronRight: "m9 5 7 7-7 7",
  chevronsLeft: "m11 7-5 5 5 5m7-10-5 5 5 5",
  chevronsRight: "m13 7 5 5-5 5M6 7l5 5-5 5",
  menu: "M4 7h16M4 12h16M4 17h16",
  edit: "M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Zm9-13 4 4",
  trash: "M4 7h16M10 11v6m4-6v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3",
  power: "M12 3v8m5.5-5a8 8 0 1 1-11 0",
  undo: "M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3",
  logout: "M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
  alert: "M12 3 2 20h20L12 3Zm0 6v5m0 3h.01",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-10v5m0-8h.01",
  checkCircle: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-4-9 3 3 5-6",
  xCircle: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-3-12 6 6m0-6-6 6",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z",
  trendUp: "m3 17 6-6 4 4 8-8m0 0h-5m5 0v5",
  trendDown: "m3 7 6 6 4-4 8 8m0 0h-5m5 0v-5",
  download: "M12 4v11m-4-4 4 4 4-4M5 20h14",
  upload: "M12 16V5m-4 4 4-4 4 4M5 20h14",
  filter: "M4 5h16l-6 8v6l-4-2v-4L4 5Z",
  rows: "M4 6h16M4 12h16M4 18h16",
  rowsCompact: "M4 5h16M4 9.5h16M4 14h16M4 18.5h16",
  box: "M4 8h16v12H4V8Zm1-4h14l1 4H4l1-4Zm5 7h4",
  barChart: "M5 20V10m7 10V4m7 16v-7",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l3 2",
  command: "M9 9V6.5A2.5 2.5 0 1 0 6.5 9H9Zm0 0h6m-6 0v6m6-6V6.5A2.5 2.5 0 1 1 17.5 9H15Zm0 0v6m0 0h2.5a2.5 2.5 0 1 1-2.5 2.5V15Zm0 0H9m0 0H6.5A2.5 2.5 0 1 0 9 17.5V15Z",
  panel: "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm5 0v14",
  arrowRight: "M5 12h14m-5-5 5 5-5 5",
  arrowLeft: "M19 12H5m5-5-5 5 5 5",
  refresh: "M20 11a8 8 0 0 0-14.5-4M4 4v4h4M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4",
  mapPin: "M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Zm0-8.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  cog: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2.2-1.3L14.3 3h-4l-.4 2.4a7.6 7.6 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2.2 1.3l.4 2.4h4l.4-2.4a7.6 7.6 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3Z",
  clipboard: "M9 4h6v3H9V4Zm-3 1.5H5a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V6.5a1 1 0 0 0-1-1h-1M8.5 14l2 2 4-4.5",
  sparkle: "m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z",
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 18, strokeWidth = 1.8, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
