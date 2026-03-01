// --- CONFIGURACIÓN CENTRALIZADA ---
const BACKEND_VERSION = "v3.1.0_FULL_INTEGRATION"; 
const SHEETS_CONFIG = {
  "Amaderarte Leads": { searchCols: ["Telefono", "Celular", "WhatsApp", "Movil"] },
  "Amaderarte Leads 1 Mueble": { searchCols: ["Telefono", "Celular", "WhatsApp", "Movil"] },
  "App Leads": { searchCols: ["Correo", "Email", "Correo Electrónico"] },
  "Consultas": { searchCols: ["WhatsApp", "Nombre"] },
  "WA Leads": { searchCols: ["WhatsApp", "Telefono", "Celular", "Phone", "Mobile"] },
  "Trafico": { searchCols: [] },
  "Visitas": { searchCols: [] } 
};

/**
 * FUNCIÓN GET (RUTEADOR)
 * Detecta si la petición es una visita de la landing o una consulta de datos.
 */
function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // A. REGISTRO DE VISITA (WordPress envía parámetro 'url')
  if (e.parameter.url) {
    return registrarVisitaSimple(ss, e.parameter);
  }

  // B. EXPORTACIÓN DE LEADS (Original para Chatbot/App)
  let allLeads = [];
  try {
    Object.keys(SHEETS_CONFIG).forEach(sheetName => {
      // REMOVED EXCLUSION TO ALLOW FETCHING TRAFICO AND VISITAS
      // if (sheetName === "Trafico" || sheetName === "Visitas") return; 
      
      const sheet = ss.getSheetByName(sheetName);
      if (sheet) {
        const data = getDataFromSheet(sheet);
        data.forEach(row => {
          row['_sheetName'] = sheetName;
          ['Telefono', 'Celular', 'WhatsApp', 'Correo', 'Email'].forEach(col => {
             if(row[col]) row[col] = String(row[col]);
          });
        });
        allLeads = allLeads.concat(data);
      }
    });
    return createResponse({ status: 'success', data: allLeads });
  } catch (err) {
    return createResponse({ status: 'error', message: err.toString() });
  }
}

/**
 * LÓGICA PARA LA NUEVA HOJA "VISITAS"
 */
function registrarVisitaSimple(ss, params) {
  const HOJA_VISITAS = "Visitas";
  let sheet = ss.getSheetByName(HOJA_VISITAS);
  
  if (!sheet) {
    sheet = ss.insertSheet(HOJA_VISITAS);
    const headers = ["Fecha/Hora", "Página URL", "IP", "Source", "Medium", "Campaign", "Content", "Term", "User Agent"];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }

  sheet.appendRow([
    new Date(),
    params.url || "URL no capturada",
    params.ip || "No detectada",
    params.utm_source || "-",
    params.utm_medium || "-",
    params.utm_campaign || "-",
    params.utm_content || "-",
    params.utm_term || "-",
    params.user_agent || "Desconocido"
  ]);

  return ContentService.createTextOutput("Visita Registrada en Visitas").setMimeType(ContentService.MimeType.TEXT);
}

/**
 * FUNCIÓN POST MAESTRA
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(30000); 

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createResponse({ status: 'error', message: "No post data received" });
    }

    const body = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (body.action === 'ping') return createResponse({ status: 'success', message: 'pong' });

    if (body.action === 'log_visit') return createResponse(handleLogVisit(ss, body));

    if (body.action === 'update') {
      if (body.sheetName && body.lead) return createResponse(handleCrmUpdate(ss, body));
      if (body.row) return createResponse(handleAppUpdate(ss, body));
    }

    if (body.action === 'create' || !body.action) {
      if (body.espacios_a_disenar || body.barrio || body.coordenadas || body.telefono) {
        return createResponse(handleAppCreate(ss, body));
      }
      return createResponse(handleWaCreate(ss, body));
    }

    return createResponse({ status: 'error', message: "Acción desconocida" });
  } catch (error) {
    return createResponse({ status: 'error', message: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

// --- HANDLERS DE CREACIÓN Y ACTUALIZACIÓN ---

function handleAppCreate(doc, data) {
  const SHEET_NAME = "App Leads";
  let sheet = doc.getSheetByName(SHEET_NAME);
  const HEADERS = ["Timestamp", "Nombre", "Apellido", "Teléfono", "Correo", "Ciudad/Municipio", "Barrio", "Localidad", "Dirección", "Coordenadas", "Link Google Maps", "Fecha Visita", "Espacios", "Número de Espacios", "Calidad", "Etapa", "Presupuesto", "Enviado WA", "Source", "Medium", "Campaign", "Content", "Term"];
  if (!sheet) {
    sheet = doc.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight("bold");
  }
  const newRow = [new Date(), data.nombre || '', data.apellido || '', data.telefono || '', data.correo || '', data.ciudad || '', data.barrio || '', data.localidad || '', data.direccion || '', data.coordenadas || '', data.link_maps || '', data.fecha_visita || '', data.espacios_a_disenar || '', data.numero_de_espacios || '', '', data.etapa || '', '', '', data.source || '', data.medium || '', data.campaign || '', data.content || '', data.term || ''];
  sheet.appendRow(newRow);
  return { status: "success", row: sheet.getLastRow() };
}

function handleAppUpdate(doc, data) {
  const sheet = doc.getSheetByName("App Leads");
  if (!sheet) return { status: 'error', message: 'Sheet not found' };
  const rowIndex = parseInt(data.row);
  const colMap = { 'nombre': 2, 'apellido': 3, 'telefono': 4, 'correo': 5, 'ciudad': 6, 'barrio': 7, 'localidad': 8, 'direccion': 9, 'coordenadas': 10, 'link_maps': 11, 'fecha_visita': 12, 'espacios_a_disenar': 13, 'numero_de_espacios': 14 };
  Object.keys(colMap).forEach(key => {
    if (data[key] !== undefined) sheet.getRange(rowIndex, colMap[key]).setValue(data[key]);
  });
  return { status: "success" };
}

/**
 * LÓGICA CRM UPDATE (ORIGINAL REINTEGRADA)
 */
function handleCrmUpdate(ss, payload) {
  const sheetName = payload.sheetName;
  const searchMode = payload.searchMode || "ID"; 
  const searchValue = String(payload.searchValue).trim().toLowerCase(); 
  const leadData = payload.lead;
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { status: 'error', message: 'Hoja no encontrada: ' + sheetName };
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => h ? h.toString().trim() : "");
  let targetColIndex = -1;
  const config = SHEETS_CONFIG[sheetName];
  
  if (config) {
     for (const possibleHeader of config.searchCols) {
        const idx = headers.findIndex(h => h.toLowerCase() === possibleHeader.toLowerCase());
        if (idx !== -1) { targetColIndex = idx; break; }
     }
  }
  
  if (targetColIndex === -1 && searchMode === 'EMAIL') {
     const emailCols = ['email', 'correo', 'correo electrónico'];
     targetColIndex = headers.findIndex(h => emailCols.includes(h.toLowerCase()));
  }
  
  if (targetColIndex === -1) return { status: 'error', message: `No columna búsqueda en ${sheetName}` };
  
  let rowFound = -1;
  for (let i = 1; i < data.length; i++) {
    let cellValue = String(data[i][targetColIndex]).trim().toLowerCase();
    if (searchMode === 'PHONE') cellValue = cellValue.replace(/\\D/g, '');
    if (cellValue === searchValue) { rowFound = i + 1; break; }
  }
  
  if (rowFound === -1) return { status: 'error', message: `Lead no encontrado: ${searchValue}` };
  
  const headerMap = {};
  headers.forEach((h, idx) => { if(h) headerMap[h.toLowerCase()] = idx; });
  
  const write = (colName, val) => {
      const key = colName.toLowerCase();
      const keyMap = {
        'etapa': ['etapa', 'estado', 'status'],
        'calidad': ['calidad', 'rating', 'clasificación'],
        'favorito': ['favorito', 'is_favorite'],
        'valor': ['valor', 'presupuesto', 'costo', 'venta'],
        'producto': ['producto', 'espacios', 'espacio', 'interés', 'aeronave'],
        'dirección': ['dirección', 'direccion', 'address', 'ubicación'],
        'estado': ['estado', 'etapa', 'status']
      };
      let targetIdx = -1;
      if (headerMap.hasOwnProperty(key)) targetIdx = headerMap[key];
      else {
          for (const mainKey in keyMap) {
              if (keyMap[mainKey].includes(key)) {
                  for (const synonym of keyMap[mainKey]) {
                      if (headerMap.hasOwnProperty(synonym)) { targetIdx = headerMap[synonym]; break; }
                  }
              }
              if (targetIdx !== -1) break;
          }
      }
      if (targetIdx !== -1) sheet.getRange(rowFound, targetIdx + 1).setValue(val);
  };
  
  Object.keys(leadData).forEach(key => write(key, leadData[key]));
  return { status: 'success', result: 'success', sheet: sheetName, row: rowFound };
}

function handleWaCreate(ss, data) {
  let sheet = ss.getSheetByName("WA Leads");
  const code = (data.countryCode || '').toString().replace('+', '');
  const fullPhone = code + (data.whatsapp || '').toString();
  sheet.appendRow([new Date(), data.firstName || '', data.lastName || '', '', "'" + fullPhone, data.email || '', data.source || '', data.medium || '', data.campaign || '', data.term || '', data.content || '']);
  return { status: 'success' };
}

function handleLogVisit(ss, data) {
  const targetSheet = "Trafico"; 
  let sheet = ss.getSheetByName(targetSheet);
  if (!sheet) {
    sheet = ss.insertSheet(targetSheet);
    sheet.appendRow(["Fecha", "IP", "Info"]);
  }
  sheet.appendRow([new Date(), data.ip || 'No IP', data.utms || data.utmString || ""]);
  return { status: "success" };
}

function createResponse(data) {
  const payload = { backendVersion: BACKEND_VERSION, timestamp: new Date().toISOString(), ...data };
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function getDataFromSheet(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  const data = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      if (headers[j]) obj[headers[j].toString().trim()] = row[j];
    }
    data.push(obj);
  }
  return data;
}
