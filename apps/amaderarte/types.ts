
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
  NO = "No"
}

export interface Lead {
  id: string; // Generated for frontend tracking
  nombre: string;
  apellido: string;
  correo: string;
  whatsapp: string;
  aeronave: string; // Used for "Right Field" (Producto / Acción / Fachada)
  origen: string; // Used for "Left Field" (Ubicación / Ciudad)
  destino: string; // Used for Details / Address
  valor: string; // Keep as string to handle currency symbols or ranges
  indicadorCalidad: QualityIndicator | string;
  vendido: string; // "X" or empty
  fecha: string; // Fecha Ida
  fechaRegreso?: string; // Fecha Regreso (New field)
  source: string;
  campana: string;
  createdAt?: string; // Timestamp from Column F (Creation Date)
  crmStatus: CrmStatus | string;
  isFavorite?: boolean; // New Favorite toggle
  linkMaps?: string; // New field for Google Maps Link (App Leads)
  rawData?: any; // New field for debugging raw JSON response
  isInteraction?: boolean; // New field to identify "Consultas" rows
  interactionType?: 'APP' | 'WHATSAPP' | 'VISITA' | 'BRIDGE' | 'CTA' | string; // New field to classify interactions
  hasCoverage?: boolean; // New field to indicate coverage status (1 Mueble)
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
