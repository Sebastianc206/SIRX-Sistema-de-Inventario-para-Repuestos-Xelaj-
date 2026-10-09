<p align="center"><img src="docs/brand/logo-rx.png" alt="SIRX · Repuestos Xelajú" width="180"></p>

# SIRX — Sistema de Inventario para Repuestos Xelajú

Aplicación web para que **Repuestos Xelajú** controle su inventario de repuestos automotrices, registre ventas y obtenga información oportuna para decisiones de reabastecimiento, sustituyendo el control manual en papel.

> Proyecto académico desarrollado bajo metodología Scrum. Ver [Acta de Constitución](docs/ARCHITECTURE.md) para el detalle completo del alcance.

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React + Vite + TypeScript |
| Backend | Node.js + Express (JavaScript) |
| Base de datos | PostgreSQL + Prisma ORM |
| Hosting Frontend | Vercel |
| Hosting Backend | Render |
| Base de datos gestionada | Neon (PostgreSQL serverless, capa gratuita) |
| Control de versiones | GitHub (branches `main` / `develop` + feature branches) |

Ver el detalle de decisiones de arquitectura en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) y la guía de despliegue en [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Estructura del repositorio

```
SIRX/
├── frontend/     # SPA en React + Vite + TypeScript
├── backend/      # API REST en Node.js + Express + Prisma
├── docs/         # Arquitectura, despliegue y documentación técnica
└── .github/      # CI, plantillas de PR/Issues y CODEOWNERS
```

## Puesta en marcha (desarrollo local)

Requisitos: Node.js 20+, npm, una base de datos PostgreSQL (local o Neon).

```bash
# Backend
cd backend
cp .env.example .env          # completar DATABASE_URL, JWT_SECRET, ADMIN_PASSWORD, OPERADOR_PASSWORD
npm install
npx prisma migrate deploy     # crea las tablas
npm run prisma:seed           # obligatorio: roles, usuarios (admin/operador) y geografía de referencia
npm run prisma:seed:demo      # opcional: catálogo de ejemplo (categorías, marcas, repuestos, proveedores) para probar
npm run dev

# Frontend (en otra terminal)
cd frontend
cp .env.example .env
npm install
npm run dev
```

## Flujo de trabajo (branches y PRs)

Ver [CONTRIBUTING.md](CONTRIBUTING.md) para la estrategia de ramas, convención de commits y el proceso de Pull Requests.

## Equipo

| Nombre | Rol |
|---|---|
| Daniel Alvarado | Scrum Master |
| Saúl Ovalle | Product Owner |
| Diego Cosillo | Developer (Frontend) |
| Sebastián Cuevas | Developer (Backend) |

Cliente: **Repuestos Xelajú** (Ronald Ovalle).
