# Guía de contribución — SIRX

## Estrategia de ramas

Se usa un flujo simplificado (GitHub Flow + rama de integración), pensado para un equipo pequeño con dedicación parcial:

- **`main`** — Rama protegida. Siempre refleja lo que está (o va a estar) en producción. Solo recibe cambios vía Pull Request aprobada, nunca push directo.
- **`develop`** — Rama de integración. Rama por defecto para el trabajo diario del sprint. Al cierre de cada sprint/hito, `develop` se fusiona a `main` para desplegar.
- **`feature/<nombre-corto>`** — Una rama por historia de usuario o tarea. Sale de `develop` y se fusiona a `develop` vía PR.
- **`fix/<nombre-corto>`** — Corrección de errores. Sale de `develop` (o de `main` si es un hotfix urgente en producción).

Ejemplos: `feature/catalogo-productos`, `feature/alertas-stock-minimo`, `fix/calculo-existencias`.

## Convención de commits

Se recomienda [Conventional Commits](https://www.conventionalcommits.org/) para mantener un historial legible:

```
feat: agregar formulario de alta de producto
fix: corregir cálculo de stock tras una venta
docs: actualizar guía de despliegue
chore: configurar linter en backend
```

## Proceso de Pull Request

1. Crear la rama desde `develop` con el prefijo correspondiente (`feature/...`, `fix/...`).
2. Abrir la PR hacia `develop` (o hacia `main` solo para el merge de cierre de sprint) usando la plantilla de `.github/PULL_REQUEST_TEMPLATE.md`.
3. El archivo `.github/CODEOWNERS` asigna automáticamente al revisor responsable — la PR le llegará para su aprobación.
4. Los checks de CI (`.github/workflows/`) deben pasar en verde antes de poder fusionar.
5. Se requiere al menos 1 aprobación antes de hacer merge. Usar "Squash and merge" para mantener el historial de `develop`/`main` limpio.

## Reglas de protección de rama recomendadas (configurar en GitHub → Settings → Branches)

Para `main` y `develop`:

- ✅ Require a pull request before merging
- ✅ Require approvals (mínimo 1)
- ✅ Require review from Code Owners
- ✅ Require status checks to pass before merging (seleccionar los workflows de CI)
- ✅ Do not allow bypassing the above settings (incluso para administradores, si se desea máxima disciplina)
- 🚫 No permitir force-push ni borrado de estas ramas

Ver [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) para los comandos exactos (`gh` CLI) o los pasos por interfaz web.
