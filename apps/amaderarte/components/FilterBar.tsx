
import React, { useState, useEffect } from 'react';
import { useLeads } from '../context/LeadsContext';
import { Search, Filter, Clock, ListFilter, ArrowUpDown, Megaphone, Globe, SlidersHorizontal, RotateCcw, BarChart3, Columns, Target, MapPin, Sprout, Funnel } from 'lucide-react';
import { QualityIndicator } from '../types';
import { AppView } from '../App';
import WhatsAppStatusIndicator from './WhatsAppStatusIndicator';

interface FilterBarProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({ currentView, onViewChange }) => {
  const { filters, setFilter, resetFilters, refreshLeads, availableCampaigns } = useLeads();
  const [showFilters, setShowFilters] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (window.innerWidth < 1024) setShowFilters(false);
  }, []);

  const selectWrapperClass = "relative w-full lg:w-auto lg:flex-1 group transition-all duration-200 hover:shadow-sm";
  const getSelectClass = (isActive: boolean) => `
    block w-full h-9 pl-8 pr-6 text-xs font-medium border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 cursor-pointer appearance-none transition-colors truncate
    ${isActive ? 'bg-amber-50 border-amber-300 text-amber-700 font-semibold' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'}
  `;
  const getIconClass = (isActive: boolean) => `
    absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none transition-colors
    ${isActive ? 'text-amber-500' : 'text-slate-400 group-hover:text-amber-500'}
  `;
  const chevronClass = "pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400";

  const isSortActive = filters.sortOrder !== 'desc';
  const isLimitActive = filters.limit !== '7_days';
  const isCategoryActive = filters.campana !== ''; // Original "Campaña" -> Now "Categoría"
  const isOriginActive = filters.source !== ''; // Original "Source" -> Now "Origen"
  const isNewCampaignActive = filters.vuelaEn !== ''; // Original "Product" -> Now "Campaña"
  const isQualityActive = filters.calidad !== '' && filters.calidad !== 'EXCLUDE_NQL';
  const isSearchActive = filters.searchTerm !== '';
  
  const anyFilterActive = isSortActive || isLimitActive || isCategoryActive || isOriginActive || isNewCampaignActive || isQualityActive || isSearchActive;

  const handleResetAndRefresh = async () => {
      setIsRefreshing(true);
      resetFilters();
      await refreshLeads(false);
      setIsRefreshing(false);
  };

  // HARDCODED OPTIONS FOR VISUALIZATION ONLY
  const NEW_CAMPAIGN_OPTIONS = ['Meta F1', 'Meta F2', 'Meta F3', 'Google'];
  const NEW_ORIGIN_OPTIONS = ['Landing 1', 'Landing 2', 'Landing 3'];

  return (
    <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm transition-all duration-300">
      <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 py-3">
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-2 lg:gap-3 w-full">
            
            <div className="flex w-full lg:w-auto items-center gap-2 lg:gap-3 shrink-0">
                <div className="bg-slate-100 p-1 rounded-lg flex items-center border border-slate-200 mr-2 shrink-0">
                    <button onClick={() => onViewChange('kanban')} className={`p-1.5 rounded-md transition-all ${currentView === 'kanban' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="Vista Kanban">
                        <Columns size={16} />
                    </button>
                    <button onClick={() => onViewChange('nql')} className={`p-1.5 rounded-md transition-all ${currentView === 'nql' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-400 hover:text-teal-600'}`} title="Pipeline Nurturing (NQL)">
                        <Sprout size={16} />
                    </button>
                    <button onClick={() => onViewChange('pipeline')} className={`p-1.5 rounded-md transition-all ${currentView === 'pipeline' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-blue-600'}`} title="Pipeline de Ventas">
                        <Funnel size={16} />
                    </button>
                    <button onClick={() => onViewChange('reports')} className={`p-1.5 rounded-md transition-all ${currentView === 'reports' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="Vista Reportes">
                        <BarChart3 size={16} />
                    </button>
                </div>

                <WhatsAppStatusIndicator />

                <div className="relative group flex-1 lg:w-[260px]">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search size={14} className={`${isSearchActive ? 'text-amber-500' : 'text-slate-400'} transition-colors`} />
                  </div>
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={filters.searchTerm}
                    onChange={(e) => setFilter('searchTerm', e.target.value)}
                    className={`block w-full h-9 pl-9 pr-3 border rounded-lg placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-xs font-medium transition-all shadow-sm ${isSearchActive ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-slate-50 border-slate-200'}`}
                  />
                </div>

                <button onClick={() => setShowFilters(!showFilters)} className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-colors shrink-0 ${showFilters ? 'bg-amber-100 text-amber-600 border-amber-200' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`} title={showFilters ? "Ocultar Filtros" : "Mostrar Filtros"}>
                    <SlidersHorizontal size={16} />
                </button>

                <button onClick={handleResetAndRefresh} disabled={isRefreshing} className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-all duration-300 shrink-0 group ${anyFilterActive ? 'bg-red-50 text-red-500 border-red-200 hover:bg-red-100' : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-amber-500'}`} title="Actualizar Datos">
                    <RotateCcw size={16} className={`transition-transform duration-700 ${isRefreshing ? 'animate-spin text-amber-600' : (!anyFilterActive ? 'group-hover:rotate-180' : '')}`} />
                </button>
            </div>

            {showFilters && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-row gap-2 w-full lg:w-auto lg:flex-1 animate-fade-in origin-top">
                  
                  {/* Sort Order */}
                  <div className={selectWrapperClass}>
                     <div className={getIconClass(isSortActive)}><ArrowUpDown size={14} /></div>
                     <select value={filters.sortOrder} onChange={(e) => setFilter('sortOrder', e.target.value)} className={getSelectClass(isSortActive)}>
                      <option value="desc">Recientes</option>
                      <option value="asc">Antiguos</option>
                    </select>
                     <div className={chevronClass}><svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg></div>
                  </div>

                  {/* Limit / Date */}
                  <div className={selectWrapperClass}>
                     <div className={getIconClass(isLimitActive)}><ListFilter size={14} /></div>
                     <select value={filters.limit} onChange={(e) => setFilter('limit', e.target.value)} className={getSelectClass(isLimitActive)}>
                      <option value="all">Ver: Todos</option>
                      <option value="today">Creado: Hoy</option>
                      <option value="yesterday">Creado: Ayer</option>
                      <option value="7_days">Creado: 7 días</option>
                      <option value="14_days">Creado: 14 días</option>
                      <option value="30_days">Creado: 30 días</option>
                      <option value="favorites">⭐ Favoritos</option>
                    </select>
                     <div className={chevronClass}><svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg></div>
                  </div>

                  {/* Existing "Campana" -> Renamed to Categoría visually */}
                  <div className={selectWrapperClass}>
                     <div className={getIconClass(isCategoryActive)}><Megaphone size={14} /></div>
                     <select value={filters.campana} onChange={(e) => setFilter('campana', e.target.value)} className={getSelectClass(isCategoryActive)}>
                      <option value="">Categoría: Todas</option>
                      {availableCampaigns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                     <div className={chevronClass}><svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg></div>
                  </div>

                  {/* New "Campaña" (Replaces Producto/vuelaEn) */}
                  <div className={selectWrapperClass}>
                     <div className={getIconClass(isNewCampaignActive)}><Target size={14} /></div>
                     <select value={filters.vuelaEn} onChange={(e) => setFilter('vuelaEn', e.target.value)} className={getSelectClass(isNewCampaignActive)}>
                      <option value="">Campaña: Todas</option>
                      {NEW_CAMPAIGN_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                     <div className={chevronClass}><svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg></div>
                  </div>

                  {/* New "Origen" (Replaces Source) */}
                  <div className={selectWrapperClass}>
                     <div className={getIconClass(isOriginActive)}><MapPin size={14} /></div>
                     <select value={filters.source} onChange={(e) => setFilter('source', e.target.value)} className={getSelectClass(isOriginActive)}>
                      <option value="">Origen: Todos</option>
                      {NEW_ORIGIN_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                     <div className={chevronClass}><svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg></div>
                  </div>
                  
                  {/* Quality */}
                   <div className={selectWrapperClass}>
                     <div className={getIconClass(isQualityActive)}><Filter size={14} /></div>
                     <select value={filters.calidad} onChange={(e) => setFilter('calidad', e.target.value)} className={getSelectClass(isQualityActive)}>
                      <option value="">Calidad: Todas</option>
                      <option value="MQL_SQL">MQL y SQL</option>
                      <option value={QualityIndicator.SQL}>Solo SQL</option>
                      <option value={QualityIndicator.MQL}>Solo MQL</option>
                    </select>
                    <div className={chevronClass}><svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg></div>
                  </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
