# ADR-002: Monorepo Turborepo para unificación de CRMs

**Estatus:** Propuesto
**Fecha:** 2026-03-01
**Superado por:** (vacío — activo)

---

## Contexto

Existen dos CRMs desarrollados sobre la misma base de código (branch compartida de origen):
- **Amaderarte CRM** — gestión de leads para empresa de muebles a medida. Producción: `amaderartecrm.web.app`
- **Flapz CRM** — gestión de leads para operadora de vuelos privados. Producción: dominio Firebase separado.

Ambos comparten:
- Arquitectura idéntica: React 19 + TypeScript + Vite + Tailwind CDN
- Chrome Extension WA Bridge (MV3) para envío de mensajes desde WA Web
- Componentes de UI: KanbanBoard, LeadCard, FilterBar, LeadDetailModal
- Servicios: `sheetsService.ts` (normalización), `whatsappWebService.ts` (singleton WA Bridge)
- Backend: Google Apps Script + Google Sheets (estructuras de hojas diferentes por empresa)

Divergen en:
- Campos de lead: Amaderarte tiene `aeronave` (producto/fachada); Flapz tiene datos de vuelo (origen, destino, aeronave real, pasajeros)
- Lógica de negocio específica: Amaderarte maneja `hasCoverage` (1 mueble), Flapz maneja rutas
- Hojas de cálculo completamente diferentes en Google Sheets

**Problema actual:** Cualquier mejora al WA Bridge o a la UI compartida debe aplicarse manualmente en ambos repositorios. Ya ha ocurrido que la extensión queda desincronizada entre proyectos. La deuda técnica crece por duplicación.

---

## Decisión

Migrar ambos CRMs a un **monorepo con Turborepo** con la siguiente estructura:

```
crm-monorepo/
├── packages/
│   ├── wa-bridge/          # Chrome Extension MV3 compartida
│   └── crm-shell/          # Componentes y servicios compartidos
├── apps/
│   ├── amaderarte/         # Config, types y sheetsService Amaderarte
│   └── flapz/              # Config, types y sheetsService Flapz
├── turbo.json
└── package.json (workspace root)
```

### Contrato de datos: `BaseLead` + `customFields`

```typescript
// packages/crm-shell/src/types/base.ts
export interface BaseLead {
  id: string;
  nombre: string;
  apellido: string;
  correo: string;
  whatsapp: string;
  origen: string;
  valor: string;
  indicadorCalidad: QualityIndicator | string;
  fecha: string;
  crmStatus: CrmStatus | string;
  isFavorite?: boolean;
  source: string;
  campana: string;
  createdAt?: string;
  isInteraction?: boolean;
  interactionType?: InteractionType | string;
  // Campos específicos por empresa
  customFields: Record<string, string>;
}
```

Cada app define su propia extensión:
```typescript
// apps/amaderarte/src/types.ts
export interface AmaderteLead extends BaseLead {
  aeronave: string;       // Producto / Fachada
  destino: string;        // Dirección / Detalles
  hasCoverage?: boolean;
  linkMaps?: string;
}

// apps/flapz/src/types.ts
export interface FlapzLead extends BaseLead {
  origenVuelo: string;
  destinoVuelo: string;
  aeronaveReal: string;
  pasajeros: string;
  fechaRegreso?: string;
}
```

---

## Alternativas consideradas

- **A. Copiar-pegar manual (status quo)** — Los cambios se sincronizan manualmente entre repositorios separados. Descartado: ya demostró ser insostenible; el WA Bridge quedó desincronizado en la primera versión de producción.

- **B. Git submodules para wa-bridge** — El directorio `chrome-extension/` sería un submodule compartido. Descartado: la experiencia de desarrollo con submodules es compleja (doble commit, doble push, referencias de hash). Turborepo es más ergonómico.

- **C. npm package privado para crm-shell** — Publicar los componentes compartidos como paquete npm privado. Descartado: requiere registry privado (costo) o npm link (frágil en dev). Monorepo evita este overhead.

- **D. Turborepo monorepo (elegida)** — Workspace único con packages locales. Cambios al bridge se aplican a ambas apps al mismo tiempo. Desarrollo local sin publishing. Deploy independiente por app.

---

## Fases de migración

| Fase | Contenido | Resultado |
|------|-----------|-----------|
| 1 | Extraer `wa-bridge` como package | Una extensión sirve a ambos CRMs |
| 2 | Crear estructura Turborepo, mover apps | Monorepo funcional con apps independientes |
| 3 | Extraer `crm-shell` (componentes + servicios) | UI compartida, divergencia solo en datos |
| 4 | Continua | Nuevas features se desarrollan una sola vez |

Ver plan detallado en [`docs/plans/001-monorepo-migration-plan.md`](../plans/001-monorepo-migration-plan.md).

---

## Consecuencias

- ✅ Un solo cambio al WA Bridge aplica a ambas empresas simultáneamente
- ✅ Mejoras de UI (LeadCard, KanbanBoard) disponibles para todos los CRMs
- ✅ Onboarding de nuevos CRMs: solo crear `apps/nueva-empresa/`
- ✅ CI/CD con Turborepo detecta qué apps necesitan rebuild/redeploy (incremental)
- ⚠️ Migración requiere refactorizar types para separar `BaseLead` de campos específicos
- ⚠️ Requiere alinear versiones de React, TypeScript y dependencias entre apps
- ⚠️ Cada app sigue teniendo su propio Firebase deploy — no hay deploy único
- ⚠️ La Chrome Extension sigue siendo una sola instalación manual (no cambia el flujo de instalación)

---

> ⚠️ IMPORTANTE: Este ADR refleja una decisión estructural. Si Turborepo es reemplazado
> por otra herramienta (nx, pnpm workspaces puro, etc.) o el enfoque cambia, marcar estatus como
> "Superado", indicar el ADR sucesor y NO borrar este archivo.
