# Changelog - Backend (Google Apps Script)

## [v3.3.0_PIPELINE_CONFIG] - 2026-03-02

### ✅ Agregado
- Nuevo endpoint GET `?action=get_config`: lee hoja "Config" y devuelve metas mensuales + multiplicadores del pipeline
- Nuevo action POST `save_config`: guarda/actualiza fila de configuración por año fiscal en hoja "Config"
- La hoja "Config" se crea automáticamente si no existe (headers + fila de defaults)
- Nuevas funciones: `handleGetConfig`, `handleSaveConfig`, `parseConfigRow`, `defaultPipelineConfig`

### 📊 Estructura hoja "Config"
Columnas: `YEAR | ENE | FEB | MAR | ABR | MAY | JUN | JUL | AGO | SEP | OCT | NOV | DIC | NEG_MULT | QUO_MULT`
- Una fila por año fiscal
- `NEG_MULT`: cuánta pipeline en Cotizado se necesita vs meta Ventas
- `QUO_MULT`: cuánta pipeline en Agendado se necesita vs meta Cotizado

---

## [v3.2.2_GEO_WA_LEADS] - 2026-02-28

### ✅ Agregado
- `handleWaCreate()` ahora escribe por nombre de columna (no por posición fija)
- `handleWaCreate()` incluye campos `Pais`, `Ciudad`, `Zona` desde datos geo del frontend
- Mayor flexibilidad: reordenar columnas en la hoja "WA Leads" no rompe el registro

### 🔧 Mejorado
- `handleLogVisit()` ahora escribe en columnas desglosadas: `PAIS`, `CIUDAD`, `ZONA`, `CTA`, `Source`, `Medium`, `Campaign`, `Term`, `Content`
- Datos geográficos desglosados recibidos desde el frontend (ipapi.co)
- UTMs se registran por columna individual, no como string unificado

---

## [v3.0.0_FULL_INTEGRATION] - 2026-02-25

### ✅ Agregado
- Nuevo endpoint GET con parámetro `url` para registrar visitas desde WordPress
- Soporte para la hoja "Visitas" con captura de UTM parameters
- Búsqueda dinámica de columnas con sinónimos (etapa=estado=status)
- Lock mechanism para evitar race conditions en updates simultáneos
- Validación de estructura de payload antes de procesarla

### 🔧 Mejorado
- Refactorización de `handleCrmUpdate()` con mapeo flexible de headers
- Mejor manejo de errores con mensajes descriptivos
- Soporte para múltiples alias de columna (Teléfono/Celular/WhatsApp/Movil)
- Headers dinámicos en `SHEETS_CONFIG` para cada hoja

### 🐛 Corregido
- Apps Script lanzaba error si la hoja no existía — ahora la crea automáticamente
- Teléfonos se truncaban como números — ahora se almacenan como texto
- Búsqueda telefónica ignoraba caracteres especiales — ahora normaliza

### ⚠️ Cambios de Breaking
- `backendVersion` ahora es `v3.0.0_FULL_INTEGRATION` (antes `v3.0.0`)
- Requiere que el frontend implemente health check con `action: "ping"`

---

## [v2.5.0] - 2026-02-20

### ✅ Agregado
- Soporte para "WA Leads" sheet
- Soporte para "App Leads" sheet con estructura de landing page
- Función `handleAppCreate()` para crear leads desde formularios

### 🔧 Mejorado
- Mejor documentación de payloads en comentarios
- Estructura modular de handlers por tipo de hoja

---

## [v2.0.0] - 2026-02-01

### ✅ Agregado
- Endpoint GET para exportar todos los leads
- Endpoint POST para actualizar leads en CRM
- Soporte para múltiples hojas simultáneamente
- Campo `_sheetName` agregado a cada lead para tracking

### 🔧 Mejorado
- Migración de versión 1.x a 2.x con arquitectura nueva
- Búsqueda flexible por teléfono o email según `searchMode`

---

## Historial Anterior

Versiones 1.x utilizaban endpoints específicos sin ruteador centralizado.

---

## 📋 Próximas Mejoras Planeadas

- [ ] Agregar OAuth2 para mayor seguridad
- [ ] Implementar rate limiting
- [ ] Soporte para batch updates (múltiples leads en un POST)
- [ ] Historial de cambios (audit log)
- [ ] Caché de headers para mejorar performance
- [ ] Validación de datos (email format, teléfono length, etc.)

---

## 🚀 Instrucciones para Actualizar

1. Reemplaza el contenido de tu Apps Script con la nueva versión
2. Verifica que `BACKEND_VERSION` coincida
3. Prueba con un POST a `/action=ping`
4. El frontend automáticamente registrará la versión compatible

---

## 🔗 Compatibilidad Frontend

| Backend | Frontend | Estado |
|---------|----------|--------|
| v3.2.2_GEO_WA_LEADS | >= v1.7_UNIFIED_CLIENT | ✅ Compatible |
| v3.0.0_FULL_INTEGRATION | >= v1.7_UNIFIED_CLIENT | ✅ Compatible |
| v2.5.0 | >= v1.5 | ✅ Compatible |
| v2.0.0 | >= v1.0 | ✅ Compatible |
