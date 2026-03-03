
import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { Lead, FilterState, CrmStatus, QualityIndicator, NurturingStatus, PipelineConfig } from '../types';
import { fetchLeads, updateLeadInSheet, checkBackendHealth, fetchPipelineConfig, savePipelineConfig } from '../services/sheetsService';

interface LeadsContextType {
  leads: Lead[];
  interactions: Lead[]; // Export interactions separately
  nqlLeads: Lead[];
  pipelineConfig: PipelineConfig | null;
  updatePipelineConfig: (config: PipelineConfig) => Promise<boolean>;
  loading: boolean;
  filters: FilterState;
  setFilter: (key: keyof FilterState, value: string) => void;
  resetFilters: () => void;
  refreshLeads: (showLoading?: boolean) => Promise<void>;
  updateLeadStatus: (leadId: string, newStatus: CrmStatus) => void;
  updateLead: (updatedLead: Lead) => void;
  updateNurturingStatus: (leadId: string, newStatus: NurturingStatus) => void;
  filteredLeads: Lead[];
  availableAircrafts: string[];
  availableCampaigns: string[];
  availableSources: string[];
}

const LeadsContext = createContext<LeadsContextType | undefined>(undefined);

const DEFAULT_FILTERS: FilterState = {
  searchTerm: '',
  calidad: 'EXCLUDE_NQL', // Por defecto, los leads NQL se muestran solo en el panel Nurturing
  vuelaEn: '',
  campana: '',
  source: '',
  limit: '7_days',
  sortOrder: 'desc'
};

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 Minutes

export const LeadsProvider = ({ children }: React.PropsWithChildren<{}>) => {
  const [allData, setAllData] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [pipelineConfig, setPipelineConfig] = useState<PipelineConfig | null>(null);

  // Centralized data fetching function
  const refreshLeads = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [data, config] = await Promise.all([fetchLeads(), fetchPipelineConfig()]);
      setAllData(data);
      if (config) setPipelineConfig(config);
    } catch (error) {
      console.error("Failed to load leads", error);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const updatePipelineConfig = async (config: PipelineConfig): Promise<boolean> => {
    try {
      const success = await savePipelineConfig(config);
      if (success) setPipelineConfig(config);
      return success;
    } catch (error) {
      console.error("Error saving pipeline config:", error);
      return false;
    }
  };

  useEffect(() => {
    // 0. Handshake Check
    checkBackendHealth();

    // 1. Initial Load
    refreshLeads(true);

    // 2. Set up interval for background updates (Silent refresh)
    const intervalId = setInterval(() => {
      console.log("Auto-refreshing leads...");
      refreshLeads(false); 
    }, REFRESH_INTERVAL_MS);

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, []);

  // DERIVED STATE: Split Interaction vs CRM Leads
  const { leads, interactions } = useMemo(() => {
     const crmLeads: Lead[] = [];
     const rawInteractions: Lead[] = [];
     
     allData.forEach(item => {
        if (item.isInteraction) {
            rawInteractions.push(item);
        } else {
            crmLeads.push(item);
        }
     });

     return { leads: crmLeads, interactions: rawInteractions };
  }, [allData]);

  const setFilter = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const updateLeadStatus = async (leadId: string, newStatus: CrmStatus) => {
    // 0. Find the lead to update in ALL DATA
    const leadToUpdate = allData.find(l => l.id === leadId);
    if (!leadToUpdate) return;
    
    // 1. Create the updated object
    const updatedLead = { ...leadToUpdate, crmStatus: newStatus };

    // 2. Optimistic Update (update UI immediately)
    setAllData(prev => 
      prev.map(item => item.id === leadId ? updatedLead : item)
    );

    // 3. Background Sync (Safe Async Call)
    try {
        const success = await updateLeadInSheet(updatedLead);
        if (!success) {
            console.warn("Backend update failed for status change.");
        }
    } catch (error) {
        console.error("Critical error syncing lead status:", error);
    }
  };

  const updateLead = async (updatedLead: Lead) => {
    // 0. Find original
    const originalLead = allData.find(l => l.id === updatedLead.id);
    if (!originalLead) return;

    // 1. Optimistic Update
    setAllData(prev =>
      prev.map(item =>
        item.id === updatedLead.id ? updatedLead : item
      )
    );
    
    // 2. Background Sync
    try {
        const success = await updateLeadInSheet(updatedLead);
        if (!success) {
             console.warn("Backend update failed for lead details.");
        }
    } catch (error) {
        console.error("Critical error syncing lead details:", error);
    }
  };

  // NQL leads: todos los leads con indicadorCalidad === NQL
  const nqlLeads = useMemo(() => {
    return leads.filter(l => l.indicadorCalidad === QualityIndicator.NQL);
  }, [leads]);

  const updateNurturingStatus = async (leadId: string, newStatus: NurturingStatus) => {
    const leadToUpdate = allData.find(l => l.id === leadId);
    if (!leadToUpdate) return;

    let updatedLead: Lead = { ...leadToUpdate, nurturingStatus: newStatus };

    // Caso especial: SQL → promover al pipeline CRM
    if (newStatus === NurturingStatus.SQL) {
      updatedLead = {
        ...updatedLead,
        indicadorCalidad: QualityIndicator.SQL,
        crmStatus: CrmStatus.NUEVO
      };
    }

    // Optimistic update
    setAllData(prev => prev.map(item => item.id === leadId ? updatedLead : item));

    try {
      const success = await updateLeadInSheet(updatedLead);
      if (!success) {
        // Rollback
        setAllData(prev => prev.map(item => item.id === leadId ? leadToUpdate : item));
        console.warn("Rollback: backend update failed for nurturing status.");
      }
    } catch (error) {
      setAllData(prev => prev.map(item => item.id === leadId ? leadToUpdate : item));
      console.error("Critical error syncing nurturing status:", error);
    }
  };

  // Auto-advance: si today >= fechaSeg1/2/3 y el estado es "Por Ejecutar", avanza
  useEffect(() => {
    if (leads.length === 0) return;
    const today = new Date().toISOString().split('T')[0];

    leads.forEach(lead => {
      if (lead.indicadorCalidad !== QualityIndicator.NQL) return;

      const shouldAdvance1 = lead.fechaSeg1 && lead.fechaSeg1 <= today && lead.estadoSeg1 !== 'Ejecutado' && lead.nurturingStatus === NurturingStatus.LANDING;
      const shouldAdvance2 = lead.fechaSeg2 && lead.fechaSeg2 <= today && lead.estadoSeg2 !== 'Ejecutado' && lead.nurturingStatus === NurturingStatus.SEGUIMIENTO_1;
      const shouldAdvance3 = lead.fechaSeg3 && lead.fechaSeg3 <= today && lead.estadoSeg3 !== 'Ejecutado' && lead.nurturingStatus === NurturingStatus.SEGUIMIENTO_2;

      if (shouldAdvance1) updateNurturingStatus(lead.id, NurturingStatus.SEGUIMIENTO_1);
      else if (shouldAdvance2) updateNurturingStatus(lead.id, NurturingStatus.SEGUIMIENTO_2);
      else if (shouldAdvance3) updateNurturingStatus(lead.id, NurturingStatus.SEGUIMIENTO_3);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads]);

  const filteredLeads = useMemo(() => {
    // Paso 0: Usar solo leads de CRM
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
         if (isNaN(leadDate.getTime())) return false; // Solo filtramos si es NaN real

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

             case '14_days':
                 const fourteenDaysAgo = new Date(now);
                 fourteenDaysAgo.setDate(now.getDate() - 14);
                 return leadDate >= fourteenDaysAgo;
             
             case '30_days':
                 const thirtyDaysAgo = new Date(now);
                 thirtyDaysAgo.setDate(now.getDate() - 30);
                 return leadDate >= thirtyDaysAgo;
             
             default:
                 return true;
         }
      });
    }

    // Paso 2: LÓGICA DE FILTRADO
    let result = processedLeads.filter(lead => {
      // Search Term Logic (normalizado: ignora tildes y mayúsculas)
      const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const term = normalize(filters.searchTerm);
      const matchSearch = !term ||
        normalize(String(lead.nombre || "")).includes(term) ||
        normalize(String(lead.apellido || "")).includes(term) ||
        normalize(String(lead.correo || "")).includes(term) ||
        String(lead.whatsapp || "").includes(term) ||
        normalize(String(lead.destino || "")).includes(term);

      // Quality Logic — NQL siempre va al panel Nurturing, nunca al Kanban principal
      let matchQuality = lead.indicadorCalidad !== QualityIndicator.NQL;

      if (filters.calidad === 'MQL_SQL') {
        matchQuality = matchQuality && (lead.indicadorCalidad === QualityIndicator.MQL || lead.indicadorCalidad === QualityIndicator.SQL);
      } else if (filters.calidad && filters.calidad !== 'EXCLUDE_NQL') {
        matchQuality = matchQuality && lead.indicadorCalidad === filters.calidad;
      }
      
      // Campaign (Category) Logic
      const matchCategory = !filters.campana || lead.campana === filters.campana;

      // PLACEHOLDER FILTERS (Visual only, always true for now)
      // Since "source" and "vuelaEn" are currently used for visual placeholders "Origen" and "Campaña (Meta/Google)",
      // we disable their filtering logic so selecting them doesn't return empty results.
      const matchSource = true; // !filters.source || lead.source === filters.source;
      const matchNewCampaign = true; // !filters.vuelaEn || lead.aeronave === filters.vuelaEn;

      return matchSearch && matchQuality && matchCategory && matchSource && matchNewCampaign;
    });

    // Paso 3: LÓGICA DE ORDENAMIENTO ESTRICTO
    result.sort((a, b) => {
        const dateA = a.createdAt || "";
        const dateB = b.createdAt || "";

        if (filters.sortOrder === 'desc') {
            return dateB.localeCompare(dateA); // Más reciente primero
        } else {
            return dateA.localeCompare(dateB); // Más antiguo primero
        }
    });

    return result;
  }, [leads, filters]);

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
      interactions,
      nqlLeads,
      pipelineConfig,
      updatePipelineConfig,
      loading,
      filters,
      setFilter,
      resetFilters,
      refreshLeads,
      updateLeadStatus,
      updateLead,
      updateNurturingStatus,
      filteredLeads,
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
