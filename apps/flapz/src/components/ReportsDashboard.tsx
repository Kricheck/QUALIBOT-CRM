
import React, { useMemo, useState, useEffect } from 'react';
import { useLeads } from '../context/LeadsContext';
import { CrmStatus, Lead, QualityIndicator } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell
} from 'recharts';
import { TrendingUp, DollarSign, Users, Target, AlertCircle, UserCheck, Map, Calendar, ChevronDown } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b', '#06b6d4', '#ec4899'];

// Helper to get max days from global filter key
const getGlobalMaxDays = (filterLimit: string): number => {
    switch (filterLimit) {
        case 'today': return 1;
        case 'yesterday': return 2;
        case '7_days': return 7;
        case '30_days': return 30;
        case 'favorites': return 365; // Treat as 'all' effectively
        case 'all': return 365; // Cap 'all' at a year for chart readability default
        default: return 30;
    }
};

const ReportsDashboard: React.FC = () => {
  const { filteredLeads, filters } = useLeads();
  
  // Local state for the specific chart time range
  const [chartDays, setChartDays] = useState<number>(30);

  // Sync Chart Range with Global Filter — siempre seguir al filtro global
  useEffect(() => {
      const maxDays = getGlobalMaxDays(filters.limit);
      setChartDays(maxDays);
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
    const conversionRate = totalLeads > 0 ? ((wonCount / totalLeads) * 100).toFixed(1) : "0";

    // Quality Ratio (SQLs / Total)
    const sqlCount = filteredLeads.filter(l => l.indicadorCalidad === QualityIndicator.SQL).length;
    const qualityRate = totalLeads > 0 ? ((sqlCount / totalLeads) * 100).toFixed(1) : "0";

    // MQL Ratio (MQLs / Total)
    const mqlCount = filteredLeads.filter(l => l.indicadorCalidad === QualityIndicator.MQL).length;
    const mqlRate = totalLeads > 0 ? ((mqlCount / totalLeads) * 100).toFixed(1) : "0";
    
    // NQL Ratio (NQLs / Total)
    const nqlCount = filteredLeads.filter(l => l.indicadorCalidad === QualityIndicator.NQL).length;

    return {
        totalLeads,
        totalPipelineValue,
        totalWonValue,
        wonCount,
        averageTicket,
        conversionRate,
        qualityRate,
        sqlCount,
        mqlRate,
        mqlCount,
        nqlCount // Added NQL Count
    };
  }, [filteredLeads]);

  // --- 2. ACQUISITION CHART DATA (Day by Day Stacked) ---
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

          // Usar fecha local (no UTC) para evitar que leads de tarde GMT-5
          // aparezcan en el día siguiente al cruzar la medianoche UTC
          const localY = createdDate.getFullYear();
          const localM = String(createdDate.getMonth() + 1).padStart(2, '0');
          const localD = String(createdDate.getDate()).padStart(2, '0');
          const dateKey = `${localY}-${localM}-${localD}`;

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


  // --- 3. OTHER CHART DATA ---
  
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
        { name: 'Cotizado', value: counts[CrmStatus.COTIZADO] || 0 },
        { name: 'Negociación', value: counts[CrmStatus.NEGOCIACION] || 0 }, // NEW STAGE
        { name: 'Ganados', value: counts[CrmStatus.GANADOS] || 0 },
        { name: 'Perdido', value: counts[CrmStatus.PERDIDO] || 0 },
    ];
  }, [filteredLeads]);

  // Chart: Leads by Source
  const sourceData = useMemo(() => {
     const counts = filteredLeads.reduce((acc, lead) => {
         const src = lead.source || "Desconocido";
         acc[src] = (acc[src] || 0) + 1;
         return acc;
     }, {} as Record<string, number>);

     return Object.keys(counts)
        .map(key => ({ name: key, value: counts[key] }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
  }, [filteredLeads]);

  // Chart: Leads by Campaign (Pie)
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

  // Chart: Top Aircrafts (Filtered)
  const aircraftData = useMemo(() => {
    const counts = filteredLeads.reduce((acc, lead) => {
        const ac = lead.aeronave || "Por definir";
        
        // FILTER: Exclude undefined
        if (ac === "Por definir" || ac === "") return acc;

        acc[ac] = (acc[ac] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return Object.keys(counts)
       .map(key => ({ name: key, value: counts[key] }))
       .sort((a, b) => b.value - a.value)
       .slice(0, 5);
 }, [filteredLeads]);

  // Chart: Top Routes (Filtered)
  const routesData = useMemo(() => {
    const counts = filteredLeads.reduce((acc, lead) => {
        const origin = lead.origen || "?";
        const dest = lead.destino || "?";
        
        // FILTER: Exclude undefined routes
        if (origin === "?" && dest === "?") return acc;

        const route = `${origin} ➝ ${dest}`;
        
        acc[route] = (acc[route] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return Object.keys(counts)
       .map(key => ({ name: key, value: counts[key] }))
       .sort((a, b) => b.value - a.value)
       .slice(0, 5);
 }, [filteredLeads]);


  if (filteredLeads.length === 0) {
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
            <p className="text-sm text-slate-500">Visualizando métricas basadas en los {stats.totalLeads} leads filtrados.</p>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
            
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

             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase">Ventas Cerradas</span>
                    <div className="p-2 bg-green-50 text-green-600 rounded-lg"><TrendingUp size={18}/></div>
                </div>
                <div className="text-xl font-bold text-slate-800 truncate" title={formatCOP(stats.totalWonValue)}>
                    {formatCompactCOP(stats.totalWonValue)}
                </div>
                {/* UPDATED: Added Count and Average Ticket */}
                <div className="text-xs text-green-600 mt-1 font-medium flex justify-between items-center">
                   <span>{stats.wonCount} clientes</span>
                   <span title="Ticket Promedio">Prom: {formatCompactCOP(stats.averageTicket)}</span>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase">Leads SQL</span>
                    <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Target size={18}/></div>
                </div>
                <div className="text-xl font-bold text-slate-800">{stats.qualityRate}%</div>
                {/* UPDATED: Added Absolute Count */}
                <div className="text-xs text-slate-500 mt-1">{stats.sqlCount} Alta Intención</div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase">Leads MQL / NQL</span>
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><UserCheck size={18}/></div>
                </div>
                <div className="text-xl font-bold text-slate-800">{stats.mqlRate}%</div>
                <div className="text-xs text-slate-500 mt-1">{stats.mqlCount} MQL + {stats.nqlCount} NQL</div>
            </div>

             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase">Volumen Total</span>
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Users size={18}/></div>
                </div>
                <div className="text-xl font-bold text-slate-800">{stats.totalLeads}</div>
                <div className="text-xs text-slate-500 mt-1">Leads en vista</div>
            </div>
        </div>

        {/* --- CRITICAL CHART: ACQUISITION TREND --- */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h3 className="font-bold text-slate-700 text-lg">Evolución de Adquisición</h3>
                    <p className="text-xs text-slate-500">Volumen diario desglosado por campaña (Agrupado)</p>
                </div>
                
                {/* Local Time Filter for Chart */}
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
            
            <div className="h-72 w-full">
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

            {/* Chart 2: Origen */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-700 mb-6">Top Fuentes (Origen)</h3>
                <div className="h-64 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={sourceData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {sourceData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Chart 3: Campañas (Pie) */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-700 mb-6">Top Campañas</h3>
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

            {/* Chart 4: Rutas */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                 <div className="flex items-center gap-2 mb-6">
                    <h3 className="font-bold text-slate-700">Rutas Frecuentes</h3>
                    <Map size={16} className="text-slate-400" />
                 </div>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={routesData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" hide />
                            <YAxis 
                                dataKey="name" 
                                type="category" 
                                width={130} 
                                fontSize={11} 
                                tickLine={false} 
                                axisLine={false}
                                tickFormatter={(val) => val.length > 20 ? `${val.substring(0, 20)}...` : val}
                            />
                            <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Bar dataKey="value" name="Solicitudes" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Chart 5: Aeronaves */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 lg:col-span-2">
                <h3 className="font-bold text-slate-700 mb-6">Aeronaves Más Solicitadas</h3>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={aircraftData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" width={120} fontSize={12} tickLine={false} axisLine={false}/>
                            <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Bar dataKey="value" name="Solicitudes" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

        </div>
    </div>
  );
};

export default ReportsDashboard;
