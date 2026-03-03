
type WaStatus = 'connected' | 'disconnected';

// Helper: dispatches a crm-debug-log event visible in DebugLogger
const logWa = (title: string, data?: unknown, type: 'info' | 'success' | 'error' = 'info') => {
  window.dispatchEvent(new CustomEvent('crm-debug-log', {
    detail: {
      id: `wa-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      title: `[WA] ${title}`,
      data: data ?? null,
      type,
    }
  }));
};

/**
 * Servicio singleton para WhatsApp Web.
 *
 * Modo extensión (preferido):
 *   La extensión de Chrome "Amaderarte WA Bridge" se anuncia via window.postMessage
 *   cuando está instalada. En ese caso se usa como puente para navegar la pestaña
 *   EXISTENTE de WA Web, en lugar de abrir una nueva por cada mensaje.
 *
 * Modo fallback (sin extensión):
 *   COOP (Cross-Origin-Opener-Policy: same-origin) en web.whatsapp.com impide
 *   reutilizar ventanas cross-origin. Se abre una nueva pestaña por cada mensaje.
 */
class WhatsAppWebService {
  private _isConnected: boolean = false;
  private _extensionAvailable: boolean = false;
  public onStatusChange: ((status: WaStatus) => void) | null = null;

  constructor() {
    // Escuchar mensajes de la extensión (retransmitidos por content.js)
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      if (!event.data || event.data.source !== 'amaderarte-extension') return;

      const msg = event.data;

      if (msg.type === 'EXTENSION_READY') {
        logWa(`Extensión de Chrome detectada (v${msg.version || '?'})`, null, 'success');
        if (!this._extensionAvailable) {
          this._extensionAvailable = true;
          this._notifyStatusChange('connected');
        }
      }

      if (msg.type === 'EXTENSION_CONTEXT_INVALIDATED') {
        // El contexto del content script quedó invalidado tras recargar la extensión.
        // El usuario debe recargar la página del CRM para restablecer la conexión.
        logWa('Contexto de extensión invalidado — recarga la página del CRM (F5)', null, 'error');
        this._extensionAvailable = false;
        this._notifyStatusChange('disconnected');
      }

      if (msg.type === 'WA_NAVIGATE_RESULT') {
        if (msg.success) {
          logWa(`Navegación exitosa via extensión — acción: ${msg.action}`, null, 'success');
        } else {
          logWa('Error al navegar via extensión', { reason: msg.reason }, 'error');
        }
      }

      if (msg.type === 'WA_OPEN_HOME_RESULT') {
        logWa(`WA Web abierto/focalizado — acción: ${msg.action}`, null, msg.success ? 'success' : 'error');
      }
    });

    // Ping activo: preguntar si la extensión está presente.
    // content.js responde con EXTENSION_READY si está inyectado.
    // Se reintenta varias veces para cubrir distintos momentos de carga.
    const ping = () => {
      logWa('WA_PING enviado — esperando EXTENSION_READY');
      window.postMessage({ source: 'amaderarte-crm', type: 'WA_PING' }, '*');
    };
    setTimeout(ping, 300);
    setTimeout(ping, 1200);
    setTimeout(ping, 3000);
  }

  /** Retorna true si la extensión de Chrome está instalada y activa */
  isExtensionAvailable(): boolean {
    return this._extensionAvailable;
  }

  getStatus(): WaStatus {
    // Con extensión siempre está listo (la extensión abre WA si no hay pestaña)
    if (this._extensionAvailable) return 'connected';
    return this._isConnected ? 'connected' : 'disconnected';
  }

  /**
   * Abre o focaliza WhatsApp Web.
   * Con extensión: navega/focaliza pestaña existente de WA.
   * Sin extensión: abre nueva pestaña (fallback).
   */
  connect(): boolean {
    logWa('connect() llamado', { extensionAvailable: this._extensionAvailable });

    if (this._extensionAvailable) {
      logWa('Extensión disponible — abriendo/focalizando WA Web', null, 'success');
      window.postMessage({ source: 'amaderarte-crm', type: 'WA_OPEN_HOME' }, '*');
      return true;
    }

    // Fallback sin extensión
    logWa('Sin extensión — abriendo WA Web en nueva pestaña (fallback)');
    const win = window.open('https://web.whatsapp.com', '_blank');
    if (!win) {
      logWa('window.open bloqueado por el navegador', null, 'error');
      return false;
    }
    logWa('WA Web abierto en nueva pestaña', null, 'success');
    this._isConnected = true;
    this._notifyStatusChange('connected');
    return true;
  }

  /**
   * Navega WhatsApp Web al chat del número indicado con el mensaje prellenado.
   * Con extensión: navega la pestaña EXISTENTE (no abre una nueva).
   * Sin extensión: abre nueva pestaña (limitación por COOP).
   */
  sendMessage(phone: string, message: string, autoSend = false): { success: boolean; reason?: string } {
    logWa(`sendMessage()`, { phone, autoSend, extensionAvailable: this._extensionAvailable, status: this.getStatus() });

    if (this.getStatus() !== 'connected') {
      logWa('sendMessage() abortado — no conectado', null, 'error');
      return { success: false, reason: 'NOT_CONNECTED' };
    }

    const cleanPhone = phone.replace(/\D/g, '');

    if (this._extensionAvailable) {
      // Modo extensión: la extensión reutiliza la pestaña existente de WA Web
      logWa('Enviando a extensión para navegar pestaña WA', { cleanPhone, autoSend });
      window.postMessage({
        source: 'amaderarte-crm',
        type: 'WA_NAVIGATE',
        phone: cleanPhone,
        message,
        autoSend,
      }, '*');
      return { success: true }; // Optimista: la extensión confirma via WA_NAVIGATE_RESULT
    }

    // Fallback sin extensión: nueva pestaña
    // COOP en web.whatsapp.com impide reutilizar pestañas cross-origin desde JS puro.
    const url = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
    logWa('Sin extensión — abriendo nueva pestaña (fallback por COOP)', { cleanPhone });
    try {
      const win = window.open(url, '_blank');
      if (!win) {
        logWa('window.open bloqueado', null, 'error');
        this._isConnected = false;
        this._notifyStatusChange('disconnected');
        return { success: false, reason: 'WINDOW_LOST' };
      }
      win.focus();
      logWa('Chat abierto en nueva pestaña', null, 'success');
      return { success: true };
    } catch (err) {
      logWa('Excepción al abrir chat', { error: String(err) }, 'error');
      this._isConnected = false;
      this._notifyStatusChange('disconnected');
      return { success: false, reason: 'WINDOW_LOST' };
    }
  }

  /** Reset manual del estado (útil en modo fallback cuando el usuario cierra WA Web) */
  disconnect(): void {
    logWa('disconnect() llamado');
    this._isConnected = false;
    if (!this._extensionAvailable) {
      this._notifyStatusChange('disconnected');
    }
  }

  private _notifyStatusChange(status: WaStatus): void {
    logWa(`_notifyStatusChange("${status}") — callback: ${!!this.onStatusChange}`, null, status === 'connected' ? 'success' : 'info');
    this.onStatusChange?.(status);
  }
}

// Singleton — una sola instancia compartida por toda la aplicación
const whatsappWebService = new WhatsAppWebService();
export default whatsappWebService;
