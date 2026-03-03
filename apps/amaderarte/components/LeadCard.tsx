
import React, { useState, useRef, useEffect } from 'react';
import { Lead, QualityIndicator, CrmStatus, NurturingStatus } from '../types';
import { useLeads } from '../context/LeadsContext';
import { MessageCircle, Eye, ArrowRight, ArrowLeft, Phone, Ban, ThumbsDown, UserX, Mail, Clock, Star, MapPin, Hammer, ExternalLink, MapPinOff, Store, CheckCircle2, XCircle } from 'lucide-react';
import LeadDetailModal from './LeadDetailModal';
import WhatsAppSelectionModal from './WhatsAppSelectionModal';

interface LeadCardProps {
  lead: Lead;
  onMoveStage: (leadId: string, direction: -1 | 1) => void;
  onStatusChange: (leadId: string, newStatus: CrmStatus) => void;
}

const formatDisplayValue = (val: string) => {
  if (!val) return '';
  const clean = val.replace(/\D/g, '');
  if (!clean) return val;
  return new Intl.NumberFormat('es-CO').format(parseInt(clean));
};

const formatDateTime = (isoString: string | undefined) => {
    if (!isoString || isoString.startsWith("1970")) return "Sin fecha";
    try {
        const date = new Date(isoString);
        // Formato: 25 Ene 20:09 (Compacto)
        // Si el año es diferente al actual, mostrarlo.
        const currentYear = new Date().getFullYear();
        const leadYear = date.getFullYear();
        
        const day = date.getDate().toString().padStart(2,'0');
        const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
        const month = monthNames[date.getMonth()];
        const time = `${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;

        if (leadYear !== currentYear) {
            return `${day} ${month} ${leadYear} ${time}`;
        }
        return `${day} ${month} ${time}`;
    } catch(e) {
        return "Fecha Inválida";
    }
};

const calculateLeadAge = (dateString: string | undefined, status: string): { label: string, colorClass: string } => {
    if (!dateString || dateString.startsWith("1970")) return { label: '', colorClass: 'hidden' };
    try {
        const now = new Date();
        const created = new Date(dateString);
        if (isNaN(created.getTime())) return { label: '', colorClass: 'hidden' };
        
        const diffMs = now.getTime() - created.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMs < 0) {
             // Futuro (Leads con fecha > hoy)
             return { label: 'Futuro', colorClass: 'bg-indigo-50 text-indigo-500 border-indigo-100' };
        }

        let label = '';
        if (diffDays >= 1) {
            label = `${diffDays}d`;
        } else if (diffHours >= 1) {
            label = `${diffHours}h`;
        } else {
            label = `${Math.max(0, diffMins)}m`;
        }

        let colorClass = 'bg-slate-100 text-slate-500 border-slate-200';

        if (status === CrmStatus.NUEVO) {
            if (diffDays < 1) { 
                colorClass = 'bg-red-100 text-red-700 border-red-200'; 
            }
            else if (diffDays <= 3) { 
                colorClass = 'bg-orange-100 text-orange-700 border-orange-200'; 
            }
        }
        return { label, colorClass };
    } catch (e) {
        return { label: '', colorClass: 'hidden' };
    }
};

const getOriginBadgeColor = (campaign: string) => {
    const c = (campaign || "").toLowerCase();
    if (c.includes("app")) return "bg-purple-100 text-purple-700 border-purple-200";
    if (c.includes("1 espacio")) return "bg-indigo-100 text-indigo-700 border-indigo-200";
    if (c.includes("+2")) return "bg-amber-100 text-amber-700 border-amber-200";
    if (c.includes("wa lead")) return "bg-green-100 text-green-700 border-green-200";
    return "bg-slate-100 text-slate-600 border-slate-200";
};

const LeadCard: React.FC<LeadCardProps> = ({ lead, onMoveStage, onStatusChange }) => {
  const { updateLead } = useLeads();
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isWAOpen, setIsWAOpen] = useState(false);
  const [showDiscardMenu, setShowDiscardMenu] = useState(false);
  const [nqlConfirm, setNqlConfirm] = useState(false);
  const discardMenuRef = useRef<HTMLDivElement>(null);

  const isSQL = lead.indicadorCalidad === QualityIndicator.SQL;
  const isMQL = lead.indicadorCalidad === QualityIndicator.MQL;
  const isNQL = lead.indicadorCalidad === QualityIndicator.NQL;
  
  const age = calculateLeadAge(lead.createdAt, lead.crmStatus);
  const isFinalStage = lead.crmStatus === CrmStatus.GANADOS || lead.crmStatus === CrmStatus.PERDIDO || lead.crmStatus === CrmStatus.FUERA_PUBLICO;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (discardMenuRef.current && !discardMenuRef.current.contains(event.target as Node)) {
        setShowDiscardMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDiscard = (status: CrmStatus) => {
    onStatusChange(lead.id, status);
    setShowDiscardMenu(false);
  };

  const handleQualityCycle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const current = lead.indicadorCalidad;
    // Ciclo: No → MQL → SQL → [confirm NQL] → No
    if (current === QualityIndicator.SQL) {
      setNqlConfirm(true);
      return;
    }
    if (current === QualityIndicator.NQL) {
      updateLead({ ...lead, indicadorCalidad: QualityIndicator.NO });
      return;
    }
    let nextQuality: string;
    if (current === QualityIndicator.NO || current === 'No') nextQuality = QualityIndicator.MQL;
    else if (current === QualityIndicator.MQL) nextQuality = QualityIndicator.SQL;
    else nextQuality = QualityIndicator.NO;
    updateLead({ ...lead, indicadorCalidad: nextQuality });
  };

  const handleConfirmNql = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNqlConfirm(false);
    updateLead({
      ...lead,
      indicadorCalidad: QualityIndicator.NQL,
      nurturingStatus: NurturingStatus.LANDING,
    });
  };

  const handleRejectNql = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNqlConfirm(false);
    updateLead({ ...lead, indicadorCalidad: QualityIndicator.NO });
  };

  const toggleFavorite = (e: React.MouseEvent) => {
      e.stopPropagation();
      updateLead({ ...lead, isFavorite: !lead.isFavorite });
  };

  const handleOpenDetails = () => {
      setIsDetailOpen(true);
  };

  return (
    <>
      <div 
        onClick={handleOpenDetails}
        className={`
        relative bg-white p-3 rounded-xl shadow-sm border-l-4 transition-transform hover:-translate-y-1 duration-200 cursor-pointer group/card
        ${isSQL ? 'border-amber-400' : isMQL ? 'border-blue-400' : isNQL ? 'border-teal-400' : 'border-slate-300'}
        ${lead.crmStatus === CrmStatus.PERDIDO ? 'opacity-75 grayscale-[0.5]' : ''}
      `}>
        <div className="flex justify-between items-start mb-1">
            <div className="flex flex-col gap-1.5 items-start">
                <div className="flex items-center gap-1.5 flex-wrap">
                    {nqlConfirm ? (
                      <div className="flex items-center gap-1 flex-wrap" onClick={e => e.stopPropagation()}>
                        <span className="text-[10px] font-semibold text-slate-600">¿Mover a NQL?</span>
                        <button onClick={handleConfirmNql} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 border border-teal-200 hover:bg-teal-200 transition-colors">
                          Sí
                        </button>
                        <button onClick={handleRejectNql} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200 transition-colors">
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleQualityCycle}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider cursor-pointer select-none transition-opacity hover:opacity-80
                          ${isSQL ? 'bg-amber-100 text-amber-700' : isMQL ? 'bg-blue-100 text-blue-700' : isNQL ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'}
                        `}
                      >
                          {lead.indicadorCalidad || 'No'}
                      </button>
                    )}

                    {age.label && (
                        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border ${age.colorClass}`}>
                            <Clock size={10} />
                            <span className="text-[10px] font-bold leading-none">{age.label}</span>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="flex flex-col items-end gap-1">
             <button onClick={toggleFavorite} className="hover:scale-110 transition-transform focus:outline-none mb-0.5">
                <Star size={16} className={`transition-colors duration-200 ${lead.isFavorite ? "fill-yellow-400 text-yellow-400" : "text-slate-300 hover:text-yellow-300"}`} />
             </button>
             
             {/* FECHA Y HORA REAL */}
             <span className="text-[10px] text-slate-400 font-mono font-medium">
                {formatDateTime(lead.createdAt)}
             </span>
             
             {/* ETIQUETA ORIGEN */}
             {lead.campana && (
                <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getOriginBadgeColor(lead.campana)}`}>
                    {lead.campana}
                </div>
             )}
          </div>
        </div>

        <h3 className="font-bold text-slate-800 text-base leading-tight group-hover/card:text-amber-700 transition-colors mb-0.5">
          {lead.nombre} {lead.apellido}
        </h3>
        
        {lead.valor && (
          <div className="text-slate-900 font-bold text-sm my-0.5">
            {formatDisplayValue(lead.valor)}
          </div>
        )}

        {lead.correo && (
          <div className="flex items-center text-slate-400 text-xs mb-0.5 truncate">
            <Mail size={12} className="mr-1.5 shrink-0" />
            <span className="truncate">{lead.correo}</span>
          </div>
        )}
        
        <div 
            onClick={(e) => { e.stopPropagation(); setIsWAOpen(true); }}
            className="flex items-center text-slate-500 text-sm mb-2 mt-1 cursor-pointer hover:text-green-600 hover:bg-green-50 w-fit px-1.5 -ml-1.5 py-0.5 rounded-md transition-all group"
        >
          <Phone size={14} className="mr-1.5 group-hover:text-green-500" />
          <span className="truncate max-w-[180px] group-hover:underline decoration-green-500/30 underline-offset-2">{lead.whatsapp}</span>
        </div>

        {/* Location / Details Visualization */}
        <div className="bg-slate-50 p-1.5 rounded-lg mb-2.5 flex items-center justify-between text-xs text-slate-600 font-medium">
          {/* CAMPO IZQUIERDO: ORIGEN/CIUDAD */}
          <div className="flex items-center gap-1 truncate max-w-[45%]">
             <MapPin size={12} className="text-amber-500 shrink-0" />
             <span className="truncate" title={lead.origen}>{lead.origen || 'Ciudad'}</span>
             
             {/* COVERAGE INDICATOR */}
             {lead.hasCoverage === true && (
                 <span title="Con Cobertura" className="ml-0.5 shrink-0 flex items-center">
                    <CheckCircle2 size={12} className="text-green-500" />
                 </span>
             )}
             {lead.hasCoverage === false && (
                 <span title="Sin Cobertura" className="ml-0.5 shrink-0 flex items-center">
                    <XCircle size={12} className="text-red-500" />
                 </span>
             )}
          </div>
          
          {/* CAMPO DERECHO: ACCIÓN / PRODUCTO / FACHADA */}
          {lead.linkMaps ? (
             <a 
                href={lead.linkMaps} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-1 truncate max-w-[45%] text-blue-600 hover:underline hover:text-blue-700 cursor-pointer"
                onClick={(e) => e.stopPropagation()} // Prevenir abrir el modal
                title="Ver Fachada en Maps"
             >
                <ExternalLink size={12} className="shrink-0" />
                <span className="truncate">{lead.aeronave || 'Fachada'}</span>
             </a>
          ) : (
            <div className={`flex items-center gap-1 truncate max-w-[45%] ${lead.aeronave === 'Fuera de Zona' ? 'text-red-500' : ''}`}>
                {lead.aeronave === 'Fuera de Zona' ? (
                    <MapPinOff size={12} className="shrink-0 text-red-500" />
                ) : (lead.campana === '1 Espacio') ? (
                    <Store size={12} className="text-slate-400 shrink-0" />
                ) : (
                    <Hammer size={12} className="text-slate-400 shrink-0" />
                )}
                <span className="truncate" title={lead.aeronave}>{lead.aeronave || 'Producto'}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 mt-auto relative">
          {lead.crmStatus !== CrmStatus.NUEVO && (
            <button 
                onClick={(e) => { e.stopPropagation(); onMoveStage(lead.id, -1); }}
                className="w-8 h-8 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg flex items-center justify-center transition-colors shrink-0"
            >
                <ArrowLeft size={16} />
            </button>
          )}

          {!isFinalStage && (
            <div className="relative" ref={discardMenuRef} onClick={(e) => e.stopPropagation()}>
              <button 
                onClick={() => setShowDiscardMenu(!showDiscardMenu)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0 ${showDiscardMenu ? 'bg-red-100 text-red-600' : 'bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500'}`}
              >
                <Ban size={16} />
              </button>
              {showDiscardMenu && (
                <div className="absolute bottom-full left-0 mb-2 w-48 bg-white rounded-lg shadow-xl border border-slate-100 overflow-hidden z-10 animate-fade-in origin-bottom-left">
                  <div className="p-1">
                    <button onClick={() => handleDiscard(CrmStatus.PERDIDO)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-red-50 hover:text-red-700 rounded-md transition-colors text-left">
                      <ThumbsDown size={14} className="text-red-500" /> <span>Perdido</span>
                    </button>
                    <button onClick={() => handleDiscard(CrmStatus.FUERA_PUBLICO)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors text-left">
                      <UserX size={14} className="text-slate-400" /> <span>Fuera de Público</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="h-4 w-[1px] bg-slate-200 mx-1"></div>

          <button onClick={(e) => { e.stopPropagation(); setIsWAOpen(true); }} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-1.5 rounded-lg flex items-center justify-center transition-colors">
            <MessageCircle size={18} />
          </button>
          
          <button onClick={(e) => { e.stopPropagation(); setIsDetailOpen(true); }} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-1.5 rounded-lg flex items-center justify-center transition-colors">
            <Eye size={18} />
          </button>

          {!isFinalStage && (
             <button onClick={(e) => { e.stopPropagation(); onMoveStage(lead.id, 1); }} className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 py-1.5 rounded-lg flex items-center justify-center transition-colors">
                <ArrowRight size={18} />
            </button>
          )}
        </div>
      </div>

      <LeadDetailModal lead={lead} isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} />
      <WhatsAppSelectionModal lead={lead} isOpen={isWAOpen} onClose={() => setIsWAOpen(false)} />
    </>
  );
};

export default LeadCard;
