
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Lead, CrmStatus } from '../types';
import { MessageCircle, X, ExternalLink, Sparkles, Loader2, ArrowLeft, Send } from 'lucide-react';
import { generateQuoteMessage } from '../services/aiService';

interface WhatsAppSelectionModalProps {
  lead: Lead;
  isOpen: boolean;
  onClose: () => void;
  initialTemplateId?: string | null; // New prop to auto-select a template
}

const WhatsAppSelectionModal: React.FC<WhatsAppSelectionModalProps> = ({ lead, isOpen, onClose, initialTemplateId }) => {
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);

  const cleanNumber = lead.whatsapp.replace(/[^0-9]/g, '');

  // Master list of all available templates
  const allTemplates = [
    {
      id: "interest",
      title: "Interés General",
      message: `Hola ${lead.nombre} 👋\n\nBienvenido a la experiencia *Flapz*. Soy Mateo Cruz y seré tu concierge personal.\n\nVi tu interés en volar en privado y quiero ofrecerte más que un precio: *una solución exacta a tu necesidad de viaje.*\n\nPara empezar, ¿podrías confirmarme *ruta, fecha y número de pasajeros*? 🛫\n\nTe adjunto nuestro catálogo para que explores las opciones que tenemos para tu vuelo.\n\nQuedo atento a tu respuesta.`,
      color: "bg-green-50 text-green-700 hover:bg-green-100 border-green-200"
    },
    {
      id: "quote",
      title: "Detalles / Cotización (AI)",
      // Updated Placeholder to match the new AI Reference Framework
      message: `Hola *${lead.nombre}* 👋\n\nSoy Mateo Cruz, tu contacto personal en *Flapz*. Gracias por considerarnos para tu próximo vuelo.\n\nHe buscado las mejores alternativas para tu itinerario *${lead.origen} - ${lead.destino}* y quiero presentarte nuestra recomendación principal:\n\n🔹 *Aeronave:* ${lead.aeronave || 'Aeronave'}\n🔹 *Tarifa:* ${lead.valor || 'Por confirmar'}\n...`,
      color: "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200",
      isAi: true
    },
    {
      id: "followup_quote",
      title: "Seguimiento Cotización",
      message: `Hola ${lead.nombre}, ¡soy Mateo de Flapz! 👋\n\nSigo atento a tu vuelo a *${lead.destino || 'tu destino'}*. Mi objetivo es que la propuesta se ajuste a tu presupuesto y garantice cumplimiento total. ✈️\n\nSi necesitas cambiar *el horario, el modelo de avión o el número de pasajeros*, dímelo y recalibramos la oferta de inmediato. 🛠️\n\n¿Quieres que ajustemos la cotización o ya resolviste tu ruta por otro medio?`,
      color: "bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200"
    },
    {
      id: "closing",
      title: "Reactivar Cliente",
      message: `Hola *${lead.nombre}* 👋, soy Mateo de Flapz.\n\nEstoy revisando tu solicitud del vuelo a *${lead.destino || 'tu destino'}*, y quisiera validar cómo puedo ayudarte a continuar.\n\nCuéntame con un número cómo prefieres avanzar:\n\n1️⃣ Tengo dudas 📞\n2️⃣ Aún lo estoy revisando 🗓️\n3️⃣ Ya lo resolví 🛑\n\nQuedo atento a tu respuesta.`,
      color: "bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200"
    }
  ];

  // Logic to filter templates based on Stage
  const templates = lead.crmStatus === CrmStatus.COTIZADO 
    ? allTemplates.filter(t => t.id === 'followup_quote' || t.id === 'closing') 
    : allTemplates;

  // Auto-select template if initialTemplateId is provided when opening
  useEffect(() => {
    if (isOpen && initialTemplateId) {
      // Search in allTemplates to allow selecting even hidden ones via direct click from DetailModal
      const t = allTemplates.find(temp => temp.id === initialTemplateId);
      if (t) {
        handleSelect(t);
      }
    } else if (!isOpen) {
      // Reset state when closed
      setPreviewMessage(null);
      setGeneratingId(null);
      setSelectedTemplate(null);
    }
  }, [isOpen, initialTemplateId]);

  const openWhatsApp = (msg: string) => {
    // Fix: Use encodeURIComponent manually. 
    // URLSearchParams uses '+' for spaces, which can break emojis on some platforms/browsers when passed to WhatsApp.
    // encodeURIComponent uses '%20' which is safer for the WhatsApp API.
    const encodedMsg = encodeURIComponent(msg);
    const url = `https://api.whatsapp.com/send?phone=${cleanNumber}&text=${encodedMsg}`;
    
    window.open(url, '_blank');
    onClose(); // Close modal after sending
  };

  const handleClose = () => {
    setPreviewMessage(null);
    setGeneratingId(null);
    setSelectedTemplate(null);
    onClose();
  };

  const handleSelect = async (template: any) => {
    setSelectedTemplate(template);

    if (template.id === 'quote') {
        setGeneratingId('quote');
        try {
            const aiMessage = await generateQuoteMessage(lead);
            setPreviewMessage(aiMessage);
        } catch (error) {
            // If AI fails, use the fallback constructed in aiService, 
            // OR use the template message if the service threw completely.
            // However, the service catches errors and returns a fallback string usually.
            // If it returns a string (even fallback), we use it.
            setPreviewMessage(template.message); 
        } finally {
            setGeneratingId(null);
        }
    } else {
        // For static templates, also Go to PREVIEW mode (Changed from immediate send)
        setPreviewMessage(template.message);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fade-in" onClick={handleClose}>
      <div 
        className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden transform scale-100 flex flex-col max-h-[90vh]" 
        onClick={e => e.stopPropagation()}
      >
        
        {/* HEADER */}
        <div className="flex justify-between items-center p-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-700 flex items-center">
            <MessageCircle size={18} className="mr-2 text-green-500" />
            {previewMessage ? 'Revisar Mensaje' : 'Elegir Plantilla'}
          </h3>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        
        {/* CONTENT */}
        <div className="p-4 overflow-y-auto">
          
          {previewMessage || generatingId ? (
            // --- EDIT / PREVIEW MODE ---
            <div className="animate-fade-in">
              
              {generatingId ? (
                 <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-3">
                    <Loader2 size={32} className="animate-spin text-blue-500" />
                    <span className="text-sm font-medium">Generando mensaje con IA...</span>
                 </div>
              ) : (
                <>
                  {selectedTemplate?.isAi ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3 text-xs text-amber-800 flex gap-2 items-start">
                       <span>🤖</span> 
                       <span>Este mensaje fue generado por IA. Por favor revísalo antes de enviar.</span>
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3 text-xs text-slate-600 flex gap-2 items-start">
                       <span>✏️</span> 
                       <span>Puedes editar esta plantilla antes de enviarla.</span>
                    </div>
                  )}

                  <textarea
                    value={previewMessage || ''}
                    onChange={(e) => setPreviewMessage(e.target.value)}
                    className="w-full h-64 p-3 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none font-sans text-slate-700 leading-relaxed"
                    placeholder="Escribe tu mensaje aquí..."
                  />
                  
                  <div className="flex gap-3 mt-4">
                    <button 
                      onClick={() => {
                          setPreviewMessage(null);
                          setSelectedTemplate(null);
                      }}
                      className="flex-1 py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                      <ArrowLeft size={16} /> Volver
                    </button>
                    <button 
                      onClick={() => openWhatsApp(previewMessage || '')}
                      className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
                    >
                      <Send size={16} /> Abrir WhatsApp
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            // --- SELECTION MODE ---
            <div className="space-y-3">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleSelect(t)}
                  className={`w-full text-left p-3 rounded-lg border transition-all flex flex-col group relative ${t.color}`}
                >
                  <span className="font-bold text-sm mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        {t.title}
                        {t.isAi && <Sparkles size={12} className="text-blue-500" />}
                    </span>
                    <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </span>
                  
                  <span className="text-xs opacity-90 line-clamp-2">
                    "{t.message}"
                  </span>
                </button>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>,
    document.body
  );
};

export default WhatsAppSelectionModal;
