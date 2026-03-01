
import React from 'react';
import { useLeads } from '../context/LeadsContext';
import { CrmStatus } from '../types';
import LeadCard from './LeadCard';

const COLUMNS = [
  { id: CrmStatus.NUEVO, title: 'Nuevos', color: 'bg-slate-100', border: 'border-slate-200' },
  { id: CrmStatus.SEGUIMIENTO, title: 'Contactado', color: 'bg-blue-50', border: 'border-blue-200' },
  { id: CrmStatus.AGENDADO, title: 'Agendado', color: 'bg-purple-50', border: 'border-purple-200' },
  { id: CrmStatus.COTIZADO, title: 'Cotizado', color: 'bg-indigo-50', border: 'border-indigo-200' },
  { id: CrmStatus.GANADOS, title: 'Ganados', color: 'bg-green-50', border: 'border-green-200' },
  { id: CrmStatus.PERDIDO, title: 'Perdido', color: 'bg-red-50', border: 'border-red-200' },
  { id: CrmStatus.FUERA_PUBLICO, title: 'Fuera de Público', color: 'bg-gray-200', border: 'border-gray-300' },
];

const KanbanBoard: React.FC = () => {
  const { filteredLeads, loading, updateLeadStatus } = useLeads();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-80px)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const handleMoveStage = (leadId: string, direction: -1 | 1) => {
    const lead = filteredLeads.find(l => l.id === leadId);
    if (!lead) return;

    // LÓGICA ESPECIAL: Recuperación de Leads
    // Si está en 'Perdido' o 'Fuera de Público' y se mueve atrás (-1), vuelve a 'Contactado' (SEGUIMIENTO)
    // NOTA: Podríamos cambiar esto para que vuelva a 'Agendado' si quisieras, pero 'Contactado' es más seguro como default.
    if (direction === -1 && (lead.crmStatus === CrmStatus.PERDIDO || lead.crmStatus === CrmStatus.FUERA_PUBLICO)) {
      updateLeadStatus(leadId, CrmStatus.SEGUIMIENTO);
      return;
    }

    // LÓGICA ESTÁNDAR LINEAL
    const currentIndex = COLUMNS.findIndex(col => col.id === lead.crmStatus);
    if (currentIndex === -1) return;

    const newIndex = currentIndex + direction;

    if (newIndex >= 0 && newIndex < COLUMNS.length) {
      const nextStatus = COLUMNS[newIndex].id;
      updateLeadStatus(leadId, nextStatus);
    }
  };

  return (
    <div className="flex-1 overflow-x-auto overflow-y-hidden bg-slate-100 p-4">
      <div className="flex flex-nowrap gap-4 h-full min-w-max md:min-w-0">
        
        {COLUMNS.map((column) => {
          const columnLeads = filteredLeads.filter(lead => lead.crmStatus === column.id);
          const totalValue = columnLeads.reduce((acc, lead) => {
             // Simple extraction of numbers from "4500 USD"
             const val = parseInt((lead.valor || '').replace(/[^0-9]/g, '')) || 0;
             return acc + val;
          }, 0);

          return (
            <div key={column.id} className="flex flex-col w-80 md:w-72 lg:w-80 h-full flex-shrink-0">
              {/* Column Header */}
              <div className={`p-3 rounded-t-xl border-t-4 ${column.color} ${column.border} shadow-sm mb-2`}>
                <div className="flex justify-between items-center mb-1">
                    <h2 className="font-bold text-slate-700">{column.title}</h2>
                    <span className="bg-white/50 px-2 py-0.5 rounded-md text-xs font-bold text-slate-600">
                        {columnLeads.length}
                    </span>
                </div>
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Total: ${totalValue.toLocaleString()}
                </div>
              </div>

              {/* Cards Container */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent pb-4">
                {columnLeads.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg">
                    <p className="text-slate-400 text-sm">Sin leads</p>
                  </div>
                ) : (
                  columnLeads.map(lead => (
                    <LeadCard 
                      key={lead.id} 
                      lead={lead} 
                      onMoveStage={handleMoveStage}
                      onStatusChange={updateLeadStatus}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}

      </div>
    </div>
  );
};

export default KanbanBoard;
