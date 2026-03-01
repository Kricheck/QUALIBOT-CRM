
import React, { useState, useEffect } from 'react';
import whatsappWebService from '../services/whatsappWebService';

const WhatsAppStatusIndicator: React.FC = () => {
  const [status, setStatus] = useState<'connected' | 'disconnected'>(
    whatsappWebService.getStatus()
  );
  const [extensionAvailable, setExtensionAvailable] = useState(
    whatsappWebService.isExtensionAvailable()
  );
  const [popupBlocked, setPopupBlocked] = useState(false);

  useEffect(() => {
    setStatus(whatsappWebService.getStatus());
    setExtensionAvailable(whatsappWebService.isExtensionAvailable());

    whatsappWebService.onStatusChange = (newStatus) => {
      setStatus(newStatus);
      setExtensionAvailable(whatsappWebService.isExtensionAvailable());
      if (newStatus === 'connected') setPopupBlocked(false);
    };

    // Polling de seguridad cada 1s para sincronizar estado
    const poll = setInterval(() => {
      setStatus(whatsappWebService.getStatus());
      setExtensionAvailable(whatsappWebService.isExtensionAvailable());
    }, 1000);

    return () => {
      whatsappWebService.onStatusChange = null;
      clearInterval(poll);
    };
  }, []);

  const handleConnect = () => {
    setPopupBlocked(false);
    const success = whatsappWebService.connect();
    if (!success) setPopupBlocked(true);
  };

  // --- Estado: CONECTADO ---
  if (status === 'connected') {
    return (
      <div className="flex items-center gap-1 h-9 px-2.5 bg-green-50 border border-green-200 rounded-lg shrink-0">
        <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
        <span className="text-xs font-medium text-green-700 whitespace-nowrap">
          {extensionAvailable ? 'WA Bridge' : 'WA Web'}
        </span>
        {/* Botón X solo en modo fallback (sin extensión) para resetear manualmente */}
        {!extensionAvailable && (
          <button
            onClick={() => whatsappWebService.disconnect()}
            className="ml-1 text-green-400 hover:text-red-500 transition-colors leading-none"
            title="Marcar como desconectado"
          >
            ×
          </button>
        )}
      </div>
    );
  }

  // --- Estado: DESCONECTADO ---
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {popupBlocked ? (
        <div className="flex items-center gap-1.5 h-9 px-3 bg-amber-50 border border-amber-200 rounded-lg">
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
          <span className="text-xs font-medium text-amber-700 whitespace-nowrap">Permite popups</span>
        </div>
      ) : (
        <button
          onClick={handleConnect}
          className="flex items-center gap-1.5 h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg hover:bg-amber-50 hover:border-amber-300 transition-colors group"
          title="Conectar WhatsApp Web"
        >
          <span className="w-2 h-2 rounded-full bg-slate-400 group-hover:bg-amber-500 transition-colors shrink-0" />
          <span className="text-xs font-medium text-slate-600 group-hover:text-amber-700 whitespace-nowrap transition-colors">
            Conectar WA
          </span>
        </button>
      )}
    </div>
  );
};

export default WhatsAppStatusIndicator;
