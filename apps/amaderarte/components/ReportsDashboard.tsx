
import React, { useMemo, useState, useEffect } from 'react';
import { useLeads } from '../context/LeadsContext';
import { CrmStatus, Lead, QualityIndicator } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, ComposedChart, Line
} from 'recharts';
import { TrendingUp, DollarSign, Users, Target, AlertCircle, MessageSquare, Map, ChevronDown, Percent, Smartphone, MessageCircle } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b', '#06b6d4', '#ec4899'];

// Helper to get max days from global filter key
const getGlobalMaxDays = (filterLimit: string): number => {
    switch (filterLimit) {
        case 'today': return 1;
        case 'yesterday': return 2;
        case '7_days': return 7;
        case '14_days': return 14;
        case '30_days': return 30;
        case 'favorites': return 365; // Treat as 'all' effectively
        case 'all': return 365; // Cap 'all' at a year for chart readability default
        default: return 30;
    }
};

const CustomTooltipCTR = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg text-xs">
                <p className="font-bold text-slate-700 mb-2">{label}</p>
                <div className="space-y-1">
                    <p className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#a855f7]"></span>
                        <span className="text-slate-600">Visitas Únicas: <span className="font-semibold">{data.visitasUnicas}</span></span>
                    </p>
                    <p className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#22c55e]"></span>
                        <span className="text-slate-600">Botón WA: <span className="font-semibold">{data.botonWA}</span></span>
                    </p>
                    <p className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#3b82f6]"></span>
                        <span className="text-slate-600">Botón Landing: <span className="font-semibold">{data.botonLanding}</span></span>
                    </p>
                    <div className="bg-amber-50 text-amber-700 p-1.5 rounded mt-2 text-center font-bold border border-amber-200">
                        CTR: {data.ctr}%
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

const CustomTooltipConversion = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg text-xs">
                <p className="font-bold text-slate-700 mb-2">{label}</p>
                <div className="space-y-1">
                    <p className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#a855f7]"></span>
                        <span className="text-slate-600">Visitas Únicas: <span className="font-semibold">{data.visitasUnicas}</span></span>
                    </p>
                    <p className="flex items-center gap-2 border-t border-slate-100 pt-1 mt-1">
                        <span className="w-2 h-2 rounded-full bg-[#f59e0b]"></span>
                        <span className="text-slate-600">Leads Creados: <span className="font-semibold">{data.leads}</span></span>
                    </p>
                    <div className="bg-green-50 text-green-700 p-1.5 rounded mt-2 text-center font-bold border border-green-200">
                        Conversión: {data.convRate}%
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

const ReportsDashboard: React.FC = () => {
  const { filteredLeads, interactions, filters } = useLeads();
  
  // Local state for the specific chart time range
  const [chartDays, setChartDays] = useState<number>(30);

  // Sync Chart Range with Global Filter
  useEffect(() => {
      const maxDays = getGlobalMaxDays(filters.limit);
      if (maxDays < chartDays) {
          setChartDays(maxDays);
      } else if (filters.limit === 'all' && chartDays < 30) {
           setChartDays(30);
      }
  }, [filters.limit]);

  // Format currency helper
  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', { 
        style: 'currency', 
        currency: 'COP', 
        maximumFractionDigits: 0,
        minimumFractionDigits: 0
    }).format(val);
  };

  // Helper for compact currency (e.g. $ 30M)
  const formatCompactCOP = (val: number) => {
      return new Intl.NumberFormat('es-CO', { 
        style: 'currency', 
        currency: 'COP',
        notation: "compact", 
        maximumFractionDigits: 1 
      }).format(val);
  };

  // --- 0. FILTER INTERACTIONS BY DATE (SYNC WITH GLOBAL FILTER) ---
  const filteredInteractions = useMemo(() => {
    if (filters.limit === 'all' || filters.limit === 'favorites') return interactions;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return interactions.filter(item => {
        if (!item.createdAt) return false;
        const d = new Date(item.createdAt);
        if (isNaN(d.getTime())) return false;

        switch (filters.limit) {
            case 'today':
                return d >= startOfToday;
            case 'yesterday':
                const startOfYesterday = new Date(startOfToday);
                startOfYesterday.setDate(startOfToday.getDate() - 1);
                return d >= startOfYesterday && d < startOfToday;
            case '7_days':
                const d7 = new Date(now); d7.setDate(now.getDate() - 7); return d >= d7;
            case '14_days':
                const d14 = new Date(now); d14.setDate(now.getDate() - 14); return d >= d14;
            case '30_days':
                const d30 = new Date(now); d30.setDate(now.getDate() - 30); return d >= d30;
            default:
                return true;
        }
    });
  }, [interactions, filters.limit]);

  // --- 1. KPI CALCULATIONS ---
  const stats = useMemo(() => {
    const totalLeads = filteredLeads.length;
    
    // Calculate Total Value (Pipeline)
    const totalPipelineValue = filteredLeads.reduce((acc, lead) => {
        const val = parseInt((lead.valor || '').replace(/\D/g, '')) || 0;
        return acc + val;
    }, 0);

    // Calculate Won Value & Count
    const wonLeads = filteredLeads.filter(l => l.crmStatus === CrmStatus.GANADOS);
    const wonCount = wonLeads.length;
    const totalWonValue = wonLeads.reduce((acc, lead) => {
        const val = parseInt((lead.valor || '').replace(/\D/g, '')) || 0;
        return acc + val;
    }, 0);

    // Average Ticket
    const averageTicket = wonCount > 0 ? totalWonValue / wonCount : 0;

    // Conversion Rate (Won / Total)
    const salesConversionRate = totalLeads > 0 ? ((wonCount / totalLeads) * 100).toFixed(1) : "0";

    // Quality Ratio (SQLs / Total)
    const sqlCount = filteredLeads.filter(l => l.indicadorCalidad === QualityIndicator.SQL).length;
    const qualityRate = totalLeads > 0 ? ((sqlCount / totalLeads) * 100).toFixed(1) : "0";

    // Interactions Breakdown — types come from sheetsService: 'VISITA', 'BRIDGE', 'CTA'
    const totalInteractions = filteredInteractions.length;
    const visitasUnicas = new Set(filteredInteractions.filter(i => i.interactionType === 'VISITA').map(i => i.whatsapp)).size;
    const traficoBotonWA = filteredInteractions.filter(i => i.interactionType === 'BRIDGE').length;
    const traficoCTA = filteredInteractions.filter(i => i.interactionType === 'CTA').length;

    // CTR: total button clicks / unique visits
    const ctrGlobal = visitasUnicas > 0
        ? (((traficoBotonWA + traficoCTA) / visitasUnicas) * 100).toFixed(1)
        : "0";

    // Lead Conversion Rate: Leads / Unique Visits
    const leadConversionRate = visitasUnicas > 0
        ? ((totalLeads / visitasUnicas) * 100).toFixed(1)
        : "0";

    return {
        totalLeads,
        totalPipelineValue,
        totalWonValue,
        wonCount,
        averageTicket,
        salesConversionRate,
        qualityRate,
        sqlCount,
        totalInteractions,
        visitasUnicas,
        traficoBotonWA,
        traficoCTA,
        ctrGlobal,
        leadConversionRate
    };
  }, [filteredLeads, filteredInteractions]);

  // --- 2. ACQUISITION CHART DATA (Evolution) ---
  const acquisitionData = useMemo(() => {
      const dataMap: Record<string, Record<string, number>> = {};
      const allCampaigns = new Set<string>();
      
      const now = new Date();
      const cutoffDate = new Date();
      cutoffDate.setDate(now.getDate() - chartDays);
      cutoffDate.setHours(0,0,0,0);

      filteredLeads.forEach(lead => {
          if (!lead.createdAt) return;
          const createdDate = new Date(lead.createdAt);
          
          if (createdDate < cutoffDate) return;

          const dateKey = createdDate.toISOString().split('T')[0];

          let campaign = lead.campana || "Desconocido";
          if (campaign.toUpperCase().startsWith("EMAIL")) {
              campaign = "EMAIL";
          }
          allCampaigns.add(campaign);

          if (!dataMap[dateKey]) {
              dataMap[dateKey] = { date: 0 };
          }
          
          dataMap[dateKey][campaign] = (dataMap[dateKey][campaign] || 0) + 1;
      });

      const chartData = Object.entries(dataMap).map(([date, counts]) => ({
          name: date,
          ...counts
      })).sort((a, b) => a.name.localeCompare(b.name));

      const formattedData = chartData.map(item => {
          const [y, m, d] = item.name.split('-');
          const dateObj = new Date(parseInt(y), parseInt(m)-1, parseInt(d));
          const displayDate = dateObj.toLocaleDateString('es-CO', { month: 'short', day: 'numeric' });
          return { ...item, displayDate };
      });

      return { data: formattedData, keys: Array.from(allCampaigns) };
  }, [filteredLeads, chartDays]);


  // --- 3A. CTR CHART DATA (Botones / Visitas por día) ---
  const ctrData = useMemo(() => {
    const dataMap: Record<string, { visitasIPs: Set<string>, botonWA: number, botonLanding: number }> = {};

    const now = new Date();
    const cutoffDate = new Date();
    cutoffDate.setDate(now.getDate() - chartDays);
    cutoffDate.setHours(0, 0, 0, 0);

    filteredInteractions.forEach(int => {
      if (!int.createdAt) return;
      const d = new Date(int.createdAt);
      if (d < cutoffDate) return;
      const k = d.toISOString().split('T')[0];

      if (!dataMap[k]) dataMap[k] = { visitasIPs: new Set(), botonWA: 0, botonLanding: 0 };

      if (int.interactionType === 'VISITA') {
        if (int.whatsapp) dataMap[k].visitasIPs.add(int.whatsapp);
      } else if (int.interactionType === 'BRIDGE') {
        dataMap[k].botonWA++;
      } else if (int.interactionType === 'CTA') {
        dataMap[k].botonLanding++;
      }
    });

    return Object.entries(dataMap).map(([date, val]) => {
      const visitasUnicas = val.visitasIPs.size;
      const totalClics = val.botonWA + val.botonLanding;
      const ctr = visitasUnicas > 0 ? ((totalClics / visitasUnicas) * 100).toFixed(1) : "0";
      const [y, m, d] = date.split('-');
      const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      const displayDate = dateObj.toLocaleDateString('es-CO', { month: 'short', day: 'numeric' });
      return { name: date, displayDate, visitasUnicas, botonWA: val.botonWA, botonLanding: val.botonLanding, ctr };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredInteractions, chartDays]);

  // --- 3B. CONVERSION CHART DATA (Leads / Visitas por día) ---
  const conversionData = useMemo(() => {
    const dataMap: Record<string, { visitasIPs: Set<string>, leads: number }> = {};

    const now = new Date();
    const cutoffDate = new Date();
    cutoffDate.setDate(now.getDate() - chartDays);
    cutoffDate.setHours(0, 0, 0, 0);

    filteredInteractions.forEach(int => {
      if (!int.createdAt || int.interactionType !== 'VISITA') return;
      const d = new Date(int.createdAt);
      if (d < cutoffDate) return;
      const k = d.toISOString().split('T')[0];
      if (!dataMap[k]) dataMap[k] = { visitasIPs: new Set(), leads: 0 };
      if (int.whatsapp) dataMap[k].visitasIPs.add(int.whatsapp);
    });

    filteredLeads.forEach(lead => {
      if (!lead.createdAt) return;
      const d = new Date(lead.createdAt);
      if (d < cutoffDate) return;
      const k = d.toISOString().split('T')[0];
      const campana = (lead.campana || "").toLowerCase();
      if (campana.includes("wa lead") || campana.includes("app")) {
        if (!dataMap[k]) dataMap[k] = { visitasIPs: new Set(), leads: 0 };
        dataMap[k].leads++;
      }
    });

    return Object.entries(dataMap).map(([date, val]) => {
      const visitasUnicas = val.visitasIPs.size;
      const convRate = visitasUnicas > 0 ? ((val.leads / visitasUnicas) * 100).toFixed(1) : "0";
      const [y, m, d] = date.split('-');
      const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      const displayDate = dateObj.toLocaleDateString('es-CO', { month: 'short', day: 'numeric' });
      return { name: date, displayDate, visitasUnicas, leads: val.leads, convRate };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredLeads, filteredInteractions, chartDays]);


  // --- 4. OTHER CHART DATA ---
  
  // Chart: Leads by Status (Funnel)
  const funnelData = useMemo(() => {
    const counts = filteredLeads.reduce((acc, lead) => {
        const status = lead.crmStatus || 'Unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return [
        { name: 'Nuevos', value: counts[CrmStatus.NUEVO] || 0 },
        { name: 'Contactado', value: counts[CrmStatus.SEGUIMIENTO] || 0 },
        { name: 'Agendado', value: counts[CrmStatus.AGENDADO] || 0 }, 
        { name: 'Cotizado', value: counts[CrmStatus.COTIZADO] || 0 },
        { name: 'Ganados', value: counts[CrmStatus.GANADOS] || 0 },
        { name: 'Perdido', value: counts[CrmStatus.PERDIDO] || 0 },
    ];
  }, [filteredLeads]);

  // Chart: Leads by Campaign (Pie) - RENAMED TO CATEGORIA
  const campaignPieData = useMemo(() => {
    const counts = filteredLeads.reduce((acc, lead) => {
        let cmp = lead.campana || "Desconocido";
        if (cmp.toUpperCase().startsWith("EMAIL")) {
            cmp = "EMAIL";
        }
        acc[cmp] = (acc[cmp] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return Object.keys(counts)
       .map(key => ({ name: key, value: counts[key] }))
       .sort((a, b) => b.value - a.value)
       .slice(0, 5);
 }, [filteredLeads]);

  // Chart: Top CITIES (Previously Aircrafts)
  const cityData = useMemo(() => {
    const stats: Record<string, { count: number, displayName: string }> = {};

    filteredLeads.forEach(lead => {
        let rawCity = lead.origen || "";
        
        // 1. Cleaning: Split by comma, dash or pipe and take the first part
        let city = rawCity.split(/[,\-|]/)[0].trim();
        
        // 2. Normalization: Capitalize first letter
        if (city) {
            city = city.charAt(0).toUpperCase() + city.slice(1);
        }
        
        // FILTER: Exclude undefined or noise
        if (!city || city === "?" || city.toLowerCase() === "por definir") return;

        // 3. Normalization for Grouping (remove accents, lower case)
        // This converts "Chía" -> "chia", "Chia" -> "chia"
        const normalizedKey = city.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

        if (!stats[normalizedKey]) {
            stats[normalizedKey] = { count: 0, displayName: city };
        }

        stats[normalizedKey].count += 1;

        // 4. DISPLAY NAME HEURISTIC: Prefer the one with accents
        // If the current stored name does NOT have an accent, but the new incoming one DOES, update it.
        const currentHasAccent = /[áéíóúÁÉÍÓÚñÑ]/.test(stats[normalizedKey].displayName);
        const newHasAccent = /[áéíóúÁÉÍÓÚñÑ]/.test(city);

        if (!currentHasAccent && newHasAccent) {
            stats[normalizedKey].displayName = city;
        }
    });

    return Object.values(stats)
       .map(item => ({ name: item.displayName, value: item.count }))
       .sort((a, b) => b.value - a.value)
       .slice(0, 5);
 }, [filteredLeads]);


  if (filteredLeads.length === 0 && interactions.length === 0) {
      return (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8">
              <AlertCircle size={48} className="mb-4 opacity-50"/>
              <p>No hay datos disponibles con los filtros actuales para generar reportes.</p>
          </div>
      );
  }

  // Define available time options for the chart based on Global Filter
  const globalMaxDays = getGlobalMaxDays(filters.limit);
  const chartTimeOptions = [7, 14, 30, 60, 90].filter(d => d <= globalMaxDays);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100 p-4 md:p-6 animate-fade-in">
        
        {/* Header */}
        <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Dashboard de Rendimiento</h2>
            <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-slate-500">
                    <span className="font-semibold text-slate-700">{stats.totalLeads}</span> leads filtrados
                </p>
                <span className="text-slate-300">|</span>
                 <p className="text-sm text-slate-500">
                    <span className="font-semibold text-slate-700">{stats.totalInteractions}</span> interacciones filtradas
                </p>
            </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
            
            {/* KPI 1: Pipeline */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase">Pipeline Total</span>
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><DollarSign size={18}/></div>
                </div>
                <div className="text-xl font-bold text-slate-800 truncate" title={formatCOP(stats.totalPipelineValue)}>
                    {formatCompactCOP(stats.totalPipelineValue)}
                </div>
                <div className="text-xs text-slate-500 mt-1">Valor Estimado</div>
            </div>

             {/* KPI 2: Ventas */}
             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase">Ventas Cerradas</span>
                    <div className="p-2 bg-green-50 text-green-600 rounded-lg"><TrendingUp size={18}/></div>
                </div>
                <div className="text-xl font-bold text-slate-800 truncate" title={formatCOP(stats.totalWonValue)}>
                    {formatCompactCOP(stats.totalWonValue)}
                </div>
                <div className="text-xs text-green-600 mt-1 font-medium flex justify-between items-center">
                   <span>{stats.wonCount} clientes</span>
                   <span title="Ticket Promedio">Prom: {formatCompactCOP(stats.averageTicket)}</span>
                </div>
            </div>

            {/* KPI 3: Lead Conversion Rate (NEW) */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase">Conv. a Lead</span>
                    <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Percent size={18}/></div>
                </div>
                <div className="text-xl font-bold text-slate-800">{stats.leadConversionRate}%</div>
                <div className="text-xs text-slate-500 mt-1">Leads / Visitas Únicas</div>
            </div>

            {/* KPI 4: Sales Conversion */}
             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase">Cierre Ventas</span>
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Users size={18}/></div>
                </div>
                <div className="text-xl font-bold text-slate-800">{stats.salesConversionRate}%</div>
                <div className="text-xs text-slate-500 mt-1">Ganados / Leads</div>
            </div>

            {/* KPI 5: CTR Global */}
             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase">CTR Global</span>
                    <div className="p-2 bg-cyan-50 text-cyan-600 rounded-lg"><Target size={18}/></div>
                </div>
                <div className="text-xl font-bold text-slate-800">{stats.ctrGlobal}%</div>
                <div className="flex items-center gap-3 mt-1">
                   <div className="flex items-center gap-1 text-[10px] text-slate-500" title="Botón WA">
                        <MessageCircle size={10} className="text-green-500"/> {stats.traficoBotonWA}
                   </div>
                   <div className="flex items-center gap-1 text-[10px] text-slate-500" title="CTA Landing">
                        <Target size={10} className="text-blue-500"/> {stats.traficoCTA}
                   </div>
                   <div className="flex items-center gap-1 text-[10px] text-slate-400" title="Visitas Únicas">
                        <Map size={10}/> {stats.visitasUnicas}
                   </div>
                </div>
            </div>
        </div>

        {/* --- CHARTS: CTR + CONVERSION (2 gráficas lado a lado) --- */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
                <h3 className="font-bold text-slate-700 text-lg">Rendimiento de Captación</h3>
                <p className="text-xs text-slate-500">CTR de botones y tasa de conversión a lead</p>
            </div>
            <div className="relative">
                <select
                    value={chartDays}
                    onChange={(e) => setChartDays(Number(e.target.value))}
                    className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg py-2 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                    {chartTimeOptions.map(days => (
                        <option key={days} value={days}>Últimos {days} días</option>
                    ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

            {/* Gráfica 1: CTR Botones */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="mb-4">
                    <h4 className="font-bold text-slate-700">CTR Botones</h4>
                    <p className="text-xs text-slate-500">Clics en Botón WA y Botón Landing vs Visitas</p>
                </div>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={ctrData} margin={{ top: 10, right: 40, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="displayDate" fontSize={11} tickLine={false} axisLine={false} minTickGap={30} />
                            <YAxis yAxisId="left" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                            <YAxis yAxisId="right" orientation="right" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                            <Tooltip content={<CustomTooltipCTR />} />
                            <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                            <Bar yAxisId="left" name="Botón WA" dataKey="botonWA" stackId="clics" fill="#22c55e" radius={[0, 0, 0, 0]} barSize={18} />
                            <Bar yAxisId="left" name="Botón Landing" dataKey="botonLanding" stackId="clics" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={18} />
                            <Line yAxisId="right" type="monotone" name="CTR %" dataKey="ctr" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, fill: '#f59e0b' }} activeDot={{ r: 5 }} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Gráfica 2: Conversión a Lead */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="mb-4">
                    <h4 className="font-bold text-slate-700">Conversión a Lead</h4>
                    <p className="text-xs text-slate-500">Leads generados (WA + App) sobre visitas únicas</p>
                </div>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={conversionData} margin={{ top: 10, right: 40, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="displayDate" fontSize={11} tickLine={false} axisLine={false} minTickGap={30} />
                            <YAxis yAxisId="left" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                            <YAxis yAxisId="right" orientation="right" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                            <Tooltip content={<CustomTooltipConversion />} />
                            <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                            <Bar yAxisId="left" name="Visitas Únicas" dataKey="visitasUnicas" fill="#a855f7" radius={[4, 4, 0, 0]} barSize={18} />
                            <Line yAxisId="left" type="monotone" name="Leads Creados" dataKey="leads" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: '#f59e0b' }} activeDot={{ r: 6 }} />
                            <Line yAxisId="right" type="monotone" name="Conv. %" dataKey="convRate" stroke="#10b981" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 5 }} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>

        {/* --- ACQUISITION TREND (RENAMED) --- */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6">
            <h3 className="font-bold text-slate-700 mb-4">Evolución Leads</h3>
            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={acquisitionData.data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis 
                            dataKey="displayDate" 
                            fontSize={11} 
                            tickLine={false} 
                            axisLine={false} 
                            minTickGap={30} // Prevent overcrowding
                        />
                        <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip 
                            cursor={{ fill: '#f8fafc' }}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                        
                        {/* Dynamic Bars based on active campaigns */}
                        {acquisitionData.keys.map((campaign, index) => (
                            <Bar 
                                key={campaign}
                                dataKey={campaign}
                                stackId="a"
                                fill={COLORS[index % COLORS.length]}
                                radius={index === acquisitionData.keys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} // Top radius only on top item
                            />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Secondary Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Chart 1: Funnel */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-700 mb-6">Estado de los Leads (Funnel)</h3>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={funnelData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis fontSize={12} tickLine={false} axisLine={false}/>
                            <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Bar dataKey="value" name="Leads" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Chart 2: Categoría Leads (Antes Campañas) */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-700 mb-6">Categoría Leads</h3>
                <div className="h-64 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={campaignPieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {campaignPieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Chart 3: Top Ciudades (Antes Aeronaves) - Expanded to Full Width */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 lg:col-span-2">
                <h3 className="font-bold text-slate-700 mb-6">Top Ciudades (Origen)</h3>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={cityData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" width={120} fontSize={12} tickLine={false} axisLine={false}/>
                            <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Bar dataKey="value" name="Leads" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

        </div>
    </div>
  );
};

export default ReportsDashboard;
