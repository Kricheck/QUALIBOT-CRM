
import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Calculator, ArrowRight, DollarSign, TrendingUp } from 'lucide-react';
import { useLeads } from '../context/LeadsContext';
import { PipelineConfig, CrmStatus } from '../types';

interface PipelineConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

// Helper to format currency nicely
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0
    }).format(amount);
};

// Helper for input display (just numbers and dots)
const formatNumber = (amount: number) => {
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(amount);
};

const PipelineConfigModal: React.FC<PipelineConfigModalProps> = ({ isOpen, onClose }) => {
  const { pipelineConfig, updatePipelineConfig, leads } = useLeads();
  const [formData, setFormData] = useState<PipelineConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Refs for managing cursor position on currency inputs
  const inputsRef = useRef<Record<string, HTMLInputElement | null>>({});
  const cursorRef = useRef<{ id: string, pos: number } | null>(null);

  useEffect(() => {
    if (isOpen && pipelineConfig) {
      setFormData({ ...pipelineConfig });
    } else if (isOpen && !pipelineConfig) {
      // Inicializar con valores por defecto si no existe config
      setFormData({
          YEAR: new Date().getFullYear(),
          ENE: 0, FEB: 0, MAR: 0, ABR: 0, MAY: 0, JUN: 0,
          JUL: 0, AGO: 0, SEP: 0, OCT: 0, NOV: 0, DIC: 0,
          NEG_MULT: 3.0,
          QUO_MULT: 3.0
      });
    }
  }, [isOpen, pipelineConfig]);

  // Restore cursor position after render
  useLayoutEffect(() => {
      if (cursorRef.current && formData) {
          const { id, pos } = cursorRef.current;
          const input = inputsRef.current[id];
          if (input) {
              input.setSelectionRange(pos, pos);
          }
          cursorRef.current = null;
      }
  }, [formData]);

  const handleChange = (field: keyof PipelineConfig, value: string) => {
    const num = parseFloat(value) || 0;
    setFormData(prev => prev ? { ...prev, [field]: num } : null);
  };

  const handleCurrencyChange = (field: keyof PipelineConfig, e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const val = input.value;
      const currentCursorPos = input.selectionStart || 0;

      // Logic to preserve cursor: count digits before cursor in the RAW value
      const digitsBeforeCursor = val.slice(0, currentCursorPos).replace(/\D/g, '').length;

      const rawNum = parseInt(val.replace(/\D/g, '')) || 0;

      // Calculate new formatted string to determine new cursor position
      const formattedNext = formatNumber(rawNum);

      let newCursorPos = 0;
      let digitsEncountered = 0;
      for (let i = 0; i < formattedNext.length; i++) {
        if (digitsEncountered === digitsBeforeCursor) break;
        if (/\d/.test(formattedNext[i])) digitsEncountered++;
        newCursorPos++;
      }

      cursorRef.current = { id: field as string, pos: newCursorPos };

      setFormData(prev => prev ? { ...prev, [field]: rawNum } : null);
  };

  const handleSave = async () => {
      if (!formData) return;
      setIsSaving(true);
      await updatePipelineConfig(formData);
      setIsSaving(false);
      onClose();
  };

  // Calculate Actual Sales per Month (WON deals) based on Lead Data
  const monthlyActuals = useMemo(() => {
      const actuals = new Array(12).fill(0);
      const targetYear = formData?.YEAR || new Date().getFullYear();

      leads.forEach(lead => {
          if (lead.crmStatus !== CrmStatus.GANADOS) return;

          // PRIORITY: Use FECHA VENTA if available.
          // Fallback: Flight Date (fecha) -> Creation Date (createdAt)
          const dateStr = lead.fechaVenta || lead.fecha || lead.createdAt;
          if (!dateStr) return;

          const d = new Date(dateStr);
          // Strict check: Year must match config year
          if (d.getFullYear() === targetYear) {
              const month = d.getMonth(); // 0-11
              if (month >= 0 && month < 12) {
                  const val = parseInt((lead.valor || '0').replace(/\D/g, '')) || 0;
                  actuals[month] += val;
              }
          }
      });
      return actuals;
  }, [leads, formData?.YEAR]);

  if (!isOpen || !formData) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
             <div className="bg-blue-600 p-2 rounded-lg text-white">
                <Calculator size={20}/>
             </div>
             <div>
                <h2 className="text-white text-lg font-bold leading-tight">Configuración de Metas</h2>
                <p className="text-slate-400 text-xs">Define presupuestos y revisa cumplimiento.</p>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50">

            {/* MATRIX TABLE */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        {/* Header Row: Column Titles & Multipliers Inputs */}
                        <tr className="bg-slate-100 border-b border-slate-200">
                            <th className="py-4 px-4 font-bold text-slate-700 w-24 text-center">Mes</th>

                            {/* Columna: Ventas (Input) */}
                            <th className="py-4 px-4 border-l border-slate-200 w-1/5 bg-green-50/50">
                                <div className="flex flex-col gap-1">
                                    <div className="flex justify-between items-start">
                                        <span className="text-xs uppercase tracking-wider font-bold text-green-700">Meta Ventas</span>
                                        <ArrowRight size={14} className="text-green-300"/>
                                    </div>
                                    <span className="text-[10px] text-green-600 font-normal bg-green-100 px-2 py-0.5 rounded-full w-fit">
                                        Input Manual
                                    </span>
                                </div>
                            </th>

                            {/* Columna: Cotizado (Calculada — plays role of Negociación in Flapz) */}
                            <th className="py-4 px-4 border-l border-slate-200 w-1/5 bg-fuchsia-50/50">
                                <div className="flex flex-col gap-2">
                                    <div className="flex justify-between items-start">
                                        <span className="text-xs uppercase tracking-wider font-bold text-fuchsia-700">Meta Cotizado</span>
                                        <ArrowRight size={14} className="text-fuchsia-300"/>
                                    </div>

                                    {/* Multiplier Input inside Header */}
                                    <div className="flex items-center gap-2 bg-white p-1.5 rounded border border-fuchsia-200 shadow-sm">
                                        <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">Ventas x</span>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={formData.NEG_MULT}
                                            onChange={e => handleChange('NEG_MULT', e.target.value)}
                                            className="w-16 text-center font-bold text-slate-900 border-b border-slate-300 focus:border-fuchsia-500 focus:outline-none bg-transparent text-sm"
                                        />
                                    </div>
                                </div>
                            </th>

                            {/* Columna: Agendado (Calculada — plays role of Cotizado in Flapz) */}
                            <th className="py-4 px-4 border-l border-slate-200 w-1/5 bg-indigo-50/50">
                                <div className="flex flex-col gap-2">
                                    <div className="flex justify-between items-start">
                                        <span className="text-xs uppercase tracking-wider font-bold text-indigo-700">Meta Agendado</span>
                                    </div>

                                    {/* Multiplier Input inside Header */}
                                    <div className="flex items-center gap-2 bg-white p-1.5 rounded border border-indigo-200 shadow-sm">
                                        <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">Cotizado x</span>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={formData.QUO_MULT}
                                            onChange={e => handleChange('QUO_MULT', e.target.value)}
                                            className="w-16 text-center font-bold text-slate-900 border-b border-slate-300 focus:border-indigo-500 focus:outline-none bg-transparent text-sm"
                                        />
                                    </div>
                                </div>
                            </th>

                            {/* New Column: Ventas Reales (Actuals) */}
                            <th className="py-4 px-4 border-l border-slate-200 w-1/5 bg-slate-100">
                                <div className="flex flex-col gap-1 items-end">
                                    <span className="text-xs uppercase tracking-wider font-bold text-slate-600">Ventas Reales</span>
                                    <div className="flex items-center gap-1 text-[10px] text-slate-500 font-normal bg-white px-2 py-0.5 rounded-full border border-slate-200">
                                        <TrendingUp size={10} /> Vendido
                                    </div>
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {MONTHS.map((month, index) => {
                            const key = month as keyof PipelineConfig;
                            const salesVal = formData[key] as number;
                            const cotVal = salesVal * formData.NEG_MULT;
                            const agdVal = cotVal * formData.QUO_MULT;

                            // Actuals Data
                            const actualVal = monthlyActuals[index];
                            const percent = salesVal > 0 ? (actualVal / salesVal) * 100 : 0;

                            return (
                                <tr key={month} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                    {/* Month Label */}
                                    <td className="py-3 px-4 font-bold text-slate-500 text-center bg-slate-50/50">
                                        {month}
                                    </td>

                                    {/* SALES INPUT (Controlled with Currency Mask) */}
                                    <td className="py-3 px-4 border-l border-slate-100">
                                        <div className="relative group">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-green-500 transition-colors pointer-events-none">
                                                <DollarSign size={14} />
                                            </div>
                                            <input
                                                ref={(el) => { inputsRef.current[key as string] = el; }}
                                                type="text"
                                                value={salesVal ? formatNumber(salesVal) : ''}
                                                onChange={e => handleCurrencyChange(key, e)}
                                                placeholder="0"
                                                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-md font-semibold text-slate-900 focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none transition-all shadow-sm"
                                            />
                                        </div>
                                    </td>

                                    {/* COTIZADO CALC */}
                                    <td className="py-3 px-4 border-l border-slate-100 text-right">
                                        <div className="py-2 px-3 bg-fuchsia-50 rounded-md border border-fuchsia-100 font-medium text-fuchsia-800 truncate">
                                            {formatCurrency(cotVal)}
                                        </div>
                                    </td>

                                    {/* AGENDADO CALC */}
                                    <td className="py-3 px-4 border-l border-slate-100 text-right">
                                        <div className="py-2 px-3 bg-indigo-50 rounded-md border border-indigo-100 font-medium text-indigo-800 truncate">
                                            {formatCurrency(agdVal)}
                                        </div>
                                    </td>

                                    {/* ACTUAL SALES (READ ONLY) */}
                                    <td className="py-3 px-4 border-l border-slate-200 bg-slate-50/30 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="font-bold text-slate-700">{formatCurrency(actualVal)}</span>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full inline-block mt-0.5 ${
                                                percent >= 100 ? 'bg-green-100 text-green-700' :
                                                percent >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-200 text-slate-500'
                                            }`}>
                                                {percent.toFixed(1)}%
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <p className="mt-4 text-xs text-slate-400 text-center">
                * Las metas de "Cotizado" y "Agendado" son calculadas. "Ventas Reales" muestra lo facturado en CRM (Estado: Vendido) para el año fiscal seleccionado.
            </p>

        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center shrink-0">
             <div className="text-xs text-slate-400 font-medium">
                Año Fiscal: <span className="text-slate-800 font-bold">{formData.YEAR}</span>
             </div>
             <div className="flex gap-3">
                <button
                    onClick={onClose}
                    className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors text-sm"
                >
                    Cancelar
                </button>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm flex items-center gap-2 transition-colors disabled:opacity-50 text-sm"
                >
                    {isSaving ? 'Guardando...' : <><Save size={18} /> Guardar Cambios</>}
                </button>
            </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PipelineConfigModal;
