# Guía de Workflow — Monorepo Qualibot CRM

**Fecha:** 2026-03-01
**Audiencia:** Desarrolladores y agentes IA que trabajan en este monorepo

---

## ¿Dónde hago los cambios de ahora en adelante?

### Respuesta corta

| Qué cambiar | Dónde hacerlo |
|-------------|---------------|
| Código React de Amaderarte | `QUALIBOT-CRM/apps/amaderarte/` |
| Código React de Flapz | `QUALIBOT-CRM/apps/flapz/` |
| Chrome Extension WA Bridge | `QUALIBOT-CRM/packages/wa-bridge/` |
| Componentes compartidos (Fase 3+) | `QUALIBOT-CRM/packages/crm-shell/` |
| Backend Apps Script (Amaderarte) | `AMADERARTE-CRM/backend/` (sigue ahí) |
| Backend Apps Script (Flapz) | `FLAPZ-CRM/backend/` (sigue ahí) |
| Documentación del monorepo | `QUALIBOT-CRM/docs/` (este repo) |
| Documentación específica Amaderarte | `AMADERARTE-CRM/docs/` |

### ¿Y los repos originales?

Los repos `AMADERARTE-CRM` y `FLAPZ-CRM` **no se eliminan**. Siguen siendo:
- El hogar del backend (Apps Script) de cada empresa
- El archivo histórico del proyecto (commits anteriores, contexto)
- El punto de retorno de emergencia si algo sale mal en el monorepo

A partir de ahora, **no hagas cambios de frontend en los repos originales**. El monorepo
es la fuente de verdad para todo el código React.

---

## Consideraciones para trabajar en el monorepo

### Instalación de paquetes

Siempre desde la raíz del monorepo, usando el filtro `--filter`:

```bash
# ✅ Correcto — instala recharts solo en Amaderarte
cd QUALIBOT-CRM/
pnpm add recharts --filter=amaderarte

# ✅ Correcto — instala en Flapz
pnpm add some-package --filter=flapz

# ✅ Correcto — instala en todos (devDependency global)
pnpm add -D typescript --workspace-root

# ❌ Incorrecto — no entres a la carpeta de la app para instalar
cd apps/amaderarte/ && npm install recharts
```

### Correr el servidor de desarrollo

```bash
# Desde la raíz QUALIBOT-CRM/
pnpm run dev:amaderarte    # → localhost:3000
pnpm run dev:flapz         # → localhost:3001

# Ambas a la vez (en terminales separadas o con un process manager)
pnpm run dev:amaderarte &
pnpm run dev:flapz
```

### Build de producción

```bash
# Desde la raíz QUALIBOT-CRM/
pnpm run build             # compila AMBAS apps (con caché Turborepo)
pnpm run build --filter=amaderarte   # solo Amaderarte
pnpm run build --filter=flapz        # solo Flapz
```

Turborepo recuerda qué cambió — si solo modificaste `apps/flapz/`, solo reconstruye Flapz.

### Deploy a Firebase

Este sí se hace **desde la carpeta de la app** (Firebase necesita leer el `.firebaserc` local):

```bash
# Amaderarte
cd QUALIBOT-CRM/apps/amaderarte/
firebase deploy

# Flapz
cd QUALIBOT-CRM/apps/flapz/
firebase deploy
```

O en un solo comando desde la raíz, si configurás el deploy script en el futuro.

### Variables de entorno

Cada app necesita su propio `.env.local` (no se commitea — está en `.gitignore`):

```
QUALIBOT-CRM/apps/amaderarte/.env.local  → GEMINI_API_KEY=...
QUALIBOT-CRM/apps/flapz/.env.local       → GEMINI_API_KEY=...
```

Si creás una nueva copia del repo (nueva máquina, nuevo colaborador), debes recrear
estos archivos manualmente.

---

## ¿Qué es la Fase 3 y cuándo estaré listo para trabajar "normal"?

**Ya puedes trabajar normal ahora mismo.** Las Fases 1 y 2 están completas.
Puedes editar código en `apps/amaderarte/` o `apps/flapz/`, hacer build y deploy.

La **Fase 3** es una mejora de organización interna, no un prerequisito funcional:

| Antes de Fase 3 | Después de Fase 3 |
|-----------------|-------------------|
| `KanbanBoard.tsx` existe duplicado en ambas apps | `KanbanBoard.tsx` existe UNA vez en `packages/crm-shell/` |
| Mejora al KanbanBoard = editar 2 archivos | Mejora al KanbanBoard = editar 1 archivo |
| Nuevo CRM = copiar toda la carpeta de componentes | Nuevo CRM = crear `apps/nuevo/` + importar de `crm-shell` |

La Fase 3 no cambia cómo funcionan las apps para el usuario final. Es inversión de tiempo
ahora para ahorrar tiempo en cada feature futura.

---

## Conceptos clave para alguien nuevo en monorepos

### ¿Qué es un monorepo?

Una sola carpeta git que contiene varios proyectos relacionados.
No es tecnología nueva — es solo una decisión de organización.

```
# Antes (multi-repo):
AMADERARTE-CRM/   ← repositorio independiente
FLAPZ-CRM/        ← repositorio independiente

# Ahora (monorepo):
QUALIBOT-CRM/
├── apps/amaderarte/   ← mismo código, mismo git
├── apps/flapz/        ← mismo código, mismo git
└── packages/wa-bridge/ ← compartido entre ambas
```

### ¿Qué hace pnpm workspaces?

Le dice a pnpm: "estos proyectos comparten dependencias". Resultado:
- Una sola carpeta `node_modules/` en la raíz (no una por proyecto)
- Si Amaderarte y Flapz usan React 19, se instala UNA vez, no dos

### ¿Qué hace Turborepo?

Orquesta los builds de forma inteligente:
- Si cambió solo `apps/flapz/`, no reconstruye `apps/amaderarte/`
- Guarda resultados en caché — el segundo `pnpm run build` tarda segundos, no minutos
- Corre builds en paralelo cuando es posible

### La analogía de la cocina

Antes tenías dos restaurantes (Amaderarte y Flapz) comprando ingredientes por separado
y cocinando todo desde cero. El monorepo es construir una cocina central (`crm-shell`)
que prepara las bases (componentes comunes), y cada restaurante solo agrega el toque
final de su menú (sus tipos de lead, su sheetsService).

---

## Estructura de documentación en este monorepo

```
QUALIBOT-CRM/docs/
├── README.md                          ← índice central
├── adr/                               ← decisiones arquitectónicas del monorepo
├── plans/                             ← planes de implementación multi-sesión
├── devlog/                            ← bugs y hallazgos de campo
├── prompts/                           ← prompts para agentes IA
└── guides/                            ← guías de workflow (este archivo)
```

Documentación específica de cada empresa sigue en su repo original:
- `AMADERARTE-CRM/docs/` — ADRs y DevLogs de Amaderarte
- `FLAPZ-CRM/docs/` (cuando se cree) — ADRs y DevLogs de Flapz

---

## Punto de retorno de emergencia

Si algo sale muy mal y necesitas volver al estado anterior a la migración:

```bash
# Ver el estado exacto pre-monorepo en AMADERARTE-CRM
cd AMADERARTE-CRM/
git checkout v-backup-previo-turbo-repo

# O crear una rama de trabajo desde ese punto
git checkout -b rollback/emergencia v-backup-previo-turbo-repo
```

El código de producción en `amaderartecrm.web.app` y `flapzcrm.web.app` sigue intacto
hasta que hagas un nuevo deploy desde el monorepo.
