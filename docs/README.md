# Documentación — Qualibot CRM Monorepo

Índice central de todos los registros técnicos del monorepo.
Para documentación específica de cada empresa, ver los repos originales.

---

## ADR — Architecture Decision Records

Decisiones estructurales que afectan al monorepo completo.

| # | Título | Estatus | Fecha |
|---|--------|---------|-------|
| [ADR-002](adr/002-monorepo-turborepo-crm-unification.md) | Monorepo Turborepo para unificación de CRMs | ✅ ACTIVO | 2026-03-01 |

---

## Planes de implementación

| # | Título | Estado | Fecha |
|---|--------|--------|-------|
| [PLAN-001](plans/001-monorepo-migration-plan.md) | Migración a monorepo Turborepo (Amaderarte + Flapz) | 🔄 En progreso (Fases 1-2 ✅) | 2026-03-01 |

---

## DevLog — Ingeniería de campo

Bugs y hallazgos relacionados con código que vive en este monorepo.

| # | Título | Componente | Fecha |
|---|--------|------------|-------|
| [DEV-001](devlog/001-chrome-extension-produccion-bug.md) | WA Bridge inoperante en producción | `packages/wa-bridge/` | 2026-02-27 |

---

## Guías de workflow

| Guía | Contenido |
|------|-----------|
| [workflow-monorepo](guides/workflow-monorepo.md) | Cómo trabajar en el monorepo: instalar paquetes, dev, build, deploy, conceptos |

---

## Prompts para agentes IA

| Prompt | Uso |
|--------|-----|
| [agent-onboarding-migration](prompts/agent-onboarding-migration.md) | Onboarding general para cualquier fase de la migración |
| [agent-onboarding-fase3-crm-shell](prompts/agent-onboarding-fase3-crm-shell.md) | Onboarding específico para la Fase 3 (extraer crm-shell) |
| [agent-session-update](prompts/agent-session-update.md) | Cierre de sesión — actualizar estado de documentación |

---

## Referencias cruzadas

La documentación específica de cada empresa está en sus repos originales:

| Repo | Documentación |
|------|--------------|
| `AMADERARTE-CRM/docs/` | ADRs y DevLogs específicos de Amaderarte |
| `AMADERARTE-CRM/.claude_session.md` | Estado actual de la sesión y tareas pendientes |
| `AMADERARTE-CRM/CLAUDE.md` | Guía de arquitectura general para agentes IA |

---

## Estructura del monorepo

```
QUALIBOT-CRM/
├── docs/                    ← este directorio
├── packages/
│   ├── wa-bridge/           ✅ Fase 1 — Chrome Extension MV3 v2.1.0
│   └── crm-shell/           ⬜ Fase 3 — componentes compartidos (pendiente)
└── apps/
    ├── amaderarte/          ✅ Fase 2 — CRM Amaderarte (puerto 3000)
    └── flapz/               ✅ Fase 2 — CRM Flapz (puerto 3001)
```
