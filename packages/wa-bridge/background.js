// background.js — Service Worker de la extensión v2.0.0
// Recibe comandos del content script (que los retransmite desde el CRM)
// y manipula las pestañas del navegador.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === 'WA_NAVIGATE') {
    navigateWhatsApp(message.phone, message.message, message.autoSend || false)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, reason: err.message }));
    return true;
  }

  if (message.type === 'WA_OPEN_HOME') {
    openWhatsAppHome()
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, reason: err.message }));
    return true;
  }

  if (message.type === 'WA_CHECK') {
    chrome.tabs.query({ url: 'https://web.whatsapp.com/*' }, (tabs) => {
      sendResponse({ waTabOpen: tabs.length > 0, tabCount: tabs.length });
    });
    return true;
  }

});

// ---------------------------------------------------------------------------
// Navegación al chat (Ctrl+Alt+N para todos los casos)
// ---------------------------------------------------------------------------

/**
 * Estrategia de navegación:
 *
 * 1. new_chat_shortcut (sin reload, preferido):
 *    - Ctrl+Alt+N → abre el diálogo "Nuevo chat" de WA Web
 *    - CDP escribe el número char por char (isTrusted:true)
 *    - Enter → WA abre la conversación (existente o nueva, funciona en todos los casos)
 *    - Inyecta el mensaje; si autoSend=true, envía con Enter via CDP
 *
 * 2. url_fallback (con reload, solo si Ctrl+Alt+N falla):
 *    - Navega por URL: /send?phone=X&text=Y
 *
 * 3. created_new (no hay pestaña de WA abierta):
 *    - Abre una nueva pestaña con /send?phone=X&text=Y
 */
async function navigateWhatsApp(phone, message, autoSend = false) {
  const cleanPhone = phone.replace(/\D/g, '');
  const fallbackUrl = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;

  const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });

  if (tabs.length > 0) {
    const tab = tabs[0];

    // Traer la ventana al frente
    await chrome.windows.update(tab.windowId, { focused: true });
    await chrome.tabs.update(tab.id, { active: true });

    // Abrir chat con Ctrl+Alt+N (funciona para contactos nuevos y con historial)
    const newChatResult = await cdpOpenNewChat(tab.id, cleanPhone);
    if (newChatResult?.success) {
      await sleep(2500);
      try {
        await injectMessageWithLineBreaks(tab.id, message);
        if (autoSend) {
          await cdpSendMessage(tab.id);
        }
      } catch (_) {
        // No crítico: el usuario puede escribir el mensaje manualmente
      }
      return { success: true, action: 'new_chat_shortcut' };
    }

    // Ctrl+Alt+N no disponible → URL fallback como último recurso
    console.warn('[WA Bridge] cdpOpenNewChat falló → URL fallback');
    await chrome.tabs.update(tab.id, { url: fallbackUrl });
    return { success: true, action: 'url_fallback' };

  } else {
    // No hay ningún tab de WA Web abierto → abrir uno nuevo
    await chrome.tabs.create({ url: fallbackUrl, active: true });
    return { success: true, action: 'created_new' };
  }
}

// ---------------------------------------------------------------------------
// Funciones CDP
// ---------------------------------------------------------------------------

/**
 * Abre un chat en WA Web sin recargar la sesión, usando el atajo Ctrl+Alt+N.
 *
 * Flujo:
 *   1. Ctrl+Alt+N → WA abre el diálogo "Nuevo chat" y enfoca su campo de búsqueda.
 *   2. CDP escribe el número char por char (isTrusted:true, activa la búsqueda).
 *   3. sleep(500ms) para que WA muestre la sugerencia del número.
 *   4. Enter → WA abre la conversación (existente o nueva).
 *
 * Funciona para todos los casos: primer mensaje, historial existente, contacto guardado.
 *
 * Modifiers CDP: Ctrl=2, Alt=1, Ctrl+Alt=3.
 * Bug CDP: 'text' solo en el evento 'char', NUNCA en keyDown/keyUp
 * (si se incluye en keyDown, cada carácter se inserta dos veces).
 */
async function cdpOpenNewChat(tabId, phone) {
  await chrome.debugger.attach({ tabId }, '1.3');
  try {
    // Paso 1: Ctrl+Alt+N → abrir diálogo "Nuevo chat"
    await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', {
      type: 'keyDown', key: 'n', code: 'KeyN',
      windowsVirtualKeyCode: 78, nativeVirtualKeyCode: 78, modifiers: 3,
    });
    await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', {
      type: 'keyUp', key: 'n', code: 'KeyN',
      windowsVirtualKeyCode: 78, nativeVirtualKeyCode: 78, modifiers: 3,
    });
    await sleep(800); // Esperar a que el diálogo abra y enfoque su input

    // Paso 2: Escribir el número char por char (isTrusted:true via CDP)
    for (const char of phone) {
      const kc = char.charCodeAt(0);
      const keyBase = { key: char, windowsVirtualKeyCode: kc, nativeVirtualKeyCode: kc, modifiers: 0 };
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', { ...keyBase, type: 'keyDown' });
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', { ...keyBase, type: 'char', text: char, unmodifiedText: char });
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', { ...keyBase, type: 'keyUp' });
      await sleep(50);
    }
    await sleep(500); // Esperar a que WA muestre la sugerencia del número

    // Paso 3: Enter → abrir la conversación
    await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', {
      type: 'keyDown', key: 'Enter', code: 'Enter',
      windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, modifiers: 0,
    });
    await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', {
      type: 'keyUp', key: 'Enter', code: 'Enter',
      windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, modifiers: 0,
    });

    console.log('[WA Bridge CDP] Ctrl+Alt+N → número → Enter completado');
    return { success: true };
  } catch (e) {
    console.warn('[WA Bridge CDP] cdpOpenNewChat error:', e.message);
    return { success: false, reason: e.message };
  } finally {
    try { await chrome.debugger.detach({ tabId }); } catch (_) {}
  }
}

/**
 * Envía el mensaje ya escrito en el compose box de WA Web presionando Enter via CDP.
 * Llamado solo cuando autoSend === true.
 *
 * IMPORTANTE: adjuntar CDP (debugger.attach) puede disparar eventos blur en la página
 * y quitar el foco del compose box. Por eso, DESPUÉS de adjuntar CDP se vuelve a
 * enfocar explícitamente el compose box vía scripting antes de enviar el Enter.
 * Sin este re-foco, el Enter llega al último chat abierto en lugar del chat actual.
 */
async function cdpSendMessage(tabId) {
  await sleep(200);
  await chrome.debugger.attach({ tabId }, '1.3');
  try {
    // Re-enfocar el compose box DESPUÉS de adjuntar CDP (el attach puede robar el foco)
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const selectors = [
          '[data-testid="conversation-compose-box-input"]',
          'div[contenteditable="true"][data-tab="10"]',
          'div[contenteditable="true"][tabindex="10"]',
        ];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) { el.focus(); return; }
        }
      },
      world: 'MAIN',
    });
    await sleep(150); // Esperar que el foco se estabilice antes de enviar Enter

    await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', {
      type: 'keyDown', key: 'Enter', code: 'Enter',
      windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, modifiers: 0,
    });
    await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', {
      type: 'keyUp', key: 'Enter', code: 'Enter',
      windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, modifiers: 0,
    });
    console.log('[WA Bridge CDP] Mensaje enviado automáticamente via Enter');
  } finally {
    try { await chrome.debugger.detach({ tabId }); } catch (_) {}
  }
}

/**
 * Inserta el mensaje en el compose box del chat respetando los saltos de línea.
 *
 * WA Web requiere isTrusted:true para crear saltos de línea con Shift+Enter.
 * execCommand('insertLineBreak') no funciona porque no genera eventos trusted.
 *
 * Estrategia:
 *   - execCommand('insertText') via scripting → inserta texto (compose box no verifica isTrusted)
 *   - CDP Shift+Enter → inserta salto de línea real con isTrusted:true
 *
 * Se adjunta CDP UNA SOLA VEZ para todo el mensaje (eficiente).
 */
async function injectMessageWithLineBreaks(tabId, message) {
  // Paso 1: Enfocar el compose box y verificar que esté vacío
  let focusOk = false;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const selectors = [
          '[data-testid="conversation-compose-box-input"]',
          'div[contenteditable="true"][data-tab="10"]',
          'div[contenteditable="true"][tabindex="10"]',
        ];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) {
            if (el.textContent.trim() !== '') return 'skipped';
            el.focus();
            return 'focused';
          }
        }
        return 'not_found';
      },
      args: [],
      world: 'MAIN',
    });
    const status = results[0]?.result;
    if (status === 'not_found') return { success: false, reason: 'compose box not found' };
    if (status === 'skipped') return { success: true, skipped: true };
    focusOk = true;
  } catch (e) {
    return { success: false, reason: e.message };
  }

  if (!focusOk) return { success: false, reason: 'focus failed' };

  const lines = message.split('\n');

  // Sin saltos de línea → scripting puro, sin necesidad de CDP
  if (lines.length === 1) {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (text) => { document.execCommand('insertText', false, text); },
      args: [message],
      world: 'MAIN',
    });
    return { success: true };
  }

  // Con saltos de línea → CDP para Shift+Enter, scripting para texto
  // CDP se adjunta UNA VEZ para todo el mensaje
  await chrome.debugger.attach({ tabId }, '1.3');
  try {
    for (let i = 0; i < lines.length; i++) {
      // Insertar texto de esta línea (vacío en líneas de separación como \n\n)
      if (lines[i].length > 0) {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: (text) => { document.execCommand('insertText', false, text); },
          args: [lines[i]],
          world: 'MAIN',
        });
      }
      // Shift+Enter para el salto de línea (excepto después de la última línea)
      if (i < lines.length - 1) {
        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', {
          type: 'keyDown', key: 'Enter', code: 'Enter',
          windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, modifiers: 8, // Shift=8
        });
        await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', {
          type: 'keyUp', key: 'Enter', code: 'Enter',
          windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, modifiers: 8,
        });
        await sleep(30);
      }
    }
    console.log(`[WA Bridge] Mensaje inyectado: ${lines.length} líneas, ${lines.length - 1} saltos vía CDP`);
    return { success: true };
  } finally {
    try { await chrome.debugger.detach({ tabId }); } catch (_) {}
  }
}

async function openWhatsAppHome() {
  const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
  if (tabs.length > 0) {
    const tab = tabs[0];
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
    return { success: true, action: 'focused_existing' };
  } else {
    await chrome.tabs.create({ url: 'https://web.whatsapp.com', active: true });
    return { success: true, action: 'created_new' };
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
