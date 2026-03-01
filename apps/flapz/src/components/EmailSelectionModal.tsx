
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Lead, CrmStatus } from '../types';
import { Mail, X, Send, ArrowLeft, Loader2, CheckCircle, AlertTriangle, ExternalLink, Sparkles } from 'lucide-react';
import { sendEmailToLead } from '../services/sheetsService';
import { useLeads } from '../context/LeadsContext';
import { generateOutboundEmail } from '../services/aiService';

// --- HELPER UTILS FOR DATA CLEANING ---
const cleanName = (name: string) => (name || "").trim().split(' ')[0];

const cleanCompany = (company: string) => {
    if (!company) return "";
    return company
        .replace(/\b(SAS|S\.A\.S|SA|S\.A|INC|CORP|LLC|GROUP|GRUPO|LIMITADA|LTDA|S EN C)\b/gi, '')
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
        .trim();
};

interface EmailSelectionModalProps {
    lead: Lead;
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void; // New prop for callback
}

const EmailSelectionModal: React.FC<EmailSelectionModalProps> = ({ lead, isOpen, onClose, onSuccess }) => {
    const { updateLead } = useLeads();
    const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [htmlHeader, setHtmlHeader] = useState('');
    const [htmlFooter, setHtmlFooter] = useState('');
    const [status, setStatus] = useState<'idle' | 'generating' | 'sending' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    const isApolloNuevo = lead.source === 'APOLLO' && lead.crmStatus === CrmStatus.NUEVO;

    // Templates Definition
    const templates = [
        {
            id: 'welcome',
            title: 'Bienvenida / Primer Contacto',
            subject: `Tu solicitud de vuelo privado: ${lead.origen} - ${lead.destino}`,
            body: `Hola ${lead.nombre},\n\nGracias por contactar a Flapz. He recibido tu solicitud para volar desde ${lead.origen} hacia ${lead.destino}.\n\nSoy Mateo Cruz, tu Concierge personal. Estoy revisando la disponibilidad de aeronaves que se ajusten a tus necesidades. En breve te enviaré las mejores opciones disponibles.\n\nSi tienes alguna preferencia específica o cambio en tu itinerario, no dudes en responderme a este correo.\n\nAtentamente,\n\nMateo Cruz\nConcierge Flapz`
        },
        {
            id: 'quote',
            title: 'Presentación de Cotización',
            subject: `Propuesta de Vuelo Flapz: ${lead.origen} - ${lead.destino}`,
            body: `Hola ${lead.nombre},\n\nEs un gusto saludarte nuevamente. Adjunto a este correo encontrarás los detalles de nuestra propuesta para tu viaje.\n\nHemos seleccionado una aeronave ${lead.aeronave || 'ejecutiva'} que garantiza confort y eficiencia para esta ruta. La tarifa estimada es de ${lead.valor || 'XXX'}.\n\n¿Te gustaría programar una breve llamada para revisar los detalles técnicos o proceder con la reserva?\n\nQuedo atento a tu comentarios.\n\nSaludos cordiales,\n\nMateo Cruz\nConcierge Flapz`
        },
        {
            id: 'followup',
            title: 'Seguimiento',
            subject: `Seguimiento a tu vuelo a ${lead.destino}`,
            body: `Hola ${lead.nombre},\n\nQuería saber si tuviste oportunidad de revisar la propuesta que te envié anteriormente.\n\nLas aeronaves en el mercado son dinámicas, por lo que me gustaría confirmar si sigues interesado en esta fecha para asegurar la disponibilidad.\n\nAvísame si tienes alguna duda o si deseas explorar otras opciones.\n\nSaludos,\n\nMateo Cruz\nConcierge Flapz`
        }
    ];

    const handleSelect = async (template: any) => {
        if (template.id === 'apollo_logistics') {
            const subject = "La ineficacia de los vuelos comerciales";
            const commercialCompany = cleanCompany(lead.compania || "su empresa");
            const preheader = `Una alternativa para la logística de ${commercialCompany}`;

            // Elegant HTML Button
            const buttonHtml = `<div style="margin: 25px 0;"><a href="https://vip.flapz.app/flota_flapz?utm_source=apollo" style="background-color: #000000; color: #ffffff; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block; font-size: 15px; border: 1px solid #333; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">Conocer flota Flapz</a></div>`;

            // Hidden Preheader Hack
            const preheaderHtml = `<div style="display:none; max-height:0px; max-width:0px; opacity:0; overflow:hidden;">${preheader}</div>`;

            const body = `Hola ${cleanName(lead.nombre)},\n\n` +
                `En empresas con el dinamismo de ${commercialCompany}, el mayor costo logístico no es el combustible, sino las horas que sus directivos pierden en aeropuertos.\n\n` +
                `La agilidad operativa se rompe cuando el líder debe adaptar su agenda a los itinerarios de una aerolínea. En FLAPZ, eliminamos esa fricción: nosotros adaptamos el vuelo a su agenda, permitiéndole aterrizar más cerca de su destino y optimizar su activo más escaso: el tiempo.\n\n` +
                `Lo invito a conocer la flota que tenemos disponible para sus próximos viajes:\n\n` +
                `[[ BOTÓN: CONOCER FLOTA ]]\n\n`;

            const footer = `Saludos,\n\n` +
                `Mateo Cruz\n` +
                `Senior Aviation Advisor | FLAPZ\n` +
                `www.flapz.app | @flapzapp`;

            setSelectedTemplate(template);
            setSubject(subject);
            setBody(body + footer);
            setHtmlHeader(preheaderHtml);
            setHtmlFooter("");
            setStatus('idle');
            return;
        }

        if (template.id === 'apollo_ai') {
            setStatus('generating');
            try {
                const result = await generateOutboundEmail(lead);
                const aiResponse = result.text;

                // Split subject and body
                let finalSubject = `Contacto Profesional: Flapz x ${lead.compania || 'Aviación Privada'}`;
                let finalBody = aiResponse;

                // Match "Asunto:" regardless of markdown formatting (e.g. **Asunto:** or *Asunto:*)
                const subjectRegex = /^\*{0,2}Asunto:\*{0,2}/i;
                if (aiResponse.includes('Asunto:')) {
                    const parts = aiResponse.split('\n');
                    const subjectLine = parts.find(p => subjectRegex.test(p.trim()));
                    if (subjectLine) {
                        finalSubject = subjectLine.replace(subjectRegex, '').replace(/\*\*/g, '').trim();
                        finalBody = parts.filter(p => !subjectRegex.test(p.trim())).join('\n').trim();
                    }
                }

                setTimeout(() => {
                    setSelectedTemplate(template);
                    setSubject(finalSubject);
                    setBody(finalBody);
                    setHtmlHeader("");
                    setHtmlFooter("");
                    setStatus('idle');
                }, 800);
            } catch (error: any) {
                console.error("AI Generation failed:", error);
                setErrorMessage(`La generación falló: ${error.message || "Error desconocido"}`);
                setStatus('error');
            }
        } else {
            setSelectedTemplate(template);
            setSubject(template.subject);
            setBody(template.body);
            setStatus('idle');
        }
    };

    const handleSend = async () => {
        if (!lead.correo) {
            setErrorMessage("Este lead no tiene un correo electrónico registrado.");
            setStatus('error');
            return;
        }

        setStatus('sending');
        try {
            const buttonHtml = `<div style="margin: 15px 0;"><a href="https://vip.flapz.app/flota_flapz?utm_source=apollo&id_user=${encodeURIComponent(lead.correo)}" style="background-color: #000000; color: #ffffff; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block; font-size: 15px; border: 1px solid #333; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">Conocer flota Flapz</a></div>`;
            let finalBody = body.replace(/\n*\[\[ BOTÓN: CONOCER FLOTA \]\]\n*/g, buttonHtml);
            finalBody = finalBody
                .replace(/www\.flapz\.app/gi, '<a href="https://www.flapz.app?utm_source=apollo&utm_campaign=apollo_email" style="color:#000000;text-decoration:underline;">www.flapz.app</a>')
                .replace(/@flapzapp/gi, '<a href="https://www.instagram.com/flapzapp" style="color:#C13584;text-decoration:none;">@flapzapp</a>');

            const result = await sendEmailToLead(lead, subject, finalBody, {
                htmlHeader: htmlHeader,
                htmlFooter: htmlFooter
            });
            if (result.success) {
                updateLead({ ...lead, emailOpened: 'SENT' });
                if (onSuccess) onSuccess();
                setStatus('success');
                setTimeout(() => {
                    onClose();
                }, 2000);
            } else {
                setErrorMessage(result.message);
                setStatus('error');
            }
        } catch (error) {
            setErrorMessage("Error de conexión al enviar el correo.");
            setStatus('error');
        }
    };

    if (!isOpen) return null;



    return createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div
                className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden transform scale-100 flex flex-col max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* HEADER */}
                <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                        <div className="bg-blue-100 p-1.5 rounded-lg text-blue-600">
                            <Mail size={18} />
                        </div>
                        {selectedTemplate ? 'Redactar Correo' : 'Seleccionar Plantilla'}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                {/* CONTENT */}
                <div className="flex-1 overflow-y-auto">
                    {status === 'success' ? (
                        <div className="flex flex-col items-center justify-center h-64 text-green-600 animate-fade-in">
                            <CheckCircle size={48} className="mb-4" />
                            <h4 className="text-lg font-bold">¡Correo enviado!</h4>
                            <p className="text-slate-500 text-sm mt-1">El mensaje ha sido procesado correctamente.</p>
                        </div>
                    ) : selectedTemplate ? (
                        <div className="p-6 flex flex-col animate-fade-in">
                            {/* Metadata */}
                            <div className="mb-4 space-y-3">
                                <div className="flex items-center gap-3 text-sm">
                                    <span className="w-16 text-slate-400 font-medium text-right shrink-0">Para:</span>
                                    <span className="bg-slate-100 px-2 py-1 rounded text-slate-700 font-mono text-xs">{lead.correo}</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                    <span className="w-16 text-slate-400 font-medium text-right shrink-0">Asunto:</span>
                                    <input
                                        type="text"
                                        value={subject}
                                        onChange={(e) => setSubject(e.target.value)}
                                        className="flex-1 bg-white border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800 font-medium"
                                    />
                                </div>
                            </div>

                            {/* Body Editor */}
                            <div className="flex-1 flex flex-col">
                                <label className="text-xs text-slate-400 font-bold uppercase mb-1">Mensaje</label>
                                <textarea
                                    value={body}
                                    onChange={(e) => setBody(e.target.value)}
                                    className="w-full h-48 md:h-64 p-4 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm text-slate-800 leading-relaxed resize-none font-sans"
                                />

                                {/* Visual Button Preview */}
                                {body.includes('[[ BOTÓN: CONOCER FLOTA ]]') && (
                                    <div className="mt-2 p-3 bg-slate-50 border border-dashed border-slate-300 rounded-lg">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Vista previa del botón</div>
                                        <div className="bg-black text-white px-6 py-2 rounded font-bold text-xs inline-block">
                                            Conocer flota Flapz
                                        </div>
                                    </div>
                                )}
                            </div>


                            {status === 'error' && (
                                <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2 border border-red-100">
                                    <AlertTriangle size={16} />
                                    <span>{errorMessage || "Error al enviar."}</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="p-4 grid gap-3">
                            <p className="text-sm text-slate-500 mb-2 px-1">
                                {isApolloNuevo ? "Generar mensaje de contacto inicial con IA:" : "Elige una plantilla para comenzar:"}
                            </p>

                            {isApolloNuevo ? (
                                <div className="grid gap-4">
                                    {/* Logistics Template */}
                                    <button
                                        onClick={() => handleSelect({ id: 'apollo_logistics', title: 'Propuesta Logística (Estratégico)' })}
                                        className="text-left p-6 rounded-xl border-2 border-slate-800 hover:border-blue-600 hover:bg-slate-50 transition-all group bg-white relative overflow-hidden shadow-md"
                                    >
                                        <div className="absolute top-0 right-0 p-3">
                                            <Mail size={24} className="text-slate-200 group-hover:text-blue-500 transition-all" />
                                        </div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="bg-slate-900 text-white p-2 rounded-lg shadow-md group-hover:bg-blue-600 transition-colors">
                                                <Send size={20} />
                                            </div>
                                            <div>
                                                <span className="font-bold text-slate-800 text-lg block italic">"La ineficacia de los vuelos comerciales"</span>
                                                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Plantilla Estratégica Logística</span>
                                            </div>
                                        </div>
                                        <p className="text-sm text-slate-600 leading-relaxed mb-4">
                                            Enfoque en ahorro de tiempo y agilidad operativa para <span className="font-semibold text-slate-800">{cleanCompany(lead.compania)}</span>.
                                        </p>
                                        <div className="flex items-center justify-center py-2 bg-slate-900 text-white rounded-lg font-bold text-sm group-hover:bg-blue-600 transition-colors">
                                            Seleccionar esta plantilla
                                        </div>
                                    </button>

                                    {/* AI Option */}
                                    <div className="space-y-3">
                                        <button
                                            onClick={() => handleSelect({ id: 'apollo_ai', title: 'Contacto Profesional (AI)' })}
                                            disabled={status === 'generating'}
                                            className={`text-left p-4 rounded-xl border transition-all group bg-white shadow-sm w-full ${status === 'generating' ? 'border-blue-500 bg-blue-50/30' : 'border-blue-100 hover:border-blue-400 hover:bg-blue-50'}`}
                                        >
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className={`p-1.5 rounded-lg transition-colors ${status === 'generating' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-600'}`}>
                                                    <Sparkles size={18} />
                                                </div>
                                                <span className="font-bold text-slate-700 text-sm block">Generar Alternativa con IA</span>
                                            </div>
                                            {status === 'generating' ? (
                                                <div className="flex items-center text-blue-600 font-bold text-xs">
                                                    <Loader2 size={12} className="animate-spin mr-2" /> Procesando inteligencia artificial...
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-center py-1.5 border border-blue-200 text-blue-600 rounded-lg font-bold text-xs group-hover:bg-blue-600 group-hover:text-white transition-all">
                                                    Generar con Inteligencia Artificial
                                                </div>
                                            )}
                                        </button>


                                        {status === 'error' && (
                                            <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2 border border-red-100">
                                                <AlertTriangle size={16} />
                                                <span>{errorMessage || "Error al generar con IA."}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                templates.map((t) => (
                                    <button
                                        key={t.id}
                                        onClick={() => handleSelect(t)}
                                        className="text-left p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all group bg-white"
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-bold text-slate-700 group-hover:text-blue-700 text-sm">{t.title}</span>
                                            <ExternalLink size={14} className="text-slate-300 group-hover:text-blue-400" />
                                        </div>
                                        <div className="text-xs text-slate-500 font-medium mb-1">Asunto: {t.subject}</div>
                                        <div className="text-xs text-slate-400 line-clamp-2 italic">"{t.body}"</div>
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* FOOTER ACTIONS */}
                {selectedTemplate && status !== 'success' && (
                    <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
                        <button
                            onClick={() => {
                                setSelectedTemplate(null);
                                setStatus('idle');
                            }}
                            disabled={status === 'sending'}
                            className="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            <ArrowLeft size={16} /> Volver
                        </button>
                        <button
                            onClick={handleSend}
                            disabled={status === 'sending' || !lead.correo}
                            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
                        >
                            {status === 'sending' ? (
                                <><Loader2 size={16} className="animate-spin" /> Enviando...</>
                            ) : (
                                <><Send size={16} /> Enviar Correo</>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

export default EmailSelectionModal;
