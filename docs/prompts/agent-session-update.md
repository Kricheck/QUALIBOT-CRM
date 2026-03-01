# Prompt: Actualización de documentos al cierre de sesión

> Usar este prompt al finalizar una sesión de trabajo en el monorepo CRM.
> Pegarlo en el chat del agente antes de cerrar la conversación.

---

## Prompt para el agente

```
Estamos terminando esta sesión de trabajo. Antes de cerrar, necesito que actualices
los documentos de estado del proyecto. Sigue este checklist en orden:

## 1. Plan de migración (`docs/plans/001-monorepo-migration-plan.md`)

Lee el archivo y actualiza el estado de cada tarea que se haya completado hoy:
- Cambia `⬜ Pendiente` → `✅ Completada` en las tareas finalizadas
- Cambia `⬜ Pendiente` → `🔄 En progreso` en tareas que empezamos pero no terminamos
- Si una tarea generó un hallazgo técnico importante, agrega una nota en línea:
  `> ⚠️ Hallazgo [fecha]: [descripción breve]. Ver DevLog-XXX para detalle.`

## 2. Sesión actual (`.claude_session.md` en la raíz)

Actualiza estas secciones:
- **Tareas completadas hoy:** lista con lo que se implementó
- **Archivos modificados (sin commit):** si hay cambios sin commitear, listarlos
- **Próximo paso concreto:** la siguiente tarea del plan que debe ejecutar el siguiente agente
- **Versiones activas:** si cambió alguna versión (manifest, backend, etc.), actualizarla

## 3. Nuevos DevLogs o ADRs (si aplica)

Si durante la sesión:
- Se resolvió un bug no obvio o que llevó más de 30 minutos → crear `docs/devlog/00N-nombre.md`
- Se tomó una decisión arquitectónica → crear `docs/adr/00N-nombre.md`
- Se cambió alguna version de manifest/backend → actualizar `MEMORY.md`

Si creaste nuevos archivos, agrégalos a `docs/README.md`.

## 4. Confirmación

Después de actualizar, dame un resumen de qué documentos modificaste y qué cambios hiciste.
Si hay algo que no puedes responder con certeza (por ejemplo, si una tarea quedó "completa"
o "en progreso"), pregúntame antes de escribir.
```

---

## Notas de uso

- Este prompt debe ejecutarse **con el contexto completo de la sesión activo** (antes de que se comprima)
- Si la sesión fue muy larga y el contexto ya se comprimió, leer `.claude_session.md` primero para reconstruir el estado
- El agente puede proponer generar commits de documentación después de actualizar los archivos
