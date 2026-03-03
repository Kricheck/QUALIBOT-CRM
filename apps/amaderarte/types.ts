import type { BaseLead } from '@qualibot/crm-shell';

export enum CrmStatus {
  NUEVO = "Nuevo",
  SEGUIMIENTO = "Contactado",
  AGENDADO = "Agendado",
  COTIZADO = "Cotizado",
  GANADOS = "Vendido",
  PERDIDO = "Perdido",
  FUERA_PUBLICO = "Fuera de Público",
  HIDDEN = "Hidden" // For interactions
}

export enum QualityIndicator {
  MQL = "MQL",
  SQL = "SQL",
  NQL = "NQL",
  NO = "No"
}

export enum NurturingStatus {
  LANDING = "Landing",
  SEGUIMIENTO_1 = "Seguimiento 1",
  SEGUIMIENTO_2 = "Seguimiento 2",
  SEGUIMIENTO_3 = "Seguimiento 3",
  SECUENCIA_EMAIL = "Secuencia Email",
  SQL = "SQL",
  PAUSADO = "Pausado",
  DESCARTADO = "Descartado"
}

export interface Lead extends BaseLead {
  // Campos comunes en BaseLead: id, nombre, apellido, correo, whatsapp,
  // aeronave, origen, destino, valor, indicadorCalidad, vendido, fecha,
  // fechaRegreso, source, campana, createdAt, crmStatus, isFavorite
  indicadorCalidad: QualityIndicator | string;
  crmStatus: CrmStatus | string;
  linkMaps?: string; // Google Maps Link (App Leads)
  rawData?: any; // Para debugging del raw JSON response
  isInteraction?: boolean; // Identifica filas de "Consultas"
  interactionType?: 'APP' | 'WHATSAPP' | 'VISITA' | 'BRIDGE' | 'CTA' | string;
  hasCoverage?: boolean; // Estado de cobertura (1 Mueble)
  // Campos de nurturing (Pipeline NQL)
  nurturingStatus?: NurturingStatus | string;
  fechaSeg1?: string;
  fechaSeg2?: string;
  fechaSeg3?: string;
  accionSeg1?: string;
  accionSeg2?: string;
  accionSeg3?: string;
  estadoSeg1?: string;
  estadoSeg2?: string;
  estadoSeg3?: string;
  fechaVenta?: string; // Fecha de cierre (YYYY-MM-DD), filtra GANADOS por mes en Pipeline
}

export interface PipelineConfig {
  YEAR: number;
  ENE: number; FEB: number; MAR: number; ABR: number; MAY: number; JUN: number;
  JUL: number; AGO: number; SEP: number; OCT: number; NOV: number; DIC: number;
  NEG_MULT: number; // Multiplicador: cuánto Cotizado se necesita vs meta Ventas
  QUO_MULT: number; // Multiplicador: cuánto Agendado se necesita vs meta Cotizado
}

export interface FilterState {
  searchTerm: string;
  calidad: string;
  vuelaEn: string;
  campana: string;
  source: string; // New filter field for "Formulario"
  limit: string; // "10", "25", "50", "100", "all"
  sortOrder: string; // "desc" (Newest/Recientes) or "asc" (Oldest/Antiguos)
}
