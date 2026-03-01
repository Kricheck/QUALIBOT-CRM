
import React, { useState, useRef, useEffect } from 'react';
import { Lead, QualityIndicator, CrmStatus, NurturingStatus } from '../types';
import { useLeads } from '../context/LeadsContext';
import { MessageCircle, Eye, ArrowRight, ArrowLeft, ArrowRightLeft, Phone, Ban, ThumbsDown, UserX, Mail, Clock, Star, MailOpen, SendHorizontal, CheckCircle2, Trash2, AlertTriangle } from 'lucide-react';
import LeadDetailModal from './LeadDetailModal';
import WhatsAppSelectionModal from './WhatsAppSelectionModal';
import EmailSelectionModal from './EmailSelectionModal';

interface LeadCardProps {
  lead: Lead;
  onMoveStage: (leadId: string, direction: -1 | 1) => void;
  onStatusChange: (leadId: string, newStatus: CrmStatus) => void;
}

// Helper to format numbers in the string (e.g. "4500 USD" -> "4.500 USD")
const formatDisplayValue = (val: string) => {
  if (!val) return '';
  const clean = val.replace(/\D/g, '');
  if (!clean) return val;
  return new Intl.NumberFormat('es-CO').format(parseInt(clean));
};

// Helper to calculate lead age relative to now (GMT-5 default Assumption)
const calculateLeadAge = (dateString: string | undefined, status: string): { label: string, colorClass: string } => {
  if (!dateString) return { label: '', colorClass: 'hidden' };

  try {
    const now = new Date();
    const created = new Date(dateString);
    if (isNaN(created.getTime())) return { label: '', colorClass: 'hidden' };

    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffMonths = Math.round(diffDays / 30);

    let label = '';
    let isUrgent = false;
    let isWarning = false;

    if (diffMins < 60) {
      label = `${diffMins} min`;
      isUrgent = true;
    } else if (diffHours < 24) {
      label = `${diffHours} horas`;
      isUrgent = true;
    } else if (diffDays <= 3) {
      label = `${diffDays} días`;
      isWarning = true;
    } else if (diffDays < 30) {
      label = `${diffDays} días`;
    } else {
      label = `${diffMonths} ${diffMonths === 1 ? 'mes' : 'meses'}`;
    }

    let colorClass = 'bg-slate-100 text-slate-500 border-slate-200';

    if (status === CrmStatus.NUEVO) {
      if (isUrgent) {
        colorClass = 'bg-red-100 text-red-700 border-red-200';
      } else if (isWarning) {
        colorClass = 'bg-orange-100 text-orange-700 border-orange-200';
      }
    }

    return { label, colorClass };
  } catch (e) {
    return { label: '', colorClass: 'hidden' };
  }
};

const LeadCard: React.FC<LeadCardProps> = ({ lead, onMoveStage, onStatusChange }) => {
  const { updateLead, removeLead } = useLeads();
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isWAOpen, setIsWAOpen] = useState(false);
  const [isEmailOpen, setIsEmailOpen] = useState(false);
  const [showDiscardMenu, setShowDiscardMenu] = useState(false);
  // NQL double-confirmation: shows inline "¿Seguro? Sí | No" before applying NQL quality
  const [nqlConfirm, setNqlConfirm] = useState(false);

  // Local state for delete button confirmation
  const [deleteConfirmState, setDeleteConfirmState] = useState<'idle' | 'confirming'>('idle');

  const discardMenuRef = useRef<HTMLDivElement>(null);

  const isSQL = lead.indicadorCalidad === QualityIndicator.SQL;
  const isMQL = lead.indicadorCalidad === QualityIndicator.MQL;
  const isNQL = lead.indicadorCalidad === QualityIndicator.NQL;

  const isPrecotizador = lead.source === 'PRECOTIZADOR';
  const isApollo = lead.source === 'APOLLO';
  const isRoundTrip = !!lead.fechaRegreso;
  const age = calculateLeadAge(lead.createdAt, lead.crmStatus);
  const isFinalStage = lead.crmStatus === CrmStatus.GANADOS || lead.crmStatus === CrmStatus.PERDIDO || lead.crmStatus === CrmStatus.FUERA_PUBLICO;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (discardMenuRef.current && !discardMenuRef.current.contains(event.target as Node)) {
        setShowDiscardMenu(false);
        setDeleteConfirmState('idle'); // Reset confirm state when closing menu
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDiscard = (status: CrmStatus) => {
    onStatusChange(lead.id, status);
    setShowDiscardMenu(false);
    setDeleteConfirmState('idle');
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (deleteConfirmState === 'idle') {
      // First Click: Change to Confirmation State
      setDeleteConfirmState('confirming');
    } else {
      // Second Click: Execute Delete
      removeLead(lead.id, lead.correo);
      setShowDiscardMenu(false);
      setDeleteConfirmState('idle');
    }
  };

  const handleQualityCycle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const current = lead.indicadorCalidad;
    // Cycle: No -> MQL -> SQL -> [NQL confirm] -> No
    if (current === QualityIndicator.SQL) {
      // Would move to NQL — require confirmation first
      setNqlConfirm(true);
      return;
    }
    let nextQuality: string;
    if (current === QualityIndicator.NO || current === 'No') nextQuality = QualityIndicator.MQL;
    else if (current === QualityIndicator.MQL) nextQuality = QualityIndicator.SQL;
    else if (current === QualityIndicator.NQL) nextQuality = QualityIndicator.NO;
    else nextQuality = QualityIndicator.NO;
    updateLead({ ...lead, indicadorCalidad: nextQuality });
  };

  const handleConfirmNql = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNqlConfirm(false);
    // Apply NQL and start in Landing stage of nurturing pipeline
    updateLead({
      ...lead,
      indicadorCalidad: QualityIndicator.NQL,
      nurturingStatus: NurturingStatus.LANDING,
    });
  };

  const handleRejectNql = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNqlConfirm(false);
    // Skip NQL, jump straight to No
    updateLead({ ...lead, indicadorCalidad: QualityIndicator.NO });
  };

  const toggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateLead({ ...lead, isFavorite: !lead.isFavorite });
  };

  // --- EMAIL BUTTON LOGIC ---
  const handleEmailClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (lead.emailOpened === true) {
      // STATE: READ (Orange) -> Action: Clean Notification (Set to FALSE)
      console.log(`🔵 [LeadCard] Resetting email status for Lead ID: ${lead.id}`);
      updateLead({ ...lead, emailOpened: false });

    } else if (lead.emailOpened === 'SENT') {
      // STATE: SENT (Purple/Moving) -> Action: Open Composer (Do NOT reset status)
      // The user can re-send, but the status remains 'SENT' until read or cleared manually elsewhere.
      console.log(`🟣 [LeadCard] Opening Email Modal (Status: SENT)`);
      setIsEmailOpen(true);

    } else {
      // STATE: UNREAD/FALSE (Blue) -> Action: Open Composer
      console.log(`⚪ [LeadCard] Opening Email Modal.`);
      setIsEmailOpen(true);
    }
  };

  const isEmailRead = lead.emailOpened === true;
  const isEmailSent = lead.emailOpened === 'SENT';

  // Visual Properties for Email Button
  let emailBtnClass = '';
  let emailIcon = <Mail size={18} />;
  let emailTitle = '';

  if (!lead.correo) {
    emailBtnClass = 'bg-slate-100 text-slate-300 cursor-not-allowed';
    emailTitle = "Sin correo";
  } else if (isEmailRead) {
    // STATE: READ (Priority 1)
    emailBtnClass = 'bg-orange-50 hover:bg-orange-100 text-orange-500 border border-orange-200 ring-2 ring-orange-100 ring-offset-1';
    emailIcon = <MailOpen size={18} className="fill-orange-100" />;
    emailTitle = "¡Leído! Clic para limpiar notificación";
  } else if (isEmailSent) {
    // STATE: SENT (Priority 2) - Using Indigo/Purple for "In Transit"
    emailBtnClass = 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200';
    // Animated Icon: Pulse implies activity/waiting
    emailIcon = <SendHorizontal size={18} className="animate-pulse" />;
    emailTitle = "Correo enviado. Esperando lectura... (Clic para reenviar)";
  } else {
    // STATE: DEFAULT
    emailBtnClass = 'bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100';
    emailIcon = <Mail size={18} />;
    emailTitle = "Enviar Correo";
  }

  // Border logic: Priority Apollo (amber/gold) > Precotizador (black) > Quality badge colors
  const borderClass = isApollo
    ? 'border-amber-400'
    : isPrecotizador
      ? 'border-slate-900'
      : (isSQL ? 'border-amber-400' : isMQL ? 'border-blue-400' : isNQL ? 'border-teal-400' : 'border-slate-300');

  // Quality Badge Color Logic
  const badgeColorClass = isSQL
    ? 'bg-amber-100 text-amber-700'
    : isMQL
      ? 'bg-blue-100 text-blue-700'
      : isNQL
        ? 'bg-teal-100 text-teal-700' // Teal for NQL
        : 'bg-slate-100 text-slate-500';

  return (
    <>
      <div className={`
        relative bg-white p-4 rounded-xl shadow-sm border-l-4 transition-transform hover:-translate-y-1 duration-200
        ${borderClass}
        ${lead.crmStatus === CrmStatus.PERDIDO ? 'opacity-75 grayscale-[0.5]' : ''}
        ${lead.crmStatus === CrmStatus.FUERA_PUBLICO ? 'opacity-60 grayscale' : ''}
      `}>
        {/* Quality Badge and Date/Campaign/Source/Favorite */}
        <div className="flex justify-between items-start mb-2">
          <div className="flex flex-col gap-1.5 items-start">
            {/* Quality Badge (Clickable) — shows NQL confirmation when cycling to NQL */}
            {nqlConfirm ? (
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[10px] font-semibold text-slate-600">¿Mover a NQL?</span>
                <button
                  onClick={handleConfirmNql}
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 hover:bg-teal-200 transition-colors"
                >
                  Sí
                </button>
                <button
                  onClick={handleRejectNql}
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={handleQualityCycle}
                className={`
                      text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider cursor-pointer select-none transition-opacity hover:opacity-80
                      ${badgeColorClass}
                    `}
                title="Clic para cambiar calidad"
              >
                {lead.indicadorCalidad || 'No'}
              </button>
            )}

            {/* Age Badge */}
            {age.label && (
              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border ${age.colorClass}`}>
                <Clock size={10} />
                <span className="text-[10px] font-bold leading-none">{age.label}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-1">
            <button
              onClick={toggleFavorite}
              className="hover:scale-110 transition-transform focus:outline-none"
            >
              <Star
                size={16}
                className={`transition-colors duration-200 ${lead.isFavorite ? "fill-yellow-400 text-yellow-400" : "text-slate-300 hover:text-yellow-300"}`}
              />
            </button>

            <span className="text-[10px] text-slate-400 font-medium">{lead.fecha}</span>
            {lead.campana && (
              <span className="text-[10px] text-slate-400 font-medium truncate max-w-[100px]" title={lead.campana}>{lead.campana}</span>
            )}
            {lead.source && (
              <span className="text-[10px] text-slate-400 font-medium truncate max-w-[100px]" title={lead.source}>{lead.source}</span>
            )}
          </div>
        </div>

        {/* Lead Info */}
        <h3 className="font-bold text-slate-800 text-lg leading-tight">
          {lead.nombre} {lead.apellido}
        </h3>

        {/* Apollo tags: cargo & compania */}
        {isApollo && (lead.cargo || lead.compania) && (
          <div className="flex flex-wrap gap-1 mt-0.5 mb-1">
            {lead.cargo && (
              <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">
                {lead.cargo}
              </span>
            )}
            {lead.compania && (
              <span className="text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded-full">
                🏢 {lead.compania}
              </span>
            )}
          </div>
        )}
        {lead.valor && (
          <div className="text-slate-900 font-bold text-sm mt-0.5 mb-1">
            {formatDisplayValue(lead.valor)}
          </div>
        )}

        {lead.correo && (
          <div className="flex items-center text-slate-400 text-xs mb-1 truncate">
            <Mail size={12} className="mr-1.5 shrink-0" />
            <span className="truncate">{lead.correo}</span>
          </div>
        )}

        <div
          onClick={() => setIsWAOpen(true)}
          className="flex items-center text-slate-500 text-sm mb-3 mt-1 cursor-pointer hover:text-green-600 hover:bg-green-50 w-fit px-1.5 -ml-1.5 py-0.5 rounded-md transition-all group"
        >
          <Phone size={14} className="mr-1.5 group-hover:text-green-500" />
          <span className="truncate max-w-[180px] group-hover:underline decoration-green-500/30 underline-offset-2">{lead.whatsapp}</span>
        </div>

        {/* Route Visualization */}
        <div className="bg-slate-50 p-2 rounded-lg mb-4 flex items-center justify-between text-xs text-slate-600 font-medium">
          <span className="truncate max-w-[40%]">{lead.origen}</span>
          {isRoundTrip ? (
            <span title="Ida y Vuelta" className="mx-1 shrink-0"><ArrowRightLeft size={12} className="text-blue-500" /></span>
          ) : (
            <span title="Solo Ida" className="mx-1 shrink-0"><ArrowRight size={12} className="text-slate-400" /></span>
          )}
          <span className="truncate max-w-[40%]">{lead.destino}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-auto relative">

          {lead.crmStatus !== CrmStatus.NUEVO && (
            <button
              onClick={() => onMoveStage(lead.id, -1)}
              className="w-8 h-8 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg flex items-center justify-center transition-colors shrink-0"
            >
              <ArrowLeft size={16} />
            </button>
          )}

          {!isFinalStage && (
            <div className="relative" ref={discardMenuRef}>
              <button
                onClick={() => {
                  setShowDiscardMenu(!showDiscardMenu);
                  setDeleteConfirmState('idle'); // Reset on toggle
                }}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0 ${showDiscardMenu ? 'bg-red-100 text-red-600' : 'bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500'}`}
              >
                <Ban size={16} />
              </button>

              {showDiscardMenu && (
                <div className="absolute bottom-full left-0 mb-2 w-48 bg-white rounded-lg shadow-xl border border-slate-100 overflow-hidden z-10 animate-fade-in origin-bottom-left">
                  <div className="p-1">
                    <button
                      onClick={() => handleDiscard(CrmStatus.PERDIDO)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-red-50 hover:text-red-700 rounded-md transition-colors text-left"
                    >
                      <ThumbsDown size={14} className="text-red-500" /> <span>Perdido</span>
                    </button>
                    <button
                      onClick={() => handleDiscard(CrmStatus.FUERA_PUBLICO)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors text-left"
                    >
                      <UserX size={14} className="text-slate-400" /> <span>Fuera de Público</span>
                    </button>

                    {/* Delete Option - ONLY for Precotizador and Apollo leads */}
                    {(isPrecotizador || isApollo) && (
                      <>
                        <div className="h-[1px] bg-slate-100 my-1"></div>
                        <button
                          onClick={handleDeleteClick}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors text-left
                                ${deleteConfirmState === 'confirming'
                              ? 'bg-red-600 text-white hover:bg-red-700 font-bold'
                              : 'text-slate-700 hover:bg-slate-900 hover:text-white'
                            }`}
                        >
                          {deleteConfirmState === 'confirming' ? (
                            <>
                              <AlertTriangle size={14} className="text-white" /> <span>¿Seguro?</span>
                            </>
                          ) : (
                            <>
                              <Trash2 size={14} className="text-slate-500 group-hover:text-white" /> <span>Eliminar</span>
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="h-4 w-[1px] bg-slate-200 mx-1"></div>

          {/* Mail Action (UPDATED LOGIC) */}
          <button
            onClick={handleEmailClick}
            disabled={!lead.correo}
            className={`flex-1 py-1.5 rounded-lg flex items-center justify-center transition-all shadow-sm group relative ${emailBtnClass}`}
            title={emailTitle}
          >
            {emailIcon}

            {/* Notification Dot for READ status */}
            {isEmailRead && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
              </span>
            )}

            {/* Standby Label */}
            {isEmailSent && (
              <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-indigo-500 bg-white px-1 rounded shadow-sm border border-indigo-100 whitespace-nowrap z-10">
                Enviado
              </span>
            )}
          </button>

          <button
            onClick={() => setIsWAOpen(true)}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white py-1.5 rounded-lg flex items-center justify-center transition-colors"
          >
            <MessageCircle size={18} />
          </button>

          <button
            onClick={() => setIsDetailOpen(true)}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-1.5 rounded-lg flex items-center justify-center transition-colors"
          >
            <Eye size={18} />
          </button>

          {!isFinalStage && (
            <button
              onClick={() => onMoveStage(lead.id, 1)}
              className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 py-1.5 rounded-lg flex items-center justify-center transition-colors"
            >
              <ArrowRight size={18} />
            </button>
          )}
        </div>
      </div>

      <LeadDetailModal lead={lead} isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} />
      <WhatsAppSelectionModal lead={lead} isOpen={isWAOpen} onClose={() => setIsWAOpen(false)} />

      {/* Pass onSuccess handler to Email Modal */}
      <EmailSelectionModal
        lead={lead}
        isOpen={isEmailOpen}
        onClose={() => setIsEmailOpen(false)}
        onSuccess={() => { }} // Now handled inside modal logic itself, but kept for future ref
      />
    </>
  );
};

export default LeadCard;
