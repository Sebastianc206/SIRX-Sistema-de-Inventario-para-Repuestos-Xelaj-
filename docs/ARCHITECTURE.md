# Arquitectura de SIRX

## Contexto

SIRX es una aplicación web de inventario para un único negocio, una sola sucursal, y un volumen de operación pequeño (ver Acta de Constitución del Proyecto). El equipo es pequeño (4 personas), con dedicación parcial y sin experiencia previa en el stack elegido. Por eso la arquitectura prioriza **simplicidad de desarrollo y de despliegue** por encima de escalabilidad o flexibilidad — no hay necesidad de microservicios, colas de mensajes, ni multi-tenant.

## Decisión: monolito de 2 capas + BaaS de base de datos

```
┌─────────────────────┐        HTTPS / JSON         ┌──────────────────────┐        SQL         ┌───────────────────────┐
│      Frontend        │ ───────────────────────────▶│       Backend         │ ──────────────────▶│      Base de datos     │
│  React + Vite + TS   │◀─────────────────────────── │   Node.js + Express   │◀────────────────── │   PostgreSQL (Neon)    │
│  (SPA, en Vercel)    │        REST API              │   API REST (Render)   │   Prisma ORM        │                        │
└─────────────────────┘                              └──────────────────────┘                     └───────────────────────┘
```

- **Frontend**: Single Page Application. Consume la API por HTTP/JSON. No renderiza en servidor (no se necesita SEO para un sistema interno).
- **Backend**: API REST monolítica. Un solo servicio, sin separar por microservicios — el volumen de operación (un negocio, una sucursal) no lo justifica.
- **Base de datos**: PostgreSQL relacional, adecuado para datos transaccionales de inventario (existencias, movimientos, ventas) que requieren integridad referencial.
- **ORM**: Prisma. Se eligió sobre SQL puro o TypeORM porque genera el cliente de datos y las migraciones a partir de un único archivo `schema.prisma`, tiene documentación extensa (mitiga el riesgo de "curva de aprendizaje" identificado en el Acta) y funciona muy bien con proveedores serverless de Postgres como Neon.
- **Autenticación**: JWT simple con roles (`administrador`, `operador`), sin dependencias externas de identidad — no se requiere SSO ni OAuth para un solo negocio.

## Por qué esta arquitectura es la más sencilla de desplegar

1. **Dos despliegues independientes, ambos con capa gratuita**: frontend estático en Vercel, backend en Render como Web Service. No requieren Docker, Kubernetes ni servidores propios.
2. **Base de datos administrada (Neon)**: no hay que instalar ni mantener PostgreSQL; Neon ofrece capa gratuita sin expirar (a diferencia de la de Render, que expira a los 90 días), con backups automáticos.
3. **Sin build step complejo**: Vite compila el frontend a archivos estáticos; el backend en JavaScript plano corre directo con Node, sin paso de compilación adicional.
4. **Todo conectado por variables de entorno** (`DATABASE_URL`, `JWT_SECRET`, `VITE_API_URL`), sin configuración específica de infraestructura.
5. **Despliegue continuo por Git**: tanto Vercel como Render se integran directo con GitHub — cada push a `main` dispara un deploy automático.

## Módulos funcionales (carpetas, sin lógica aún)

Mapeo directo del alcance del Acta a la estructura de carpetas:

| Módulo del Acta | Estado | Frontend | Backend |
|---|---|---|---|
| Autenticación y usuarios (roles) | ✅ Hecho (HU-01, HU-02) | `pages/LoginPage`, `pages/UsuariosPage`, `hooks/useAuth` | `routes/authRoutes`, `routes/usuarioRoutes`, `middlewares/authMiddleware`, `middlewares/roleMiddleware` |
| Catálogo de repuestos (CRUD + carga masiva) | ✅ Hecho (HU-04, HU-05) | `pages/RepuestosPage`, `components/RepuestoFormModal`, `components/CargaMasivaRepuestosModal` | `routes/articuloRoutes`, `services/articuloService`, `utils/excelRepuestos` |
| Gestión de proveedores | ✅ Hecho (HU-26) | `pages/ProveedoresPage`, `components/ProveedorFormModal` | `routes/proveedorRoutes`, `services/proveedorService` |
| Movimientos de inventario | ⏳ Pendiente | — | — |
| Alertas de stock mínimo | ⏳ Pendiente (el dato ya existe: `Articulo.inventarioMinimo` + `Inventario.cantidad`) | — | — |
| Registro de ventas | ⏳ Pendiente | — | — |
| Panel de reportes / dashboard | ⏳ Pendiente | — | — |

## Conteo físico de inventario (`/api/conteos`)

Criterio de éxito del acta: diferencia <= 5 % entre existencias del sistema y conteo físico. Solo Administrador (cada endpoint con `authorize("Administrador")`).

- **Modelo** (migración `20261008000000_conteo_fisico`): `conteo_fisico` (cabecera: nombre, fecha, estado, categoría opcional = alcance, quién creó/cerró) y `conteo_detalle` (una fila por SKU: `cantidad_sistema` = stock registrado al contar, `cantidad_contada`, y al aplicar `ajuste`, `cantidad_antes`, `cantidad_despues`).
- **Estados:** `borrador` -> `aplicado` (cerrado y corrigió Inventario) | `cerrado` (cerrado sin corregir, solo informe) | `cancelado`. Todo estado distinto de `borrador` es final: no se reabre ni se aplica dos veces (cada operación toma `SELECT ... FOR UPDATE` de la fila del conteo y exige `borrador` dentro de la transacción). Solo se pueden borrar borradores/cancelados.
- **Ajustes positivos:** no se reutilizan `SalidaMaestro/Detalle` (solo restan) ni `CompraMaestro/Detalle` (exigen proveedor y precio). La trazabilidad vive en `conteo_detalle` y `movimientoService` la expone en Movimientos como «Conteo físico» (`categoria: "ajuste"`, `tipo` entrada/salida según el signo, `anulable: false`, antes -> después). No rompe ningún contrato existente (los reportes de mermas/ventas siguen leyendo `salida_*`; el reporte «Conteo físico» cubre las correcciones).
- **Concurrencia con ventas:** la diferencia se mide contra el stock del sistema *al momento de contar cada SKU* y, al aplicar, se **suma** al stock vigente (`increment`), nunca se reemplaza el stock por lo contado: las ventas hechas durante el conteo se conservan. Si el stock vigente difiere del de conteo en alguna línea con diferencia, el cierre responde `409 CAMBIO_STOCK` con la lista y solo se aplica con `confirmarCambios: true`; si el resultado fuera negativo se rechaza todo (`409 STOCK_NEGATIVO`).
- **KPI:** exactitud = productos con diferencia 0 / productos contados; diferencia agregada = sum|contado - sistema| / sum(sistema); meta `META_EXACTITUD_PCT = 5` (constante en `conteoService.js`, espejo en `frontend/src/utils/conteo.ts`). Solo cuentan los productos contados; los del alcance sin contar se informan aparte y no se ajustan.
- **Reporte:** `conteo-fisico` en el catálogo de reportes (filtro `idConteo`, solo Administrador; PDF/Excel/CSV).
- **Decisión abierta:** el Operador NO puede contar ni ver conteos. Si el negocio quiere conteo en bodega por Operador, habría que abrir solo `PUT /:id/lineas` (sin costos, sin cierre) con un modo "captura" y validar quién puede ver diferencias. No se habilitó.
- **Límite conocido:** `GET /api/movimientos` filtra `fechaHasta` hasta las 23:59 en la hora del servidor; si el servidor corre en UTC, los movimientos de la noche (después de las 18:00 en Guatemala) del último día del rango aparecen hasta el día siguiente. Afecta a todos los movimientos, no solo a conteos.

## Fuera de alcance (según Acta)

Facturación FEL/SAT, reportes de servicio a camiones, contabilidad/nómina, app móvil nativa, tienda en línea, integración con proveedores, operación multi-sucursal, soporte post-entrega. No se reserva estructura de carpetas para estos módulos.
