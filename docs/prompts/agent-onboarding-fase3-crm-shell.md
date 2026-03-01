# Prompt: Onboarding Fase 3 — Extraer `packages/crm-shell/`

> Prompt específico para el agente que implementará la Fase 3 del monorepo.
> Las Fases 1 y 2 ya están completas. Este agente debe extraer los componentes
> y servicios compartidos a un package reutilizable.

---

## Prompt para el agente

```
Eres un agente de ingeniería incorporándote a la Fase 3 de la migración del monorepo
Qualibot CRM. Las Fases 1 y 2 ya están completadas por otro agente. Tu misión es
extraer los componentes y servicios compartidos a `packages/crm-shell/`.

---

## PASO 1 — Lee estos 4 documentos antes de escribir una sola línea de código

1. `.claude_session.md` en `AMADERARTE-CRM/` — estado detallado de qué se hizo y qué sigue
2. `docs/plans/001-monorepo-migration-plan.md` — tareas 3.1 a 3.11 con criterios de aceptación
3. `docs/adr/002-monorepo-turborepo-crm-unification.md` — por qué `BaseLead + customFields` y no union types
4. `CLAUDE.md` — arquitectura general del proyecto

---

## PASO 2 — Entiende la estructura actual del monorepo

El monorepo vive en `QUALIBOT-CRM/` (también en el workspace de VS Code):

```
QUALIBOT-CRM/
├── packages/wa-bridge/       ← extensión Chrome (Fase 1 ✅)
├── apps/amaderarte/          ← CRM Amaderarte (Fase 2 ✅)
│   ├── App.tsx, types.ts, index.tsx   (estructura PLANA, sin src/)
│   ├── components/, context/, services/
│   └── vite.config.ts        (@/ → raíz de apps/amaderarte/)
└── apps/flapz/               ← CRM Flapz (Fase 2 ✅)
    ├── src/
    │   ├── App.tsx, types.ts
    │   ├── components/, context/, services/
    └── vite.config.ts        (@/ → apps/flapz/src/)
```

**CRÍTICO:** Amaderarte tiene estructura PLANA (sin src/). Flapz tiene carpeta src/.
Esto afecta cómo los componentes importan entre sí y cómo funcionará crm-shell.

---

## PASO 3 — Diferencias clave antes de definir BaseLead

| Campo | Amaderarte | Flapz | ¿Compartido? |
|-------|-----------|-------|-------------|
| id, nombre, apellido, correo, whatsapp | ✅ | ✅ | ✅ Sí |
| origen, valor, indicadorCalidad, fecha | ✅ | ✅ | ✅ Sí |
| crmStatus | ✅ (valores distintos) | ✅ (valores distintos) | ⚠️ Tipo base sí, enum no |
| isFavorite, source, campana, createdAt | ✅ | ✅ | ✅ Sí |
| isInteraction, interactionType | ✅ | — | ⚠️ Solo Amaderarte |
| destino, hasCoverage, linkMaps | ✅ | — | ❌ Solo Amaderarte → customFields |
| aeronave | ✅ (producto/fachada) | ✅ (aeronave real) | ❌ Semántica diferente → customFields |
| fechaRegreso, emailOpened | — | ✅ | ❌ Solo Flapz → customFields |
| cargo, compania (Apollo) | — | ✅ | ❌ Solo Flapz → customFields |
| nurturingStatus, fechaSeg1/2/3 | — | ✅ | ❌ Solo Flapz → customFields |

**Regla:** todo lo que NO está en ambas apps va a `customFields: Record<string, string>`.

---

## PASO 4 — Orden de trabajo recomendado (de menor a mayor riesgo)

1. **Crear `packages/crm-shell/`** con `package.json` y `tsconfig.json`
2. **Definir `BaseLead`** en `packages/crm-shell/src/types/base.ts` (tarea plan 3.1)
3. **Extender en cada app:** `AmaderteLead extends BaseLead` y `FlapzLead extends BaseLead` (tareas 3.2–3.3)
4. **Extraer `whatsappWebService.ts`** — es el servicio más idéntico entre ambas apps
   (comparar ambas versiones línea por línea antes de mover)
5. **Extraer componentes** en este orden (menor a mayor riesgo):
   - `ErrorBoundary` (sin props de negocio, trivial)
   - `WhatsAppStatusIndicator` (solo lectura de estado WA)
   - `FilterBar` (verificar si los filtros difieren entre apps)
   - `LeadCard` (verificar campos que renderiza)
   - `KanbanBoard` (depende de LeadCard)
   - `LeadDetailModal` (más acoplado a tipos específicos)
   - `WhatsAppSelectionModal` (más complejo)
6. **Parametrizar `LeadsContext`** con genérico `<T extends BaseLead>` (tarea 3.5)
7. **Actualizar imports** en ambas apps a `@qualibot/crm-shell`

---

## PASO 5 — Reglas de trabajo para esta fase

- **Antes de mover un componente**: comparar el archivo en Amaderarte
  (`apps/amaderarte/components/Foo.tsx`) vs Flapz (`apps/flapz/src/components/Foo.tsx`)
  para confirmar que son idénticos o entender las diferencias
- **Si un componente diverge**: diseñar la API con render props o `children` antes de mover
- **Un componente a la vez**: no mover todo en un batch, verificar que el build pasa después de cada extracción
- **Verificar build después de cada extracción**: `pnpm run build` desde QUALIBOT-CRM raíz
- **Criterio de aceptación final** (tarea 3.11):
  - `apps/amaderarte/src/` solo contiene: `types.ts`, `sheetsService.ts`, `App.tsx`, `main.tsx`
  - `apps/flapz/src/` solo contiene: `types.ts`, `sheetsService.ts`, `App.tsx`, `main.tsx`
  - Ambas apps funcionan igual que antes en dev y build
- **Al terminar la sesión**: ejecutar el prompt en `docs/prompts/agent-session-update.md`

---

## PASO 6 — Dato técnico importante sobre las diferencias estructurales

Amaderarte NO tiene carpeta `src/` — los archivos están directamente en `apps/amaderarte/`.
Cuando extraigas componentes a `crm-shell`, los imports en Amaderarte cambiarán de:
  `import { KanbanBoard } from '@/components/KanbanBoard'`
a:
  `import { KanbanBoard } from '@qualibot/crm-shell'`

Para Flapz, que sí tiene `src/`, los imports cambiarán de:
  `import { KanbanBoard } from '@/components/KanbanBoard'`
a:
  `import { KanbanBoard } from '@qualibot/crm-shell'`

Ambos casos usan el mismo import final — la diferencia de estructura se abstrae.

---

## ¿Listo? Confirma que leíste los 4 documentos del Paso 1 y dame:
1. Resumen de qué dice cada documento (2 líneas por documento)
2. Tu propuesta de `BaseLead` con los campos compartidos identificados
3. Tu propuesta de estructura de `packages/crm-shell/package.json`
4. Primer componente que vas a extraer y por qué lo elegiste
```

---

## Notas de uso

- Usar este prompt al inicio de la sesión de Fase 3, como primer mensaje al agente
- El agente debe tener acceso de lectura/escritura al directorio `QUALIBOT-CRM/`
- Si el workspace de VS Code ya tiene `QUALIBOT-CRM` agregado, el agente puede leer ambos proyectos
