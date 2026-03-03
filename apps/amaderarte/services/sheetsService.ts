
import { Lead, CrmStatus, QualityIndicator, NurturingStatus, PipelineConfig } from '../types';
import { MOCK_LEADS } from './mockData';

// --- CONFIGURACIÓN DE CONEXIÓN ---
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxhp5mob5jdJVNZbBAhE-JGx1Dk5GxYDv4rvKW-WTWYPbFwCXcgWz0y0WukaoG6pkavGw/exec"; 
const FRONTEND_VERSION = "v1.7_UNIFIED_CLIENT"; 

// --- MAPA DE COLUMNAS (Sin cambios) ---
const COLUMN_MAP = {
    id: ['ID', 'User ID', 'Consecutivo', 'Ref'],
    nombre: ['Nombre', 'Cliente', 'Nombre Completo', 'Nombre y Apellido'],
    apellido: ['Apellido'], 
    correo: ['Correo', 'Email', 'Correo Electrónico'],
    whatsapp: ['Celular', 'Telefono', 'Teléfono', 'WhatsApp', 'Movil', 'Teléfono Contacto', 'Teléfono (WhatsApp)', 'Phone'],
    ubicacion: ['Ciudad', 'Municipio', 'Ubicación', 'Ciudad - Localidad', 'Lugar', 'Barrio', 'Ciudad/Municipio', 'País', 'Pais', 'Country'],
    direccion: ['Dirección', 'Address'],
    detalle: ['Detalle', 'Observaciones', 'Descripción', 'Notas', 'Mensaje', 'Msg Intro', 'Preguntas'],
    producto: ['Espacios', 'Espacio', 'Producto', 'Interés', 'Tipo Mueble', 'Aeronave', 'Espacios a Diseñar'], 
    presupuesto: ['Valor', 'Presupuesto', 'Costo', 'Venta', 'Precio', 'Medio Pago'],
    fechaInicio: ['Timestamp', 'Marca temporal', 'Fecha', 'Fecha de Contacto', 'Fecha Ingreso', 'Created At', 'Date', 'Fecha Creación', 'Fecha Registro'],
    estado: ['Etapa', 'Estado', 'Status', 'Situación'],
    accion: ['Acción', 'Próximo Paso', 'Cita | Acción'],
    aux: ['Fuente', 'Origen', 'Medio', 'Campaña'], 
    calidad: ['Calidad', 'Rating', 'Clasificación'],
    linkMaps: ['Link Google Maps', 'Link Maps'],
    interesShowroom: ['Interés Visitar Showroom'],
    nurturingStatus: ['Nurturing Status', 'Estado Nurturing'],
    fechaSeg1: ['Fecha Seg1', 'Fecha Seguimiento 1', 'Fecha Seg 1'],
    fechaSeg2: ['Fecha Seg2', 'Fecha Seguimiento 2', 'Fecha Seg 2'],
    fechaSeg3: ['Fecha Seg3', 'Fecha Seguimiento 3', 'Fecha Seg 3'],
    accionSeg1: ['Accion Seg1', 'Acción Seg1', 'Accion Seguimiento 1'],
    accionSeg2: ['Accion Seg2', 'Acción Seg2', 'Accion Seguimiento 2'],
    accionSeg3: ['Accion Seg3', 'Acción Seg3', 'Accion Seguimiento 3'],
    fechaVenta: ['Fecha Venta', 'Fecha Cierre', 'Sale Date', 'FECHA VENTA']
};

// --- HELPER DE LOGGING ROBUSTO ---
const logDebug = (title: string, data: any, type: 'info' | 'success' | 'error' | 'request' = 'info') => {
  console.log(`[CRM ${type.toUpperCase()}] ${title}`, data);
  const event = new CustomEvent('crm-debug-log', {
    detail: { 
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      title, 
      data, 
      type 
    }
  });
  window.dispatchEvent(event);
};

// --- NUEVA FUNCIÓN: VERIFICACIÓN DE SALUD BACKEND ---
export const checkBackendHealth = async () => {
    logDebug("Iniciando Handshake", { url: GOOGLE_SCRIPT_URL }, 'request');
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify({ action: "ping" })
        });

        const text = await response.text();
        let json;
        try {
            json = JSON.parse(text);
        } catch(e) {
            logDebug("Handshake Fallido (HTML Error)", { text: text.substring(0, 100) }, 'error');
            return;
        }

        if (json.backendVersion) {
            logDebug("Handshake Exitoso", {
                serverVersion: json.backendVersion,
                mode: json.mode,
                latency: 'OK'
            }, 'success');
        } else if (json.result === 'error' && json.message?.includes('Acción desconocida')) {
            logDebug("ALERTA CRÍTICA: Backend Desactualizado", {
                mensaje: "El backend respondió, pero no reconoce 'ping'. Es una versión vieja.",
                respuesta: json
            }, 'error');
        } else {
            logDebug("Respuesta Inesperada", json, 'info');
        }
    } catch (error: any) {
        logDebug("Error Conexión Handshake", { msg: error.message }, 'error');
    }
};

// Helpers de Parsing (Sin cambios sustanciales)
const findValueByMap = (row: any, mapKeys: string[]): string => {
  if (!row || typeof row !== 'object') return "";
  const rowKeys = Object.keys(row);
  for (const mapKey of mapKeys) {
    const normalizedMapKey = mapKey.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const foundKey = rowKeys.find(k => k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() === normalizedMapKey);
    if (foundKey && row[foundKey] !== undefined) return String(row[foundKey]);
    const partialKey = rowKeys.find(k => k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().includes(normalizedMapKey));
    if (partialKey && row[partialKey] !== undefined) return String(row[partialKey]);
  }
  return "";
};

const parseTimestamp = (input: any): string => {
  if (!input) return "1970-01-01T00:00:00.000Z";
  let dateStr = String(input).trim().replace(/[\n\r]/g, '').replace(/\s+/g, ' ');
  if (dateStr.includes('T') && /\d/.test(dateStr)) return dateStr.replace(/\s/g, '');
  // Soporte para formato DD/M/YYYY HH:mm:ss (formato de Sheets en GMT-5 / Latinoamérica)
  // new Date("23/2/2026 23:20:46") retorna Invalid Date en V8 cuando día > 12 → parser explícito
  const dmyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (dmyMatch) {
    const [, day, month, year, hh, mm, ss] = dmyMatch;
    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hh), parseInt(mm), parseInt(ss));
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) return date.toISOString();
  } catch (e) {}
  return "1970-01-01T00:00:00.000Z";
};

const parseSmartDate = (isoTimestamp: string) => (!isoTimestamp || isoTimestamp.startsWith("1970")) ? "" : isoTimestamp.split('T')[0];

// Parsea "YYYY-MM-DD | Estado" → { date, estado }
const parseSegField = (raw: string): { date: string; estado: string } => {
  if (!raw || !raw.trim()) return { date: '', estado: '' };
  const parts = raw.split('|').map(s => s.trim());
  return { date: parts[0] || '', estado: parts[1] || '' };
};

// Serializa { date, estado } → "YYYY-MM-DD | Estado" para backend
const serializeSegDate = (date?: string, estado?: string): string => {
  if (!date) return ' ';
  if (estado) return `${date} | ${estado}`;
  return date;
};

const normalizeLead = (rawLead: any): Lead => {
  let sheetName = (rawLead._sheetName || "").trim();
  let sheetNameLower = sheetName.toLowerCase();
  
  // -- DETECCIÓN DE VISITAS --
  if (sheetNameLower.includes("visitas")) {
      const createdAt = parseTimestamp(findValueByMap(rawLead, ['Fecha/Hora', 'Fecha', 'Timestamp']));
      const ip = findValueByMap(rawLead, ['IP']);
      return {
          id: `VISIT_${Math.random().toString(36).substr(2, 9)}`,
          nombre: "Visita", apellido: "", correo: "", whatsapp: ip, aeronave: "VISITA", origen: "Visitas", destino: "", valor: "", indicadorCalidad: QualityIndicator.NO, vendido: "", fecha: parseSmartDate(createdAt), source: "VISITA", campana: "Visitas", createdAt: createdAt, crmStatus: CrmStatus.HIDDEN, isFavorite: false, isInteraction: true, interactionType: 'VISITA', rawData: rawLead
      };
  }

  // -- DETECCIÓN DE TRAFICO --
  if (sheetNameLower.includes("trafico")) {
      const createdAt = parseTimestamp(findValueByMap(rawLead, ['Fecha', 'Timestamp']));
      const ctaValue = findValueByMap(rawLead, ['CTA']); // v3.2.1+: columna dedicada con valor exacto "BRIDGE" o "CTA"
      const infoValue = findValueByMap(rawLead, ['Info', 'Info/UTMs', 'Info/UTM']); // fallback datos históricos
      const interactionType = (ctaValue.toUpperCase() === 'BRIDGE' || infoValue.toLowerCase().startsWith('bridge')) ? 'BRIDGE' : 'CTA';
      return {
          id: `TRAF_${Math.random().toString(36).substr(2, 9)}`,
          nombre: "Trafico", apellido: "", correo: "", whatsapp: "", aeronave: interactionType, origen: "Trafico", destino: ctaValue || infoValue, valor: "", indicadorCalidad: QualityIndicator.NO, vendido: "", fecha: parseSmartDate(createdAt), source: interactionType, campana: "Trafico", createdAt: createdAt, crmStatus: CrmStatus.HIDDEN, isFavorite: false, isInteraction: true, interactionType: interactionType, rawData: rawLead
      };
  }

  // -- DETECCIÓN DE INTERACCIONES (Antiguas Consultas) --
  if (sheetNameLower.includes("consultas")) {
      const whatsappVal = findValueByMap(rawLead, COLUMN_MAP.whatsapp);
      const createdAt = parseTimestamp(findValueByMap(rawLead, COLUMN_MAP.fechaInicio));
      const fechaIda = parseSmartDate(createdAt);
      const isIp = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(whatsappVal);
      const interactionType = isIp ? 'APP' : 'WHATSAPP';
      
      return {
          id: `INT_${interactionType}_${Math.random().toString(36).substr(2, 9)}`,
          nombre: findValueByMap(rawLead, COLUMN_MAP.nombre) || (isIp ? "Usuario App" : "Usuario WA"),
          apellido: "", correo: "", whatsapp: whatsappVal, aeronave: interactionType, origen: "Consultas", destino: "", valor: "", indicadorCalidad: QualityIndicator.NO, vendido: "", fecha: fechaIda, source: interactionType, campana: "Interacciones", createdAt: createdAt, crmStatus: CrmStatus.HIDDEN, isFavorite: false, isInteraction: true, interactionType: interactionType, rawData: rawLead
      };
  }

  // -- LOGICA LEADS CRM --
  let campanaLabel = "General";
  let campanaPrefix = "GEN";

  if (sheetNameLower.includes("1 mueble")) { campanaLabel = "1 Espacio"; campanaPrefix = "1M"; } 
  else if (sheetNameLower.includes("amaderarte leads")) { campanaLabel = "+2 Espacios"; campanaPrefix = "2M"; } 
  else if (sheetNameLower.includes("app") || sheetNameLower.includes("leads app")) { campanaLabel = "App"; campanaPrefix = "APP"; } 
  else if (sheetNameLower.includes("wa lead")) { campanaLabel = "WA Lead"; campanaPrefix = "WA"; } 
  else { campanaLabel = sheetName || "Amaderarte"; campanaPrefix = "OTH"; }

  const createdAt = parseTimestamp(findValueByMap(rawLead, COLUMN_MAP.fechaInicio));
  const fechaIda = parseSmartDate(createdAt);

  // ID REGLA DE NEGOCIO
  let realId = "";
  if (sheetNameLower.includes("app")) {
      realId = findValueByMap(rawLead, COLUMN_MAP.correo);
  } else {
      realId = findValueByMap(rawLead, COLUMN_MAP.whatsapp).replace(/\D/g, '');
  }
  if (!realId || realId.length < 3) realId = `UNKNOWN_${Math.floor(Math.random() * 10000)}`;
  const uniqueId = `${campanaPrefix}_${realId}_${Math.random().toString(36).substr(2, 5)}`;

  let status = findValueByMap(rawLead, COLUMN_MAP.estado);
  const accionGen = findValueByMap(rawLead, COLUMN_MAP.accion);
  if (!status) status = (accionGen && accionGen.toLowerCase().includes('cita')) ? CrmStatus.SEGUIMIENTO : CrmStatus.NUEVO;

  const rawLocation = findValueByMap(rawLead, COLUMN_MAP.ubicacion);
  const rawLinkMaps = findValueByMap(rawLead, COLUMN_MAP.linkMaps);
  let finalOrigen = rawLocation;
  let finalAeronave = findValueByMap(rawLead, COLUMN_MAP.producto); 
  let finalLinkMaps = "";
  let finalDestino = ""; 
  let hasCoverage: boolean | undefined = undefined;
  let explicitAddress = findValueByMap(rawLead, COLUMN_MAP.direccion);
  let detailInfo = findValueByMap(rawLead, COLUMN_MAP.detalle);

  if (campanaPrefix === "APP") {
      finalOrigen = rawLocation;
      if (!finalAeronave) finalAeronave = "Fachada";
      finalLinkMaps = rawLinkMaps;
      finalDestino = explicitAddress || detailInfo;
  } 
  else if (campanaPrefix === "2M") {
      finalOrigen = rawLocation;
      if (!finalAeronave && accionGen) finalAeronave = accionGen; 
      finalDestino = explicitAddress; 
  }
  else if (campanaPrefix === "1M") {
      const parts = rawLocation.split('|').map(s => s.trim());
      const rawLocationLower = rawLocation.toLowerCase();
      if (rawLocationLower.includes("cobertura: no")) hasCoverage = false;
      else if (rawLocationLower.includes("cobertura: si") || rawLocationLower.includes("cobertura: sí")) hasCoverage = true;

      if (hasCoverage === false) {
          finalOrigen = parts[0];
          if (!finalAeronave) finalAeronave = "Fuera de Zona";
      } else {
          finalOrigen = parts.length >= 3 ? parts[2].split(' ')[0] : parts[0];
          const rawShowroom = findValueByMap(rawLead, COLUMN_MAP.interesShowroom);
          if (rawShowroom && rawShowroom.includes('|') && rawShowroom.split('|')[1]) finalAeronave = rawShowroom.split('|')[1].trim();
      }
      finalDestino = ""; 
  } 
  else if (campanaPrefix === "WA") {
      const ciudad = findValueByMap(rawLead, ['Ciudad', 'City']);
      const zona = findValueByMap(rawLead, ['Zona', 'Zone']);
      finalOrigen = ciudad && zona ? `${ciudad}, ${zona}` : ciudad || rawLocation || "";
      if (!finalAeronave) finalAeronave = "Por definir";
      finalDestino = explicitAddress ? explicitAddress : findValueByMap(rawLead, COLUMN_MAP.correo);
  }
  else {
      finalDestino = explicitAddress || detailInfo;
  }

  // Nurturing fields
  const seg1 = parseSegField(findValueByMap(rawLead, COLUMN_MAP.fechaSeg1));
  const seg2 = parseSegField(findValueByMap(rawLead, COLUMN_MAP.fechaSeg2));
  const seg3 = parseSegField(findValueByMap(rawLead, COLUMN_MAP.fechaSeg3));

  return {
    id: uniqueId, nombre: findValueByMap(rawLead, COLUMN_MAP.nombre) || "Sin Nombre", apellido: findValueByMap(rawLead, COLUMN_MAP.apellido) || "", correo: findValueByMap(rawLead, COLUMN_MAP.correo), whatsapp: findValueByMap(rawLead, COLUMN_MAP.whatsapp), aeronave: finalAeronave, origen: finalOrigen, destino: finalDestino, valor: findValueByMap(rawLead, COLUMN_MAP.presupuesto), indicadorCalidad: findValueByMap(rawLead, COLUMN_MAP.calidad) || QualityIndicator.NO, vendido: "", fecha: fechaIda, source: findValueByMap(rawLead, COLUMN_MAP.aux) || "Google Sheets", campana: campanaLabel, createdAt: createdAt, crmStatus: status, isFavorite: false, linkMaps: finalLinkMaps, rawData: rawLead, isInteraction: false, hasCoverage: hasCoverage,
    nurturingStatus: (findValueByMap(rawLead, COLUMN_MAP.nurturingStatus) as NurturingStatus) || undefined,
    fechaSeg1: seg1.date || undefined,
    fechaSeg2: seg2.date || undefined,
    fechaSeg3: seg3.date || undefined,
    accionSeg1: findValueByMap(rawLead, COLUMN_MAP.accionSeg1) || undefined,
    accionSeg2: findValueByMap(rawLead, COLUMN_MAP.accionSeg2) || undefined,
    accionSeg3: findValueByMap(rawLead, COLUMN_MAP.accionSeg3) || undefined,
    estadoSeg1: seg1.estado || undefined,
    estadoSeg2: seg2.estado || undefined,
    estadoSeg3: seg3.estado || undefined,
    fechaVenta: parseSmartDate(parseTimestamp(findValueByMap(rawLead, COLUMN_MAP.fechaVenta))) || undefined
  };
};

export const fetchLeads = async (): Promise<Lead[]> => {
  if (!GOOGLE_SCRIPT_URL) return MOCK_LEADS.map(l => ({...l}));

  try {
    const response = await fetch(`${GOOGLE_SCRIPT_URL}?t=${new Date().getTime()}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    // VALIDACIÓN DE ESTRUCTURA
    const rawData = await response.json();
    let dataArray = [];
    let backendVersion = "Unknown";

    if (Array.isArray(rawData)) {
        // Soporte Legacy (si el backend antiguo responde)
        dataArray = rawData;
        backendVersion = "LEGACY_ARRAY";
    } else if (rawData && Array.isArray(rawData.data)) {
        // Nueva Estructura
        dataArray = rawData.data;
        backendVersion = rawData.backendVersion || "Unknown";
    }

    logDebug("Fetch Inicial", { 
        frontendVersion: FRONTEND_VERSION,
        backendVersion: backendVersion,
        registros: dataArray.length 
    }, 'info');

    const filteredData = dataArray.filter((row: any) => {
        if (!row._sheetName) return true; 
        const name = row._sheetName.toLowerCase();
        return name.includes('amaderarte') || name.includes('app') || name.includes('1 mueble') || name.includes('consultas') || name.includes('wa lead') || name.includes('trafico') || name.includes('visitas'); 
    });
    
    return filteredData.map(normalizeLead);
  } catch (error) {
    logDebug("Error Fetching", error, 'error');
    return []; 
  }
};

const getTargetSheetName = (lead: Lead): string => {
    if (lead.rawData && lead.rawData._sheetName) return lead.rawData._sheetName;
    const campana = (lead.campana || "").toLowerCase();
    if (campana.includes("1 espacio")) return "Amaderarte Leads 1 Mueble"; 
    if (campana.includes("app")) return "App Leads"; 
    if (campana.includes("wa lead")) return "WA Leads";
    return "Amaderarte Leads";
};

export const updateLeadInSheet = async (lead: Lead): Promise<boolean> => {
  if (!GOOGLE_SCRIPT_URL) return true;
  if (lead.isInteraction) return false; 

  const targetSheetName = getTargetSheetName(lead).trim();
  const parts = lead.id.split('_');
  let searchValue = parts.length >= 2 ? parts[1] : lead.id;
  let searchMode = "PHONE"; 

  if (targetSheetName.toLowerCase().includes("app")) {
      searchMode = "EMAIL";
      if (!searchValue.includes("@") && lead.correo) searchValue = lead.correo;
  } else {
      searchMode = "PHONE";
      if (searchValue.length < 5 && lead.whatsapp) searchValue = lead.whatsapp.replace(/\D/g, '');
  }

  const leadFields: any = {
    'Etapa': lead.crmStatus,
    'Calidad': lead.indicadorCalidad,
    'Rating': lead.indicadorCalidad,
    'Favorito': lead.isFavorite ? 'TRUE' : 'FALSE',
    'Valor': lead.valor,
    'Presupuesto': lead.valor,
    'Producto': lead.aeronave,
    'Espacio': lead.aeronave,
    'Espacios': lead.aeronave,
    'Dirección': lead.destino,
    'Nurturing Status': lead.nurturingStatus ?? ' ',
    'Fecha Seg1': serializeSegDate(lead.fechaSeg1, lead.estadoSeg1),
    'Fecha Seg2': serializeSegDate(lead.fechaSeg2, lead.estadoSeg2),
    'Fecha Seg3': serializeSegDate(lead.fechaSeg3, lead.estadoSeg3),
    'Accion Seg1': lead.accionSeg1 ?? ' ',
    'Accion Seg2': lead.accionSeg2 ?? ' ',
    'Accion Seg3': lead.accionSeg3 ?? ' ',
    'Fecha Venta': lead.fechaVenta ?? ' '
  };

  if (targetSheetName !== "Amaderarte Leads") leadFields['Estado'] = lead.crmStatus;

  const payload = {
      action: 'update',
      sheetName: targetSheetName,
      searchMode: searchMode, 
      searchValue: searchValue,
      lead: leadFields
  };

  logDebug(`[REQ] Update ${targetSheetName}`, { 
      client: FRONTEND_VERSION,
      target: targetSheetName,
      payload
  }, 'request');

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    const rawText = await response.text();
    
    if (rawText.trim().startsWith("<")) {
         logDebug("Error HTML Crudo", { rawText: rawText.substring(0, 200) + "..." }, 'error');
         throw new Error("El servidor devolvió HTML en lugar de JSON. Verifica la URL del script.");
    }

    let result;
    try {
        result = JSON.parse(rawText);
    } catch (e) {
        logDebug("Error JSON Parse", { rawText }, 'error');
        return false;
    }

    const serverVersion = result.backendVersion || "LEGACY";
    
    if (result.status === 'success') {
        logDebug(`[RES] Update Exitoso (${serverVersion})`, result, 'success');
        return true;
    } else {
        // DETECCIÓN ESPECÍFICA DE ERROR DE VERSIÓN
        if (result.message && result.message.includes('Acción desconocida')) {
            logDebug("ERROR FATAL: Código Backend Desactualizado", {
                mensaje: "El backend no ha sido actualizado. Ve a Apps Script > Deploy > New Deployment",
                detalle: result
            }, 'error');
        } else {
            logDebug(`[RES] Error Backend (${serverVersion})`, result, 'error');
        }
        return false;
    }

  } catch (error: any) {
    logDebug("Error Red/Sistema", { msg: error.message }, 'error');
    return false;
  }
};

// --- PIPELINE CONFIG ---

const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  YEAR: new Date().getFullYear(),
  ENE: 0, FEB: 0, MAR: 0, ABR: 0, MAY: 0, JUN: 0,
  JUL: 0, AGO: 0, SEP: 0, OCT: 0, NOV: 0, DIC: 0,
  NEG_MULT: 3.0,
  QUO_MULT: 3.0
};

export const fetchPipelineConfig = async (): Promise<PipelineConfig | null> => {
  if (!GOOGLE_SCRIPT_URL) return DEFAULT_PIPELINE_CONFIG;
  try {
    const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=get_config`);
    if (!response.ok) return DEFAULT_PIPELINE_CONFIG;
    const data = await response.json();
    if (data.status === 'success' && data.config) return data.config as PipelineConfig;
    return DEFAULT_PIPELINE_CONFIG;
  } catch {
    return DEFAULT_PIPELINE_CONFIG;
  }
};

export const savePipelineConfig = async (config: PipelineConfig): Promise<boolean> => {
  if (!GOOGLE_SCRIPT_URL) return false;
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'save_config', config })
    });
    if (!response.ok) return false;
    const data = await response.json();
    return data.status === 'success';
  } catch {
    return false;
  }
};
