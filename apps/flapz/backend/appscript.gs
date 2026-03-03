
// ==========================================
// BACKEND VERSION
// v1.0.0 - Initial release: CRUD, pipeline config, email tracking
// v1.1.0 - Apollo integration, fuzzy column mapping
// v1.2.0 - Nurturing pipeline: 7 new columns (Nurturing Status, Fecha Seg1-3, Accion Seg1-3)
// ==========================================
const BACKEND_VERSION = "1.2.0";

// ==========================================
// CONFIGURACIÓN DEL CRM (BACKEND)
// ==========================================
const SHEET_NAME = 'Registros';
const PIPELINE_SHEET_NAME = 'Pipeline';   // Nueva hoja para configuración de metas
const COL_ID_HEADER = 'AUX2';             // Identificador único del Lead
const COL_EMAIL_HEADER = 'CORREO';        // Para búsquedas por email (fallback)
const COL_TRACKING_HEADER = 'EMAIL_READ'; // Columna para el Pixel de Rastreo
const REMITENTE_NOMBRE = "Mateo de Flapz"; 

// Encabezados definidos para la hoja Pipeline
// NOTA: El orden es importante para la lectura/escritura desde el React App
const PIPELINE_HEADERS = [
  'YEAR', 
  'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC', 
  'NEG_MULT', 'QUO_MULT'
];

// ==========================================
// 1. GET: LEER DATOS, CONFIG Y PIXEL
// ==========================================
function doGet(e) {
  const action = e && e.parameter ? e.parameter.action : null;

  // --- A0. VERSION CHECK ---
  if (action === 'version') {
    return response({ version: BACKEND_VERSION });
  }

  // --- A. LEER CONFIGURACIÓN PIPELINE (NUEVO) ---
  if (action === 'get_config') {
    return getPipelineConfig();
  }

  // --- B. INTERCEPTOR DEL PIXEL ---
  if (action === 'track') {
    // Si no viene action explícito pero viene id, asumimos tracking (retrocompatibilidad)
    const id = e && e.parameter ? e.parameter.id : null;
    if (id) return handleTrackingPixel(id);
  }

  // --- C. FLUJO NORMAL (LEER LEADS) ---
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) return response({status: 'error', message: 'Hoja Registros no encontrada'});
  
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return response([]);

  const headers = rows[0];
  
  // HELPER: Forzar formato de fecha a String Local (GMT-5)
  const formatDate = (val) => {
    if (!val) return "";
    if (val instanceof Date) {
       return Utilities.formatDate(val, "GMT-05:00", "yyyy-MM-dd HH:mm:ss");
    }
    return String(val); 
  };
  
  // Convertir filas a objetos JSON
  const data = rows.slice(1).map(row => {
    let obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });

    // Normalización de fechas de creación
    let rawDate = null;
    if (obj['Marca temporal']) rawDate = obj['Marca temporal'];
    else if (obj['Timestamp']) rawDate = obj['Timestamp'];
    else if (row.length > 5) rawDate = row[5]; 
    
    obj['_created_at_'] = formatDate(rawDate);
    
    return obj;
  });

  return response(data);
}

// ==========================================
// 2. POST: CREAR, ACTUALIZAR, GUARDAR CONFIG Y EMAILS
// ==========================================
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); 
  } catch (e) {
    return response({status: 'error', message: 'Servidor ocupado'});
  }

  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action; 

    // --- ACCIÓN: GUARDAR CONFIGURACIÓN PIPELINE (NUEVO) ---
    // Esto se maneja antes de cargar la hoja 'Registros'
    if (action === 'save_config') {
       return savePipelineConfig(payload.config);
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error("Hoja 'Registros' no encontrada");
    
    // --- ACCIÓN: ELIMINAR LEAD ---
    if (action === 'delete') {
      return deleteLead(payload.email, sheet);
    }

    // --- ACCIÓN: ENVIAR CORREO ---
    if (action === 'send_email') {
       const recipient = payload.recipient;
       const subject = payload.subject;
       const body = payload.body;
       const htmlBody = payload.htmlBody;

       if (!recipient) throw new Error("Falta el destinatario");

       var options = { name: REMITENTE_NOMBRE };
       if (htmlBody) options.htmlBody = htmlBody;

       GmailApp.sendEmail(recipient, subject, body, options);
       return response({status: 'success', message: 'Correo enviado'});
    }

    // --- ACCIÓN: ACTUALIZAR O CREAR REGISTRO ---
    const lead = payload.lead;
    if (!lead) throw new Error("Datos del lead incompletos");

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // Identificar columnas clave
    const idxId = headers.indexOf(COL_ID_HEADER);
    const idxEmail = headers.findIndex(h => String(h).toUpperCase() === 'CORREO' || String(h).toUpperCase() === 'EMAIL');
    
    let rowIndex = -1;

    // 1. Buscar por ID
    if (lead.AUX2 && idxId !== -1) {
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idxId]).trim() === String(lead.AUX2).trim()) {
          rowIndex = i + 1;
          break;
        }
      }
    }
    // 2. Buscar por Correo (Fallback)
    if (rowIndex === -1 && lead.correo && idxEmail !== -1) {
      for (let i = data.length - 1; i >= 1; i--) {
        if (String(data[i][idxEmail]).trim().toLowerCase() === String(lead.correo).trim().toLowerCase()) {
          rowIndex = i + 1;
          break;
        }
      }
    }

    // MAPEO DE VALORES
    const getLeadValueForHeader = (headerName) => {
        const h = String(headerName).toUpperCase().trim();
        if (h === 'AUX1' || h === 'ESTADO' || h === 'STATUS') return lead.crmStatus || lead.AUX1;
        if (h === 'AUX2' || h === 'ID') return lead.id || lead.AUX2;
        if (h === 'CORREO' || h === 'EMAIL') return lead.correo || lead.email;
        if (h === 'NOMBRE' || h === 'FIRST NAME') return lead.nombre;
        if (h === 'APELLIDO' || h === 'LAST NAME') return lead.apellido;
        if (h === 'TELEFONO' || h === 'WHATSAPP' || h === 'PHONE') return lead.whatsapp || lead.telefono;
        if (h === 'AERONAVE' || h === 'AIRCRAFT') return lead.aeronave;
        if (h === 'VALOR' || h === 'PRECIO' || h === 'PRICE') return lead.valor;
        if (h === 'SALIDA' || h === 'FECHA IDA' || h === 'DEPARTURE') return lead.fecha;
        if (h === 'REGRESO' || h === 'FECHA REGRESO' || h === 'RETURN') return lead.fechaRegreso;
        if (h === 'VENDIDO') return lead.vendido;
        if (h === 'INDICADOR DE CALIDAD' || h === 'QUALITY') return lead.indicadorCalidad;
        if (h === 'FAVORITO') return lead.favorito;
        if (h === 'ORIGEN') return lead.origen;
        if (h === 'DESTINO') return lead.destino;
        if (h === 'CAMPAÑA' || h === 'CAMPAA' || h === 'CAMPAIGN') return lead.campana;
        if (h === 'ORIGEN DE LEAD' || h === 'SOURCE') return lead.source;
        if (h === 'FECHA VENTA' || h === 'FECHA DE VENTA' || h === 'SALE DATE') return lead.fechaVenta; // NUEVO MAPEO
        if (h === COL_TRACKING_HEADER) return lead.email_read;
        if (h === 'CARGO' || h === 'ROL' || h === 'ROLE' || h === 'JOB TITLE') return lead.cargo || lead.Cargo || "";
        if (h === 'EMPRESA' || h === 'COMPANIA' || h === 'COMPAÑÍA' || h === 'COMPANY') return lead.compania || lead.Empresa || "";
        if (h === 'NURTURING STATUS' || h === 'NURTURING_STATUS') return lead['Nurturing Status'] || lead.nurturingStatus || "";
        if (h === 'FECHA SEG1' || h === 'FECHA_SEG1') return lead['Fecha Seg1'] || lead.fechaSeg1 || "";
        if (h === 'FECHA SEG2' || h === 'FECHA_SEG2') return lead['Fecha Seg2'] || lead.fechaSeg2 || "";
        if (h === 'FECHA SEG3' || h === 'FECHA_SEG3') return lead['Fecha Seg3'] || lead.fechaSeg3 || "";
        if (h === 'ACCION SEG1' || h === 'ACCION_SEG1') return lead['Accion Seg1'] || lead.accionSeg1 || "";
        if (h === 'ACCION SEG2' || h === 'ACCION_SEG2') return lead['Accion Seg2'] || lead.accionSeg2 || "";
        if (h === 'ACCION SEG3' || h === 'ACCION_SEG3') return lead['Accion Seg3'] || lead.accionSeg3 || "";
        return lead[headerName] || "";
    };

    if (rowIndex !== -1) {
      // === ACTUALIZAR EXISTENTE ===
      headers.forEach((header, colIdx) => {
         const val = getLeadValueForHeader(header);
         if (val !== undefined) {
             if (val !== "" || header === COL_TRACKING_HEADER) {
                sheet.getRange(rowIndex, colIdx + 1).setValue(val);
             }
         }
      });
      return response({status: 'success', message: 'Lead actualizado'});

    } else {
      // === CREAR NUEVO ===
      const newRow = headers.map(header => {
          if (header === 'Marca temporal' || header === 'Timestamp') return new Date();
          const val = getLeadValueForHeader(header);
          return val !== undefined ? val : "";
      });
      
      sheet.appendRow(newRow);
      return response({status: 'success', message: 'Lead creado correctamente'});
    }

  } catch (error) {
    return response({status: 'error', message: error.toString()});
  } finally {
    lock.releaseLock();
  }
}

// ==========================================
// FUNCIONES AUXILIARES: PIPELINE (NUEVO)
// ==========================================

// Verifica si existe la hoja 'Pipeline', si no, la crea con encabezados y fila default.
function ensurePipelineSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(PIPELINE_SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(PIPELINE_SHEET_NAME);
    // 1. Crear encabezados en Fila 1
    sheet.getRange(1, 1, 1, PIPELINE_HEADERS.length).setValues([PIPELINE_HEADERS]);
    
    // 2. Crear fila inicial vacía con año actual en Fila 2 (para evitar lecturas vacías)
    const initialRow = PIPELINE_HEADERS.map(h => h === 'YEAR' ? new Date().getFullYear() : 0);
    
    // Valores por defecto para multiplicadores (evita división por cero)
    initialRow[PIPELINE_HEADERS.indexOf('NEG_MULT')] = 3.0;
    initialRow[PIPELINE_HEADERS.indexOf('QUO_MULT')] = 3.0;
    
    sheet.appendRow(initialRow);
  }
  return sheet;
}

function getPipelineConfig() {
  const sheet = ensurePipelineSheet();
  const data = sheet.getDataRange().getValues();
  
  // Si solo están los encabezados, devolvemos objeto vacío
  if (data.length < 2) return response({}); 

  const headers = data[0];
  const row = data[1]; // Tomamos siempre la fila 2 como la configuración activa
  
  let config = {};
  headers.forEach((h, i) => {
    config[h] = row[i];
  });
  
  return response(config);
}

function savePipelineConfig(config) {
  const sheet = ensurePipelineSheet();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Construir fila ordenada según encabezados de la hoja (seguridad)
  const newRow = headers.map(h => config[h] !== undefined ? config[h] : "");
  
  // Sobrescribir siempre la fila 2 (Mantenemos una sola configuración activa)
  if (sheet.getLastRow() >= 2) {
    sheet.getRange(2, 1, 1, headers.length).setValues([newRow]);
  } else {
    sheet.appendRow(newRow);
  }
  
  return response({status: 'success', message: 'Configuración guardada'});
}

// ==========================================
// OTRAS UTILIDADES
// ==========================================

function deleteLead(email, sheet) {
    if (!email) return response({status: 'error', message: 'Email requerido'});
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idxEmail = headers.findIndex(h => String(h).toUpperCase() === 'CORREO' || String(h).toUpperCase() === 'EMAIL');
    
    if (idxEmail === -1) return response({status: 'error', message: 'Columna email no encontrada'});
    
    let deletedCount = 0;
    // Iteramos de abajo hacia arriba para borrar sin afectar índices
    for (let i = data.length - 1; i >= 1; i--) {
        if (String(data[i][idxEmail]).trim().toLowerCase() === String(email).trim().toLowerCase()) {
            sheet.deleteRow(i + 1);
            deletedCount++;
        }
    }
    
    if (deletedCount > 0) return response({status: 'success', message: 'Lead eliminado'});
    return response({status: 'error', message: 'Lead no encontrado'});
}

function handleTrackingPixel(leadId) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return ContentService.createTextOutput("Busy");

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const idxId = headers.indexOf(COL_ID_HEADER);
    let idxTrack = headers.findIndex(h => String(h).toUpperCase() === COL_TRACKING_HEADER.toUpperCase());

    if (idxId !== -1 && idxTrack !== -1 && leadId) {
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idxId]).trim() === String(leadId).trim()) {
           sheet.getRange(i + 1, idxTrack + 1).setValue("TRUE");
           SpreadsheetApp.flush();
           break;
        }
      }
    }
  } catch (e) {
    Logger.log("Error tracking: " + e.toString());
  } finally {
    lock.releaseLock();
  }
  return ContentService.createTextOutput("Tracked");
}

function response(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
