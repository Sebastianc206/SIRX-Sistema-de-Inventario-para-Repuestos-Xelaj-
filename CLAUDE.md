# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

SIRX is an inventory management web app for a Guatemalan auto-parts business (Repuestos Xelajú), built as an academic project under Scrum. Full context (data model rationale, user stories, security requirements, design tokens) lives in [CONTEXTO_SIRX.md](CONTEXTO_SIRX.md) — read it before making non-trivial changes to the data model or auth/role logic. Architecture decisions and deployment steps are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

**Note:** `CONTEXTO_SIRX.md` describes an earlier conceptual model (entities named `Repuesto`, `Movimiento`, `Usuario.rol` enum `admin`/`operador`). The actual implemented Prisma schema uses different names — see Architecture below. Trust the code/schema over that document for naming; trust it for the *why* (roles, sensitivity rules, business rules).

Two roles: `Administrador` (full access, including costs/margins/suppliers) and `Operador` (counter sales, no financial data). Role names are capitalized strings (`"Administrador"`, `"Operador"`), checked against `req.usuario.role` from the JWT — see `backend/src/middlewares/roleMiddleware.js`.

## Commands

Backend (`backend/`):
```bash
npm run dev              # start with nodemon
npm start                # start (production)
npm run lint             # eslint .
npm test                 # jest (all tests)
npx jest path/to/file.test.js        # single test file
npx jest -t "test name substring"    # single test by name
npm run prisma:generate  # regenerate Prisma client after schema changes
npm run prisma:migrate   # create + apply a dev migration
npm run prisma:seed      # required: roles, geography, admin/operador users
npm run prisma:seed:demo # optional: sample catalog data
```

Frontend (`frontend/`):
```bash
npm run dev      # vite dev server (port 5173)
npm run build    # tsc -b && vite build
npm run lint      # eslint .
npm test         # vitest run (all tests)
npx vitest run src/path/to/File.test.tsx   # single test file
npx vitest             # watch mode
```

Both `.env` files are copied from `.env.example` before first run. The backend **fails to start** if `JWT_SECRET` is under 32 chars or `JWT_EXPIRES_IN` is outside 1m–1h (fail-fast check in `app.js`), and `prisma:seed` fails without `ADMIN_PASSWORD`/`OPERADOR_PASSWORD` meeting the password policy (8+ chars, upper/lower/number/symbol).

CI (`.github/workflows/ci-backend.yml`, `ci-frontend.yml`) runs on PRs/pushes to `main`/`develop`, scoped by path (`backend/**` or `frontend/**`): `npm ci` → lint → (backend: `prisma generate`) → test → (frontend: build).

## Architecture

**Backend** — Node/Express, layered as routes → controllers → services → Prisma:
- `src/app.js` wires middleware order: HTTPS-forcing (`httpsMiddleware.js`, must run before CORS) → CORS (`CORS_ORIGIN` env) → JSON body parsing → routes mounted under `/api/*`.
- `src/middlewares/authMiddleware.js` verifies the JWT and attaches `req.usuario = { idColaborador, username, role }`.
- `src/middlewares/roleMiddleware.js` exports `authorize(...roles)`, used per-route to gate by role.
- **Sensitive-field filtering is done in services/controllers, never by hiding UI.** Pattern: a controller computes `ocultarDatosSensibles = req.usuario.role !== "Administrador"` and passes it into the service, which strips `precioCosto`/`idProveedor`/etc. before returning (see `articuloController.js` + `articuloService.js`). **Any new endpoint touching `Articulo`, the dashboard, or reports must apply this same filtering explicitly** — it's not automatic and is easy to forget (flagged as a known risk in CONTEXTO_SIRX.md §9).
- Each route file has a co-located `.test.js` (supertest + jest); services also have their own `.test.js`. Jest config (in `backend/package.json`) loads `test/setupEnv.js` before tests.

**Data model** (`backend/prisma/schema.prisma`) — table names are explicitly mapped via `@map`/`@@map` to lowercase snake_case to match a pre-existing Postgres schema (comments in the file explain this). Key entities and how they differ from the conceptual doc:
- `Colaborador` (person) has one `Usuario` (login credentials + `failedAttempts`/`lockedUntil` for lockout) and one or more `Plaza` (a role assignment with start/end dates, linking to `Rol`).
- `Articulo` (= "Repuesto" conceptually) holds `precioCosto`/`precioVenta`/`idProveedor` — cost and supplier are the sensitive fields hidden from `Operador`.
- `Inventario` is a **cached** current-stock table keyed by `sku`, kept in sync transactionally by purchase/sale flows — not derived on read.
- Two symmetric transactional flows instead of one generic "Movimiento" table: `CompraMaestro`/`CompraDetalle` (purchases, increase stock) and `SalidaMaestro`/`SalidaDetalle` (sales/outflows, decrease stock), each with a maestro/detalle (header/line) split.
- Geography (`Pais`/`Departamento`/`Municipio`) is shared reference data used by both `Proveedor` and `Cliente`.

**Frontend** — React + Vite + TS, path alias `@` → `frontend/src` (configured in `vite.config.ts` and `tsconfig.json`):
- `App.tsx` defines all routes; `ProtectedRoute` (`components/ProtectedRoute.tsx`) gates by auth and optionally by `roles={[...]}` — mirrors backend role checks but is a UX convenience, **not** the security boundary (the API is).
- `context/AuthContext.tsx` + `hooks/useAuth.ts` hold session state; `VITE_INACTIVITY_TIMEOUT_MINUTES` drives auto-logout on inactivity.
- One `*Service.ts` per resource under `src/services/` wraps `fetch` calls to the backend; one `*Page.tsx` per resource under `src/pages/`, with modals for create/edit forms (`*FormModal.tsx`).
- Design tokens (colors for the "pino" palette and stock-status badges) are documented in `CONTEXTO_SIRX.md` §8 — badge color must be derived from `stock_actual` vs `stock_minimo` per the mapping table there, not hardcoded per-component.

## Security requirements (apply to all new endpoints/forms)

These are enforced project-wide, not just where already implemented — see CONTEXTO_SIRX.md §7 for the full list. The ones most likely to be missed on new work:
- Every backend endpoint must independently check role via `authorize(...)` — never rely on the frontend hiding a button.
- Any new field/endpoint exposing `Articulo` data must decide explicitly whether `precioCosto`/`idProveedor` should be filtered for `Operador`.
- No raw SQL string concatenation — use Prisma.
- No stack traces or internal error messages returned to the client (see `manejarError` pattern in controllers).
