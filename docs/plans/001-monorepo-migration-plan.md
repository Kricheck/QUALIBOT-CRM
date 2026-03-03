# Plan de Migración: Monorepo CRM Unificado

**Versión:** 1.1
**Fecha:** 2026-03-01
**Estado:** En progreso — Fases 1 y 2 completadas
**ADR de referencia:** [ADR-002](../adr/002-monorepo-turborepo-crm-unification.md)

---

> 📌 **MEMORIA VIVA**
> Este documento es el mapa de la migración. Actualizar el estado de cada fase y tarea al completarla.
> Si el plan cambia por hallazgos técnicos, documentar el cambio con fecha y motivo.

---

## Contexto

Dos CRMs comparten código base pero viven en repositorios/branches separados:
- `AMADERARTE-CRM` — muebles a medida, producción en `amaderartecrm.web.app`
- `FLAPZ-CRM` — vuelos privados, producción en dominio Firebase separado

El objetivo es un monorepo donde cambios al WA Bridge y componentes UI solo se escriben una vez.

---

## Estructura objetivo del monorepo

```
crm-monorepo/
├── package.json                    # workspace root (pnpm)
├── turbo.json                      # config Turborepo
├── .gitignore
│
├── packages/
│   ├── wa-bridge/                  # Chrome Extension MV3 compartida
│   │   ├── manifest.json           # content_scripts.matches incluye AMBAS URLs de prod
│   │   ├── background.js
│   │   ├── content.js
│   │   └── package.json
│   │
│   └── crm-shell/                  # Componentes + servicios compartidos
│       ├── src/
│       │   ├── types/
│       │   │   ├── base.ts         # BaseLead, CrmStatus, QualityIndicator
│       │   │   └── index.ts
│       │   ├── components/
│       │   │   ├── KanbanBoard.tsx
│       │   │   ├── LeadCard.tsx
│       │   │   ├── FilterBar.tsx
│       │   │   ├── LeadDetailModal.tsx
│       │   │   └── WhatsAppSelectionModal.tsx
│       │   ├── context/
│       │   │   └── LeadsContext.tsx  # Parameterizado con tipo genérico
│       │   └── services/
│       │       ├── whatsappWebService.ts
│       │       └── aiService.ts
│       ├── package.json
│       └── tsconfig.json
│
└── apps/
    ├── amaderarte/                 # Amaderarte CRM
    │   ├── src/
    │   │   ├── types.ts            # AmaderteLead extends BaseLead
    │   │   ├── services/
    │   │   │   └── sheetsService.ts  # Parseo específico de hojas Amaderarte
    │   │   ├── App.tsx
    │   │   └── main.tsx
    │   ├── public/
    │   ├── .firebaserc             # config Firebase amaderartecrm
    │   ├── firebase.json
    │   ├── vite.config.ts
    │   └── package.json
    │
    └── flapz/                      # Flapz CRM
        ├── src/
        │   ├── types.ts            # FlapzLead extends BaseLead
        │   ├── services/
        │   │   └── sheetsService.ts  # Parseo específico de hojas Flapz
        │   ├── App.tsx
        │   └── main.tsx
        ├── public/
        ├── .firebaserc             # config Firebase flapz
        ├── firebase.json
        ├── vite.config.ts
        └── package.json
```

---

## Fases de implementación

### Fase 1 — Extraer `wa-bridge` como package compartido
**Estado:** ✅ Completada — 2026-03-01
**Repo:** https://github.com/Kricheck/QUALIBOT-CRM — `packages/wa-bridge/`

**Objetivo:** Una sola carpeta de extensión que sirve a ambas apps. Al instalar en Chrome, el bridge funciona con ambas URLs de producción.

**Tareas:**

- [ ] **1.1** Crear repositorio `crm-monorepo` (o renombrar el existente)
- [ ] **1.2** Inicializar `pnpm` workspaces en raíz (`package.json` + `pnpm-workspace.yaml`)
- [ ] **1.3** Instalar Turborepo: `pnpm add -D turbo` + configurar `turbo.json`
- [ ] **1.4** Mover `AMADERARTE-CRM/chrome-extension/` → `packages/wa-bridge/`
- [ ] **1.5** En `packages/wa-bridge/manifest.json`: agregar URL de producción de Flapz a `content_scripts.matches`
- [ ] **1.6** Actualizar `MEMORY.md` en ambos proyectos con la nueva ubicación de la extensión
- [ ] **1.7** Verificar que la extensión instalada en modo developer sigue funcionando con ambas URLs
- [ ] **1.8** Documentar en `packages/wa-bridge/README.md` cómo instalar (apuntar a la carpeta del package)

**Criterios de aceptación:**
- Extension instalada desde `packages/wa-bridge/` inyecta `content.js` en `amaderartecrm.web.app`
- Extension inyecta `content.js` en la URL de producción de Flapz
- No se duplica código: una sola `background.js`, un solo `content.js`

---

### Fase 2 — Crear estructura Turborepo y mover apps
**Estado:** ✅ Completada — 2026-03-01
**Repo:** https://github.com/Kricheck/QUALIBOT-CRM — `apps/amaderarte/` y `apps/flapz/`

> ⚠️ Hallazgo 2026-03-01: Amaderarte usa estructura plana (`@/` → raíz de app), Flapz usa `src/`
> (`@/` → `src/`). Ambas compilan correctamente con sus configs originales. Puerto Flapz cambiado
> a 3001 para evitar conflicto con Amaderarte en dev.

**Objetivo:** Ambas apps viven en `apps/amaderarte/` y `apps/flapz/`. Cada una compila y despliega independientemente. El bridge en `packages/wa-bridge/` es referenciado desde ambas (aunque la extensión no se instala como npm package — sigue siendo instalación manual en Chrome).

**Tareas:**

- [ ] **2.1** Mover código de `AMADERARTE-CRM/` → `apps/amaderarte/` (preservar historial git con `git mv`)
- [ ] **2.2** Mover código de `FLAPZ-CRM/` → `apps/flapz/`
- [ ] **2.3** Configurar `package.json` individual por app con sus dependencias
- [ ] **2.4** Configurar `vite.config.ts` en cada app (path aliases `@/` → `src/`)
- [ ] **2.5** Configurar Firebase por app: `apps/amaderarte/.firebaserc`, `apps/flapz/.firebaserc`
- [ ] **2.6** Agregar scripts en raíz `turbo.json`:
  ```json
  {
    "pipeline": {
      "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
      "dev": { "cache": false, "persistent": true }
    }
  }
  ```
- [ ] **2.7** Verificar `pnpm run dev --filter=amaderarte` levanta correctamente en puerto 3000
- [ ] **2.8** Verificar `pnpm run build --filter=flapz` compila correctamente
- [ ] **2.9** Actualizar CI/CD (si existe) o instrucciones de deploy en `docs/`

**Criterios de aceptación:**
- `pnpm run dev --filter=amaderarte` → app funciona en localhost:3000
- `pnpm run dev --filter=flapz` → app funciona en localhost:3001 (o puerto configurado)
- `pnpm run build` en raíz compila ambas apps con Turborepo
- Deploy a Firebase funciona desde carpeta de cada app

---

### Fase 3 — Extraer `crm-shell` (componentes + servicios compartidos)
**Estado:** 🔄 En progreso — Fase 3a completada (2026-03-01)
**Estimación de esfuerzo:** 2-3 sesiones
**Prerequisito:** Fase 2 completada ✅

> ⚠️ **Hallazgo 2026-03-01 — Revisión de divergencia:** La mayoría de componentes UI divergen
> significativamente. El criterio de aceptación original ("solo 4 archivos por app") requeriría
> render props de alta complejidad. Se adopta estrategia en dos partes:
>
> - **Fase 3a ✅** (2026-03-01): `BaseLead` + `ErrorBoundary` compartidos — completada
> - **Fase 3b ⬜:** Componentes con render props — evaluar por componente en sesiones futuras
>
> | Componente | Divergencia | Estado |
> |---|---|---|
> | `ErrorBoundary` | Mínima | ✅ Extraído a crm-shell |
> | `whatsappWebService.ts` | Total (estrategias WA distintas) | ⬜ Mantener por app |
> | `KanbanBoard.tsx` | Estructural (columnas distintas) | ⬜ Fase 3b |
> | `LeadCard.tsx` | Alta (features exclusivos) | ⬜ Fase 3b |
> | `FilterBar.tsx` | Media (botones iguales en ambas apps ahora) | ⬜ Fase 3b |
> | `WhatsAppSelectionModal.tsx` | Media | ⬜ Fase 3b |
> | `PipelineView.tsx` | Alta (stages y columnas distintas por CRM) | ⬜ Mantener por app |
> | `PipelineConfigModal.tsx` | Baja (solo labels distintos) | ⬜ Candidato Fase 3b |
>
> ⚠️ **Hallazgo 2026-03-02 — Backends en monorepo:** `appscript.gs` de cada CRM ahora vive en
> `QUALIBOT-CRM/apps/{crm}/backend/`. Regla permanente: NO editar repos legacy. Los repos
> `AMADERARTE-CRM/` y `FLAPZ-CRM/` serán retirados del workspace. Ver MEMORY.md.

**Objetivo:** Componentes y servicios que son idénticos entre apps viven en `packages/crm-shell/`. Cada app importa desde ahí y solo contiene su divergencia real.

**Tareas:**

- [x] **3.1** Definir `BaseLead` en `packages/crm-shell/src/types/base.ts` ✅ 2026-03-01
  — Implementado con campos comunes reales (sin `customFields` — las apps tienen campos tipados)
- [x] **3.2** En `apps/amaderarte/types.ts`: `Lead extends BaseLead` ✅ 2026-03-01
- [x] **3.3** En `apps/flapz/src/types.ts`: `Lead extends BaseLead` ✅ 2026-03-01
- [x] **3.extra** Extraer `ErrorBoundary` a `packages/crm-shell/src/components/` ✅ 2026-03-01
  — Único componente verdaderamente idéntico. Ambas apps importan desde `@qualibot/crm-shell`.
- [ ] **3.4** Mover componentes compartidos a `packages/crm-shell/src/components/`
  — ⚠️ Requiere análisis de render props. Ver tabla de divergencia arriba. Reservado para Fase 3b.
  - `KanbanBoard.tsx` — columnas distintas por app
  - `LeadCard.tsx` — features muy distintos
  - `FilterBar.tsx` — vistas extra en Flapz
  - `LeadDetailModal.tsx` — pendiente comparación
  - `WhatsAppSelectionModal.tsx` — estrategias WA distintas
- [ ] **3.5** Parametrizar `LeadsContext` con genérico `<T extends BaseLead>`:
  ```typescript
  export function createLeadsContext<T extends BaseLead>(config: LeadsConfig<T>) { ... }
  ```
- [ ] **3.6** Mover `whatsappWebService.ts` y `aiService.ts` a `packages/crm-shell/src/services/`
- [ ] **3.7** Cada app crea su `LeadsProvider` usando el contexto genérico con su tipo específico
- [ ] **3.8** Cada app mantiene su `sheetsService.ts` propio (parseo de hojas diferente)
- [ ] **3.9** Configurar `packages/crm-shell/package.json` con `exports` para tree-shaking
- [ ] **3.10** Corregir imports en ambas apps post-refactor
- [ ] **3.11** Build completo de ambas apps sin errores TypeScript

**Criterios de aceptación:**
- `apps/amaderarte/src/` solo contiene: `types.ts`, `sheetsService.ts`, `App.tsx`, `main.tsx`
- `apps/flapz/src/` solo contiene: `types.ts`, `sheetsService.ts`, `App.tsx`, `main.tsx`
- Ambas apps funcionan igual que antes en dev y producción
- Un cambio en `packages/crm-shell/src/components/LeadCard.tsx` se refleja en ambas apps al rebuild

---

### Fase 4 — Mantenimiento continuo
**Estado:** ⬜ Continua (post Fase 3)

**Reglas para nuevas features:**

1. Si la feature es igual para todas las empresas → implementar en `packages/crm-shell/`
2. Si la feature tiene datos específicos de empresa → implementar en `customFields` de cada `Lead`
3. Si la feature es exclusiva de una empresa → implementar solo en `apps/[empresa]/`
4. Nuevos CRMs: crear `apps/nueva-empresa/` con `NuevaLead extends BaseLead` y su `sheetsService.ts`

---

## Decisiones técnicas clave

### ¿Por qué pnpm + Turborepo y no npm workspaces?
- pnpm maneja hoisting de dependencias más eficientemente (evita phantom dependencies)
- Turborepo agrega caché de build incremental: si solo cambió `apps/flapz/`, no rebuild de `apps/amaderarte/`
- Compatibilidad directa con Firebase deploy por app

### ¿Por qué `customFields` y no discriminated union?
- La alternativa union (`AmaderteLead | FlapzLead`) requiere type guards en todos los componentes compartidos
- `customFields: Record<string, string>` permite que `LeadDetailModal` renderice campos desconocidos sin cambios
- Los componentes específicos de cada empresa pueden leer `lead.customFields['aeronave']` directamente

### ¿La extensión Chrome se publica como npm package?
- **No.** La extensión se instala manualmente en Chrome (`chrome://extensions/`). No es un módulo importable.
- `packages/wa-bridge/` existe solo para tener el código en un lugar dentro del monorepo y referenciarla desde `docs/`.
- El manifest.json de la extensión incluye las URLs de producción de TODAS las apps del monorepo.

---

## Riesgos identificados

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Divergencia de versiones React/TS entre apps | Media | Pinear versiones en workspace root |
| Componentes compartidos con props específicas de empresa | Alta | Usar render props o slots para personalización |
| Historial git fragmentado al mover archivos | Media | Usar `git mv` + cherry-pick estratégico |
| sheetsService Flapz muy diferente al de Amaderarte | Alta | Mantener sheetsService local a cada app (ya está en el plan) |

---

## Referencias

- [ADR-002: Decisión Turborepo](../adr/002-monorepo-turborepo-crm-unification.md)
- [Turborepo docs](https://turbo.build/repo/docs)
- [pnpm workspaces](https://pnpm.io/workspaces)
- [DevLog-001: Bug producción extensión](../devlog/001-chrome-extension-produccion-bug.md) — para entender el problema que motivó la extracción del bridge

---

> 📌 MEMORIA VIVA: Actualizar el estado `⬜/🔄/✅` de cada fase al avanzar.
> Si una tarea genera un hallazgo técnico inesperado, crear un DevLog referenciado aquí.
