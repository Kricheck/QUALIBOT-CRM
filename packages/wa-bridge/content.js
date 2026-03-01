// content.js — Inyectado en las páginas del CRM (localhost)
// Actúa como puente entre la página del CRM (window.postMessage)
// y el background service worker (chrome.runtime.sendMessage).

const EXTENSION_VERSION = '1.2.0';

function announceReady() {
  window.postMessage({
    source: 'amaderarte-extension',
    type: 'EXTENSION_READY',
    version: EXTENSION_VERSION,
  }, '*');
}

/**
 * Wrapper seguro para chrome.runtime.sendMessage.
 *
 * Cuando la extensión se recarga/actualiza, el contexto de este content script
 * queda invalidado: chrome.runtime pasa a ser undefined. Sin este guard, cualquier
 * intento de llamar a sendMessage lanza un TypeError que bloquea el envío de mensajes.
 *
 * Si el contexto está invalidado, notifica al CRM para que actualice el estado del
 * indicador de conexión y muestre "Recarga la página".
 */
function safeRuntimeSend(message, callback) {
  if (!chrome?.runtime?.sendMessage) {
    window.postMessage({
      source: 'amaderarte-extension',
      type: 'EXTENSION_CONTEXT_INVALIDATED',
    }, '*');
    return;
  }
  chrome.runtime.sendMessage(message, callback);
}

// --- Escuchar mensajes enviados por el CRM ---
window.addEventListener('message', (event) => {
  // Solo aceptar mensajes del mismo window (no iframes ni otros orígenes)
  if (event.source !== window) return;
  if (!event.data || event.data.source !== 'amaderarte-crm') return;

  const msg = event.data;

  // El CRM pregunta "¿estás ahí?" — responder inmediatamente
  if (msg.type === 'WA_PING') {
    announceReady();
    return;
  }

  if (msg.type === 'WA_NAVIGATE') {
    safeRuntimeSend(
      { type: 'WA_NAVIGATE', phone: msg.phone, message: msg.message, autoSend: msg.autoSend || false },
      (response) => {
        // Reenviar resultado al CRM
        window.postMessage({
          source: 'amaderarte-extension',
          type: 'WA_NAVIGATE_RESULT',
          success: response?.success ?? false,
          reason: response?.reason,
          action: response?.action,
        }, '*');
      }
    );
  }

  if (msg.type === 'WA_OPEN_HOME') {
    safeRuntimeSend(
      { type: 'WA_OPEN_HOME' },
      (response) => {
        window.postMessage({
          source: 'amaderarte-extension',
          type: 'WA_OPEN_HOME_RESULT',
          success: response?.success ?? false,
          action: response?.action,
        }, '*');
      }
    );
  }

  if (msg.type === 'WA_CHECK') {
    safeRuntimeSend(
      { type: 'WA_CHECK' },
      (response) => {
        window.postMessage({
          source: 'amaderarte-extension',
          type: 'WA_STATUS',
          waTabOpen: response?.waTabOpen ?? false,
          tabCount: response?.tabCount ?? 0,
        }, '*');
      }
    );
  }
});

// --- Anunciar presencia de la extensión al CRM ---
// Se anuncia varias veces para cubrir distintos momentos de inicialización de React.
setTimeout(announceReady, 500);
setTimeout(announceReady, 1500);
setTimeout(announceReady, 3000);
