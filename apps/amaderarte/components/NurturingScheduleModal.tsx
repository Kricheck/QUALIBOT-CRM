import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Save, AlertCircle, Lock, RotateCcw, CheckCircle2 } from 'lucide-react';
import { Lead } from '../types';
import { useLeads } from '../context/LeadsContext';

interface NurturingScheduleModalProps {
  lead: Lead;
  onClose: () => void;
}

const NurturingScheduleModal: React.FC<NurturingScheduleModalProps> = ({ lead, onClose }) => {
  const { updateLead } = useLeads();

  const [fechaSeg1, setFechaSeg1] = useState(lead.fechaSeg1 || '');
  const [fechaSeg2, setFechaSeg2] = useState(lead.fechaSeg2 || '');
  const [fechaSeg3, setFechaSeg3] = useState(lead.fechaSeg3 || '');
  const [accionSeg1, setAccionSeg1] = useState(lead.accionSeg1 || '');
  const [accionSeg2, setAccionSeg2] = useState(lead.accionSeg2 || '');
  const [accionSeg3, setAccionSeg3] = useState(lead.accionSeg3 || '');
  const [estadoSeg1, setEstadoSeg1] = useState<string>(lead.estadoSeg1 || '');
  const [estadoSeg2, setEstadoSeg2] = useState<string>(lead.estadoSeg2 || '');
  const [estadoSeg3, setEstadoSeg3] = useState<string>(lead.estadoSeg3 || '');
  const [error, setError] = useState('');

  const overlayRef = useRef<HTMLDivElement>(null);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const validate = (): boolean => {
    if (fechaSeg1 && fechaSeg2 && fechaSeg2 <= fechaSeg1) {
      setError('Seguimiento 2 debe ser posterior a Seguimiento 1.');
      return false;
    }
    if (fechaSeg2 && fechaSeg3 && fechaSeg3 <= fechaSeg2) {
      setError('Seguimiento 3 debe ser posterior a Seguimiento 2.');
      return false;
    }
    setError('');
    return true;
  };

  const handleSave = () => {
    if (!validate()) return;
    updateLead({
      ...lead,
      fechaSeg1: fechaSeg1 || undefined,
      accionSeg1: accionSeg1 || undefined,
      estadoSeg1: estadoSeg1 || undefined,
      fechaSeg2: fechaSeg2 || undefined,
      accionSeg2: accionSeg2 || undefined,
      estadoSeg2: estadoSeg2 || undefined,
      fechaSeg3: fechaSeg3 || undefined,
      accionSeg3: accionSeg3 || undefined,
      estadoSeg3: estadoSeg3 || undefined,
    });
    onClose();
  };

  const inputClass = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 text-slate-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed";
  const textareaClass = `${inputClass} resize-none`;
  const labelClass = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1";

  const seg2Locked = !fechaSeg1 && !fechaSeg2;
  const seg3Locked = !fechaSeg2 && !fechaSeg3;

  const SegHeader = ({ num, locked, color }: { num: number; locked: boolean; color: string }) => (
    <div className="flex items-center gap-1.5 mb-1">
      <span className={`w-5 h-5 rounded-full ${locked ? 'bg-slate-300' : color} text-white text-[10px] font-bold flex items-center justify-center`}>
        {locked ? <Lock size={9} /> : num}
      </span>
      <span className={`text-xs font-bold uppercase tracking-wide ${locked ? 'text-slate-400' : ''}`}>
        Seguimiento {num}
      </span>
      {locked && <span className="text-[10px] text-slate-400">(completa el anterior primero)</span>}
    </div>
  );

  const SegControls = ({
    fecha, estado, locked, isExecuted,
    onEstadoChange, onReset,
  }: {
    fecha: string; estado: string; locked: boolean; isExecuted: boolean;
    onEstadoChange: (v: string) => void;
    onReset: () => void;
  }) => {
    if (locked || !fecha) return null;
    return (
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onEstadoChange(estado === 'Ejecutado' ? 'Por Ejecutar' : 'Ejecutado')}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
              estado === 'Ejecutado' ? 'bg-green-500' : 'bg-slate-300'
            }`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
              estado === 'Ejecutado' ? 'translate-x-5' : 'translate-x-0.5'
            }`} />
          </button>
          <span className={`text-[11px] font-semibold ${estado === 'Ejecutado' ? 'text-green-600' : 'text-slate-400'}`}>
            {estado === 'Ejecutado' ? (
              <span className="flex items-center gap-1"><CheckCircle2 size={11} /> Ejecutado</span>
            ) : 'Por ejecutar'}
          </span>
        </div>
        <button
          type="button"
          onClick={onReset}
          disabled={isExecuted}
          title={isExecuted ? 'No se puede resetear un seguimiento ya ejecutado' : 'Borrar fecha y acción de este seguimiento'}
          className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-slate-500 bg-slate-100 rounded-lg hover:bg-red-50 hover:text-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <RotateCcw size={10} />
          Resetear
        </button>
      </div>
    );
  };

  const modal = (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Calendar size={16} className="text-amber-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Programar Seguimientos</h2>
              <p className="text-xs text-slate-400">{lead.nombre} {lead.apellido}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              <AlertCircle size={14} className="shrink-0" />
              {error}
            </div>
          )}

          {/* Seguimiento 1 */}
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-3">
            <SegHeader num={1} locked={false} color="bg-amber-500" />
            <div>
              <label className={labelClass}>Fecha</label>
              <input type="date" value={fechaSeg1} onChange={e => setFechaSeg1(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Acción a ejecutar</label>
              <textarea rows={2} value={accionSeg1} onChange={e => setAccionSeg1(e.target.value)} placeholder="ej: Llamar para confirmar medidas del espacio" className={textareaClass} />
            </div>
            <SegControls fecha={fechaSeg1} estado={estadoSeg1} locked={false} isExecuted={estadoSeg1 === 'Ejecutado'} onEstadoChange={setEstadoSeg1} onReset={() => { setFechaSeg1(''); setAccionSeg1(''); setEstadoSeg1(''); }} />
          </div>

          {/* Seguimiento 2 */}
          <div className={`p-4 rounded-xl border space-y-3 transition-opacity ${seg2Locked ? 'border-slate-200 bg-slate-50/50 opacity-60' : 'border-amber-100 bg-amber-50/20'}`}>
            <SegHeader num={2} locked={seg2Locked} color="bg-amber-400" />
            <div>
              <label className={labelClass}>Fecha</label>
              <input type="date" value={fechaSeg2} min={fechaSeg1 ? fechaSeg1 : undefined} disabled={seg2Locked} onChange={e => setFechaSeg2(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Acción a ejecutar</label>
              <textarea rows={2} value={accionSeg2} disabled={seg2Locked} onChange={e => setAccionSeg2(e.target.value)} placeholder="ej: Enviar cotización definitiva" className={textareaClass} />
            </div>
            <SegControls fecha={fechaSeg2} estado={estadoSeg2} locked={seg2Locked} isExecuted={estadoSeg2 === 'Ejecutado'} onEstadoChange={setEstadoSeg2} onReset={() => { setFechaSeg2(''); setAccionSeg2(''); setEstadoSeg2(''); }} />
          </div>

          {/* Seguimiento 3 */}
          <div className={`p-4 rounded-xl border space-y-3 transition-opacity ${seg3Locked ? 'border-slate-200 bg-slate-50/50 opacity-60' : 'border-slate-200 bg-slate-50/40'}`}>
            <SegHeader num={3} locked={seg3Locked} color="bg-slate-400" />
            <div>
              <label className={labelClass}>Fecha</label>
              <input type="date" value={fechaSeg3} min={fechaSeg2 ? fechaSeg2 : undefined} disabled={seg3Locked} onChange={e => setFechaSeg3(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Acción a ejecutar</label>
              <textarea rows={2} value={accionSeg3} disabled={seg3Locked} onChange={e => setAccionSeg3(e.target.value)} placeholder="ej: WA de reactivación con propuesta renovada" className={textareaClass} />
            </div>
            <SegControls fecha={fechaSeg3} estado={estadoSeg3} locked={seg3Locked} isExecuted={estadoSeg3 === 'Ejecutado'} onEstadoChange={setEstadoSeg3} onReset={() => { setFechaSeg3(''); setAccionSeg3(''); setEstadoSeg3(''); }} />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors">
            <Save size={13} />
            Guardar Seguimientos
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default NurturingScheduleModal;
