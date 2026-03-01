# DevLog-001: WA Bridge inoperante en producción — content_scripts.matches

**Fecha:** 2026-02-27
**Tipo:** Bug crítico — regresión de producción
**Componente:** Chrome Extension (`chrome-extension/manifest.json`)
**Versión afectada:** manifest 2.0.0, 2.0.1
**Versión del fix:** manifest 2.0.2

---

> 📌 **MEMORIA VIVA**
> Los hallazgos aquí registrados son lecciones para el equipo. Si la solución descrita deja de ser válida por una actualización del entorno (nuevo dominio, nueva versión de Chrome, cambio en la API de extensiones MV3), añade una nota al final con la fecha del cambio y lo que ya no aplica.

---

## Desafío del día

Tras el primer deploy del CRM a Firebase Hosting (`https://amaderartecrm.web.app`), el **WA Bridge dejó de funcionar completamente en producción**.

Síntomas observados:
- El indicador mostraba **"WA Web"** en lugar de **"WA Bridge"** al cargar la app
- Cada envío de plantilla de WhatsApp **abría una nueva ventana** de WA Web (comportamiento de fallback), en lugar de navegar la pestaña existente
- En localhost (`localhost:3000`) todo funcionaba con normalidad

## Diagnóstico

### Pista 1 — Logs del DebugLogger
```
[INFO] [WA] WA_PING enviado — esperando EXTENSION_READY   ← se repite 3 veces
[INFO] [WA] WA_PING enviado — esperando EXTENSION_READY
[INFO] [WA] WA_PING enviado — esperando EXTENSION_READY
← nunca aparece SUCCESS [WA] Extensión de Chrome detectada
```

En desarrollo el log mostraba inmediatamente:
```
[SUCCESS] [WA] Extensión de Chrome detectada (v1.2.0)
```

### Pista 2 — Screenshot de permisos en chrome://extensions/
Al inspeccionar los permisos de la extensión, la lista de URLs en `content_scripts` era:
```
http://localhost:3000/*
http://localhost:4173/*
http://localhost:5173/*
http://localhost:8080/*
https://amadertecrm.web.app/*   ← URL INCORRECTA (typo)
```

### Causa raíz A — URL de producción ausente del manifest
El `manifest.json` tenía en `content_scripts.matches` solo URLs de localhost. Al hacer el deploy a Firebase, nunca se agregó `https://amaderartecrm.web.app/*`. Chrome **no inyecta `content.js`** en páginas que no están en `matches`, por lo tanto:

```
CRM en producción → window.postMessage(WA_PING) → nadie escucha → extensión no detectada → fallback
```

### Causa raíz B — Typo en la URL
Al agregar la URL de producción (fix inicial), se escribió `amadertecrm` en lugar de `amaderartecrm` (falta la segunda `a`):

| Incorrecto | Correcto |
|-----------|---------|
| `https://amadertecrm.web.app/*` | `https://amaderartecrm.web.app/*` |

Este typo pasó desapercibido hasta que el usuario comparó visualmente la URL en el panel de permisos de Chrome.

## Solución aplicada

1. Corregir `content_scripts.matches` en `manifest.json`:

```json
"content_scripts": [
  {
    "matches": [
      "http://localhost:3000/*",
      "http://localhost:5173/*",
      "http://localhost:4173/*",
      "http://localhost:8080/*",
      "https://amaderartecrm.web.app/*"
    ],
    "js": ["content.js"],
    "run_at": "document_start"
  }
]
```

2. Subir la versión del manifest a `2.0.2` para poder verificar que Chrome cargó la versión correcta.

3. **Re-instalar la extensión** (quitar + cargar sin empaquetar) — Chrome no siempre aplica cambios en `matches` con solo recargar la extensión.

## Lección aprendida

### L1 — checklist de deploy para extensiones Chrome
Cada vez que se cambia el dominio de la app (nuevo deploy, nuevo ambiente, nueva URL), verificar:
- [ ] `chrome-extension/manifest.json` → `content_scripts.matches` incluye la nueva URL exacta
- [ ] La URL está escrita sin typos (compararla carácter a carácter con la barra del navegador)
- [ ] La versión del manifest fue incrementada (para poder verificar cuál está cargada)
- [ ] La extensión fue **re-instalada** (no solo recargada) si se cambiaron los `matches`

### L2 — El panel de permisos de Chrome es tu aliado
`chrome://extensions/` → detalle de la extensión → "Ver permisos" muestra exactamente qué URLs tiene registradas la extensión en tiempo de ejecución. Es el lugar definitivo para verificar si un cambio en `matches` tomó efecto.

### L3 — Señal de diagnóstico rápido
Si el DebugLogger muestra `WA_PING enviado` 3 veces sin respuesta `EXTENSION_READY`, el `content.js` no está siendo inyectado en esa página. Causas posibles (en orden de probabilidad):
1. La URL no está en `content_scripts.matches`
2. Typo en la URL de `matches`
3. La extensión no fue re-instalada después del cambio en `matches`
4. La pestaña del CRM no fue recargada después de re-instalar la extensión

## Archivos afectados
- [`chrome-extension/manifest.json`](../../chrome-extension/manifest.json) — fix principal (matches + versión)
