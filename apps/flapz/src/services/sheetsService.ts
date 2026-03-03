
import { Lead, CrmStatus, QualityIndicator, PipelineConfig } from '../types';
import { MOCK_LEADS } from './mockData';

// Helper: emite un evento crm-debug-log visible en DebugLogger
const logData = (title: string, data?: unknown, type: 'info' | 'success' | 'error' | 'request' = 'info') => {
  window.dispatchEvent(new CustomEvent('crm-debug-log', {
    detail: {
      id: `sheets-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toLocaleTimeString(),
      title: `[Sheets] ${title}`,
      data: data ?? null,
      type,
    }
  }));
};

// ---------------------------------------------------------------------------
// CONFIGURACIÓN DE ENDPOINTS
// ---------------------------------------------------------------------------
// SECURITY: Las URLs se leen desde variables de entorno (.env) para que no
// queden expuestas en el historial de git.
// ⚠️  PENDIENTE FASE 2 (CRÍTICO — S3): Agregar autenticación a los endpoints de
//    Apps Script. Sin auth, cualquier persona con la URL puede leer/escribir
//    datos del CRM. Ver .env.example para instrucciones de configuración.

// URL 1: Backend CRM (Hoja "Registros") - Gestión y Estados
const DEFAULT_CRM_SCRIPT_URL: string = import.meta.env.VITE_CRM_SCRIPT_URL ?? "";

// URL 2: Backend Precotizador (Hoja "Sheet1") - Data Cruda Histórica
const PRECOTIZADOR_SCRIPT_URL: string = import.meta.env.VITE_PRECOTIZADOR_SCRIPT_URL ?? "";

// Helper to get the current CRM URL (User defined or Default)
export const getApiUrl = (): string => {
    const stored = localStorage.getItem("APP_SCRIPT_URL");
    return stored && stored.startsWith("http") ? stored : DEFAULT_CRM_SCRIPT_URL;
};

// Helper to save new CRM URL
export const setApiUrl = (url: string) => {
    if (!url || !url.trim()) {
        localStorage.removeItem("APP_SCRIPT_URL");
    } else {
        localStorage.setItem("APP_SCRIPT_URL", url.trim());
    }
};

// Helper: Case-insensitive fuzzy search for object keys
const findColumnValue = (row: any, keywords: string[]): string => {
    if (!row || typeof row !== 'object') return "";
    const keys = Object.keys(row);

    // Normalize NFD helper
    const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // Pass 1: Exact matches (case-insensitive, normalized)
    for (const keyword of keywords) {
        const normalizedKeyword = normalize(keyword);
        const matchingKey = keys.find(key => normalize(key) === normalizedKeyword);
        if (matchingKey && row[matchingKey] !== undefined && row[matchingKey] !== null) {
            return String(row[matchingKey]);
        }
    }

    // Pass 2: Fuzzy matches (.includes)
    // CRITICAL: Exclude internal system tags like 'SOURCE_ORIGIN' to avoid collisions with data fields like 'Origin'
    for (const keyword of keywords) {
        const normalizedKeyword = normalize(keyword);
        const matchingKey = keys.find(key => {
            if (key === 'SOURCE_ORIGIN') return false;
            const normalizedKey = normalize(key);
            return normalizedKey.includes(normalizedKeyword);
        });
        if (matchingKey && row[matchingKey] !== undefined && row[matchingKey] !== null) {
            return String(row[matchingKey]);
        }
    }

    return "";
};

// Helper to normalize raw data coming from sheets (Handles both Leads Sheet and Sheet1)
const normalizeLead = (rawLead: any): Lead => {
    // 1. Determine Identity (Email & Name)
    const correo = findColumnValue(rawLead, ['CORREO', 'User Email', 'Email']);
    const nombre = findColumnValue(rawLead, ['NOMBRE', 'User Name', 'First Name']);
    const apellido = findColumnValue(rawLead, ['APELLIDO', 'User Surname', 'Last Name']);
    const whatsapp = findColumnValue(rawLead, ['WHATSAPP', 'User Phone', 'Phone', 'Teléfono']);

    // 2. Generate ID
    // Registros sheet usually has AUX2. Precotizador doesn't.
    // APOLLO CRITICAL: Use correo as ID strictly.
    let id = "";
    if (rawLead['SOURCE_ORIGIN'] === 'APOLLO') {
        id = correo ? correo.trim().toLowerCase() : `apollo-temp-${Math.random().toString(36).substr(2, 9)}`;
    } else {
        id = rawLead.AUX2 ? String(rawLead.AUX2).trim() : "";
        if (!id) id = correo ? correo.trim().toLowerCase() : `temp-${Math.random().toString(36).substr(2, 9)}`;
    }

    // 3. Status Logic
    let status = rawLead.AUX1;
    const vendido = findColumnValue(rawLead, ['Vendido', 'Sold']);

    // APOLLO CRITICAL: Default to 'Nuevo'
    if (rawLead['SOURCE_ORIGIN'] === 'APOLLO') {
        status = CrmStatus.NUEVO;
    } else if (!status) {
        if (String(vendido).toUpperCase() === "X" || String(vendido).toUpperCase() === "TRUE") {
            status = CrmStatus.GANADOS;
        } else {
            status = CrmStatus.NUEVO;
        }
    }

    // 4. Source & Origin Detection
    // Check explicit tag from backend or infer from lack of CRM columns
    const originTag = rawLead['SOURCE_ORIGIN'];
    const isSheet1 = originTag === 'PRECOTIZADOR' || (!rawLead.AUX1 && (rawLead['Option 1 Aircraft'] || rawLead['User Email']));
    const isApollo = originTag === 'APOLLO';

    let source = findColumnValue(rawLead, ['FORMULARIO', 'Source', 'UTM Source', 'Origen']);
    if (isApollo) {
        source = "APOLLO";
    } else if (isSheet1) {
        source = "PRECOTIZADOR";
    } else if (!source) {
        source = "Organic";
    }

    // 5. Quality Logic
    // Pre-cotizador and Apollo leads default to 'NO' unless specified otherwise
    let indicadorCalidad = findColumnValue(rawLead, ['Indicador de Calidad', 'Quality']);
    if (!indicadorCalidad && (isSheet1 || isApollo)) {
        indicadorCalidad = QualityIndicator.NO;
    } else if (!indicadorCalidad) {
        indicadorCalidad = QualityIndicator.NO;
    }

    // 5b. Apollo-specific fields (Robust mapping with defaults)
    let cargo = "";
    let compania = "";

    if (isApollo) {
        cargo = findColumnValue(rawLead, ['Cargo', 'Title', 'Job Title']);
        compania = findColumnValue(rawLead, ['Empresa', 'Company', 'Compañía']);
    } else {
        // Standardize structure for Sheet1/CRM
        cargo = findColumnValue(rawLead, ['Cargo', 'cargo']) || "";
        compania = findColumnValue(rawLead, ['Empresa', 'empresa', 'Compañía']) || "";
    }

    // 6. Flight Data Mapping
    // APOLLO CRITICAL: flight origin should be empty so agents can fill it later.
    // The lead source (APOLLO) is already handled in 'source' field.
    let origen = findColumnValue(rawLead, ['ORIGEN', 'Origin']);
    if (isApollo) origen = "";

    const destino = findColumnValue(rawLead, ['DESTINO', 'Destination']);

    // Dates
    let rawFecha = findColumnValue(rawLead, ['SALIDA', 'Departure Date', 'Fecha Ida']);
    const fechaIda = rawFecha ? parseSmartDate(rawFecha) : "";

    let rawRegreso = findColumnValue(rawLead, ['REGRESO', 'Return Date', 'Fecha Regreso']);
    const fechaRegreso = rawRegreso ? parseSmartDate(rawRegreso) : undefined;

    // FECHA VENTA Parsing
    let rawFechaVenta = findColumnValue(rawLead, ['FECHA VENTA', 'Sale Date', 'Fecha Venta', 'Fecha de Cierre']);
    const fechaVenta = rawFechaVenta ? parseSmartDate(rawFechaVenta) : undefined;

    // Aircraft
    let aeronave = findColumnValue(rawLead, ['AERONAVE', 'Option 1 Aircraft', 'Aircraft']);
    if (!aeronave) aeronave = "Por definir";

    // Price (Priority: COP -> USD -> Generic)
    let valor = findColumnValue(rawLead, ['VALOR', 'Option 1 Price (COP)', 'Option 1 Price (USD)', 'Price']);

    // 7. Metadata (Creation Date & Tracking)
    let rawCreated = rawLead['_created_at_'];
    if (!rawCreated) {
        // Apollo uses 'Fecha' | Sheet1 uses 'Timestamp' | CRM uses 'marca temporal' etc.
        // Important: Apollo 'Fecha' is in GMT-5. Sheet1 'Timestamp' is in ISO/GMT 0.
        rawCreated = findColumnValue(rawLead, ['Timestamp', 'Fecha', 'Date', 'creacion', 'marca temporal', 'created', 'fecha de ingreso']);
    }

    // Pass hint about source to handle timezone correctly if needed
    const createdAt = parseTimestamp(rawCreated, isApollo ? 'GMT-5' : (isSheet1 ? 'GMT-0' : undefined));

    const rawFav = findColumnValue(rawLead, ['Favorito', 'Favorite']);
    const rawFavStr = String(rawFav).toUpperCase().trim();
    const isFav = rawFavStr === "X" || rawFavStr === "TRUE" || rawFavStr === "SI";

    // Email Tracking Status
    const rawRead = findColumnValue(rawLead, ['email_read', 'leido', 'read', 'visto']);
    let emailOpened: boolean | 'SENT' = false;
    const rawReadStr = String(rawRead).toUpperCase().trim();
    if (rawReadStr === "TRUE" || rawReadStr === "SI" || rawReadStr === "X") {
        emailOpened = true;
    } else if (rawReadStr === "SENT" || rawReadStr === "ENVIADO") {
        emailOpened = 'SENT';
    }

    // 8. Nurturing fields
    // Fechas use combined format: "YYYY-MM-DD | Estado" (Estado = 'Ejecutado' | 'Por Ejecutar')
    const parseSegField = (raw: string): { date: string; estado: string } => {
        if (!raw) return { date: '', estado: '' };
        const pipeIdx = raw.indexOf(' | ');
        if (pipeIdx === -1) return { date: raw.trim(), estado: '' };
        return { date: raw.slice(0, pipeIdx).trim(), estado: raw.slice(pipeIdx + 3).trim() };
    };

    const nurturingStatus = findColumnValue(rawLead, ['Nurturing Status', 'NURTURING STATUS', 'NURTURING_STATUS']) || undefined;
    const rawFechaSeg1 = findColumnValue(rawLead, ['Fecha Seg1', 'FECHA SEG1', 'FECHA_SEG1']);
    const seg1 = parseSegField(rawFechaSeg1);
    const fechaSeg1 = seg1.date ? parseSmartDate(seg1.date) : undefined;
    const estadoSeg1 = seg1.estado || undefined;

    const rawFechaSeg2 = findColumnValue(rawLead, ['Fecha Seg2', 'FECHA SEG2', 'FECHA_SEG2']);
    const seg2 = parseSegField(rawFechaSeg2);
    const fechaSeg2 = seg2.date ? parseSmartDate(seg2.date) : undefined;
    const estadoSeg2 = seg2.estado || undefined;

    const rawFechaSeg3 = findColumnValue(rawLead, ['Fecha Seg3', 'FECHA SEG3', 'FECHA_SEG3']);
    const seg3 = parseSegField(rawFechaSeg3);
    const fechaSeg3 = seg3.date ? parseSmartDate(seg3.date) : undefined;
    const estadoSeg3 = seg3.estado || undefined;

    const accionSeg1 = findColumnValue(rawLead, ['Accion Seg1', 'ACCION SEG1', 'ACCION_SEG1']) || undefined;
    const accionSeg2 = findColumnValue(rawLead, ['Accion Seg2', 'ACCION SEG2', 'ACCION_SEG2']) || undefined;
    const accionSeg3 = findColumnValue(rawLead, ['Accion Seg3', 'ACCION SEG3', 'ACCION_SEG3']) || undefined;

    return {
        id,
        nombre: nombre || "Sin Nombre",
        apellido: apellido || "",
        correo: correo || "",
        whatsapp: whatsapp,
        aeronave,
        origen,
        destino,
        valor,
        indicadorCalidad,
        vendido,
        fecha: fechaIda,
        fechaRegreso,
        fechaVenta,
        source,
        campana: isApollo ? "APOLLO" : (findColumnValue(rawLead, ['Campaña', 'UTM Campaign', 'Campaign']) || "Directo"),
        createdAt,
        crmStatus: status,
        isFavorite: isFav,
        emailOpened,
        cargo,
        compania,
        nurturingStatus,
        fechaSeg1,
        fechaSeg2,
        fechaSeg3,
        accionSeg1,
        accionSeg2,
        accionSeg3,
        estadoSeg1,
        estadoSeg2,
        estadoSeg3,
    };
};

// Date Helpers
const parseTimestamp = (input: any, tzHint?: 'GMT-5' | 'GMT-0'): string => {
    if (!input) return "";
    let str = String(input).trim();

    // 1. If strict ISO with Z (UTC), assume GMT-0
    if (str.includes('T') && (str.includes('Z') || str.includes('+') || str.match(/-\d{2}:\d{2}$/))) {
        return new Date(str).toISOString();
    }

    try {
        // 2. Handle Simple Strings "2024-02-10 10:00:00" or Date objects
        // If it's just a date string, apply the timezone hint
        if (!str.includes('Z') && !str.includes('+') && !str.match(/-\d{2}:\d{2}$/)) {
            const ISOStr = str.includes('T') ? str : str.replace(' ', 'T');

            if (tzHint === 'GMT-5') {
                return new Date(`${ISOStr}-05:00`).toISOString();
            } else if (tzHint === 'GMT-0') {
                // If it's Sheet1 Timestamp without Z, it's usually UTC
                return new Date(`${ISOStr}Z`).toISOString();
            }

            // Default fallback to local/GMT-5 if no hint
            return new Date(`${ISOStr}-05:00`).toISOString();
        }

        const date = new Date(str);
        if (isNaN(date.getTime())) return "";
        return date.toISOString();
    } catch (e) { return ""; }
};

const parseSmartDate = (input: any): string => {
    if (!input) return "";
    if (input instanceof Date && !isNaN(input.getTime())) {
        const y = input.getFullYear();
        const m = String(input.getMonth() + 1).padStart(2, '0');
        const d = String(input.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    let str = String(input).trim();
    if (str.includes('T')) str = str.split('T')[0];

    const yearFirstMatch = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
    if (yearFirstMatch) return `${yearFirstMatch[1]}-${yearFirstMatch[2].padStart(2, '0')}-${yearFirstMatch[3].padStart(2, '0')}`;

    const dayFirstMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
    if (dayFirstMatch) {
        let y = dayFirstMatch[3];
        if (y.length === 2) y = `20${y}`;
        return `${y}-${dayFirstMatch[2].padStart(2, '0')}-${dayFirstMatch[1].padStart(2, '0')}`;
    }
    return str;
};

// ---------------------------------------------------------------------------
// API FUNCTIONS
// ---------------------------------------------------------------------------

export const fetchLeads = async (): Promise<Lead[]> => {
    const crmUrl = getApiUrl();
    const rawUrl = PRECOTIZADOR_SCRIPT_URL;

    logData('fetchLeads iniciado', {
        crmUrl: crmUrl ? `${crmUrl.slice(0, 60)}...` : '(vacío)',
        precotizadorUrl: rawUrl ? `${rawUrl.slice(0, 60)}...` : '(vacío)',
    });

    // If no URL configured, return Mock Data
    if (!crmUrl || crmUrl.includes("script.google.com/macros/s/...")) {
        logData('URL no configurada — usando MOCK_LEADS', { crmUrl }, 'error');
        console.warn("Using Mock Data (No valid URL configured).");
        return MOCK_LEADS.map(l => ({ ...l }));
    }

    try {
        // Helper: fetch con validación de status HTTP y tipo de respuesta
        const safeFetch = async (url: string, label: string): Promise<any[]> => {
            if (!url) {
                logData(`${label}: URL vacía — omitiendo fetch`, null, 'info');
                return [];
            }
            try {
                logData(`${label}: iniciando fetch`, { url: `${url.slice(0, 60)}...` }, 'request');
                const r = await fetch(url);
                if (!r.ok) {
                    logData(`${label}: error HTTP ${r.status}`, { status: r.status, statusText: r.statusText }, 'error');
                    console.error(`[sheetsService] ${label}: HTTP ${r.status} ${r.statusText}`);
                    return [];
                }
                const data = await r.json();
                if (!Array.isArray(data)) {
                    logData(`${label}: respuesta inesperada (no es array)`, data, 'error');
                    console.error(`[sheetsService] ${label}: respuesta inesperada (no es array)`, data);
                    return [];
                }
                logData(`${label}: fetch OK`, { filas: data.length }, 'success');
                return data;
            } catch (e) {
                logData(`${label}: error de red o parseo`, { error: String(e) }, 'error');
                console.error(`[sheetsService] ${label}: error de red o parseo`, e);
                return [];
            }
        };

        // 1. Fetch both sources in parallel
        const [crmData, rawData] = await Promise.all([
            safeFetch(crmUrl, "CRM"),
            safeFetch(rawUrl, "Precotizador"),
        ]);

        // 2. Normalize CRM Data (Master List)
        const normalizedCrmLeads = crmData
            .filter((row: any) => {
                const hasEmail = findColumnValue(row, ['CORREO', 'User Email', 'Email']).includes('@');
                const hasId = row.AUX2 && String(row.AUX2).length > 0;
                return hasEmail || hasId;
            })
            .map(normalizeLead);

        // 4. Map CRM Leads for quick lookup
        const crmEmailMap = new Map<string, Lead>();
        normalizedCrmLeads.forEach(lead => {
            if (lead.correo) crmEmailMap.set(lead.correo.toLowerCase(), lead);
        });

        // 5. Deduplicate Raw Data (Sheet1 + Apollo)
        // Goal: Only keep the LATEST interaction per email from the raw source.
        const latestRawLeadsMap = new Map<string, any>();

        rawData.forEach((row: any) => {
            // NOTE: SOURCE_ORIGIN is now provided by the backend ('PRECOTIZADOR' or 'APOLLO')

            // We use normalizeLead here temporarily just to extract email and date robustly
            // But we store the raw row to preserve original data structure for later
            const tempLead = normalizeLead(row);
            if (!tempLead.correo) return;

            const emailKey = tempLead.correo.toLowerCase();
            const currentDate = tempLead.createdAt ? new Date(tempLead.createdAt).getTime() : 0;

            if (!latestRawLeadsMap.has(emailKey)) {
                latestRawLeadsMap.set(emailKey, { row, date: currentDate });
            } else {
                const existing = latestRawLeadsMap.get(emailKey);
                // If current is newer, replace it
                if (currentDate > existing.date) {
                    latestRawLeadsMap.set(emailKey, { row, date: currentDate });
                }
            }
        });

        // 6. Process Unique Raw Leads & Merge with CRM
        const finalLeads = [...normalizedCrmLeads];

        latestRawLeadsMap.forEach(({ row }: { row: any }) => {
            const rawLead = normalizeLead(row);
            const emailKey = rawLead.correo.toLowerCase();
            const existingCrmLead = crmEmailMap.get(emailKey);

            // PRIORITY RULE: CRM IS TRUTH
            if (!existingCrmLead) {
                finalLeads.push(rawLead);
            }
        });

        // 7. FINAL SORT: Chronological (Newest first)
        // This ensures the global state is already sorted for the Kanban.
        finalLeads.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA; // Descending
        });

        logData('fetchLeads completado', {
            crmLeads: normalizedCrmLeads.length,
            precotizadorLeads: latestRawLeadsMap.size,
            total: finalLeads.length,
        }, 'success');

        return finalLeads;

    } catch (error) {
        logData('fetchLeads — error inesperado', { error: String(error) }, 'error');
        console.error("Error fetching leads:", error);
        return MOCK_LEADS.map(l => ({ ...l }));
    }
};

export const updateLeadInSheet = async (lead: Lead, syncEmailStatus: boolean = true): Promise<boolean> => {
    const url = getApiUrl(); // Always write to CRM (Registros)
    if (!url) return true;

    try {
        // Helper to force update even if empty by sending a space character
        // This is a workaround for backend scripts that ignore empty strings/falsy values
        // "" -> " " (Backend sees ' ', writes ' ', User sees empty cell)
        const ensureVal = (v: string | undefined | null) => {
            if (v === undefined || v === null) return " ";
            const str = String(v);
            return str.length === 0 ? " " : str;
        };

        const leadData: any = {
            id: lead.id,
            AUX2: lead.id,
            correo: lead.correo,
            crmStatus: lead.crmStatus,
            AUX1: lead.crmStatus,
            aeronave: ensureVal(lead.aeronave),
            // Added explicit ORIGEN and DESTINO mapping for Sheet columns
            ORIGEN: ensureVal(lead.origen),
            DESTINO: ensureVal(lead.destino),
            origen: ensureVal(lead.origen),
            destino: ensureVal(lead.destino),
            valor: ensureVal(lead.valor),
            fecha: ensureVal(lead.fecha),
            fechaRegreso: ensureVal(lead.fechaRegreso),
            fechaVenta: ensureVal(lead.fechaVenta), // Send to Backend
            'FECHA VENTA': ensureVal(lead.fechaVenta), // Mapping Key
            vendido: lead.vendido,
            indicadorCalidad: lead.indicadorCalidad,
            favorito: lead.isFavorite ? 'X' : ' ' // Force clear if not favorite
        };

        // Siempre enviar cargo y compania si están presentes (aplica a todos los leads)
        if (lead.cargo) leadData.Cargo = lead.cargo;
        if (lead.compania) leadData.Empresa = lead.compania;

        // Nurturing fields (always send to allow clearing)
        // Fecha Seg fields use combined format: "YYYY-MM-DD | Estado" when estado is present
        const serializeSegDate = (date?: string, estado?: string): string => {
            if (!date) return ' ';
            if (estado) return `${date} | ${estado}`;
            return date;
        };

        leadData['Nurturing Status'] = lead.nurturingStatus ?? ' ';
        leadData['Fecha Seg1'] = serializeSegDate(lead.fechaSeg1, lead.estadoSeg1);
        leadData['Fecha Seg2'] = serializeSegDate(lead.fechaSeg2, lead.estadoSeg2);
        leadData['Fecha Seg3'] = serializeSegDate(lead.fechaSeg3, lead.estadoSeg3);
        leadData['Accion Seg1'] = lead.accionSeg1 ?? ' ';
        leadData['Accion Seg2'] = lead.accionSeg2 ?? ' ';
        leadData['Accion Seg3'] = lead.accionSeg3 ?? ' ';

        if (syncEmailStatus) {
            if (lead.emailOpened === true) leadData.email_read = 'TRUE';
            else if (lead.emailOpened === 'SENT') leadData.email_read = 'SENT';
            else leadData.email_read = 'FALSE';
        }

        // Data Promotion Logic:
        // If it comes from Precotizador or Apollo, we ensure we send ALL data to create the full record in Registros.
        if (lead.source === "PRECOTIZADOR" || lead.source === "APOLLO" || lead.id.includes('temp') || lead.id.includes('-new-')) {
            leadData.is_new_import = true;
            leadData.nombre = lead.nombre;
            leadData.apellido = lead.apellido;
            leadData.whatsapp = lead.whatsapp;
            leadData.origen = lead.origen;
            leadData.destino = lead.destino;
            leadData.campana = lead.campana;
            leadData.User_Email = lead.correo;
            leadData.User_Phone = lead.whatsapp;

            if (lead.source === "APOLLO") {
                leadData.FORMULARIO = "APOLLO";
            } else {
                // --- MIGRATION UPDATES (PRECOTIZADOR) ---
                leadData.FORMULARIO = "PRECOTIZADOR";
                leadData['Env. WA'] = "X";
            }

            // 3. Normalize Timestamp to FECHA column (YYYY-MM-DD HH:mm:ss)
            // FORCE GMT-5 CONVERSION for Colombia Time
            if (lead.createdAt) {
                const d = new Date(lead.createdAt);
                if (!isNaN(d.getTime())) {
                    const COLOMBIA_OFFSET = 5 * 60 * 60 * 1000;
                    const gmt5Date = new Date(d.getTime() - COLOMBIA_OFFSET);
                    const pad = (n: number) => n.toString().padStart(2, '0');
                    const formattedDate = `${gmt5Date.getUTCFullYear()}-${pad(gmt5Date.getUTCMonth() + 1)}-${pad(gmt5Date.getUTCDate())} ${pad(gmt5Date.getUTCHours())}:${pad(gmt5Date.getUTCMinutes())}:${pad(gmt5Date.getUTCSeconds())}`;
                    leadData.FECHA = formattedDate;
                }
            }

            // Clean ID if it was temp
            if (leadData.id.includes('temp') || leadData.id.includes('-new-')) {
                leadData.id = lead.correo; // Use email as stable ID once promoted
                leadData.AUX2 = lead.correo;
            }
        }

        const payload = {
            action: 'update',
            lead: leadData
        };

        const response = await fetch(url, {
            method: "POST",
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error(`[sheetsService] updateLead: HTTP ${response.status} ${response.statusText}`);
            return false;
        }
        const result = await response.json();
        return result.status === 'success';
    } catch (error) {
        console.error("Error updating lead:", error);
        return false;
    }
};

export const sendEmailToLead = async (
    lead: Lead,
    subject: string,
    body: string,
    options: { htmlHeader?: string, htmlFooter?: string } = {}
): Promise<{ success: boolean, message: string }> => {
    const url = getApiUrl();
    if (!url) return { success: false, message: "No API URL configured" };

    try {
        const trackingUrl = `${url}?action=track&id=${encodeURIComponent(lead.id)}&t=${Date.now()}`;
        const trackingPixel = `<img src="${trackingUrl}" width="1" height="1" style="opacity:0.01;" alt="" />`;

        const htmlContent = body.replace(/\n/g, '<br>');
        const finalHtmlBody = `
            <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.5;">
                ${options.htmlHeader || ''}
                ${htmlContent}
                ${options.htmlFooter || ''}
            </div>
            <br>${trackingPixel}`;

        const payload = {
            action: 'send_email',
            recipient: lead.correo,
            subject: subject,
            htmlBody: finalHtmlBody,
            body: body,
            lead: {
                AUX2: lead.id,
                id: lead.id,
                correo: lead.correo,
                nombre: lead.nombre
            }
        };

        const response = await fetch(url, {
            method: "POST",
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const msg = `Error de servidor al enviar email: HTTP ${response.status}`;
            console.error(`[sheetsService] sendEmail: ${msg}`);
            return { success: false, message: msg };
        }
        const result = await response.json();

        if (result.status === 'success') {
            return { success: true, message: "Email enviado correctamente" };
        } else {
            console.error("Email send failed:", result);
            return { success: false, message: result.message || "Error desconocido" };
        }
    } catch (error: any) {
        console.error("Error calling send_email:", error);
        return { success: false, message: error.toString() };
    }
};

// RENAMED & UPDATED: Deletes from BOTH sources
export const deleteLeadFromAllSources = async (email: string, source?: string): Promise<boolean> => {
    const precotizadorUrl = PRECOTIZADOR_SCRIPT_URL;
    const crmUrl = getApiUrl();

    if (!email) return false;

    const payload = {
        action: 'delete',
        email: email,
        source: source // Enviar el origen para que el backend sepa de qué hoja borrar
    };

    // We try to delete from both. If at least one succeeds, we consider it a partial success (return true),
    // but ideally both should succeed.
    try {
        const promises = [];

        // 1. Delete from Precotizador (Sheet1)
        if (precotizadorUrl && !precotizadorUrl.includes("script.google.com/macros/s/...")) {
            promises.push(
                fetch(precotizadorUrl, {
                    method: "POST",
                    body: JSON.stringify(payload)
                }).then(r => r.ok).catch(e => false)
            );
        }

        // 2. Delete from CRM (Registros)
        if (crmUrl && !crmUrl.includes("script.google.com/macros/s/...")) {
            promises.push(
                fetch(crmUrl, {
                    method: "POST",
                    body: JSON.stringify(payload)
                }).then(r => r.json()).then(data => data.status === 'success').catch(e => false)
            );
        }

        const results = await Promise.all(promises);
        // Return true if at least one deletion attempt was successful or if no valid URLs existed (mock mode)
        return results.some(r => r === true) || results.length === 0;

    } catch (error) {
        console.error("Error deleting lead:", error);
        return false;
    }
};

// --- NEW PIPELINE CONFIGURATION FUNCTIONS ---

export const fetchPipelineConfig = async (): Promise<PipelineConfig | null> => {
    const url = getApiUrl();
    if (!url || url.includes("script.google.com/macros/s/...")) {
        // Mock Config for development/demo
        return {
            YEAR: new Date().getFullYear(),
            ENE: 50000000, FEB: 50000000, MAR: 60000000, ABR: 60000000,
            MAY: 70000000, JUN: 80000000, JUL: 80000000, AGO: 70000000,
            SEP: 90000000, OCT: 100000000, NOV: 120000000, DIC: 150000000,
            NEG_MULT: 3.0,
            QUO_MULT: 3.0
        };
    }

    try {
        const response = await fetch(`${url}?action=get_config`);
        if (!response.ok) {
            console.error(`[sheetsService] fetchPipelineConfig: HTTP ${response.status}`);
            return null;
        }
        const data = await response.json();

        // Check if data is empty, return default if so
        if (Object.keys(data).length === 0) {
            return {
                YEAR: new Date().getFullYear(),
                ENE: 0, FEB: 0, MAR: 0, ABR: 0, MAY: 0, JUN: 0,
                JUL: 0, AGO: 0, SEP: 0, OCT: 0, NOV: 0, DIC: 0,
                NEG_MULT: 3.0, QUO_MULT: 3.0
            };
        }
        return data;
    } catch (error) {
        console.error("Error fetching pipeline config:", error);
        return null;
    }
};

export const savePipelineConfig = async (config: PipelineConfig): Promise<boolean> => {
    const url = getApiUrl();
    if (!url) return false;

    try {
        const payload = {
            action: 'save_config',
            config: config
        };

        const response = await fetch(url, {
            method: "POST",
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error(`[sheetsService] savePipelineConfig: HTTP ${response.status}`);
            return false;
        }
        const result = await response.json();
        return result.status === 'success';
    } catch (error) {
        console.error("Error saving pipeline config:", error);
        return false;
    }
};
