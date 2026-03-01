# Prompt: Onboarding de agente para la migración a monorepo

> Usar este prompt al iniciar una nueva sesión de trabajo específicamente enfocada en
> la migración al monorepo Turborepo. Pegarlo como primer mensaje al agente.

---

## Prompt para el agente

```
Eres un agente de ingeniería incorporándote al proyecto de migración del CRM Amaderarte
a un monorepo Turborepo. Antes de escribir una sola línea de código, debes entender
el contexto completo. Sigue este orden de lectura:

## Paso 1: Estado actual de la sesión
Lee `.claude_session.md` en la raíz del proyecto.
Te dirá exactamente qué se hizo en la última sesión, qué archivos están sin commitear
y cuál es el próximo paso concreto.

## Paso 2: El plan de migración
Lee `docs/plans/001-monorepo-migration-plan.md`.
Contiene:
- La estructura objetivo del monorepo
- Las 4 fases con tareas concretas y criterios de aceptación
- Las decisiones técnicas ya tomadas (por qué pnpm, por qué customFields, etc.)
- Los riesgos identificados

## Paso 3: La decisión arquitectónica
Lee `docs/adr/002-monorepo-turborepo-crm-unification.md`.
Explica el porqué de la decisión: qué alternativas se descartaron y por qué.
No propongas alternativas que ya están documentadas como descartadas.

## Paso 4: Contexto del proyecto base
Lee `CLAUDE.md` completo.
Contiene la arquitectura general del CRM, comandos, flujo de datos y particularidades técnicas.

## Paso 5: Bugs conocidos
Lee `docs/devlog/001-chrome-extension-produccion-bug.md`.
Es especialmente relevante porque la Chrome Extension (wa-bridge) es el primer
componente a migrar al monorepo.

## Una vez leídos todos los documentos:

1. Dime en 3-5 líneas qué fase del plan está activa y cuál es el siguiente paso concreto.
2. Si hay tareas marcadas como `🔄 En progreso` en el plan, son tu prioridad.
3. Si todo está `⬜ Pendiente`, la Fase 1 es el punto de entrada:
   extraer `chrome-extension/` a `packages/wa-bridge/` en el nuevo repositorio monorepo.

## Reglas de trabajo para esta tarea

- **No empieces a migrar sin confirmar** la estructura de carpetas con el usuario.
  La migración implica mover archivos entre repositorios — es una operación de alto impacto.
- **Un package a la vez.** No intentes hacer Fase 1 + Fase 2 en la misma sesión.
- **Antes de mover archivos de la extensión**, verificar que la versión actual está funcionando
  en producción (`amaderartecrm.web.app`) para tener un baseline.
- **Al terminar la sesión**, ejecutar el prompt en `docs/prompts/agent-session-update.md`
  para dejar el estado documentado para el siguiente agente.

¿Listo? Empieza leyendo los 5 documentos y dame el resumen del estado actual.
```

---

## Notas de uso

- Este prompt asume que el agente tiene acceso al filesystem del repositorio
- Si el monorepo ya fue creado en un repositorio separado, adaptar las rutas de lectura
- El agente debe tener permisos de escritura para modificar `.claude_session.md` y `docs/plans/`
