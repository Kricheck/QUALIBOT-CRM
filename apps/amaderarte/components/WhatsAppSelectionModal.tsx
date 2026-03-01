
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Lead, CrmStatus } from '../types';
import { MessageCircle, X, ExternalLink, ArrowLeft, Send } from 'lucide-react';
import whatsappWebService from '../services/whatsappWebService';
import { useLeads } from '../context/LeadsContext';

interface WhatsAppSelectionModalProps {
  lead: Lead;
  isOpen: boolean;
  onClose: () => void;
  initialTemplateId?: string | null; // New prop to auto-select a template
}

const WhatsAppSelectionModal: React.FC<WhatsAppSelectionModalProps> = ({ lead, isOpen, onClose, initialTemplateId }) => {
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [waError, setWaError] = useState<'not_connected' | 'window_lost' | null>(null);
  const [autoSend, setAutoSend] = useState(false);

  const { updateLeadStatus } = useLeads();
  const cleanNumber = lead.whatsapp.replace(/[^0-9]/g, '');
  const firstName = lead.nombre ? lead.nombre.trim().split(/\s+/)[0] : 'Cliente';

  // Master list of all available templates
  const allTemplates = [
    {
      id: "opening",
      title: "1. Abrir Conversación",
      message: `¡Hola, ${firstName}! 👋 Soy Kassandra de Amaderarte.\n\nVi que te registraste en nuestra página para diseñar tus próximos muebles. Debes tener un gran proyecto en mente...✨\n\nPara iniciar el proceso, podrías confirmarme:\n\n📍 Ciudad y barrio donde vives:\n🛋 ¿Qué muebles quieres diseñar? (Ej: Cocina, closet, centro de TV)\n\n¡Quedo atenta para que empecemos a crear tu espacio soñado! 💪`,
      color: "bg-green-50 text-green-700 hover:bg-green-100 border-green-200"
    },
    {
      id: "schedule",
      title: "2. Confirmar Agenda",
      message: `¡Hola ${firstName}! 👋 ¡Bienvenido/a a la familia Amaderarte! 😊\n\nEstamos muy emocionados de empezar a proyectar tu [Muebles a diseñar]. Aquí tienes los detalles de nuestra visita:\n\n📅 Fecha: [Fecha] \n📍 Dirección: [Dirección] \n✨ Diseñador asignado: [Nombre del Diseñador]\n\nRecordatorios importantes: \n✅ Por favor, asegúrate de que alguien nos reciba en la dirección mencionada. \n✅ La visita es el primer paso para crear tu pieza única.\n\n¡Gracias por confiar en nuestro arte! ✨ Nos vemos pronto.`,
      color: "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200",
    },
    {
      id: "followup",
      title: "3. Seguimiento Cotización",
      message: `Hola ${firstName} 👋 ¿Cómo va todo?\n\nTe escribo para saber si pudiste revisar la propuesta para tu [Muebles a diseñar] que te enviamos. ✨\n\nRecuerda que en Amaderarte seleccionamos materiales que garantizan durabilidad y estilo por muchos años.\n\n¿Tienes alguna duda sobre los materiales o el presupuesto que podamos resolver ahora?`,
      color: "bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200"
    },
    {
      id: "activation",
      title: "4. Activación (Sin Respuesta)",
      message: `Hola ${firstName}, ¿cómo estás? 👋\n\nNo hemos tenido noticias tuyas sobre el proyecto de [Muebles a diseñar] y no quisiera que perdieras tu cupo en nuestra agenda de producción de este mes. ⏳\n\n¿Sigues interesado/a en realizar el proyecto o hubo algún cambio en tus planes? > Confírmame para saber si libero el espacio o si necesitas un ajuste en la propuesta. 😊`,
      color: "bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200"
    },
    {
      id: "review",
      title: "5. Post-Entrega (Reseña)",
      message: `¡Hola ${firstName}! ✨ Qué alegría que tu nuevo [Muebles diseñados] ya esté ocupando su lugar en casa.\n\nEn Amaderarte ponemos el corazón en cada detalle y esperamos que esta pieza traiga mucha calidez a tu hogar.\n\n¿Te gustó cómo quedó el resultado final? 😍\n\nSi tienes un momento, nos encantaría que nos ayudaras con dos cositas: 📸 Una foto: Si nos compartes una foto de tu espacio, nos harías muy felices. ⭐ Tu opinión: ¿Nos regalarías una breve reseña aquí? [Link]\n\n¡Gracias por dejarnos ser parte de tu hogar! ✨`,
      color: "bg-teal-50 text-teal-700 hover:bg-teal-100 border-teal-200"
    }
  ];

  // Logic to filter templates based on Stage
  // NOTE: Modified to always show all templates if opened via specific action, 
  // but if opened generically, we could filter. For now, showing all to ensure access.
  const templates = allTemplates;

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
      setSelectedTemplate(null);
      setWaError(null);
      setAutoSend(false);
    }
  }, [isOpen, initialTemplateId]);

  const openWhatsApp = (msg: string) => {
    setWaError(null);

    if (whatsappWebService.getStatus() !== 'connected') {
      setWaError('not_connected');
      return;
    }

    const result = whatsappWebService.sendMessage(cleanNumber, msg, autoSend);
    if (result.success) {
      if (lead.crmStatus === CrmStatus.NUEVO) {
        updateLeadStatus(lead.id, CrmStatus.SEGUIMIENTO);
      }
      onClose(); // WA Web ya tiene el chat + mensaje listo; el usuario solo presiona Enviar
    } else if (result.reason === 'WINDOW_LOST') {
      setWaError('window_lost');
    }
  };

  const handleClose = () => {
    setPreviewMessage(null);
    setSelectedTemplate(null);
    setWaError(null);
    onClose();
  };

  const handleSelect = (template: any) => {
    setSelectedTemplate(template);
    setPreviewMessage(template.message);
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
          
          {previewMessage ? (
            // --- EDIT / PREVIEW MODE ---
            <div className="animate-fade-in">
              <>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3 text-xs text-slate-600 flex gap-2 items-start">
                   <span>✏️</span>
                   <span>Puedes editar esta plantilla antes de enviarla.</span>
                </div>

                  <textarea
                    value={previewMessage || ''}
                    onChange={(e) => setPreviewMessage(e.target.value)}
                    className="w-full h-64 p-3 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none font-sans text-slate-700 leading-relaxed"
                    placeholder="Escribe tu mensaje aquí..."
                  />
                  
                  {/* Banners de error de conexión WA Web */}
                  {waError === 'not_connected' && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                      <p className="font-semibold mb-1">WhatsApp Web no está conectado</p>
                      <p className="mb-2 text-red-600">Conecta desde la barra superior y vuelve a intentarlo. La pestaña de WA Web se reutilizará automáticamente.</p>
                      <button
                        onClick={() => { whatsappWebService.connect(); setWaError(null); }}
                        className="w-full py-1.5 px-3 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium transition-colors"
                      >
                        Conectar ahora
                      </button>
                    </div>
                  )}
                  {waError === 'window_lost' && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                      <p className="font-semibold mb-1">La pestaña de WhatsApp Web se cerró</p>
                      <p>Reconecta usando el botón en la barra superior y vuelve a intentarlo.</p>
                    </div>
                  )}

                  {/* Opciones de envío + nota informativa */}
                  {!waError && (
                    <div className="mt-3 space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors select-none">
                        <input
                          type="checkbox"
                          checked={autoSend}
                          onChange={e => setAutoSend(e.target.checked)}
                          className="w-4 h-4 cursor-pointer accent-green-600"
                        />
                        <span className="text-xs text-slate-700 font-medium">Enviar automáticamente</span>
                      </label>
                      {!autoSend && (
                        <p className="text-xs text-blue-600 flex gap-2 items-center px-1">
                          <span>ℹ️</span>
                          <span>El mensaje quedará listo en WA Web. Presiona <strong>Enviar</strong> para confirmarlo.</span>
                        </p>
                      )}
                      {autoSend && (
                        <p className="text-xs text-amber-600 flex gap-2 items-center px-1">
                          <span>⚡</span>
                          <span>El mensaje se enviará automáticamente. Revísalo bien antes de abrir.</span>
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex gap-3 mt-3">
                    <button
                      onClick={() => {
                          setPreviewMessage(null);
                          setSelectedTemplate(null);
                          setWaError(null);
                      }}
                      className="flex-1 py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                      <ArrowLeft size={16} /> Volver
                    </button>
                    <button
                      onClick={() => openWhatsApp(previewMessage || '')}
                      className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
                    >
                      <Send size={16} /> {autoSend ? 'Enviar Mensaje' : 'Abrir en WA Web'}
                    </button>
                  </div>
                </>
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
