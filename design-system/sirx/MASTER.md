# SIRX — Design System (Master)

> **Fuente de verdad: `frontend/src/styles/tokens.css`.** Este documento describe los
> tokens y componentes REALES del frontend. Una versión anterior de este archivo (generada
> con la herramienta de diseño) proponía una paleta slate/rojo, tipografías Syncopate +
> Space Mono y un estilo "kinetic": fue **rechazada** y no se usa en ninguna parte.
> Si algo de aquí contradice el CSS, manda el CSS.

**Proyecto:** SIRX — inventario de Repuestos Xelajú (Guatemala)
**Estilo:** data-dense / operativo. Verde pino oscuro como color principal + acento latón,
neutros cálidos (papel y tinta). Light mode únicamente.
**Reglas de oro:** ningún componente usa hex crudos (todo pasa por `var(--token)`), texto
>= 4.5:1, objetivos táctiles >= 44px, foco visible siempre, nada de emojis como íconos.

---

## 1. Color

### Marca — verde esmeralda oscuro (siempre el color principal)

El nombre de los tokens sigue siendo `--pino-*` para no tocar componentes; los valores son los de la paleta Esmeralda (elegida; antes era un pino `#1f5a45`).

| Token | Hex | Uso |
|-------|-----|-----|
| `--pino-100` | `#e3f4ec` | Fondos suaves, chips activos, hover de filas |
| `--pino-200` | `#bde5d2` | Bordes suaves, hover de chips |
| `--pino-300` | `#8dd1b2` | Bordes de chips activos |
| `--pino-400` | `#4fb68c` | Barras de gráfica, hover de bordes |
| `--pino-500` | `#1b9470` | Foco (`--focus-outline`), bordes activos |
| `--pino-600` | `#0b6e4f` | **Base**: botón primario, enlaces, avatar (blanco sobre 600 ≈ 6.2:1) |
| `--pino-700` | `#095840` | Hover primario, texto de acento sobre claro |
| `--pino-800` | `#07422f` | Barra de selección, panel de marca (login) |
| `--pino-900` | `#052a1e` | Sidebar, overlay |

Alias semánticos: `--color-primary-50/100/500/600/700`.
**Acento latón:** `--color-accent: #c9972f` — indicador de ruta activa, icono de la acción
principal, punto de marca. Nunca como texto pequeño sobre fondo claro.

### Neutros cálidos

`--neutro-papel #f4f5f1` (fondo de página), `--neutro-superficie #ffffff` (tarjetas),
`--neutro-200 #e9ebe4`, `--neutro-300-borde #d3d6cc`, `--neutro-400 #a3a79b`,
`--neutro-500 #5d6258` (texto tenue, 5.9:1 sobre papel), `--neutro-600-texto-tenue #474b43`,
`--neutro-700 #353831`, `--tinta-900 #171a16` (texto). Alias: `--color-neutral-0 … 900`.

### Estado de stock (CONTEXTO_SIRX.md §8) — SIEMPRE derivado de `estadoStock()`

| Estado | Regla | Fondo | Texto |
|--------|-------|-------|-------|
| En stock | cantidad > mínimo | `--stock-en-stock-bg #dff0e6` | `--stock-en-stock-text #124a31` |
| Stock bajo | 0 < cantidad <= mínimo | `--stock-bajo-bg #fbecc8` | `--stock-bajo-text #6a4608` |
| Agotado | cantidad <= 0 | `--stock-agotado-bg #f8dfda` | `--stock-agotado-text #7a2519` |
| En tránsito / info | — | `--stock-transito-bg #dbeaf3` | `--stock-transito-text #1b4560` |

El badge siempre lleva **punto + texto** (nunca solo color) y el tono se decide en
`utils/estadoStock.ts` + `StockBadge`, jamás por componente. Semánticos: `--color-error/
warning/info/success-(bg|fg|border)`, `--color-danger-solid #9b2c1f` (botón destructivo).

## 2. Tipografía

- **Display:** Barlow 500/600/700 (`--font-display`) — títulos, cifras de KPI, totales.
- **UI:** Inter 400/500/600/700 (`--font-sans`) — texto, formularios, tablas.
- Se cargan con `<link rel="preconnect">` + `<link rel="stylesheet">` en `index.html`
  (no con `@import` en CSS).
- Escala: `--text-xs .75rem`, `--text-sm .875rem`, `--text-base 1rem`, `--text-lg 1.25rem`,
  `--text-xl 1.625rem`, `--text-2xl 2.125rem`. Interlineado `--leading-tight 1.2`,
  `--leading-normal 1.5`. Cifras con `font-variant-numeric: tabular-nums` (`.tabular`).
- Tablas: 13px (`0.8125rem`) para densidad; resto del sistema >= 14px; inputs 16px.

## 3. Espaciado, forma, elevación, movimiento

- Espaciado base 4px: `--space-xs .25rem`, `sm .5rem`, `md 1rem`, `lg 1.5rem`, `xl 2rem`, `2xl 3rem`.
- Radios: `--radius-sm 8px`, `--radius-md 12px`, `--radius-lg 18px`.
- Sombras: `--shadow-sm`, `--shadow-card`, `--shadow-pop` (menús, diálogos, toasts).
- Movimiento: `--ease cubic-bezier(.2,0,0,1)`, `--dur-fast 150ms`, `--dur-base 220ms`,
  `--dur-slow 320ms`. Todo se desactiva con `prefers-reduced-motion` (en `base.css`).
- Capas: `--z-sidebar 40`, `--z-topbar 30`, `--z-overlay 100`, `--z-toast 200`, `--z-tooltip 300`.
- Layout: `--sidebar-w 15.5rem`, `--rail-w 4.5rem` (sidebar colapsado), `--topbar-h 3.75rem`,
  `--page-max 80rem`, `--target 2.75rem` (44px), `--row-h 3.25rem`, `--row-h-compact 2.5rem`.

## 4. Organización del CSS (`frontend/src/styles/`)

| Archivo | Contenido |
|---------|-----------|
| `tokens.css` | Todas las variables (este documento). |
| `base.css` | Reset, tipografía, foco visible, `.sr-only`, skip-link, reduced-motion. |
| `ui.css` | Button, Badge, Card, Field/Input, Alert, EmptyState, Skeleton, Toast, Tooltip, Overlay/Dialog/Drawer, Chips. |
| `layout.css` | Shell (`.app`), Sidebar (+ riel), Topbar, Breadcrumbs, UserMenu, paleta de comandos, 404/ErrorBoundary. |
| `data.css` | Toolbar, filtros-chip, DataTable (+ tarjetas en móvil), selección, paginación. |
| `features.css` | Comparación de ventas, multi-selects y combobox de repuesto (Movimientos / líneas). |
| `pages.css` | Login, tablero (KPI, gráficas, alertas), punto de venta, formularios de líneas. |
| `conteos.css` | Conteo físico: barra de captura (lector de códigos), estado de guardado, cantidad editable. |

`src/index.css` solo importa estos archivos en orden de cascada.

## 5. Componentes (`frontend/src/components/ui/`)

`Button` (primary/secondary/ghost/danger/danger-ghost, sm/md/lg, `loading`), `IconButton`
(`label` obligatorio = aria-label + tooltip), `Tooltip` (portal, hover + foco, Escape),
`Badge` / `StockBadge` / `EstadoBadge`, `Card`, `Field` + `Input` + `Select` (label, hint y
error enlazados con `aria-describedby`), `Alert`, `EmptyState`, `Skeleton` / `SkeletonRows`,
`Toast` (`ToastProvider` + `useToast`: éxito/info `role=status`, error/aviso `role=alert`,
auto-descarte 4.5-8 s, pausa con hover/foco), `ConfirmDialog` (`alertdialog`, foco inicial en
"Cancelar"), `Modal` / `Drawer` (focus trap, Escape, retorno de foco, `aria-labelledby`,
aviso de cambios sin guardar con `dirty`), `DataTable` (orden con `aria-sort`, `scope=col`,
`<caption>` oculto, selección, acciones por fila, esqueleto, vacío, tarjetas en móvil),
`TableToolbar` (búsqueda + botón "Filtros") / `FilterToggle` / `FilterSelect` / `FilterChips` / `BulkBar`, `MoreMenu` (acciones secundarias), `KpiCard` (indicador plano, sin ícono ni gráfica),
`PageHeader`, `Icon` (set SVG único, decorativo por defecto).

Shell: `components/layout/` (`AppLayout`, `Sidebar`, `Topbar`, `UserMenu`, `CommandPalette`).
Navegación: fuente única en `src/navigation.ts` (sidebar, breadcrumbs, paleta, títulos).

## 6. Patrones

- **Shell único** con rutas anidadas (`<Outlet />`); ninguna página repite sidebar.
- **Sidebar** con 4 entradas primarias (Inicio, Ventas, Repuestos, Reportes) y dos grupos plegables ("Gestión", "Administración"; se abren solos si la ruta actual está dentro); colapsable a riel de íconos (estado en `localStorage`); en móvil panel deslizable.
- **Paleta de comandos** `Ctrl/Cmd+K` (o `/`): páginas, acciones rápidas y repuestos por SKU/nombre. Es la vía rápida a todo lo que el menú pliega.
- **Formularios** crear/editar en `Drawer` (o `Modal` si es corto); errores de formulario inline (`Alert`),
  resultados de acciones con `Toast`, acciones destructivas con `ConfirmDialog`.
- **Tablas:** toolbar unificada (búsqueda + botón "Filtros" con contador; 1-2 filtros van en línea),
  chips de filtros activos removibles, estados de carga/vacío/error con CTA, tarjetas < 720px.
- **Conteo físico (`/conteos`):** lista con filtro por estado y una acción primaria ("Nuevo conteo"); detalle con KPIs (exactitud, diferencia agregada con veredicto de la meta de 5 %), **barra de captura** (`ConteoCaptura`: Enter con SKU exacto agrega o suma 1 y deja el foco ahí, así sirve con lector de códigos; el campo se vacía al instante y las búsquedas se atienden en orden), tabla con cantidad editable (Enter vuelve al buscador) y **autoguardado** con indicador ("Guardado / Guardando / No se pudo guardar + Reintentar"). Acción primaria según estado ("Cerrar y aplicar ajustes" en curso, "Descargar reporte" cerrado); lo demás en "Más". Diferencia siempre con palabra + signo ("+3 sobran", "−2 faltan") y badge por magnitud, nunca solo color.
- **Ventas = punto de venta:** búsqueda rápida (Enter agrega SKU exacto), lista compacta única, filtros plegados, carrito lateral con el total;
  en móvil el carrito es una hoja con barra de total fija.
- **Gráficas** en SVG propio con alternativa textual (tabla `sr-only` / etiquetas), sin depender solo del color.
- **Seguridad por rol:** la UI oculta lo que el rol no debe ver, pero la frontera real es la API;
  el Operador nunca recibe costos, márgenes ni proveedores (ni el tablero los calcula).

## 7. Accesibilidad (checklist)

Contraste >= 4.5:1; foco visible global (`:focus-visible`, anillo claro sobre fondos oscuros);
objetivos >= 44px (los botones `sm` suben a 44px con puntero táctil); skip-link "Saltar al contenido";
foco al contenido al navegar y `document.title` por ruta; `aria-current`, `aria-sort`, `aria-pressed`,
`aria-expanded`; `prefers-reduced-motion`; fondo `inert` mientras hay un diálogo abierto.

## 8. Anti-patrones

Paleta slate/roja del documento anterior, Syncopate/Space Mono, emojis como íconos, hex crudos en
componentes, hover como único medio de revelar acciones, estados solo con color, `@import` de fuentes
en CSS, banners sueltos para resultados de acciones.

---

## 9. Reportes impresos (PDF / Excel / CSV)

Los reportes descargables se generan en el **backend** (`backend/src/services/reportes/render/`) con
**pdfkit** (PDF vectorial, sin navegador ni binarios) y **exceljs** (Excel). La paleta vive en
`render/paleta.js` y **duplica los tokens** de `tokens.css` (el backend no lee CSS): si cambian los
tokens, actualizar ese archivo.

- **Página:** carta (612x792 pt); horizontal para reportes anchos (movimientos, reposición, rotación).
  Márgenes 40 pt (36 en horizontal), contenido entre 62 pt arriba y 54 pt abajo.
- **Tipografía (incrustada desde `@fontsource`, subconjunto latino):** Barlow 600/700 para título, KPI y
  secciones; Inter 400/600/700 para texto y tablas (8 pt). Cifras con `tnum` (tabulares).
- **Encabezado (1.ª página de cada reporte):** banda `--pino-800` de 76 pt, marca "REPUESTOS XELAJÚ · SIRX"
  con tracking, título en Barlow 27 pt blanco y filete **latón** (`--color-accent`) — el único acento.
  Debajo: filtros aplicados (izquierda) y generado/por (derecha). Continuación: cabecera corrida
  (marca + título del reporte) con filete verde.
- **KPI:** tarjetas `--neutro-papel` con borde `--neutro-300`, barra lateral `--pino-600`, etiqueta 7.5 pt,
  valor Barlow 19 pt `--pino-800`, nota 7 pt. Hasta 5 por fila.
- **Tablas:** cabecera `--pino-700` con texto blanco (se repite en cada página), filas zebra `--neutro-papel`,
  números a la derecha con formato `Q 1,234.50`, negativos en tono `--stock-agotado-text`, fila de totales
  en `--pino-100` con filete `--pino-600`. Estados = badge con **punto + texto** (colores de stock).
- **Gráficas:** barras horizontales (pista `--neutro-200`, barra `--pino-600`, valor al final) y línea con
  área `--pino-100`; siempre con el valor impreso, nunca solo color. Legibles en blanco y negro.
- **Pie en cada página:** "Documento operativo, no constituye documento tributario.", marca + fecha/hora
  de generación + usuario, y "Página X de Y" (se dibuja al final, cuando se conoce el total).
- **Excel:** hoja "Resumen" (marca, filtros, KPI, notas, leyenda) + una hoja por tabla con cabecera
  `--pino-700`, zebra, anchos, formatos reales de moneda/entero/porcentaje/fecha, fila 1 congelada y
  autofiltro. **CSV:** UTF-8 con BOM, cifras sin formato, neutraliza fórmulas (`=`, `+`, `-`, `@`).
- **Nombres:** `sirx_reporte-<tipo>_<YYYY-MM-DD>.<ext>`; combinados `sirx_reporte-combinado_...`;
  CSV múltiple = ZIP `sirx_reportes_...zip`.
- **Pantalla (`/reportes`):** `styles/reportes.css` (`.rep-*`): lista compacta de reportes (una fila cada uno,
  casilla para descargar varios) junto al detalle; la barra de descarga múltiple solo aparece con selección;
  filtros por reporte en una sola rejilla, vista previa con `KpiCard`, `DataTable` y gráficas SVG propias
  (`components/reportes/ReporteChart.tsx`).

---

## 10. Principios de simplicidad

Regla madre: **la pantalla muestra lo que se usa todos los días; lo demás se pliega, no se elimina.**
Todo lo plegado sigue alcanzable por teclado y por la paleta de comandos.

- **Una acción primaria por vista** (botón verde sólido). Todo lo demás es `secondary`/`ghost`.
  Dashboard: "Nueva venta". Repuestos/Categorías/Proveedores/Usuarios: "Nuevo ...". Ventas y Compras: el registrar.
- **Máximo 4-5 controles de primer nivel por barra de herramientas.** Búsqueda + "Filtros" (+ "Más" si hay).
  Con 1-2 filtros, en línea; con 3 o más, plegados tras el botón "Filtros" (con contador de activos).
- **Qué va en "Más" (`MoreMenu`):** carga masiva, exportar, densidad de filas y cualquier acción que no
  se use en cada sesión. Nunca la acción primaria ni acciones destructivas de fila.
- **Qué va plegado (`.disclosure`, `<details>`):** herramientas avanzadas o de consulta ocasional
  (ajuste de umbrales en bloque, comparación de ventas, stock por categoría y actividad reciente).
- **Navegación:** 4 destinos primarios + grupos plegables. Sin accesos rápidos que repitan al menú;
  breadcrumbs mínimos (solo el nombre de la página, y el grupo si es secundaria).
- **Sin descripciones bajo el título de página**; el título basta. El contexto va en la fila de datos.
- **Indicadores:** franja plana de 2-4 cifras (etiqueta, valor, una línea de contexto). Sin íconos,
  sparklines, anillos ni tarjetas tintadas; el tono solo colorea la cifra/nota.
- **Cifras de dinero en Inter** (tabulares): Barlow confunde la "Q" con "0".
- **Prohibido:** tarjetas idénticas ícono+título+texto como estructura de página, hero-metric, bordes
  laterales de color > 1px en tarjetas/alertas/notas, eyebrow o mayúsculas espaciadas sobre títulos,
  gradientes/rayas/glass decorativos, tarjetas anidadas, hex crudos en componentes, un segundo botón
  primario en la misma vista, alternar vistas (lista/tarjetas) donde una basta.
- **Estados:** vacío con una acción clara; confirmación (`ConfirmDialog`) para lo destructivo; errores
  junto a la acción; movimiento solo funcional y <= 220 ms.

## 11. Marca / Logo

Monograma "RX" verde con la silueta de un auto sobre el borde superior. Fuente: `frontend/src/assets/brand/logo-original.webp` (raster 1254x1254, fondo crema). Todas las versiones derivan de él con alfa suave (sin halo).

| Archivo | Uso | Fondo |
|---|---|---|
| `assets/brand/logo-rx.png` | Logo horizontal verde (1024 px de ancho) | Claro (papel, blanco) |
| `assets/brand/logo-rx-blanco.png` | Logo horizontal blanco | Oscuro (pino-800 o más oscuro): sidebar, panel de login, banda del PDF |
| `assets/brand/marca-rx.png` / `marca-rx-blanco.png` | Marca cuadrada 512 px (compacta) | Claro / oscuro: sidebar colapsado, topbar móvil |
| `public/favicon-32.png`, `favicon-192.png`, `apple-touch-icon.png` | Favicon y pantalla de inicio | Marca blanca sobre verde `#0b6e4f` |
| `backend/assets/brand/logo-rx*.png` | Copia (600 px) para PDF y Excel; el backend no lee el frontend | |

En React se usa solo `components/layout/BrandLogo.tsx` (`alto`, `tono`, `compacta`); es decorativo (alt vacío), por lo que debe ir junto al texto "SIRX" o con un nombre accesible propio.

- **Dónde va:** login (panel de marca), cabecera del sidebar (completo expandido, cuadrado colapsado), topbar móvil, encabezado del PDF y hoja Resumen del Excel. No se repite en cada pantalla, ni como marca de agua, ni animado. CSV no lleva logo.
- **Área de respeto:** como mínimo la altura de la "R" (aprox. 1/3 del alto del logo) libre alrededor. Alto mínimo 24 px en pantalla (16 mm en impresión).
- **No hacer:** deformar o cambiar la proporción; recolorear fuera del verde o blanco; ponerlo sobre fondos de bajo contraste o fotos; añadir sombras, contornos o efectos; usar la versión verde sobre fondos oscuros.
- **Limitación:** es raster; para tamaños grandes (impresos, rótulos) pedir el vectorial (SVG/AI) al diseñador.
