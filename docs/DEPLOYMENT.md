# Guía de despliegue

## Servicios recomendados (todos con capa gratuita)

| Componente | Servicio | Notas |
|---|---|---|
| Frontend (SPA) | [Vercel](https://vercel.com) | Conectar el repo de GitHub, root directory `frontend/`, build command `npm run build`, output `dist/`. |
| Backend (API) | [Render](https://render.com) | Web Service, root directory `backend/`, build command `npm install`, start command `npm start`. |
| Base de datos | [Neon](https://neon.tech) | Crear proyecto PostgreSQL, copiar el connection string a `DATABASE_URL`. |

## Variables de entorno

**Backend** (`backend/.env`, ver `backend/.env.example`):
- `DATABASE_URL` — connection string de Neon.
- `PORT` — puerto local (Render lo asigna automáticamente en producción).
- `JWT_SECRET` — secreto para firmar tokens de sesión. Mínimo 32 caracteres: el servidor no arranca si es más corto (T-105).
- `JWT_EXPIRES_IN` — vida del token de sesión. Debe estar entre `1m` y `1h` (política de sesión corta, T-105); el servidor no arranca fuera de ese rango.
- `CORS_ORIGIN` — URL del frontend desplegado.
- `ADMIN_PASSWORD` / `OPERADOR_PASSWORD` — contraseñas de las cuentas de prueba que crea `npm run prisma:seed`. Requeridas (sin valor por defecto) y deben cumplir la política de contraseñas: mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo (T-104).

HTTPS (T-103) se fuerza a nivel de aplicación (redirección 301 automática de HTTP a HTTPS) para cualquier host que no sea `localhost`/`127.0.0.1`; Render además redirige HTTP→HTTPS en su propio proxy de entrada.

**Frontend** (`frontend/.env`, ver `frontend/.env.example`):
- `VITE_API_URL` — URL pública del backend desplegado en Render.

## Pasos de despliegue inicial

1. Crear el proyecto en Neon y obtener el `DATABASE_URL`.
2. En Render: nuevo Web Service apuntando a `backend/`, configurar variables de entorno, deploy.
3. Ejecutar migraciones de Prisma contra la base de Neon (`npx prisma migrate deploy`) una vez existan modelos.
4. En Vercel: nuevo proyecto apuntando a `frontend/`, configurar `VITE_API_URL` con la URL de Render, deploy.
5. Configurar dominio propio (opcional, ver Acta — costo aproximado de Q100/año) apuntando al proyecto de Vercel.

## Configuración de protección de ramas y CODEOWNERS en GitHub

El archivo [`.github/CODEOWNERS`](../.github/CODEOWNERS) ya asigna un revisor por defecto para todo el repositorio, por lo que **toda PR le será solicitada automáticamente para revisión**. Falta activar las reglas de protección de rama (esto se hace desde la configuración del repositorio, no desde archivos versionados):

### Opción A — Interfaz web
`Settings → Branches → Add branch ruleset` (o "Add rule" en la vista clásica) para `main` y `develop`:
- Require a pull request before merging
- Require approvals: 1
- Require review from Code Owners
- Require status checks to pass (seleccionar los workflows `CI Frontend` y `CI Backend`)
- Restrict who can push to matching branches (opcional, para bloquear push directo de todos menos el owner)

### Opción B — GitHub CLI (`gh`)

```bash
gh api repos/:owner/:repo/branches/main/protection \
  --method PUT \
  -f required_pull_request_reviews.required_approving_review_count=1 \
  -F required_pull_request_reviews.require_code_owner_reviews=true \
  -f enforce_admins=true \
  -F restrictions=null
```

Repetir cambiando `main` por `develop` si también se quiere proteger la rama de integración.

> Nota: estas reglas requieren permisos de administrador sobre el repositorio y deben configurarlas ustedes directamente (no se pueden aplicar solo con archivos versionados).
