
import React, { useState, useEffect, useRef } from 'react';
import { useLeads } from '../context/LeadsContext';
import { Search, Filter, Clock, ListFilter, ArrowUpDown, Megaphone, Globe, SlidersHorizontal, RotateCcw, BarChart3, Columns, Funnel, Sprout } from 'lucide-react';
import { QualityIndicator } from '../types';
import { AppView } from '../App';

interface FilterBarProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({ currentView, onViewChange }) => {
  const { filters, setFilter, resetFilters, refreshLeads, availableCampaigns, availableSources } = useLeads();
  const [showFilters, setShowFilters] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Initialize visibility based on screen width
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setShowFilters(false);
    }
  }, []);

  // Styles Helpers
  const selectWrapperClass = "relative w-full lg:w-auto lg:flex-1 group transition-all duration-200 hover:shadow-sm";
  
  // Dynamic Style for Active vs Inactive Filters
  const getSelectClass = (isActive: boolean) => `
    block w-full h-9 pl-8 pr-6 text-xs font-medium border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer appearance-none transition-colors truncate
    ${isActive 
      ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold' // Active State
      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white' // Default State
    }
  `;

  const getIconClass = (isActive: boolean) => `
    absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none transition-colors
    ${isActive ? 'text-blue-500' : 'text-slate-400 group-hover:text-blue-500'}
  `;

  const chevronClass = "pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400";

  // View flags — must be declared before any derived state that depends on them
  const isPipelineView = currentView === 'pipeline';
  const isNqlView = currentView === 'nql';
  const isReportsView = currentView === 'reports';
  const showFiltersBar = currentView !== 'pipeline';

  // Check which filters are active (non-default)
  const isSortActive = filters.sortOrder !== 'desc';
  const isLimitActive = filters.limit !== '7_days'; // New default is 7 days
  const isCampaignActive = filters.campana !== '';
  const isSourceActive = filters.source !== '';
  const isTimeActive = filters.vuelaEn !== '';
  const isQualityActive = isReportsView
    ? filters.calidad !== 'ALL_QUALIFIED'
    : filters.calidad !== 'EXCLUDE_NQL';
  const isSearchActive = filters.searchTerm !== '';

  const anyFilterActive = isSortActive || isLimitActive || isCampaignActive || isSourceActive || isTimeActive || isQualityActive || isSearchActive;

  // New Handler that combines Reset and Refresh (Silent Mode)
  const handleResetAndRefresh = async () => {
      // 1. Visual Feedback: Start local spinner
      setIsRefreshing(true);

      // 2. Reset Filters immediately so UI inputs clear up
      resetFilters();

      // 3. Refresh Data from Google Sheets in BACKGROUND
      // IMPORTANT: We pass 'false' to prevent the global loading spinner from wiping the board.
      // The user will see the old data until the new data arrives and React re-renders.
      await refreshLeads(false);

      // 4. Visual Feedback: Stop local spinner
      setIsRefreshing(false);
  };

  // Sync quality filter when switching between reports ↔ kanban views so the defaults make sense:
  // entering reports → ALL_QUALIFIED (include NQL in metrics)
  // leaving reports  → EXCLUDE_NQL (hide NQL from main kanban)
  const prevViewRef = useRef<AppView>(currentView);
  useEffect(() => {
    const prev = prevViewRef.current;
    prevViewRef.current = currentView;

    if (currentView === 'reports' && prev !== 'reports') {
      // Entering reports: show all leads including NQL
      if (filters.calidad === 'EXCLUDE_NQL' || filters.calidad === 'MQL_SQL') {
        setFilter('calidad', 'ALL_QUALIFIED');
      }
    } else if (currentView !== 'reports' && prev === 'reports') {
      // Leaving reports: restore kanban default (hide NQL) if the filter was a reports-only value
      if (filters.calidad === 'ALL_QUALIFIED' || filters.calidad === 'QUALIFIED_ONLY') {
        setFilter('calidad', 'EXCLUDE_NQL');
      }
    }
  }, [currentView]);

  return (
    <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm transition-all duration-300">
      <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 py-3">
        
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-2 lg:gap-3 w-full">
            
            {/* BLOCK 1: CONTROL CLUSTER (View Switcher + Search + Buttons) */}
            <div className="flex w-full lg:w-auto items-center gap-2 lg:gap-3 shrink-0">
                
                {/* View Switcher (Kanban / Nurturing / Pipeline / Reports) */}
                <div className="bg-slate-100 p-1 rounded-lg flex items-center border border-slate-200 mr-2 shrink-0">
                    <button
                        onClick={() => onViewChange('kanban')}
                        className={`p-1.5 rounded-md transition-all ${currentView === 'kanban' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        title="Vista Kanban"
                    >
                        <Columns size={16} />
                    </button>
                    <button
                        onClick={() => onViewChange('nql')}
                        className={`p-1.5 rounded-md transition-all ${currentView === 'nql' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-400 hover:text-teal-500'}`}
                        title="Nurturing NQL"
                    >
                        <Sprout size={16} />
                    </button>
                    <button
                        onClick={() => onViewChange('pipeline')}
                        className={`p-1.5 rounded-md transition-all ${currentView === 'pipeline' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        title="Vista Pipeline"
                    >
                        <Funnel size={16} />
                    </button>
                    <button
                        onClick={() => onViewChange('reports')}
                        className={`p-1.5 rounded-md transition-all ${currentView === 'reports' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        title="Vista Reportes"
                    >
                        <BarChart3 size={16} />
                    </button>
                </div>

                {/* HIDE FILTERS IF PIPELINE / REPORTS VIEW */}
                {showFiltersBar && (
                  <>
                    {/* Search Bar */}
                    <div className="relative group flex-1 lg:w-[260px]">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search size={14} className={`${isSearchActive ? 'text-blue-500' : 'text-slate-400'} transition-colors`} />
                      </div>
                      <input
                        type="text"
                        placeholder="Buscar..."
                        value={filters.searchTerm}
                        onChange={(e) => setFilter('searchTerm', e.target.value)}
                        className={`block w-full h-9 pl-9 pr-3 border rounded-lg placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs font-medium transition-all shadow-sm
                            ${isSearchActive ? 'bg-blue-50 border-blue-300 text-blue-800' : 'bg-slate-50 border-slate-200'}
                        `}
                      />
                    </div>

                    {/* Toggle Filters Button */}
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-colors shrink-0
                            ${showFilters ? 'bg-blue-100 text-blue-600 border-blue-200' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}
                        `}
                        title={showFilters ? "Ocultar Filtros" : "Mostrar Filtros"}
                    >
                        <SlidersHorizontal size={16} />
                    </button>

                    {/* Reset & Refresh Button */}
                    <button
                        onClick={handleResetAndRefresh}
                        disabled={isRefreshing}
                        className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-all duration-300 shrink-0 group
                            ${anyFilterActive 
                                ? 'bg-red-50 text-red-500 border-red-200 hover:bg-red-100 hover:border-red-300 hover:shadow-sm'  // "Destructive" Clean Mode
                                : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-white hover:text-blue-500 hover:border-blue-300' // "Refresh" Mode
                            }
                        `}
                        title={anyFilterActive ? "Resetear Filtros y Actualizar" : "Actualizar Datos"}
                    >
                        <RotateCcw 
                            size={16} 
                            className={`transition-transform duration-700 ${isRefreshing ? 'animate-spin text-blue-600' : (!anyFilterActive ? 'group-hover:rotate-180' : '')}`} 
                        />
                    </button>
                  </>
                )}
            </div>

            {/* BLOCK 2: FILTERS CONTAINER (Collapsible) - Hide on Pipeline/Reports View */}
            {showFiltersBar && showFilters && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-row gap-2 w-full lg:w-auto lg:flex-1 animate-fade-in origin-top">
                
                  {/* 1. Orden */}
                  <div className={selectWrapperClass}>
                     <div className={getIconClass(isSortActive)}><ArrowUpDown size={14} /></div>
                     <select
                      value={filters.sortOrder}
                      onChange={(e) => setFilter('sortOrder', e.target.value)}
                      className={getSelectClass(isSortActive)}
                    >
                      <option value="desc">Recientes</option>
                      <option value="asc">Antiguos</option>
                    </select>
                     <div className={chevronClass}>
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>

                  {/* 2. Limit (Now Ranges & Favorites) — hidden in NQL view (irrelevant for nurturing) */}
                  {!isNqlView && (
                  <div className={selectWrapperClass}>
                     <div className={getIconClass(isLimitActive)}><ListFilter size={14} /></div>
                     <select
                      value={filters.limit}
                      onChange={(e) => setFilter('limit', e.target.value)}
                      className={getSelectClass(isLimitActive)}
                    >
                      <option value="all">Ver: Todos</option>
                      <option value="today">Creado: Hoy</option>
                      <option value="yesterday">Creado: Ayer</option>
                      <option value="7_days">Creado: 7 días</option>
                      <option value="30_days">Creado: 30 días</option>
                      <option value="favorites">⭐ Favoritos</option>
                    </select>
                     <div className={chevronClass}>
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                  )}

                  {/* 3. Campaña */}
                  <div className={selectWrapperClass}>
                     <div className={getIconClass(isCampaignActive)}><Megaphone size={14} /></div>
                     <select
                      value={filters.campana}
                      onChange={(e) => setFilter('campana', e.target.value)}
                      className={getSelectClass(isCampaignActive)}
                    >
                      <option value="">Campaña: Todas</option>
                      {availableCampaigns.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                     <div className={chevronClass}>
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>

                   {/* 4. Formulario (Source) */}
                   <div className={selectWrapperClass}>
                     <div className={getIconClass(isSourceActive)}><Globe size={14} /></div>
                     <select
                      value={filters.source}
                      onChange={(e) => setFilter('source', e.target.value)}
                      className={getSelectClass(isSourceActive)}
                    >
                      <option value="">Origen: Todo</option>
                      {availableSources.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                     <div className={chevronClass}>
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>

                  {/* 5. Timeframe */}
                  <div className={selectWrapperClass}>
                     <div className={getIconClass(isTimeActive)}><Clock size={14} /></div>
                     <select
                      value={filters.vuelaEn}
                      onChange={(e) => setFilter('vuelaEn', e.target.value)}
                      className={getSelectClass(isTimeActive)}
                    >
                      <option value="">Vuela: Todo</option>
                      <option value="vuelo_vigente">Vuelo vigente</option>
                      <option value="1_week">1 semana</option>
                      <option value="2_weeks">2 semanas</option>
                      <option value="3_weeks">3 semanas</option>
                      <option value="plus_3_weeks">+ 3 semanas</option>
                      <option value="past_flights">Ya voló</option>
                    </select>
                     <div className={chevronClass}>
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>

                   {/* 6. Quality — hidden in NQL view (always NQL there);
                        shows different options for reports vs kanban */}
                   {!isNqlView && (
                   <div className={selectWrapperClass}>
                     <div className={getIconClass(isQualityActive)}><Filter size={14} /></div>
                     {isReportsView ? (
                       <select
                         value={filters.calidad}
                         onChange={(e) => setFilter('calidad', e.target.value)}
                         className={getSelectClass(isQualityActive)}
                       >
                         <option value="ALL_QUALIFIED">Todas</option>
                         <option value="QUALIFIED_ONLY">SQL, MQL y NQL</option>
                         <option value="MQL_SQL">SQL y MQL</option>
                         <option value={QualityIndicator.SQL}>Solo SQL</option>
                         <option value={QualityIndicator.MQL}>Solo MQL</option>
                         <option value={QualityIndicator.NQL}>Solo NQL</option>
                         <option value={QualityIndicator.NO}>Solo No</option>
                       </select>
                     ) : (
                       <select
                         value={filters.calidad}
                         onChange={(e) => setFilter('calidad', e.target.value)}
                         className={getSelectClass(isQualityActive)}
                       >
                         <option value="EXCLUDE_NQL">Todas</option>
                         <option value="MQL_SQL">SQL y MQL</option>
                         <option value="ALL_QUALIFIED">Incluir NQL</option>
                         <option value={QualityIndicator.SQL}>Solo SQL</option>
                         <option value={QualityIndicator.MQL}>Solo MQL</option>
                         <option value={QualityIndicator.NO}>Solo No</option>
                       </select>
                     )}
                    <div className={chevronClass}>
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                  )}

                </div>
            )}

        </div>
      </div>
    </div>
  );
};

export default FilterBar;
