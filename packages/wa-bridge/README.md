# Qualibot WA Bridge — Chrome Extension MV3

Extensión privada que reutiliza la pestaña existente de WhatsApp Web para enviar mensajes desde cualquier CRM de Qualibot, sin abrir pestañas nuevas.

## Versión actual
`2.1.0`

## Apps soportadas

| CRM | URL de producción |
|-----|------------------|
| Amaderarte CRM | `https://amaderartecrm.web.app` |
| Flapz CRM | `https://flapzcrm.web.app` |
| Desarrollo local | `http://localhost:3000`, `5173`, `4173`, `8080` |

## Instalación en Chrome

1. Abrir `chrome://extensions/`
2. Activar **Modo desarrollador** (esquina superior derecha)
3. Clic en **"Cargar extensión sin empaquetar"**
4. Seleccionar **esta carpeta** (`packages/wa-bridge/`)
5. Verificar que aparece "Qualibot WA Bridge v2.1.0" en la lista

> Al reinstalar (cuando cambia `content_scripts.matches`), primero **eliminar** la versión anterior y luego cargar de nuevo. Un simple "Actualizar" no aplica los cambios de matches.

## Actualizar la extensión

Si se modifica `manifest.json`, `background.js` o `content.js`:
1. Ir a `chrome://extensions/`
2. Clic en el ícono de recarga de "Qualibot WA Bridge"
3. En el CRM: recargar la página (F5)

Si se modifica `content_scripts.matches` (URLs permitidas):
1. **Eliminar** la extensión y **cargar de nuevo** desde esta carpeta

## Agregar soporte para un nuevo CRM

1. Agregar la URL de producción en `manifest.json` → `content_scripts.matches`
2. Bump de versión minor (e.g. `2.1.0` → `2.2.0`)
3. Reinstalar en Chrome
4. Commit en este repo con el cambio

## Arquitectura

```
CRM (React) → window.postMessage → content.js → chrome.runtime → background.js → chrome.tabs → WA Web
```

- `content.js` — inyectado en las URLs del CRM; hace de puente entre la app web y background
- `background.js` — service worker; controla las pestañas de WA Web via Chrome Debugger Protocol (CDP)
- `popup.html/js` — interfaz del ícono de extensión en Chrome

Ver [docs/devlog/001-chrome-extension-produccion-bug.md](../../AMADERARTE-CRM/docs/devlog/001-chrome-extension-produccion-bug.md) para historial de bugs resueltos (hasta que la documentación se migre al monorepo).
