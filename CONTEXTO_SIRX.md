# SIRX — Sistema de Inventario para Repuestos Xelajú
### Documento de contexto para continuar el desarrollo

Este documento reúne todo lo definido hasta ahora del proyecto (alcance, modelo de datos,
historias de usuario, seguridad y sistema de diseño) para que sirva de referencia al retomar
el código que ya avanzó el equipo. No reemplaza el Documento de Diseño y Alcance ni el
Backlog completo — es un resumen operativo pensado para trabajar directo sobre el código.

---

## 1. Qué es el producto

Aplicación web de gestión de inventario para **Repuestos Xelajú**, negocio de venta de
repuestos automotrices y servicio de mecánica. Sustituye el control manual en papel por un
sistema donde cada producto, movimiento de existencia y venta queda registrado.

**Problema que resuelve:** no hay forma de saber si hay existencias de un producto, si hace
falta reabastecer, ni cómo va la venta. Esto genera pérdida de ventas por quiebres de stock,
capital inmovilizado en repuestos de baja rotación, y descuadres entre lo registrado y lo
físicamente existente.

**Cliente:** Ronald Ovalle, propietario de Repuestos Xelajú.

## 2. Stack tecnológico

- **Frontend:** React + Vite + TypeScript
- **Backend:** Node.js + Express
- **Base de datos:** PostgreSQL

## 3. Roles del sistema

| Rol | Descripción |
|---|---|
| **Admin** | Control total: usuarios, proveedores, costos, reportes financieros, logs de auditoría |
| **Operador** | Mostrador: vende, consulta catálogo y existencias, registra movimientos — sin acceso a datos financieros sensibles |

### Matriz de sensibilidad (qué ve cada rol)

**Importante:** esto se aplica en el **backend**, filtrando la respuesta de la API según el
rol autenticado — nunca solo ocultando elementos en el frontend. Cualquiera con las
herramientas de desarrollador del navegador vería el dato igual si solo se oculta visualmente.

| Dato / función | Admin | Operador | Por qué |
|---|---|---|---|
| `precio_costo` | Sí | No | Revela el margen de ganancia |
| Proveedores (CRUD y datos de contacto) | Sí | No | Relación comercial del dueño |
| Reporte de valorización de inventario | Sí | No | Se calcula desde el costo |
| Valor de inventario en el dashboard | Sí | No | También se deriva del costo |
| Logs de auditoría | Sí | No | Actividad de todo el personal |
| Datos de otros usuarios (correo, teléfono) | Sí | No | Gestión de usuarios es función de admin |
| `precio_venta` | Sí | Sí | El operador lo necesita para vender |
| Existencias / stock actual | Sí | Sí | Necesario para operar |
| Reporte de productos más vendidos | Sí | Sí | No revela margen |

---

## 4. Modelo de datos

### Entidades

**Usuario**
| Campo | Tipo | Notas |
|---|---|---|
| id | PK | |
| nombre_completo | varchar | |
| correo | varchar, único | login |
| password_hash | varchar | nunca texto plano |
| rol | enum(admin, operador) | |
| estado | enum(activo, inactivo) | |
| intentos_fallidos | int | bloqueo tras 3 intentos |
| bloqueado_hasta | timestamp, nullable | |
| ultimo_acceso | timestamp, nullable | |
| fecha_creacion | timestamp | |

**TokenRecuperacion** — id, usuario_id (FK), token (único), fecha_expiracion, usado (bool)

**Categoria** — id, nombre (único), descripcion

**Marca** — id, nombre (único) — evita duplicados tipo "Bosch"/"BOSCH"

**Proveedor** (solo admin) — id, nombre, contacto, telefono

**ModeloVehiculo** — id, marca_vehiculo, modelo, anio_desde, anio_hasta

**RepuestoModeloCompatible** (tabla puente N:M) — repuesto_id + modelo_id, llave compuesta.
Un repuesto puede tener varios modelos compatibles o ninguno (repuestos genéricos como
aceite, trapos, herramientas). No es obligatorio llenarla.

**Repuesto**
| Campo | Tipo | Notas |
|---|---|---|
| id | PK | |
| codigo | varchar, único | SKU |
| nombre | varchar | |
| descripcion | text, nullable | |
| categoria_id | FK → Categoria | |
| marca_id | FK → Marca, nullable | |
| proveedor_id | FK → Proveedor, nullable | **solo admin** |
| precio_costo | decimal | **solo admin** |
| precio_venta | decimal | |
| unidad_medida | varchar | pieza, juego, litro |
| stock_actual | int | **campo cacheado**, ver nota abajo |
| stock_minimo | int | |
| ubicacion | varchar, nullable | |
| pais_origen | varchar, nullable | |
| codigo_barras | varchar, nullable, único | |
| estado | enum(activo, descontinuado) | baja lógica, no borrado físico |

**Movimiento** — id, repuesto_id (FK), usuario_id (FK), tipo (entrada/salida), cantidad,
motivo (compra/ajuste/merma/devolución/venta), referencia_venta_id (FK nullable), fecha

**Venta** — id, usuario_id (FK), fecha, total

**DetalleVenta** — id, venta_id (FK), repuesto_id (FK), cantidad, precio_unitario
(copiado al momento de la venta), subtotal

**CargaMasivaLog** (auxiliar) — id, usuario_id (FK), nombre_archivo, fecha, filas_exitosas,
filas_error, detalle_errores

### Decisiones de normalización

- **1FN:** "modelos compatibles" vive en tabla puente, no como texto separado por comas.
- **3FN:** Categoria, Marca y Proveedor en tablas propias — no se repite su nombre en cada
  fila de Repuesto.
- **Desnormalización deliberada #1:** `stock_actual` es técnicamente calculable (entradas −
  salidas de Movimiento), pero se cachea para que catálogo y reportes respondan rápido.
  Se sincroniza con una transacción atómica en cada movimiento.
- **Desnormalización deliberada #2:** `DetalleVenta.precio_unitario` se copia al momento de
  la venta — así una venta pasada no cambia de valor si el precio del producto cambia después.

### Motivos de salida — importante distinguir

Una salida de inventario **no siempre es una venta**:
- **Venta:** única que genera ingreso, ligada a `Venta`.
- **Ajuste:** corrección porque el conteo físico no cuadra con el sistema ("no sé qué pasó").
- **Merma:** pérdida identificable — dañado, vencido, roto ("sé qué pasó y por qué").
- **Devolución:** puede ir en dos direcciones — devolución a proveedor (salida real) o
  devolución de cliente (en realidad es una **entrada**). El campo `motivo` no distingue
  dirección explícitamente todavía; usar `tipo=entrada, motivo=devolución` para devoluciones
  de cliente si el negocio lo requiere.

### Índices recomendados

`Repuesto.codigo` y `Repuesto.codigo_barras` (únicos) · `Repuesto.nombre` (búsqueda) ·
`Movimiento(repuesto_id, fecha)` · `Venta.fecha` y `DetalleVenta.venta_id`

---

## 5. Épicas e historias de usuario

7 épicas, 25 historias de usuario. Prioridad ordenada de mayor a menor (1 = más importante).
Clasificación MoSCoW: **Necesario** (sin esto no se cumple el acta) · **Deseable** (suma
valor, el sistema funciona sin esto) · **Opcional** (lo primero que se recorta).

| Prio. | ID | Historia | Épica | Clasif. | Sprint |
|---|---|---|---|---|---|
| 1 | HU-18 | Seguridad básica de los endpoints | Seguridad | Necesario | 1 |
| 2 | HU-19 | Gestión segura de sesiones y contraseñas | Seguridad | Necesario | 1 |
| 3 | HU-01 | Autenticación y acceso seguro por rol | Auth y Usuarios | Necesario | 1 |
| 4 | HU-02 | Gestión de usuarios operadores | Auth y Usuarios | Necesario | 1 |
| 5 | HU-07 | Gestión de categorías de repuestos | Catálogo | Necesario | 1 |
| 6 | HU-26 | Gestión de proveedores | Catálogo | Necesario | 1 |
| 7 | HU-04 | Gestión del catálogo de repuestos | Catálogo | Necesario | 1 |
| 8 | HU-05 | Carga masiva de repuestos vía Excel | Catálogo | Necesario | 1 |
| 9 | HU-06 | Búsqueda y filtrado avanzado del catálogo | Catálogo | Necesario | 1 |
| 10 | HU-08 | Registro de entradas de inventario por compra | Movimientos | Necesario | 2 |
| 11 | HU-09 | Registro de salidas por ajuste o merma | Movimientos | Necesario | 2 |
| 12 | HU-10 | Consulta del historial de movimientos | Movimientos | Necesario | 2 |
| 13 | HU-11 | Configuración del nivel mínimo de existencia | Alertas | Necesario | 2 |
| 14 | HU-12 | Panel de alertas de existencia baja | Alertas | Necesario | 2 |
| 15 | HU-03 | Recuperación de contraseña | Auth y Usuarios | Deseable | 2 |
| 16 | HU-20 | Protección XSS y CSRF | Seguridad | Deseable | 2 |
| 17 | HU-21 | Rate limiting y protección contra fuerza bruta | Seguridad | Deseable | 2 |
| 18 | HU-22 | Auditoría y registro de actividad | Seguridad | Deseable | 2 |
| 19 | HU-13 | Registro de venta de mostrador | Ventas | Necesario | 3 |
| 20 | HU-14 | Consulta del historial de ventas | Ventas | Necesario | 3 |
| 21 | HU-15 | Tablero principal con resumen general | Reportes | Deseable | 3 |
| 22 | HU-17 | Reporte de valorización de inventario | Reportes | Deseable | 3 |
| 23 | HU-16 | Reporte de productos más vendidos | Reportes | Opcional | 3 |
| 24 | HU-23 | Protección de datos y respaldo | Seguridad | Deseable | 3 |
| 25 | HU-24 | Endurecimiento final y pruebas de seguridad | Seguridad | Opcional | 3 |

*(HU-25 no se usa — historia descartada al afinar el backlog; el número no se reutiliza.)*

**Regla de tamaño:** 1 punto de historia ≈ 2 horas, 2 puntos ≈ 4 horas. Ninguna tarea debe
pasar de 2 puntos — si es más grande, se desglosa.

---

## 6. Estado actual del proyecto

| Sprint | Periodo | Meta | Estado |
|---|---|---|---|
| Sprint 1 | 11–21 ago 2026 | Login por rol operativo + catálogo completo y poblado | ✅ Cerrado |
| Sprint 2 | 24 ago–4 sep 2026 | Movimientos de inventario en operación + alertas activas | ✅ Cerrado (2026-09-13) |
| Sprint 3 | 7–18 sep 2026 | Ventas de mostrador, reportes, tablero y despliegue | 🔄 En curso |

> **Corrección (2026-09-13):** esta tabla marcaba Sprint 2 como cerrado desde
> antes, pero HU-08/HU-09/HU-10/HU-12 no tenían ningún código detrás — ni
> tablas de movimientos en uso, ni endpoints, ni pantallas. Se implementaron
> de punta a punta en esta fecha (incluyendo la migración de esquema que
> hacía falta, ver `docs/DATABASE.md`), y de paso también HU-13/14/15 de
> Sprint 3. Quedó verificado manualmente vía API: una compra que suma stock,
> una venta con varias líneas que resta stock de cada una y calcula bien el
> total, el historial combinado de movimientos por producto (excluyendo
> ventas), y el tablero con alertas de stock bajo.

### Ya construido (Sprint 1 + 2 + parte de Sprint 3)
Autenticación con roles, gestión de usuarios y proveedores, catálogo completo (CRUD, carga
masiva vía Excel, búsqueda/filtros, categorías).

Movimientos de inventario (HU-08/09/10): registro de compras a proveedor (una o varias
líneas, suma stock en transacción atómica), registro de salidas por ajuste/merma (no ligadas
a una venta, resta stock validando existencia suficiente), e historial combinado de
movimientos por producto (compras + salidas no-venta, más recientes primero). Compras es
exclusivo de Administrador (`precioCompra`/`montoTotalCompra` son datos de costo); ajustes y
movimientos están abiertos a ambos roles.

Ventas de mostrador (HU-13/14): registro de venta con una o varias líneas de producto,
descuento automático de stock por línea y cálculo del total; historial de ventas. Abierto a
ambos roles (venta de mostrador es tarea de Operador).

Tablero principal (HU-12/15): tarjetas KPI (SKUs activos, alertas de stock bajo, y ventas del
día solo para Administrador — dato financiero oculto a Operador) y tabla de productos por
debajo de su stock mínimo.

Recuperación de contraseña, seguridad base y avanzada (validación de inputs, HTTPS, XSS/CSRF,
rate limiting, auditoría).

### Falta por construir (Sprint 3, en curso)
Reporte de productos más vendidos, reporte de valorización de inventario, respaldo de datos,
y checklist final de seguridad (OWASP Top 10) antes del despliegue.

---

## 7. Requerimientos de seguridad (aplican a todo el desarrollo)

- Consultas parametrizadas / ORM en **todos** los endpoints — nunca concatenar SQL
- Validar y sanitizar todo input de usuario en cada endpoint
- Verificar rol/permiso en **cada endpoint del backend**, nunca solo ocultar botones en frontend
- Contraseñas con bcrypt (o equivalente), nunca texto plano
- HTTPS forzado en todos los entornos
- Tokens de sesión con tiempo de vida corto
- Bloqueo temporal de cuenta tras 3 intentos fallidos de login
- Protección CSRF en formularios/endpoints que modifican datos
- Cabeceras de seguridad HTTP (CSP, X-Frame-Options, HSTS)
- Rate limiting en login y recuperación de contraseña
- Registro de auditoría de acciones sensibles (login, cambios de usuario, movimientos, ventas)
- Variables de entorno para credenciales — nunca hardcodeadas ni en el repositorio
- Validar tipo y tamaño máximo de archivo en la carga masiva
- CORS restringido a orígenes permitidos
- No exponer stack traces ni mensajes de error internos al cliente

---

## 8. Sistema de diseño — UI

Extraído y estandarizado de la paleta de color entregada para el gestor de inventarios.
Verde pino oscuro como color principal, neutros cálidos (nunca blanco ni negro puros).

### Tokens de color (CSS custom properties)

```css
:root {
  /* Pino — color principal. 600 es la base: botones, enlaces, cabeceras, elementos activos.
     700/800 para estados presionados y texto sobre relleno claro. */
  --pino-100: #E9F0EC;
  --pino-200: #C5DCD2;
  --pino-300: #9EC1B4;
  --pino-400: #6DA391;
  --pino-500: #40806B;
  --pino-600: #2E5B4A; /* base */
  --pino-700: #24493B;
  --pino-800: #1B372C;
  --pino-900: #12241D;

  /* Neutros — papel y tinta. Grises cálidos desaturados hacia el verde. */
  --neutro-superficie: #FCFBF7;
  --neutro-papel: #F7F6F2;
  --neutro-200: #EDEBE4;
  --neutro-300-borde: #D8D5CC;
  --neutro-400: #B4B0A6;
  --neutro-500: #8A8680;
  --neutro-600-texto-tenue: #625F29;
  --neutro-700: #46443F;
  --tinta-900: #1E1D1A;

  /* Estados de stock — cada uno con relleno claro + tinta oscura para texto encima.
     Nunca usar el tono medio como texto pequeño (falla de contraste). */
  --stock-en-stock-bg: #E9F0EC;
  --stock-en-stock-mid: #40806B;
  --stock-en-stock-text: #24493B;

  --stock-bajo-bg: #F5E9CE;
  --stock-bajo-mid: #C08A2E;
  --stock-bajo-text: #6E4B0E;

  --stock-agotado-bg: #F5E2DE;
  --stock-agotado-mid: #A8402F;
  --stock-agotado-text: #7E2E20;

  --stock-transito-bg: #DCEAF1;
  --stock-transito-mid: #2F6D8F;
  --stock-transito-text: #1F4B66;
}
```

### Reglas de uso

- El 600 de Pino es la única base de color de marca — no usar 500 o 700 como color primario
  de botones.
- Contraste sobre el papel (`--neutro-papel`): 600 → 7.2:1 · 700 → 9.3:1 · 500 → 4.3:1 (el
  500 solo sirve para texto grande e íconos, no para texto pequeño).
- Cada estado de stock usa su tono claro como fondo de badge y su tono oscuro como texto —
  nunca el tono medio como texto pequeño, no pasa el contraste mínimo.
- Ningún color de la paleta llega a blanco puro (#FFFFFF) ni negro puro (#000000).

### Mapeo estado de stock → dato del backend

| Badge visual | Condición en backend |
|---|---|
| En stock | `stock_actual > stock_minimo` |
| Stock bajo | `stock_actual <= stock_minimo AND stock_actual > 0` (esto alimenta HU-12, el panel de alertas) |
| Agotado | `stock_actual = 0` |
| En tránsito | *(ver observación en sección 9 — no existe todavía en el modelo de datos)* |

---

## 9. Observaciones y mejoras detectadas

- **Estado "En tránsito" sin respaldo en el modelo de datos.** El sistema de diseño
  contempla un cuarto estado de stock ("En tránsito") que no existe en el modelo actual —
  hoy solo sabemos entradas ya recibidas (`Movimiento` tipo=entrada), no pedidos hechos pero
  aún no llegados. Si se quiere soportar de verdad, se necesitaría una entidad tipo
  `OrdenCompra` (repuesto, cantidad pedida, fecha esperada, estado) separada de `Movimiento`.
  Si no es prioridad para el MVP, lo más simple es no implementar ese badge todavía y
  dejarlo documentado como extensión futura, en vez de mostrarlo sin datos reales detrás.

- **Dirección de "devolución" ambigua.** Ver nota en la sección 4 — el campo `motivo` no
  distingue si una devolución es hacia el proveedor (salida) o desde el cliente (entrada).
  Vale la pena confirmar con el cliente si esto ocurre en la práctica antes de complicar el
  modelo por un caso que quizás no se presente.

- **Gestión de proveedores (HU-26) no estaba en el alcance original.** Se agregó a mitad de
  camino porque `Repuesto.proveedor_id` ya existía como FK pero no había ninguna pantalla
  para crear proveedores — sin esto el campo era inutilizable. Ya está en el backlog y
  priorizado, solo se deja anotado por si el código que ya avanzó el equipo no la contempla.

- **Filtrado de datos sensibles por rol es un esfuerzo transversal, no una sola tarea.**
  Cada endpoint nuevo que toque `Repuesto`, el dashboard o los reportes necesita revisar
  explícitamente si debe excluir `precio_costo` y `proveedor_id` para el rol operador — es
  fácil que un endpoint nuevo se cree sin este filtro si no se recuerda activamente.

- **Capacidad del equipo por debajo de la carga planificada.** Sprint 1 requirió más del
  doble de horas que la capacidad declarada del equipo (188h planificadas contra ~80h
  disponibles). Esto no bloquea el desarrollo, pero es una señal de que el ritmo actual no es
  sostenible a largo plazo sin ajustar dedicación o alcance.

- **Paleta de estados de stock reutiliza directamente la escala Pino para "En stock".** Esto
  es una buena práctica de diseño (menos colores que mantener), pero significa que si el
  tono base de marca (`--pino-600`) cambia en el futuro, el estado "En stock" cambia con él —
  vale la pena decidir a propósito si eso es deseable o si conviene independizar esa paleta.
