
import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useRef } from 'react';
import { Lead, FilterState, CrmStatus, QualityIndicator, NurturingStatus, PipelineConfig } from '../types';
import { fetchLeads, updateLeadInSheet, deleteLeadFromAllSources, fetchPipelineConfig, savePipelineConfig } from '../services/sheetsService';

interface LeadsContextType {
  leads: Lead[];
  loading: boolean;
  filters: FilterState;
  pipelineConfig: PipelineConfig | null;
  setFilter: (key: keyof FilterState, value: string) => void;
  resetFilters: () => void;
  refreshLeads: (showLoading?: boolean) => Promise<void>;
  updateLeadStatus: (leadId: string, newStatus: CrmStatus) => void;
  updateNurturingStatus: (leadId: string, newStatus: NurturingStatus) => void;
  updateLead: (updatedLead: Lead) => void;
  removeLead: (leadId: string, email: string) => Promise<void>;
  updatePipelineConfig: (config: PipelineConfig) => Promise<boolean>;
  filteredLeads: Lead[];
  nqlLeads: Lead[];
  availableAircrafts: string[];
  availableCampaigns: string[];
  availableSources: string[];
}

const LeadsContext = createContext<LeadsContextType | undefined>(undefined);

const DEFAULT_FILTERS: FilterState = {
  searchTerm: '',
  calidad: 'EXCLUDE_NQL',
  vuelaEn: '',
  campana: '',
  source: '',
  limit: '7_days',
  sortOrder: 'desc'
};

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export const LeadsProvider = ({ children }: React.PropsWithChildren<{}>) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [pipelineConfig, setPipelineConfig] = useState<PipelineConfig | null>(null);

  // Contador de writes pendientes: el auto-refresh no corre si hay updates en vuelo
  // para evitar race conditions entre actualizaciones optimistas y el refresh.
  const pendingUpdates = useRef(0);

  // Centralized data fetching function
  const refreshLeads = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const data = await fetchLeads();
      setLeads(data);

      // Also fetch config if not loaded
      const config = await fetchPipelineConfig();
      if (config) setPipelineConfig(config);

    } catch (error) {
      console.error("Failed to load leads", error);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Initial Load
    refreshLeads(true);

    // 2. Set up interval for background updates (Silent refresh)
    // Se omite si: (a) hay writes pendientes (race condition) o (b) la pestaña está oculta
    const intervalId = setInterval(() => {
      if (pendingUpdates.current > 0) return;
      if (typeof document !== "undefined" && document.hidden) return;
      refreshLeads(false);
    }, REFRESH_INTERVAL_MS);

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, []);

  const setFilter = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const updateLeadStatus = async (leadId: string, newStatus: CrmStatus) => {
    // 0. Find the lead to update
    const leadToUpdate = leads.find(l => l.id === leadId);
    if (!leadToUpdate) return;

    // 1. Create the updated object
    const updatedLead = { ...leadToUpdate, crmStatus: newStatus };

    // --- LOGIC: Auto-set Sale Date on WON ---
    if (newStatus === CrmStatus.GANADOS && !updatedLead.fechaVenta) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      updatedLead.fechaVenta = `${y}-${m}-${d}`;
    }
    // ----------------------------------------

    // 2. Optimistic Update (update UI immediately)
    setLeads(prevLeads =>
      prevLeads.map(lead => lead.id === leadId ? updatedLead : lead)
    );

    // 3. Background Sync — bloquea auto-refresh mientras está en vuelo
    pendingUpdates.current += 1;
    try {
      const success = await updateLeadInSheet(updatedLead, false);
      if (!success) {
        throw new Error("Backend update failed");
      }
    } catch (error) {
      console.error("[LeadsContext] updateLeadStatus: fallo — revertiendo UI:", error);
      setLeads(prevLeads =>
        prevLeads.map(lead => lead.id === leadId ? leadToUpdate : lead)
      );
    } finally {
      pendingUpdates.current -= 1;
    }
  };

  const updateLead = async (updatedLead: Lead) => {
    // 0. Find original for reversion
    const originalLead = leads.find(l => l.id === updatedLead.id);
    if (!originalLead) return;

    // 1. Optimistic Update
    setLeads(prevLeads =>
      prevLeads.map(lead =>
        lead.id === updatedLead.id ? updatedLead : lead
      )
    );

    // 2. Background Sync — bloquea auto-refresh mientras está en vuelo
    pendingUpdates.current += 1;
    try {
      const success = await updateLeadInSheet(updatedLead, true);
      if (!success) {
        throw new Error("Backend update failed");
      }
    } catch (error) {
      console.error("[LeadsContext] updateLead: fallo — revertiendo UI:", error);
      setLeads(prevLeads =>
        prevLeads.map(lead => lead.id === updatedLead.id ? originalLead : lead)
      );
    } finally {
      pendingUpdates.current -= 1;
    }
  };

  const removeLead = async (leadId: string, email: string) => {
    // 0. Find original for reversion
    const originalLead = leads.find(l => l.id === leadId);
    if (!originalLead) return;

    // 1. Optimistic Update
    setLeads(prevLeads => prevLeads.filter(l => l.id !== leadId));

    // 2. Background Call — revertir UI si el backend falla (éxito=false O excepción)
    try {
      const success = await deleteLeadFromAllSources(email, originalLead.source);
      if (!success) {
        // El backend reportó fallo explícito → revertir
        setLeads(prevLeads =>
          [...prevLeads, originalLead].sort((a, b) => {
            const dA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dB - dA;
          })
        );
        console.error("[LeadsContext] removeLead: backend devolvió false — revertiendo UI");
        alert("No se pudo eliminar el lead del servidor. Intente nuevamente.");
      }
    } catch (error) {
      console.error("[LeadsContext] removeLead: excepción — revertiendo UI:", error);
      setLeads(prevLeads =>
        [...prevLeads, originalLead].sort((a, b) => {
          const dA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dB - dA;
        })
      );
      alert("No se pudo eliminar el lead del servidor. Intente nuevamente.");
    }
  };

  const updateNurturingStatus = async (leadId: string, newStatus: NurturingStatus) => {
    const leadToUpdate = leads.find(l => l.id === leadId);
    if (!leadToUpdate) return;

    const updatedLead = { ...leadToUpdate, nurturingStatus: newStatus };

    // Special: promote to main pipeline when stage is SQL
    if (newStatus === NurturingStatus.SQL) {
      updatedLead.indicadorCalidad = QualityIndicator.SQL;
      updatedLead.crmStatus = CrmStatus.NUEVO;
    }

    setLeads(prevLeads =>
      prevLeads.map(lead => lead.id === leadId ? updatedLead : lead)
    );

    pendingUpdates.current += 1;
    try {
      const success = await updateLeadInSheet(updatedLead, true);
      if (!success) throw new Error("Backend update failed");
    } catch (error) {
      console.error("[LeadsContext] updateNurturingStatus: fallo — revertiendo UI:", error);
      setLeads(prevLeads =>
        prevLeads.map(lead => lead.id === leadId ? leadToUpdate : lead)
      );
    } finally {
      pendingUpdates.current -= 1;
    }
  };

  const updatePipelineConfig = async (config: PipelineConfig) => {
    setPipelineConfig(config); // Optimistic
    return await savePipelineConfig(config);
  };

  const filteredLeads = useMemo(() => {
    // Paso 0: Copia de los datos crudos
    let processedLeads = [...leads];

    // Paso 1: LÓGICA DE TIEMPO DE CREACIÓN Y FAVORITOS
    if (filters.limit !== 'all') {
      const now = new Date();
      // Start of Today (00:00:00)
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      processedLeads = processedLeads.filter(lead => {
        // A. Caso Especial: Favoritos (Ignora fecha)
        if (filters.limit === 'favorites') {
          return lead.isFavorite === true;
        }

        // B. Casos de Fecha (Requieren createdAt)
        if (!lead.createdAt) return false;

        const leadDate = new Date(lead.createdAt);
        if (isNaN(leadDate.getTime())) return false;

        switch (filters.limit) {
          case 'today':
            return leadDate >= startOfToday;
          case 'yesterday':
            const startOfYesterday = new Date(startOfToday);
            startOfYesterday.setDate(startOfToday.getDate() - 1);
            return leadDate >= startOfYesterday && leadDate < startOfToday;
          case '7_days':
            const sevenDaysAgo = new Date(now);
            sevenDaysAgo.setDate(now.getDate() - 7);
            return leadDate >= sevenDaysAgo;
          case '30_days':
            const thirtyDaysAgo = new Date(now);
            thirtyDaysAgo.setDate(now.getDate() - 30);
            return leadDate >= thirtyDaysAgo;
          default:
            return true;
        }
      });
    }

    // Paso 2: LÓGICA DE FILTRADO (Búsqueda, Calidad, Tiempo de Vuelo)
    let result = processedLeads.filter(lead => {
      // Search Term Logic
      const term = filters.searchTerm.toLowerCase();
      const matchSearch = !term ||
        String(lead.nombre || "").toLowerCase().includes(term) ||
        String(lead.apellido || "").toLowerCase().includes(term) ||
        String(lead.correo || "").toLowerCase().includes(term) ||
        String(lead.whatsapp || "").includes(term) ||
        String(lead.destino || "").toLowerCase().includes(term);

      // Quality Logic
      let matchQuality = true;
      if (filters.calidad === 'EXCLUDE_NQL') {
        // Default: hide NQL leads from main kanban (they belong to the nurturing pipeline)
        matchQuality = lead.indicadorCalidad !== QualityIndicator.NQL;
      } else if (filters.calidad === 'MQL_SQL') {
        matchQuality = lead.indicadorCalidad === QualityIndicator.MQL || lead.indicadorCalidad === QualityIndicator.SQL;
      } else if (filters.calidad === 'ALL_QUALIFIED') {
        // "Todas" for reports — show everything including NQL
        matchQuality = true;
      } else if (filters.calidad === 'QUALIFIED_ONLY') {
        // SQL + MQL + NQL (all quality leads, excludes "No")
        matchQuality = lead.indicadorCalidad === QualityIndicator.SQL ||
          lead.indicadorCalidad === QualityIndicator.MQL ||
          lead.indicadorCalidad === QualityIndicator.NQL;
      } else if (filters.calidad) {
        matchQuality = lead.indicadorCalidad === filters.calidad;
      }

      // Campaign Logic
      const matchCampaign = !filters.campana || lead.campana === filters.campana;

      // Source Logic
      const matchSource = !filters.source || lead.source === filters.source;

      // Flight Timeframe Logic
      let matchTime = true;
      if (filters.vuelaEn && lead.fecha) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [y, m, d] = lead.fecha.split('-').map(Number);
        const leadDate = new Date(y, m - 1, d);

        const diffTime = leadDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        switch (filters.vuelaEn) {
          case 'vuelo_vigente': matchTime = diffDays >= 0; break;
          case 'past_flights': matchTime = diffDays < 0; break;
          case '1_week': matchTime = diffDays >= 0 && diffDays <= 7; break;
          case '2_weeks': matchTime = diffDays > 7 && diffDays <= 14; break;
          case '3_weeks': matchTime = diffDays > 14 && diffDays <= 21; break;
          case 'plus_3_weeks': matchTime = diffDays > 21; break;
          default: matchTime = true;
        }
      } else if (filters.vuelaEn && !lead.fecha) {
        matchTime = false;
      }

      return matchSearch && matchQuality && matchTime && matchCampaign && matchSource;
    });

    // Paso 3: LÓGICA DE ORDENAMIENTO
    result.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;

      if (filters.sortOrder === 'desc') {
        return dateB - dateA;
      }
      return dateA - dateB;
    });

    return result;
  }, [leads, filters]);

  // Auto-advance NQL leads whose scheduled dates have passed.
  // Fires on every leads change so the visual update is immediate (e.g. when a user
  // saves a schedule whose Seg1 date is already today/past). The guard
  // `toAdvance.length === 0` ensures the second firing (after setLeads) is a no-op.
  useEffect(() => {
    if (leads.length === 0) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const toAdvance: { lead: Lead; next: NurturingStatus }[] = [];

    leads.forEach(lead => {
      if (lead.indicadorCalidad !== QualityIndicator.NQL) return;
      const status = (lead.nurturingStatus as NurturingStatus) || NurturingStatus.LANDING;

      if (status === NurturingStatus.LANDING && lead.fechaSeg1) {
        const d = new Date(lead.fechaSeg1); d.setHours(0, 0, 0, 0);
        if (d <= today) toAdvance.push({ lead, next: NurturingStatus.SEGUIMIENTO_1 });
      } else if (status === NurturingStatus.SEGUIMIENTO_1 && lead.fechaSeg2) {
        const d = new Date(lead.fechaSeg2); d.setHours(0, 0, 0, 0);
        if (d <= today) toAdvance.push({ lead, next: NurturingStatus.SEGUIMIENTO_2 });
      } else if (status === NurturingStatus.SEGUIMIENTO_2 && lead.fechaSeg3) {
        const d = new Date(lead.fechaSeg3); d.setHours(0, 0, 0, 0);
        if (d <= today) toAdvance.push({ lead, next: NurturingStatus.SEGUIMIENTO_3 });
      }
    });

    if (toAdvance.length === 0) return;

    // 1. Visual update (optimistic, immediate)
    const advancedLeads = toAdvance.map(({ lead, next }) => ({ ...lead, nurturingStatus: next }));
    const advancedMap = new Map(advancedLeads.map(l => [l.id, l]));
    setLeads(prev => prev.map(l => advancedMap.get(l.id) ?? l));

    // 2. Backend write (fire-and-forget, guarded against auto-refresh race)
    pendingUpdates.current += advancedLeads.length;
    Promise.all(advancedLeads.map(l => updateLeadInSheet(l, false))).finally(() => {
      pendingUpdates.current -= advancedLeads.length;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads]);

  const nqlLeads = useMemo(() => {
    return leads.filter(l => l.indicadorCalidad === QualityIndicator.NQL);
  }, [leads]);

  const availableAircrafts = useMemo(() => {
    return Array.from(new Set(leads.map(l => l.aeronave))).sort();
  }, [leads]);

  const availableCampaigns = useMemo(() => {
    const rawCampaigns = leads.map(l => l.campana).filter(Boolean);
    return Array.from(new Set(rawCampaigns)).sort();
  }, [leads]);

  const availableSources = useMemo(() => {
    return Array.from(new Set(leads.map(l => l.source).filter(Boolean))).sort();
  }, [leads]);

  return (
    <LeadsContext.Provider value={{
      leads,
      loading,
      filters,
      pipelineConfig,
      setFilter,
      resetFilters,
      refreshLeads,
      updateLeadStatus,
      updateNurturingStatus,
      updateLead,
      removeLead,
      updatePipelineConfig,
      filteredLeads,
      nqlLeads,
      availableAircrafts,
      availableCampaigns,
      availableSources
    }}>
      {children}
    </LeadsContext.Provider>
  );
};

export const useLeads = () => {
  const context = useContext(LeadsContext);
  if (context === undefined) {
    throw new Error('useLeads must be used within a LeadsProvider');
  }
  return context;
};
