
export enum CrmStatus {
  NUEVO = "Nuevo",
  SEGUIMIENTO = "Contactado",
  COTIZADO = "Cotizado",
  NEGOCIACION = "Negociación",
  GANADOS = "Ganados",
  PERDIDO = "Perdido",
  FUERA_PUBLICO = "Fuera de Público"
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

export interface PipelineConfig {
  YEAR: number;
  // Monthly Targets in COP (Sold)
  ENE: number;
  FEB: number;
  MAR: number;
  ABR: number;
  MAY: number;
  JUN: number;
  JUL: number;
  AGO: number;
  SEP: number;
  OCT: number;
  NOV: number;
  DIC: number;
  // Multipliers
  NEG_MULT: number; // How much Pipeline value in Negotiation is needed vs Sales Target
  QUO_MULT: number; // How much Pipeline value in Quote is needed vs Negotiation Target
}

export interface Lead {
  id: string; // Generated for frontend tracking
  nombre: string;
  apellido: string;
  correo: string;
  whatsapp: string;
  aeronave: string;
  origen: string;
  destino: string;
  valor: string; // Keep as string to handle currency symbols or ranges
  indicadorCalidad: QualityIndicator | string;
  vendido: string; // "X" or empty
  fecha: string; // Fecha Ida
  fechaRegreso?: string; // Fecha Regreso (New field)
  fechaVenta?: string; // Fecha Venta (New field for WON deals)
  source: string;
  campana: string;
  createdAt?: string; // Timestamp from Column F (Creation Date)
  crmStatus: CrmStatus | string;
  isFavorite?: boolean; // New Favorite toggle
  emailOpened?: boolean | 'SENT'; // Updated: Supports boolean (TRUE/FALSE) or string 'SENT'
  // Apollo-specific fields
  cargo?: string;     // Job title from Apollo.io
  compania?: string;  // Company name from Apollo.io
  // Nurturing pipeline fields
  nurturingStatus?: NurturingStatus | string;
  fechaSeg1?: string;
  fechaSeg2?: string;
  fechaSeg3?: string;
  accionSeg1?: string;
  accionSeg2?: string;
  accionSeg3?: string;
  estadoSeg1?: string; // 'Ejecutado' | 'Por Ejecutar' | ''
  estadoSeg2?: string;
  estadoSeg3?: string;
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
