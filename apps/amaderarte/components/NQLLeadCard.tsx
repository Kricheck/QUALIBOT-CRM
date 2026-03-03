import React, { useState, useRef, useEffect } from 'react';
import { Lead, NurturingStatus, QualityIndicator, CrmStatus } from '../types';
import { useLeads } from '../context/LeadsContext';
import {
  MessageCircle, Eye, Star, Calendar, ClipboardList,
  PauseCircle, ChevronDown, AlertCircle, CheckCircle2,
  TrendingUp, Zap
} from 'lucide-react';
import LeadDetailModal from './LeadDetailModal';
import WhatsAppSelectionModal from './WhatsAppSelectionModal';
import NurturingScheduleModal from './NurturingScheduleModal';

interface NQLLeadCardProps {
  lead: Lead;
  onStatusChange: (leadId: string, newStatus: NurturingStatus) => void;
}

const NQLLeadCard: React.FC<NQLLeadCardProps> = ({ lead, onStatusChange }) => {
  const { updateLead } = useLeads();
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isWAOpen, setIsWAOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [convertConfirm, setConvertConfirm] = useState<'MQL' | 'SQL' | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const status = (lead.nurturingStatus as NurturingStatus) || NurturingStatus.LANDING;

  const isExecuted = (
    (status === NurturingStatus.SEGUIMIENTO_1 && lead.estadoSeg1 === 'Ejecutado') ||
    (status === NurturingStatus.SEGUIMIENTO_2 && lead.estadoSeg2 === 'Ejecutado') ||
    (status === NurturingStatus.SEGUIMIENTO_3 && lead.estadoSeg3 === 'Ejecutado')
  );

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setConvertConfirm(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const getActionInfo = (): { label: string; date: string; isOverdue: boolean; segNum: number } | null => {
    const today = new Date(); today.setHours(0, 0, 0, 0);

    if (status === NurturingStatus.SEGUIMIENTO_1 && lead.fechaSeg1) {
      return { label: lead.accionSeg1 || '', date: lead.fechaSeg1, isOverdue: new Date(lead.fechaSeg1) <= today, segNum: 1 };
    }
    if (status === NurturingStatus.SEGUIMIENTO_2 && lead.fechaSeg2) {
      return { label: lead.accionSeg2 || '', date: lead.fechaSeg2, isOverdue: new Date(lead.fechaSeg2) <= today, segNum: 2 };
    }
    if (status === NurturingStatus.SEGUIMIENTO_3 && lead.fechaSeg3) {
      return { label: lead.accionSeg3 || '', date: lead.fechaSeg3, isOverdue: new Date(lead.fechaSeg3) <= today, segNum: 3 };
    }
    return null;
  };

  const actionInfo = getActionInfo();

  const handleToggleFavorite = () => {
    updateLead({ ...lead, isFavorite: !lead.isFavorite });
  };

  const handleConvert = (quality: QualityIndicator.MQL | QualityIndicator.SQL) => {
    updateLead({
      ...lead,
      indicadorCalidad: quality,
      nurturingStatus: undefined,
      ...(quality === QualityIndicator.SQL ? { crmStatus: CrmStatus.NUEVO } : {}),
    });
    setShowMenu(false);
    setConvertConfirm(null);
  };

  const getNextScheduledDate = () => {
    if (lead.fechaSeg1) return { date: lead.fechaSeg1, num: 1 };
    return null;
  };

  const nextSched = status === NurturingStatus.LANDING ? getNextScheduledDate() : null;

  const opacityClass = status === NurturingStatus.DESCARTADO
    ? 'opacity-50 grayscale'
    : status === NurturingStatus.PAUSADO
    ? 'opacity-70'
    : '';

  return (
    <>
      <div className={`bg-white rounded-xl shadow-sm border border-slate-100 border-l-4 border-l-teal-400 ${opacityClass} hover:shadow-md transition-shadow duration-200 text-xs`}>

        {/* TOP ROW */}
        <div className="flex items-start justify-between px-3 pt-3 pb-1 gap-1">
          <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-700 border border-teal-200">
            NQL
          </span>
          <div className="flex-1 min-w-0 mx-1">
            <p className="font-semibold text-slate-800 truncate">
              {lead.nombre} {lead.apellido}
            </p>
          </div>
          <button
            onClick={handleToggleFavorite}
            className={`shrink-0 p-1 rounded transition-colors ${lead.isFavorite ? 'text-amber-400' : 'text-slate-200 hover:text-amber-300'}`}
          >
            <Star size={13} fill={lead.isFavorite ? 'currentColor' : 'none'} />
          </button>
        </div>

        {/* CONTACT INFO */}
        <div className="px-3 pb-2 space-y-0.5">
          {lead.correo && <p className="text-slate-400 truncate">{lead.correo}</p>}
          {lead.whatsapp && <p className="text-slate-400">{lead.whatsapp}</p>}
          {lead.aeronave && <p className="text-slate-500 font-medium truncate">{lead.aeronave}</p>}
        </div>

        {/* LOCATION */}
        {lead.origen && (
          <div className="mx-3 mb-2 px-2 py-1.5 bg-slate-50 rounded-lg text-slate-600">
            <span className="truncate">{lead.origen}</span>
            {lead.destino && <span className="text-slate-400"> — {lead.destino}</span>}
          </div>
        )}

        {/* VALUE */}
        {lead.valor && (
          <div className="mx-3 mb-2 text-right">
            <span className="font-semibold text-slate-700">{lead.valor}</span>
          </div>
        )}

        {/* ACTION INDICATOR */}
        {actionInfo && (
          <div className={`mx-3 mb-2 p-2 rounded-lg border ${
            isExecuted
              ? 'bg-green-50 border-green-200'
              : actionInfo.isOverdue
              ? 'bg-orange-50 border-orange-200'
              : 'bg-sky-50 border-sky-200'
          }`}>
            <div className="flex items-start gap-1.5">
              {isExecuted
                ? <CheckCircle2 size={12} className="text-green-500 shrink-0 mt-0.5" />
                : actionInfo.isOverdue
                ? <AlertCircle size={12} className="text-orange-500 shrink-0 mt-0.5" />
                : <ClipboardList size={12} className="text-sky-500 shrink-0 mt-0.5" />
              }
              <p className={`flex-1 text-[11px] leading-tight ${
                isExecuted ? 'text-green-700 line-through' : actionInfo.isOverdue ? 'text-orange-700' : 'text-sky-700'
              }`}>
                {actionInfo.label || <span className="italic opacity-60">Sin descripción</span>}
              </p>
            </div>
            {actionInfo.date && (
              <p className={`text-[10px] mt-1 ${
                isExecuted ? 'text-green-500' : actionInfo.isOverdue ? 'text-orange-500 font-semibold' : 'text-sky-500'
              }`}>
                {actionInfo.date}
              </p>
            )}
            {!isExecuted && (
              <button
                onClick={() => {
                  const update: Partial<typeof lead> = {};
                  if (status === NurturingStatus.SEGUIMIENTO_1) update.estadoSeg1 = 'Ejecutado';
                  else if (status === NurturingStatus.SEGUIMIENTO_2) update.estadoSeg2 = 'Ejecutado';
                  else if (status === NurturingStatus.SEGUIMIENTO_3) update.estadoSeg3 = 'Ejecutado';
                  updateLead({ ...lead, ...update });
                }}
                className={`mt-2 w-full flex items-center justify-center gap-1 py-1 rounded text-[11px] font-semibold transition-colors
                  ${actionInfo.isOverdue
                    ? 'bg-orange-500 text-white hover:bg-orange-600'
                    : 'bg-sky-500 text-white hover:bg-sky-600'
                  }`}
              >
                <CheckCircle2 size={11} />
                Marcar ejecutado
              </button>
            )}
            {isExecuted && (
              <p className="mt-2 text-center text-[10px] text-green-600 font-semibold">
                ✓ Registrado — el lead avanzará cuando llegue la siguiente fecha
              </p>
            )}
          </div>
        )}

        {/* LANDING: schedule info/button */}
        {status === NurturingStatus.LANDING && (
          <div className="mx-3 mb-2">
            {nextSched ? (
              <div className="flex items-center gap-1.5 px-2 py-1.5 bg-sky-50 rounded-lg border border-sky-200">
                <Calendar size={11} className="text-sky-500 shrink-0" />
                <span className="text-sky-700 text-[11px]">Seg. 1 programado: <strong>{nextSched.date}</strong></span>
              </div>
            ) : (
              <button
                onClick={() => setIsScheduleOpen(true)}
                className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border border-dashed border-amber-300 text-amber-600 hover:bg-amber-50 transition-colors text-[11px] font-medium"
              >
                <Calendar size={11} />
                Programar seguimientos
              </button>
            )}
          </div>
        )}

        {/* ACTION BAR */}
        <div className="flex items-center justify-between px-3 pb-3 pt-1 border-t border-slate-50 gap-1">
          <button onClick={() => setIsWAOpen(true)} className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 transition-colors" title="WhatsApp">
            <MessageCircle size={14} />
          </button>

          <button onClick={() => setIsScheduleOpen(true)} className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 transition-colors" title="Programar seguimientos">
            <Calendar size={14} />
          </button>

          <button onClick={() => setIsDetailOpen(true)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors" title="Ver detalle">
            <Eye size={14} />
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => { setShowMenu(prev => !prev); setConvertConfirm(null); }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              title="Más opciones"
            >
              <ChevronDown size={14} />
            </button>

            {showMenu && (
              <div className="absolute bottom-full right-0 mb-1 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                {convertConfirm ? (
                  <div className="px-3 py-3">
                    <p className="text-xs font-semibold text-slate-700 mb-1">Convertir a {convertConfirm}</p>
                    <p className="text-[11px] text-slate-500 mb-3 leading-tight">
                      El lead dejará de aparecer en Nurturing y pasará al pipeline comercial.
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => setConvertConfirm(null)} className="flex-1 py-1.5 text-[11px] font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                        Cancelar
                      </button>
                      <button
                        onClick={() => handleConvert(convertConfirm === 'MQL' ? QualityIndicator.MQL : QualityIndicator.SQL)}
                        className={`flex-1 py-1.5 text-[11px] font-semibold text-white rounded-lg transition-colors ${
                          convertConfirm === 'SQL' ? 'bg-green-500 hover:bg-green-600' : 'bg-blue-500 hover:bg-blue-600'
                        }`}
                      >
                        Confirmar →{convertConfirm}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {status !== NurturingStatus.PAUSADO && (
                      <button onClick={() => { onStatusChange(lead.id, NurturingStatus.PAUSADO); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">
                        <PauseCircle size={13} className="text-slate-400" />
                        Pausar Nurturing
                      </button>
                    )}
                    {status !== NurturingStatus.DESCARTADO && (
                      <button onClick={() => { onStatusChange(lead.id, NurturingStatus.DESCARTADO); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-orange-600 hover:bg-orange-50">
                        <Zap size={13} className="text-orange-400" />
                        Descartar de Nurturing
                      </button>
                    )}
                    {status !== NurturingStatus.LANDING && (
                      <button onClick={() => { onStatusChange(lead.id, NurturingStatus.LANDING); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-sky-600 hover:bg-sky-50">
                        <Calendar size={13} className="text-sky-400" />
                        Volver a Landing
                      </button>
                    )}
                    <div className="border-t border-slate-100" />
                    <button onClick={() => setConvertConfirm('MQL')} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-blue-600 hover:bg-blue-50">
                      <TrendingUp size={13} className="text-blue-400" />
                      Convertir a MQL
                    </button>
                    <button onClick={() => setConvertConfirm('SQL')} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-green-600 hover:bg-green-50">
                      <TrendingUp size={13} className="text-green-500" />
                      Convertir a SQL
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <LeadDetailModal lead={lead} isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} />
      <WhatsAppSelectionModal lead={lead} isOpen={isWAOpen} onClose={() => setIsWAOpen(false)} />
      {isScheduleOpen && <NurturingScheduleModal lead={lead} onClose={() => setIsScheduleOpen(false)} />}
    </>
  );
};

export default NQLLeadCard;
