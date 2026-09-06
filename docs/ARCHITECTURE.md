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
| Catálogo de repuestos (CRUD) | ✅ Hecho (HU-04) | `pages/RepuestosPage`, `components/RepuestoFormModal` | `routes/articuloRoutes`, `services/articuloService` |
| Movimientos de inventario | ⏳ Pendiente | — | — |
| Alertas de stock mínimo | ⏳ Pendiente (el dato ya existe: `Articulo.inventarioMinimo` + `Inventario.cantidad`) | — | — |
| Registro de ventas | ⏳ Pendiente | — | — |
| Panel de reportes / dashboard | ⏳ Pendiente | — | — |

## Fuera de alcance (según Acta)

Facturación FEL/SAT, reportes de servicio a camiones, contabilidad/nómina, app móvil nativa, tienda en línea, integración con proveedores, operación multi-sucursal, soporte post-entrega. No se reserva estructura de carpetas para estos módulos.
