
import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLeads } from '../context/LeadsContext';
import { CrmStatus, PipelineConfig, Lead } from '../types';
import { ArrowDown, DollarSign, Users, Settings2, Target, Calendar, Eye, X } from 'lucide-react';
import PipelineConfigModal from './PipelineConfigModal';

// Define the logical funnel order (excluding Lost/Trash)
const FUNNEL_STAGES = [
  { id: CrmStatus.NUEVO, label: 'Nuevos', color: 'bg-slate-100 border-slate-200 text-slate-600' },
  { id: CrmStatus.SEGUIMIENTO, label: 'Contactado', color: 'bg-blue-50 border-blue-200 text-blue-700' },
  { id: CrmStatus.AGENDADO, label: 'Agendado', color: 'bg-purple-50 border-purple-200 text-purple-700' },
  { id: CrmStatus.COTIZADO, label: 'Cotizado', color: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
  { id: CrmStatus.GANADOS, label: 'Vendido', color: 'bg-green-50 border-green-200 text-green-700' }
];

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const CONFIG_KEYS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

// Helper to parse currency strings
const parseValue = (val: string | undefined): number => {
    if (!val) return 0;
    return parseInt(val.replace(/\D/g, '')) || 0;
};

// Helper format
const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0
    }).format(amount);
};

// Helper compact
const formatCompact = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        notation: 'compact',
        maximumFractionDigits: 1
    }).format(amount);
};

const PipelineView: React.FC = () => {
  const { leads, pipelineConfig } = useLeads(); // Use 'leads' (raw) instead of filteredLeads
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [detailStage, setDetailStage] = useState<string | null>(null);

  // LOCK TO CURRENT MONTH
  const currentDate = new Date();
  const currentMonthIndex = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // --- 1. LOCAL FILTERING BY MONTH ---
  const currentMonthLeads = useMemo(() => {
      // Calculate 30 days ago for "Nuevos" filter
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      return leads.filter(l => {
          // 1. Logic for GANADOS (Vendido) - Strict Monthly Filter
          if (l.crmStatus === CrmStatus.GANADOS) {
               // PRIORITY & STRICT: Use FECHA VENTA.
               // If fechaVenta is empty, DO NOT show in the monthly pipeline.
               if (!l.fechaVenta) return false;

               // Parse YYYY-MM-DD safely
               const [y, m] = l.fechaVenta.split('-').map(Number);

               // Month check (m is 1-12, currentMonthIndex is 0-11)
               if (!isNaN(y) && !isNaN(m)) {
                   return (m - 1) === currentMonthIndex && y === currentYear;
               }

               // Fallback for full ISO strings if any
               const dateObj = new Date(l.fechaVenta);
               return dateObj.getMonth() === currentMonthIndex && dateObj.getFullYear() === currentYear;
          }

          // 2. Logic for NUEVOS (New) - Only last 30 days
          if (l.crmStatus === CrmStatus.NUEVO) {
              if (!l.createdAt) return false;
              const createdDate = new Date(l.createdAt);
              return createdDate >= thirtyDaysAgo;
          }

          // 3. For other active leads (Snapshot view), include all.
          // Exclude Lost/Trash
          return l.crmStatus !== CrmStatus.PERDIDO && l.crmStatus !== CrmStatus.FUERA_PUBLICO;
      });
  }, [leads, currentMonthIndex, currentYear]);


  const funnelMetrics = useMemo(() => {
    // 1. Calculate SNAPSHOT counts
    const snapshotCounts: Record<string, { count: number, value: number }> = {};
    FUNNEL_STAGES.forEach(stage => snapshotCounts[stage.id] = { count: 0, value: 0 });

    let totalActiveValue = 0;

    currentMonthLeads.forEach(lead => {
        if (!snapshotCounts[lead.crmStatus]) return;

        snapshotCounts[lead.crmStatus].count += 1;
        const v = parseValue(lead.valor);
        snapshotCounts[lead.crmStatus].value += v;
        totalActiveValue += v;
    });

    // 2. Calculate ACCUMULATED Funnel Flow (Downstream accumulation)
    const funnelStats = FUNNEL_STAGES.map((stage, index) => {
        let accumulatedCount = 0;
        let accumulatedValue = 0;

        for (let i = index; i < FUNNEL_STAGES.length; i++) {
            const nextStageId = FUNNEL_STAGES[i].id;
            accumulatedCount += snapshotCounts[nextStageId].count;
            accumulatedValue += snapshotCounts[nextStageId].value;
        }

        return {
            ...stage,
            currentCount: snapshotCounts[stage.id].count,
            currentValue: snapshotCounts[stage.id].value,
            accumulatedCount,
            accumulatedValue
        };
    });

    return { funnelStats, totalActiveValue };

  }, [currentMonthLeads]);


  // --- 2. GOAL CALCULATIONS ---
  const goals = useMemo(() => {
      if (!pipelineConfig) return null;

      const monthKey = CONFIG_KEYS[currentMonthIndex] as keyof PipelineConfig;
      const salesGoal = (pipelineConfig[monthKey] as number) || 0;

      // card2 = Cotizado (plays role of Negociación in Flapz)
      const cotizadoGoal = salesGoal * pipelineConfig.NEG_MULT;
      // card3 = Agendado (plays role of Cotizado in Flapz)
      const agendadoGoal = cotizadoGoal * pipelineConfig.QUO_MULT;

      // Actuals (Snapshot)
      const wonActual = funnelMetrics.funnelStats.find(s => s.id === CrmStatus.GANADOS)?.currentValue || 0;
      const cotActual = funnelMetrics.funnelStats.find(s => s.id === CrmStatus.COTIZADO)?.currentValue || 0;
      const agdActual = funnelMetrics.funnelStats.find(s => s.id === CrmStatus.AGENDADO)?.currentValue || 0;

      return {
          sales: { goal: salesGoal, actual: wonActual, percent: salesGoal > 0 ? (wonActual / salesGoal) * 100 : 0 },
          neg: { goal: cotizadoGoal, actual: cotActual, percent: cotizadoGoal > 0 ? (cotActual / cotizadoGoal) * 100 : 0 },
          quo: { goal: agendadoGoal, actual: agdActual, percent: agendadoGoal > 0 ? (agdActual / agendadoGoal) * 100 : 0 }
      };
  }, [pipelineConfig, currentMonthIndex, funnelMetrics]);


  // Calculate percentages relative to the first stage (Total Volume) for the Visual Funnel
  const maxVolume = funnelMetrics.funnelStats[0]?.accumulatedCount || 1;

  // Prepare data for the detail modal
  const detailStageLeads = useMemo(() => {
     if (!detailStage) return [];
     return currentMonthLeads.filter(l => l.crmStatus === detailStage);
  }, [currentMonthLeads, detailStage]);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-8 animate-fade-in pb-20">

      {/* Header & Controls */}
      <div className="max-w-4xl mx-auto mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
            <h2 className="text-2xl font-bold text-slate-800">Pipeline de Ventas</h2>
            <p className="text-sm text-slate-500">Gestión de flujo y cumplimiento de metas.</p>
        </div>

        <div className="flex items-center gap-3">
             {/* Current Month Display (Read Only) */}
             <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm">
                 <Calendar size={16} className="text-blue-500"/>
                 <span className="text-sm font-bold text-slate-700 capitalize">
                    {MONTH_NAMES[currentMonthIndex]} {currentYear}
                 </span>
             </div>

             {/* Config Button */}
             <button
                onClick={() => setIsConfigOpen(true)}
                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Configurar Presupuesto"
             >
                <Settings2 size={20} />
             </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">

        {/* --- GOAL DASHBOARD WIDGET --- */}
        {goals && (
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* 1. SALES GOAL */}
                <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 relative overflow-hidden">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-green-100 text-green-700 rounded-lg">
                            <DollarSign size={20} />
                        </div>
                        <span className="text-xs font-bold uppercase text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                            Ventas (Vendido)
                        </span>
                    </div>

                    <div className="flex items-baseline gap-1 mb-1">
                        <span className="text-2xl font-bold text-slate-800">{formatCompact(goals.sales.actual)}</span>
                        <span className="text-xs text-slate-400 font-medium">/ {formatCompact(goals.sales.goal)}</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-2">
                        <div
                            className={`h-full rounded-full transition-all duration-1000 ${goals.sales.percent >= 100 ? 'bg-green-500' : 'bg-green-400'}`}
                            style={{ width: `${Math.min(goals.sales.percent, 100)}%` }}
                        ></div>
                    </div>
                    <div className="text-right text-xs font-bold text-slate-500">{goals.sales.percent.toFixed(1)}% Cumplimiento</div>
                </div>

                {/* 2. COTIZADO GOAL */}
                <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 relative overflow-hidden">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                            <Users size={20} />
                        </div>
                         <div className="text-right">
                             <span className="text-xs font-bold uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full block mb-1">
                                Cotizado
                             </span>
                             <span className="text-[10px] text-slate-400">Target x{pipelineConfig?.NEG_MULT}</span>
                         </div>
                    </div>

                     <div className="flex items-baseline gap-1 mb-1">
                        <span className="text-2xl font-bold text-slate-800">{formatCompact(goals.neg.actual)}</span>
                        <span className="text-xs text-slate-400 font-medium">/ {formatCompact(goals.neg.goal)}</span>
                    </div>

                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-2">
                        <div
                             className={`h-full rounded-full transition-all duration-1000 ${goals.neg.percent >= 100 ? 'bg-indigo-500' : 'bg-indigo-400'}`}
                            style={{ width: `${Math.min(goals.neg.percent, 100)}%` }}
                        ></div>
                    </div>
                     <div className="text-right text-xs font-bold text-slate-500">{goals.neg.percent.toFixed(1)}% Cobertura</div>
                </div>

                {/* 3. AGENDADO GOAL */}
                <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 relative overflow-hidden">
                    <div className="flex justify-between items-start mb-4">
                         <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
                            <Target size={20} />
                        </div>
                         <div className="text-right">
                             <span className="text-xs font-bold uppercase text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full block mb-1">
                                Agendado
                             </span>
                             <span className="text-[10px] text-slate-400">Target x{pipelineConfig?.QUO_MULT}</span>
                         </div>
                    </div>

                    <div className="flex items-baseline gap-1 mb-1">
                        <span className="text-2xl font-bold text-slate-800">{formatCompact(goals.quo.actual)}</span>
                        <span className="text-xs text-slate-400 font-medium">/ {formatCompact(goals.quo.goal)}</span>
                    </div>

                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-2">
                        <div
                             className={`h-full rounded-full transition-all duration-1000 ${goals.quo.percent >= 100 ? 'bg-purple-500' : 'bg-purple-400'}`}
                            style={{ width: `${Math.min(goals.quo.percent, 100)}%` }}
                        ></div>
                    </div>
                    <div className="text-right text-xs font-bold text-slate-500">{goals.quo.percent.toFixed(1)}% Cobertura</div>
                </div>

             </div>
        )}

        {/* --- VISUAL FUNNEL --- */}
        {funnelMetrics.funnelStats.map((stage, index) => {
            const prevStage = funnelMetrics.funnelStats[index - 1];

            // Conversion Rate Calculation based on ACCUMULATED flow
            let conversionRate = 100;
            if (prevStage && prevStage.accumulatedCount > 0) {
                conversionRate = (stage.accumulatedCount / prevStage.accumulatedCount) * 100;
            } else if (prevStage && prevStage.accumulatedCount === 0) {
                conversionRate = 0;
            }

            const widthPercentage = Math.max((stage.accumulatedCount / maxVolume) * 100, 5);

            // Show "Ver Lista" button for COTIZADO and GANADOS
            const isInteractiveStage = stage.id === CrmStatus.COTIZADO || stage.id === CrmStatus.GANADOS;

            return (
                <div key={stage.id} className="relative group">

                    {index > 0 && (
                        <div className="h-8 flex justify-center items-center relative py-1">
                             <div className="absolute left-1/2 -translate-x-1/2 h-full w-[2px] bg-slate-200"></div>
                             <div className="z-10 bg-white border border-slate-200 px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-500 shadow-sm flex items-center gap-1">
                                <ArrowDown size={10} />
                                {conversionRate.toFixed(1)}% conversión
                             </div>
                        </div>
                    )}

                    <div className="flex items-stretch bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow relative">
                        <div className={`w-32 md:w-48 p-4 flex flex-col justify-center border-r border-slate-100 ${stage.color} bg-opacity-10`}>
                            <h3 className="font-bold text-sm md:text-base">{stage.label}</h3>

                            {/* ACTION BUTTON FOR COTIZADO AND GANADOS */}
                            {isInteractiveStage && (
                                <button
                                    onClick={() => setDetailStage(stage.id)}
                                    className="mt-2 flex items-center gap-1 text-[10px] font-bold uppercase text-slate-500 hover:text-blue-600 bg-white/60 hover:bg-white px-2 py-1 rounded border border-transparent hover:border-blue-200 transition-all w-fit shadow-sm"
                                >
                                    <Eye size={12} /> Ver Lista
                                </button>
                            )}
                        </div>

                        <div className="flex-1 p-4 flex flex-col justify-center relative bg-slate-50/50">
                             <div className="flex justify-between text-xs text-slate-400 mb-1 px-1">
                                <span>Actualmente: <strong>{stage.currentCount}</strong></span>
                                <span>{formatMoney(stage.currentValue)}</span>
                             </div>

                             <div className="h-4 w-full bg-slate-200 rounded-full overflow-hidden relative">
                                <div
                                    className={`h-full rounded-full transition-all duration-1000 ease-out ${stage.color.replace('text-', 'bg-').replace('border-', '')}`}
                                    style={{ width: `${widthPercentage}%` }}
                                ></div>
                             </div>
                        </div>

                        <div className="w-40 md:w-56 p-4 flex flex-col justify-center items-end border-l border-slate-100 bg-white">
                            <div className="flex items-center gap-1.5 text-slate-800 font-bold text-lg md:text-xl">
                                <Users size={18} className="text-slate-400" />
                                {stage.id === CrmStatus.COTIZADO ? stage.currentCount : stage.accumulatedCount}
                            </div>
                            <div className="flex items-center gap-1 text-slate-600 font-semibold text-sm mt-1">
                                <DollarSign size={14} className="text-slate-400" />
                                {new Intl.NumberFormat('es-CO', { notation: "compact", maximumFractionDigits: 1 }).format(
                                    stage.id === CrmStatus.COTIZADO ? stage.currentValue : stage.accumulatedValue
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            );
        })}

      </div>

      <PipelineConfigModal isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} />

      {/* STAGE DETAIL LIST MODAL */}
      {detailStage && (
          <StageDetailModal
            isOpen={true}
            onClose={() => setDetailStage(null)}
            title={FUNNEL_STAGES.find(s => s.id === detailStage)?.label || ''}
            leads={detailStageLeads}
            stageId={detailStage}
          />
      )}
    </div>
  );
};

interface StageDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  leads: Lead[];
  stageId: string;
}

const StageDetailModal: React.FC<StageDetailModalProps> = ({ isOpen, onClose, title, leads, stageId }) => {
    if (!isOpen) return null;

    const formatVal = (val: string) => {
        const num = parseInt(val.replace(/\D/g, '')) || 0;
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(num);
    };

    return createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in" onClick={onClose}>
             <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[85vh] animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <div className="bg-slate-900 px-6 py-4 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-600 p-2 rounded-lg text-white">
                           <Users size={20} />
                        </div>
                        <div>
                           <h2 className="text-white text-lg font-bold">Leads en: {title}</h2>
                           <p className="text-slate-400 text-xs">{leads.length} registros encontrados</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors bg-slate-800 p-2 rounded-full hover:bg-slate-700">
                        <X size={20}/>
                    </button>
                </div>

                <div className="overflow-y-auto bg-slate-50 flex-1 p-6">
                   {leads.length === 0 ? (
                       <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
                           <Users size={48} className="mb-4 opacity-20"/>
                           <p>No se encontraron leads en esta etapa para el periodo seleccionado.</p>
                       </div>
                   ) : (
                       <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                           <table className="w-full text-left text-sm border-collapse">
                              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[11px] tracking-wider border-b border-slate-200">
                                <tr>
                                    <th className="p-4">Cliente</th>
                                    <th className="p-4">Producto</th>
                                    <th className="p-4">Ubicación</th>
                                    <th className="p-4 text-right">Valor Estimado</th>
                                    {stageId === CrmStatus.GANADOS && <th className="p-4 text-right">Fecha Venta</th>}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {leads.map(lead => (
                                    <tr key={lead.id} className="hover:bg-blue-50/30 transition-colors">
                                        <td className="p-4">
                                            <div className="font-bold text-slate-800">{lead.nombre} {lead.apellido}</div>
                                            <div className="text-xs text-slate-500">{lead.correo || lead.whatsapp}</div>
                                        </td>
                                        <td className="p-4">
                                            <span className="inline-block bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-medium border border-slate-200">
                                                {lead.aeronave || 'No definido'}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-slate-700">{lead.origen || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right font-mono text-slate-700 font-medium">
                                            {formatVal(lead.valor)}
                                        </td>

                                        {/* Fecha Venta (only for GANADOS/Vendido) */}
                                        {stageId === CrmStatus.GANADOS && (
                                            <td className="p-4 text-right text-slate-800 font-bold text-xs bg-green-50/50">
                                                {lead.fechaVenta || '-'}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                              </tbody>
                           </table>
                       </div>
                   )}
                </div>

                <div className="p-4 bg-white border-t border-slate-200 flex justify-end shrink-0">
                    <button onClick={onClose} className="px-5 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors text-sm">
                        Cerrar Listado
                    </button>
                </div>
             </div>
        </div>,
        document.body
    );
};

export default PipelineView;
