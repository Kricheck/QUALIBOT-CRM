/**
 * AMADERARTE CRM - Google Apps Script Backend
 * Version: v3.3.0_PIPELINE_CONFIG
 *
 * Frontend coordina con este script para:
 * - GET: Exportar todos los leads + hojas Trafico y Visitas (lectura para dashboard CTR)
 * - GET ?action=get_config: Leer configuración de metas del pipeline (hoja "Config")
 * - POST: Actualizar/crear leads, registrar visitas de WordPress
 * - POST action=save_config: Guardar metas mensuales y multiplicadores del pipeline
 *
 * Desplegado como: Deploy > New deployment > Type: Web app
 * Ejecutar como: El usuario que despliega
 * Quien tiene acceso: Cualquiera
 *
 * v3.3.0 Changes:
 * - Nuevo GET ?action=get_config: lee hoja "Config" y devuelve metas mensuales + multiplicadores
 * - Nuevo POST action=save_config: guarda/actualiza fila de configuración por año fiscal
 * - La hoja "Config" se crea automáticamente si no existe
 * - Nuevas funciones: handleGetConfig, handleSaveConfig, parseConfigRow, defaultPipelineConfig
 *
 * v3.2.2 Changes:
 * - handleWaCreate() ahora escribe por nombre de columna (no por posición fija)
 * - handleWaCreate() incluye Pais, Ciudad, Zona desde datos geo del frontend
 * - Mayor flexibilidad: reordenar columnas en la hoja no rompe el registro
 *
 * v3.2.1 Changes:
 * - handleLogVisit() ahora escribe en columnas desglosadas: PAIS, CIUDAD, ZONA, CTA, Source, Medium, Campaign, Term, Content
 * - Recibe datos geográficos desglosados desde el frontend (ipapi.co)
 * - UTMs se registran por columna individual, no como string unificado
 *
 * v3.2.0 Changes:
 * - GET ahora incluye hojas "Trafico" y "Visitas" en la respuesta (antes estaban excluidas)
 * - El CRM solo LEE esas hojas, nunca escribe en ellas
 * - "Trafico" viene de la landing: campo "Info" empieza con "bridge" = Botón WA, resto = Botón Landing
 * - "Visitas" viene de WordPress: campo "IP" = identificador de visita única
 *
 * v3.1.0 Changes:
 * - handleLogVisit() registra explícitamente "BRIDGE" o "CTA" en campo Info
 * - registrarVisitaSimple() retorna JSON response
 */

// --- CONFIGURACIÓN CENTRALIZADA ---
const BACKEND_VERSION = "v3.3.0_PIPELINE_CONFIG";
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
 *
 * Parámetros:
 * - url: Si existe, registra visita de WordPress
 * - ninguno: Exporta todos los leads
 */
function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // A. CONFIGURACIÓN DE PIPELINE (devuelve metas mensuales de la hoja "Config")
  if (e.parameter.action === 'get_config') {
    return createResponse(handleGetConfig(ss));
  }

  // B. REGISTRO DE VISITA (WordPress envía parámetro 'url')
  if (e.parameter.url) {
    return registrarVisitaSimple(ss, e.parameter);
  }

  // C. EXPORTACIÓN COMPLETA: Leads CRM + Trafico + Visitas (para dashboard CTR)
  let allLeads = [];
  try {
    Object.keys(SHEETS_CONFIG).forEach(sheetName => {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) return;

      const data = getDataFromSheet(sheet);
      data.forEach(row => {
        row['_sheetName'] = sheetName;
        // Convertir a string campos que pueden ser numéricos
        ['Telefono', 'Celular', 'WhatsApp', 'Correo', 'Email', 'IP', 'Info'].forEach(col => {
          if (row[col] !== undefined && row[col] !== null) row[col] = String(row[col]);
        });
      });
      allLeads = allLeads.concat(data);
    });
    return createResponse({ status: 'success', data: allLeads });
  } catch (err) {
    return createResponse({ status: 'error', message: err.toString() });
  }
}

/**
 * LÓGICA PARA LA HOJA "VISITAS"
 * Registra visitantes desde WordPress o landing page con IP única (para CTR)
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

  return createResponse({ status: 'success', message: 'Visita registrada' });
}

/**
 * FUNCIÓN POST MAESTRA
 * Ruteador para: update, create, log_visit, ping
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

    // Health check
    if (body.action === 'ping') {
      return createResponse({ status: 'success', message: 'pong' });
    }

    // Guardar configuración de metas del pipeline
    if (body.action === 'save_config') {
      return createResponse(handleSaveConfig(ss, body));
    }

    // Log visita de tráfico
    if (body.action === 'log_visit') {
      return createResponse(handleLogVisit(ss, body));
    }

    // Actualizar lead existente
    if (body.action === 'update') {
      if (body.sheetName && body.lead) {
        return createResponse(handleCrmUpdate(ss, body));
      }
      if (body.row) {
        return createResponse(handleAppUpdate(ss, body));
      }
    }

    // Crear nuevo lead
    if (body.action === 'create' || !body.action) {
      // App Leads tiene estructura especial
      if (body.espacios_a_disenar || body.barrio || body.coordenadas || body.telefono) {
        return createResponse(handleAppCreate(ss, body));
      }
      // WA Leads estructura
      return createResponse(handleWaCreate(ss, body));
    }

    return createResponse({ status: 'error', message: "Acción desconocida: " + body.action });
  } catch (error) {
    return createResponse({ status: 'error', message: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

// --- HANDLERS DE CREACIÓN ---

/**
 * Crea un nuevo lead en "App Leads"
 * Estructura: Viene de formulario de landing/app
 */
function handleAppCreate(doc, data) {
  const SHEET_NAME = "App Leads";
  let sheet = doc.getSheetByName(SHEET_NAME);
  const HEADERS = [
    "Timestamp", "Nombre", "Apellido", "Teléfono", "Correo",
    "Ciudad/Municipio", "Barrio", "Localidad", "Dirección", "Coordenadas",
    "Link Google Maps", "Fecha Visita", "Espacios", "Número de Espacios",
    "Calidad", "Etapa", "Presupuesto", "Enviado WA", "Source", "Medium",
    "Campaign", "Content", "Term"
  ];

  if (!sheet) {
    sheet = doc.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight("bold");
  }

  const newRow = [
    new Date(),
    data.nombre || '',
    data.apellido || '',
    data.telefono || '',
    data.correo || '',
    data.ciudad || '',
    data.barrio || '',
    data.localidad || '',
    data.direccion || '',
    data.coordenadas || '',
    data.link_maps || '',
    data.fecha_visita || '',
    data.espacios_a_disenar || '',
    data.numero_de_espacios || '',
    '',
    data.etapa || '',
    '',
    '',
    data.source || '',
    data.medium || '',
    data.campaign || '',
    data.content || '',
    data.term || ''
  ];

  sheet.appendRow(newRow);
  return { status: "success", row: sheet.getLastRow() };
}

/**
 * Actualiza un lead en "App Leads"
 */
function handleAppUpdate(doc, data) {
  const sheet = doc.getSheetByName("App Leads");
  if (!sheet) return { status: 'error', message: 'Sheet not found' };

  const rowIndex = parseInt(data.row);
  const colMap = {
    'nombre': 2,
    'apellido': 3,
    'telefono': 4,
    'correo': 5,
    'ciudad': 6,
    'barrio': 7,
    'localidad': 8,
    'direccion': 9,
    'coordenadas': 10,
    'link_maps': 11,
    'fecha_visita': 12,
    'espacios_a_disenar': 13,
    'numero_de_espacios': 14
  };

  Object.keys(colMap).forEach(key => {
    if (data[key] !== undefined) {
      sheet.getRange(rowIndex, colMap[key]).setValue(data[key]);
    }
  });

  return { status: "success" };
}

/**
 * Crea un nuevo lead en "WA Leads"
 * Escribe por nombre de columna (no por posición fija) para mayor flexibilidad.
 *
 * Columnas reconocidas: Fecha Registro, Nombre, Apellido, Pais, Ciudad, Zona,
 * WhatsApp, Email, Source, Medium, Campaign, Term, Content
 *
 * Expected payload:
 * {
 *   firstName, lastName, countryCode, whatsapp, email,
 *   pais, ciudad, zona,
 *   source, medium, campaign, term, content
 * }
 */
function handleWaCreate(ss, data) {
  const sheet = ss.getSheetByName("WA Leads");
  if (!sheet) return { status: 'error', message: 'Hoja WA Leads no encontrada' };

  const code = (data.countryCode || '').toString().replace('+', '');
  const number = (data.whatsapp || '').toString();
  const fullPhone = "'" + code + number; // Prefijo ' para evitar que Sheets interprete como número

  // Mapa de datos: clave = título exacto de la columna en Sheets
  const fieldMap = {
    'Fecha Registro': new Date(),
    'Nombre':         data.firstName || '',
    'Apellido':       data.lastName  || '',
    'Pais':           data.pais      || '',
    'Ciudad':         data.ciudad    || '',
    'Zona':           data.zona      || '',
    'WhatsApp':       fullPhone,
    'Email':          data.email     || '',
    'Source':         data.source    || '',
    'Medium':         data.medium    || '',
    'Campaign':       data.campaign  || '',
    'Term':           data.term      || '',
    'Content':        data.content   || ''
  };

  // Leer headers de la fila 1 y construir la fila en el orden actual de la hoja
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const newRow = headers.map(h => {
    const key = h ? h.toString().trim() : '';
    return fieldMap.hasOwnProperty(key) ? fieldMap[key] : '';
  });

  sheet.appendRow(newRow);
  return { status: 'success' };
}

// --- HANDLERS DE ACTUALIZACIÓN CRM ---

/**
 * Actualiza un lead existente en cualquier hoja CRM
 * Usado por el frontend cuando se cambia estado, presupuesto, etc.
 */
function handleCrmUpdate(ss, payload) {
  const sheetName = payload.sheetName;
  const searchMode = payload.searchMode || "ID";
  const searchValue = String(payload.searchValue).trim().toLowerCase();
  const leadData = payload.lead;

  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return { status: 'error', message: 'Hoja no encontrada: ' + sheetName };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => h ? h.toString().trim() : "");

  // 1. Encontrar columna de búsqueda según searchMode
  let targetColIndex = -1;
  const config = SHEETS_CONFIG[sheetName];

  if (config) {
    for (const possibleHeader of config.searchCols) {
      const idx = headers.findIndex(h => h.toLowerCase() === possibleHeader.toLowerCase());
      if (idx !== -1) {
        targetColIndex = idx;
        break;
      }
    }
  }

  if (targetColIndex === -1 && searchMode === 'EMAIL') {
    const emailCols = ['email', 'correo', 'correo electrónico'];
    targetColIndex = headers.findIndex(h => emailCols.includes(h.toLowerCase()));
  }

  if (targetColIndex === -1) {
    return { status: 'error', message: `No se encontró columna de búsqueda en ${sheetName}` };
  }

  // 2. Buscar fila que coincida
  let rowFound = -1;
  for (let i = 1; i < data.length; i++) {
    let cellValue = String(data[i][targetColIndex]).trim().toLowerCase();
    if (searchMode === 'PHONE') {
      cellValue = cellValue.replace(/\D/g, '');
    }
    if (cellValue === searchValue) {
      rowFound = i + 1;
      break;
    }
  }

  if (rowFound === -1) {
    return { status: 'error', message: `Lead no encontrado: ${searchValue}` };
  }

  // 3. Mapear headers a columnas
  const headerMap = {};
  headers.forEach((h, idx) => {
    if (h) headerMap[h.toLowerCase()] = idx;
  });

  // 4. Función para escribir valores (con sinónimos)
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

    // Búsqueda directa
    if (headerMap.hasOwnProperty(key)) {
      targetIdx = headerMap[key];
    } else {
      // Búsqueda por sinónimos
      for (const mainKey in keyMap) {
        if (keyMap[mainKey].includes(key)) {
          for (const synonym of keyMap[mainKey]) {
            if (headerMap.hasOwnProperty(synonym)) {
              targetIdx = headerMap[synonym];
              break;
            }
          }
        }
        if (targetIdx !== -1) break;
      }
    }

    if (targetIdx !== -1) {
      sheet.getRange(rowFound, targetIdx + 1).setValue(val);
    }
  };

  // 5. Escribir todos los campos del lead
  Object.keys(leadData).forEach(key => write(key, leadData[key]));

  return {
    status: 'success',
    result: 'success',
    sheet: sheetName,
    row: rowFound
  };
}

// --- HANDLERS DE LOGGING ---

/**
 * Registra evento de tráfico/botones (BRIDGE = WhatsApp, CTA = Landing)
 *
 * Expected payload:
 * {
 *   action: "log_visit",
 *   ip: "1.2.3.4",
 *   pais: "Colombia",
 *   ciudad: "Bogotá",
 *   zona: "Bogota D.C.",
 *   interactionType: "BRIDGE" | "CTA",
 *   source: "google",
 *   medium: "organic",
 *   campaign: "SEO",
 *   content: "[optional]",
 *   term: "[optional]"
 * }
 */
function handleLogVisit(ss, data) {
  const targetSheet = "Trafico";
  let sheet = ss.getSheetByName(targetSheet);

  if (!sheet) {
    sheet = ss.insertSheet(targetSheet);
    const headers = ["Fecha", "IP", "PAIS", "CIUDAD", "ZONA", "CTA", "Source", "Medium", "Campaign", "Term", "Content"];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }

  // Validar y normalizar interaction type
  let interactionType = (data.interactionType || "CTA").toUpperCase();
  if (interactionType !== "BRIDGE" && interactionType !== "CTA") {
    interactionType = "CTA"; // Default
  }

  sheet.appendRow([
    new Date(),
    data.ip || 'No IP',
    data.pais || '-',
    data.ciudad || '-',
    data.zona || '-',
    interactionType,       // "BRIDGE" o "CTA"
    data.source || '-',
    data.medium || '-',
    data.campaign || '-',
    data.term || '-',
    data.content || '-'
  ]);

  return { status: "success", type: interactionType };
}

// --- HANDLERS DE CONFIGURACIÓN PIPELINE ---

/**
 * Devuelve la configuración de metas del pipeline para el año en curso.
 * Lee la hoja "Config" (la crea si no existe).
 * Estructura esperada en Sheets: YEAR | ENE | FEB | ... | DIC | NEG_MULT | QUO_MULT
 */
function handleGetConfig(ss) {
  var sheet = ss.getSheetByName('Config');
  if (!sheet) {
    sheet = ss.insertSheet('Config');
    var initHeaders = ['YEAR','ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC','NEG_MULT','QUO_MULT'];
    sheet.getRange(1, 1, 1, initHeaders.length).setValues([initHeaders]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  var year = new Date().getFullYear();
  var data = getDataFromSheet(sheet);
  var row = null;
  for (var i = 0; i < data.length; i++) {
    if (Number(data[i]['YEAR']) === year) { row = data[i]; break; }
  }

  if (row) {
    return { status: 'success', config: parseConfigRow(row) };
  }
  return { status: 'success', config: defaultPipelineConfig(year) };
}

/**
 * Guarda o actualiza la configuración de metas en la hoja "Config".
 * Si ya existe una fila para el año, la actualiza; si no, agrega una nueva.
 */
function handleSaveConfig(ss, body) {
  var config = body.config;
  if (!config || !config.YEAR) {
    return { status: 'error', message: 'Config inválida: falta YEAR' };
  }

  var sheet = ss.getSheetByName('Config');
  if (!sheet) {
    sheet = ss.insertSheet('Config');
  }

  var HEADERS = ['YEAR','ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC','NEG_MULT','QUO_MULT'];

  // Inicializar headers si la hoja está vacía
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var newRow = HEADERS.map(function(h) { return config[h] !== undefined ? config[h] : 0; });

  // Buscar fila existente con el mismo año
  var yearCol = headers.indexOf('YEAR');
  for (var i = 1; i < values.length; i++) {
    if (Number(values[i][yearCol]) === Number(config.YEAR)) {
      sheet.getRange(i + 1, 1, 1, HEADERS.length).setValues([newRow]);
      return { status: 'success', message: 'Config actualizada para ' + config.YEAR };
    }
  }

  // No existe fila para ese año, agregar nueva
  sheet.appendRow(newRow);
  return { status: 'success', message: 'Config creada para ' + config.YEAR };
}

/**
 * Convierte una fila de la hoja Config (object con keys = headers) a PipelineConfig tipado
 */
function parseConfigRow(row) {
  return {
    YEAR:     Number(row['YEAR']     || 0),
    ENE:      Number(row['ENE']      || 0),
    FEB:      Number(row['FEB']      || 0),
    MAR:      Number(row['MAR']      || 0),
    ABR:      Number(row['ABR']      || 0),
    MAY:      Number(row['MAY']      || 0),
    JUN:      Number(row['JUN']      || 0),
    JUL:      Number(row['JUL']      || 0),
    AGO:      Number(row['AGO']      || 0),
    SEP:      Number(row['SEP']      || 0),
    OCT:      Number(row['OCT']      || 0),
    NOV:      Number(row['NOV']      || 0),
    DIC:      Number(row['DIC']      || 0),
    NEG_MULT: Number(row['NEG_MULT'] || 3),
    QUO_MULT: Number(row['QUO_MULT'] || 3)
  };
}

/**
 * Retorna una configuración por defecto con metas en cero para el año dado
 */
function defaultPipelineConfig(year) {
  return {
    YEAR: year,
    ENE: 0, FEB: 0, MAR: 0, ABR: 0, MAY: 0, JUN: 0,
    JUL: 0, AGO: 0, SEP: 0, OCT: 0, NOV: 0, DIC: 0,
    NEG_MULT: 3.0,
    QUO_MULT: 3.0
  };
}

// --- UTILIDADES ---

/**
 * Crea respuesta JSON estándar con versión del backend
 */
function createResponse(data) {
  const payload = {
    backendVersion: BACKEND_VERSION,
    timestamp: new Date().toISOString(),
    ...data
  };
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Lee datos de una hoja y retorna array de objetos
 * Primera fila = headers, resto = data
 */
function getDataFromSheet(sheet) {
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) return [];

  const headers = values[0];
  const data = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const obj = {};

    for (let j = 0; j < headers.length; j++) {
      if (headers[j]) {
        obj[headers[j].toString().trim()] = row[j];
      }
    }

    data.push(obj);
  }

  return data;
}
