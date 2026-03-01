import React, { useMemo } from 'react';
import { Lead, NurturingStatus, QualityIndicator } from '../types';
import { useLeads } from '../context/LeadsContext';
import NQLLeadCard from './NQLLeadCard';

// Column configuration for the NQL nurturing pipeline
const NURTURING_COLUMNS: {
  status: NurturingStatus;
  label: string;
  color: string;
  headerBg: string;
  dot: string;
}[] = [
  {
    status: NurturingStatus.LANDING,
    label: 'Landing',
    color: 'border-t-sky-400',
    headerBg: 'bg-sky-50',
    dot: 'bg-sky-400',
  },
  {
    status: NurturingStatus.SEGUIMIENTO_1,
    label: 'Seguimiento 1',
    color: 'border-t-amber-400',
    headerBg: 'bg-amber-50',
    dot: 'bg-amber-400',
  },
  {
    status: NurturingStatus.SEGUIMIENTO_2,
    label: 'Seguimiento 2',
    color: 'border-t-amber-500',
    headerBg: 'bg-amber-50',
    dot: 'bg-amber-500',
  },
  {
    status: NurturingStatus.SEGUIMIENTO_3,
    label: 'Seguimiento 3',
    color: 'border-t-amber-600',
    headerBg: 'bg-amber-50',
    dot: 'bg-amber-600',
  },
  {
    status: NurturingStatus.SECUENCIA_EMAIL,
    label: 'Secuencia Email',
    color: 'border-t-violet-400',
    headerBg: 'bg-violet-50',
    dot: 'bg-violet-400',
  },
  {
    status: NurturingStatus.PAUSADO,
    label: 'Pausado',
    color: 'border-t-slate-400',
    headerBg: 'bg-slate-50',
    dot: 'bg-slate-400',
  },
  {
    status: NurturingStatus.DESCARTADO,
    label: 'Descartado',
    color: 'border-t-red-400',
    headerBg: 'bg-red-50',
    dot: 'bg-red-400',
  },
];

const NQLKanbanBoard: React.FC = () => {
  const { nqlLeads, filters, updateNurturingStatus } = useLeads();

  // Apply shared filters (excluding quality — always NQL; and excluding limit/time-range
  // to avoid hiding overdue follow-up alerts for old leads)
  const filteredNqlLeads = useMemo(() => {
    let result = [...nqlLeads];

    // Search
    const term = filters.searchTerm.toLowerCase();
    if (term) {
      result = result.filter(lead =>
        String(lead.nombre || '').toLowerCase().includes(term) ||
        String(lead.apellido || '').toLowerCase().includes(term) ||
        String(lead.correo || '').toLowerCase().includes(term) ||
        String(lead.whatsapp || '').includes(term) ||
        String(lead.destino || '').toLowerCase().includes(term)
      );
    }

    // Campaign
    if (filters.campana) {
      result = result.filter(l => l.campana === filters.campana);
    }

    // Source
    if (filters.source) {
      result = result.filter(l => l.source === filters.source);
    }

    // Flight timeframe
    if (filters.vuelaEn) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      result = result.filter(lead => {
        if (!lead.fecha) return false;
        const [y, m, d] = lead.fecha.split('-').map(Number);
        const leadDate = new Date(y, m - 1, d);
        const diffDays = Math.ceil((leadDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        switch (filters.vuelaEn) {
          case 'vuelo_vigente': return diffDays >= 0;
          case 'past_flights': return diffDays < 0;
          case '1_week': return diffDays >= 0 && diffDays <= 7;
          case '2_weeks': return diffDays > 7 && diffDays <= 14;
          case '3_weeks': return diffDays > 14 && diffDays <= 21;
          case 'plus_3_weeks': return diffDays > 21;
          default: return true;
        }
      });
    }

    // Sort
    result.sort((a, b) => {
      const dA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return filters.sortOrder === 'desc' ? dB - dA : dA - dB;
    });

    return result;
  }, [nqlLeads, filters]);

  // Group by nurturing status
  const leadsByStatus = useMemo(() => {
    const map = new Map<NurturingStatus, Lead[]>();
    NURTURING_COLUMNS.forEach(col => map.set(col.status, []));

    filteredNqlLeads.forEach(lead => {
      const status = (lead.nurturingStatus as NurturingStatus) || NurturingStatus.LANDING;
      const bucket = map.get(status);
      if (bucket) {
        bucket.push(lead);
      } else {
        // Unknown status → Landing
        map.get(NurturingStatus.LANDING)!.push(lead);
      }
    });

    return map;
  }, [filteredNqlLeads]);

  const totalLeads = filteredNqlLeads.length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Board header */}
      <div className="px-4 py-2 border-b border-slate-200 bg-white flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-teal-500"></span>
          <span className="text-sm font-bold text-slate-700">Pipeline Nurturing</span>
          <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 text-xs font-semibold">{totalLeads} NQL</span>
        </div>
        <p className="text-xs text-slate-400">Leads en proceso de maduración hacia SQL</p>
      </div>

      {/* Columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full gap-3 px-4 py-3 min-w-max">
          {NURTURING_COLUMNS.map(col => {
            const colLeads = leadsByStatus.get(col.status) || [];
            return (
              <div
                key={col.status}
                className={`flex flex-col w-64 shrink-0 bg-white rounded-xl border border-slate-200 border-t-4 ${col.color} shadow-sm overflow-hidden`}
              >
                {/* Column header */}
                <div className={`flex items-center justify-between px-3 py-2.5 ${col.headerBg} border-b border-slate-100`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${col.dot}`}></span>
                    <span className="text-xs font-bold text-slate-700 truncate">{col.label}</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-500 bg-white px-1.5 py-0.5 rounded-full border border-slate-200 shrink-0">
                    {colLeads.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {colLeads.length === 0 ? (
                    <div className="flex items-center justify-center h-16 text-slate-300 text-xs">
                      Sin leads
                    </div>
                  ) : (
                    colLeads.map(lead => (
                      <NQLLeadCard
                        key={lead.id}
                        lead={lead}
                        onStatusChange={updateNurturingStatus}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default NQLKanbanBoard;
