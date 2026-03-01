
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Lead, QualityIndicator, CrmStatus } from '../types';
import { useLeads } from '../context/LeadsContext';
import { X, Calendar, DollarSign, Plane, Save, MessageCircle, Phone, ChevronDown, Mail, ArrowRightLeft, ArrowRight, Tag, MapPin, PenTool, Megaphone, Briefcase, Building2 } from 'lucide-react';
import WhatsAppSelectionModal from './WhatsAppSelectionModal';
import EmailSelectionModal from './EmailSelectionModal';

interface LeadDetailModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
}

// Categorized Aircraft List
const AIRCRAFT_GROUPS: Record<string, string[]> = {
  "Heavy Jets": [
    "Challenger 300",
    "Falcon 2000S"
  ],
  "Midsize Jets": [
    "Hawker 900XP",
    "Gulfstream G150"
  ],
  "Light Jets": [
    "Phenom 300E",
    "Hawker 400"
  ],
  "Turboprops": [
    "Grand Caravan",
    "King Air 200",
    "Beechcraft 1900D"
  ],
  "Short Haul": [
    "Piper Navajo",
    "Cessna 402",
    "Piper Seneca"
  ],
  "Helicópteros": [
    "Bell 206",
    "AS350-B2",
    "Bell 412"
  ]
};

// Flattened list for validation
const PREDEFINED_AIRCRAFTS = new Set([
  ...Object.values(AIRCRAFT_GROUPS).flat(),
  "Por definir",
  "" // Handle empty initial state as standard
]);

// Helper to format numbers with thousands separator (e.g., 25.000.000)
const formatCurrency = (value: string) => {
  // Remove existing non-numeric characters
  const rawValue = value.replace(/\D/g, '');
  if (!rawValue) return '';
  return new Intl.NumberFormat('es-CO').format(parseInt(rawValue));
};

const LeadDetailModal: React.FC<LeadDetailModalProps> = ({ lead, isOpen, onClose }) => {
  const { updateLead } = useLeads();
  const [formData, setFormData] = useState<Lead | null>(null);
  const [tripType, setTripType] = useState<'oneWay' | 'roundTrip'>('oneWay');
  const [isCustomAircraft, setIsCustomAircraft] = useState(false);

  // WhatsApp Modal State
  const [isWAModalOpen, setIsWAModalOpen] = useState(false);
  const [selectedWATemplateId, setSelectedWATemplateId] = useState<string | null>(null);

  // Email Modal State
  const [isEmailModalOpen, setIsEmailOpen] = useState(false);

  // State to store the last known return date so it can be restored
  const [lastReturnDate, setLastReturnDate] = useState<string>('');

  // Refs for Date Pickers
  const fechaIdaRef = useRef<HTMLInputElement>(null);
  const fechaRegresoRef = useRef<HTMLInputElement>(null);
  const fechaVentaRef = useRef<HTMLInputElement>(null);
  const customAircraftInputRef = useRef<HTMLInputElement>(null);

  // Refs for Currency Cursor Management
  const valorInputRef = useRef<HTMLInputElement>(null);
  const cursorRef = useRef<number | null>(null);

  useEffect(() => {
    if (lead) {
      // 1. Clean up the value (remove USD) and format it initially
      const cleanValor = lead.valor ? lead.valor.replace(/USD/gi, '').trim() : '';
      const formattedValor = formatCurrency(cleanValor);

      // 2. Determine trip type based on existence of return date
      const initialTripType = lead.fechaRegreso ? 'roundTrip' : 'oneWay';
      setTripType(initialTripType);

      // 3. Initialize cache for return date
      setLastReturnDate(lead.fechaRegreso || '');

      // 4. Check if aircraft is custom or predefined
      const currentAircraft = lead.aeronave || "";
      const isPredefined = PREDEFINED_AIRCRAFTS.has(currentAircraft);
      setIsCustomAircraft(!isPredefined);

      setFormData({ ...lead, valor: formattedValor });
    } else {
      setFormData(null);
      setIsCustomAircraft(false);
    }
  }, [lead]);

  // Cursor Restoration Effect: Runs synchronously after DOM update to prevent flicker
  useLayoutEffect(() => {
    if (valorInputRef.current && cursorRef.current !== null) {
      valorInputRef.current.setSelectionRange(cursorRef.current, cursorRef.current);
      cursorRef.current = null; // Reset
    }
  }, [formData?.valor]);

  if (!isOpen || !formData) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    // If the user manually changes the return date, update our "cache"
    if (name === 'fechaRegreso') {
      setLastReturnDate(value);
    }

    setFormData(prev => prev ? { ...prev, [name]: value } : null);
  };

  // --- NEW CURRENCY HANDLER (With Cursor Preservation) ---
  const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const val = input.value;
    const currentCursorPos = input.selectionStart || 0;

    // 1. Calculate how many real digits were before the cursor in the input event
    // We assume the user action (typing/deleting) has already happened in 'val'
    // but we need to track relative position before we re-format.
    const digitsBeforeCursor = val.slice(0, currentCursorPos).replace(/\D/g, '').length;

    // 2. Format the new value
    const formatted = formatCurrency(val);

    // 3. Calculate where the cursor should be in the new formatted string
    // We walk through the new string until we have seen the same number of digits
    let newCursorPos = 0;
    let digitsEncountered = 0;

    for (let i = 0; i < formatted.length; i++) {
      if (digitsEncountered === digitsBeforeCursor) break;
      if (/\d/.test(formatted[i])) {
        digitsEncountered++;
      }
      newCursorPos++;
    }

    // 4. Save position to ref (to apply in useLayoutEffect)
    cursorRef.current = newCursorPos;

    setFormData(prev => prev ? { ...prev, valor: formatted } : null);
  };
  // ---------------------------------------------------

  const handleAircraftSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;

    if (value === "OTHER_CUSTOM") {
      setIsCustomAircraft(true);
      setFormData(prev => prev ? { ...prev, aeronave: '' } : null);
      setTimeout(() => {
        if (customAircraftInputRef.current) {
          customAircraftInputRef.current.focus();
        }
      }, 100);
    } else {
      setIsCustomAircraft(false);
      setFormData(prev => prev ? { ...prev, aeronave: value } : null);
    }
  };

  const handleTripTypeChange = (type: 'oneWay' | 'roundTrip') => {
    setTripType(type);

    if (type === 'oneWay') {
      if (formData?.fechaRegreso) {
        setLastReturnDate(formData.fechaRegreso);
      }
      setFormData(prev => prev ? { ...prev, fechaRegreso: '' } : null);
    } else {
      setFormData(prev => prev ? { ...prev, fechaRegreso: lastReturnDate } : null);
    }
  };

  const handleSave = () => {
    if (formData) {
      // IMPORTANT: Sanitize valor to be pure numeric string before saving
      // We pass empty strings through (avoid replacing '' with default)
      const cleanLead = {
        ...formData,
        valor: formData.valor ? formData.valor.replace(/\D/g, '') : '',
        // Explicitly handle fields that might be cleared
        origen: formData.origen || '',
        destino: formData.destino || '',
        aeronave: formData.aeronave || ''
      };

      updateLead(cleanLead);
      onClose();
    }
  };

  const triggerDatePicker = (ref: React.RefObject<HTMLInputElement>) => {
    const element = ref.current;
    if (element && !element.disabled) {
      try {
        // Modern browsers support showPicker() on input type="date"
        if (typeof (element as any).showPicker === 'function') {
          (element as any).showPicker();
        } else {
          element.focus();
          element.click(); // Some browsers need click
        }
      } catch (error) {
        element.focus();
      }
    }
  };

  // Helper to prevent typing in date inputs
  const handleDateKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow Tab for navigation, but prevent other keys to force picker usage
    if (e.key !== 'Tab') {
      e.preventDefault();
      // If Enter or Space, try to open picker
      if (e.key === 'Enter' || e.key === ' ') {
        try {
          if ('showPicker' in e.currentTarget) (e.currentTarget as any).showPicker();
        } catch (err) { }
      }
    }
  };

  // Open WhatsApp Modal with a specific template pre-selected
  const handleOpenWA = (templateId: string) => {
    setSelectedWATemplateId(templateId);
    setIsWAModalOpen(true);
  };

  const handleOpenEmail = () => {
    setIsEmailOpen(true);
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all scale-100 flex flex-col max-h-[90vh]">
          <div className="bg-slate-900 px-6 py-4 flex justify-between items-center shrink-0">
            <h2 className="text-white text-lg font-semibold">Detalles Lead</h2>
            <button onClick={onClose} className="text-slate-300 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="p-6 space-y-6 overflow-y-auto">
            {/* Header Info */}
            <div className="border-b pb-4">
              <h3 className="text-2xl font-bold text-slate-800">{formData.nombre} {formData.apellido}</h3>

              <div className="flex flex-col gap-2 mt-2">
                {/* Email */}
                <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                  <Mail size={16} className="text-blue-500" />
                  <span>{formData.correo}</span>
                </div>

                {/* Read-only WhatsApp with styled container */}
                <div className="inline-flex items-center gap-2 bg-slate-800 text-slate-200 px-3 py-1.5 rounded-md shadow-sm w-fit mt-1">
                  <Phone size={14} className="text-green-400" />
                  <span className="font-mono text-sm tracking-wide">{formData.whatsapp}</span>
                </div>


              </div>
            </div>

            {/* Trip Type Selector */}
            <div className="bg-slate-100 p-1 rounded-lg flex items-center">
              <button
                onClick={() => handleTripTypeChange('oneWay')}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-medium rounded-md transition-all ${tripType === 'oneWay' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <ArrowRight size={14} /> Solo Ida
              </button>
              <button
                onClick={() => handleTripTypeChange('roundTrip')}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-medium rounded-md transition-all ${tripType === 'roundTrip' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <ArrowRightLeft size={14} /> Ida y Vuelta
              </button>
            </div>

            {/* Editable Fields Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Fecha Ida - Clickable Container with Auto-Trigger */}
              <div
                onClick={() => triggerDatePicker(fechaIdaRef)}
                className="bg-slate-50 p-3 rounded-lg border border-slate-100 group hover:border-blue-300 cursor-pointer transition-all relative"
              >
                <div className="flex items-center text-slate-500 mb-1">
                  <Calendar size={14} className="mr-1 text-blue-500" /> <span className="text-xs font-bold uppercase">Fecha Ida</span>
                </div>
                <input
                  ref={fechaIdaRef}
                  type="date"
                  name="fecha"
                  value={formData.fecha}
                  onChange={handleChange}
                  onKeyDown={handleDateKeyDown}
                  onClick={(e) => {
                    // Ensure picker opens even if clicking text part
                    try {
                      if ('showPicker' in e.target) (e.target as any).showPicker();
                    } catch (err) { }
                  }}
                  className="w-full bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer"
                />
              </div>

              {/* Fecha Regreso - Clickable Container with Auto-Trigger */}
              <div
                onClick={() => tripType === 'roundTrip' && triggerDatePicker(fechaRegresoRef)}
                className={`p-3 rounded-lg border transition-all relative ${tripType === 'roundTrip'
                  ? 'bg-slate-50 border-slate-100 hover:border-blue-300 cursor-pointer'
                  : 'bg-slate-100 border-transparent opacity-50 cursor-not-allowed'}`}
              >
                <div className="flex items-center text-slate-500 mb-1">
                  <Calendar size={14} className={`mr-1 ${tripType === 'roundTrip' ? 'text-blue-500' : 'text-slate-400'}`} />
                  <span className="text-xs font-bold uppercase">Fecha Regreso</span>
                </div>
                <input
                  ref={fechaRegresoRef}
                  type="date"
                  name="fechaRegreso"
                  value={formData.fechaRegreso || ''}
                  onChange={handleChange}
                  disabled={tripType === 'oneWay'}
                  onKeyDown={handleDateKeyDown}
                  onClick={(e) => {
                    if (tripType === 'roundTrip') {
                      try {
                        if ('showPicker' in e.target) (e.target as any).showPicker();
                      } catch (err) { }
                    }
                  }}
                  className={`w-full bg-transparent font-semibold text-slate-800 focus:outline-none ${tripType === 'roundTrip' ? 'cursor-pointer' : 'cursor-not-allowed text-slate-400'}`}
                />
              </div>

              {/* Origen */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 group focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                <div className="flex items-center text-slate-500 mb-1">
                  <MapPin size={14} className="mr-1 text-blue-500" /> <span className="text-xs font-bold uppercase">Origen</span>
                </div>
                <input
                  type="text"
                  name="origen"
                  value={formData.origen}
                  onChange={handleChange}
                  placeholder="Ciudad de origen"
                  className="w-full bg-transparent font-semibold text-slate-800 focus:outline-none"
                />
              </div>

              {/* Destino */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 group focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                <div className="flex items-center text-slate-500 mb-1">
                  <MapPin size={14} className="mr-1 text-green-500" /> <span className="text-xs font-bold uppercase">Destino</span>
                </div>
                <input
                  type="text"
                  name="destino"
                  value={formData.destino}
                  onChange={handleChange}
                  placeholder="Ciudad de destino"
                  className="w-full bg-transparent font-semibold text-slate-800 focus:outline-none"
                />
              </div>

              {/* Cargo */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 group focus-within:ring-1 focus-within:ring-amber-400 transition-all">
                <div className="flex items-center text-slate-500 mb-1">
                  <Briefcase size={14} className="mr-1 text-amber-500" /> <span className="text-xs font-bold uppercase">Cargo</span>
                </div>
                <input
                  type="text"
                  name="cargo"
                  value={formData.cargo || ''}
                  onChange={handleChange}
                  placeholder="Ej: CEO, Director Comercial"
                  className="w-full bg-transparent font-semibold text-slate-800 focus:outline-none"
                />
              </div>

              {/* Empresa */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 group focus-within:ring-1 focus-within:ring-amber-400 transition-all">
                <div className="flex items-center text-slate-500 mb-1">
                  <Building2 size={14} className="mr-1 text-amber-500" /> <span className="text-xs font-bold uppercase">Empresa</span>
                </div>
                <input
                  type="text"
                  name="compania"
                  value={formData.compania || ''}
                  onChange={handleChange}
                  placeholder="Nombre de la empresa"
                  className="w-full bg-transparent font-semibold text-slate-800 focus:outline-none"
                />
              </div>

              {/* Quality Indicator - Dropdown */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 group focus-within:ring-1 focus-within:ring-blue-500 transition-all relative">
                <div className="flex items-center text-slate-500 mb-1">
                  <Tag size={14} className="mr-1" /> <span className="text-xs font-bold uppercase">Calidad</span>
                </div>
                <div className="relative">
                  <select
                    name="indicadorCalidad"
                    value={formData.indicadorCalidad}
                    onChange={handleChange}
                    className="w-full bg-transparent font-semibold text-slate-800 focus:outline-none appearance-none pr-6 cursor-pointer"
                  >
                    <option value={QualityIndicator.MQL}>MQL - Marketing Qualified</option>
                    <option value={QualityIndicator.SQL}>SQL - Sales Qualified</option>
                    <option value={QualityIndicator.NQL}>NQL - Nurturing Qualified</option>
                    <option value={QualityIndicator.NO}>No</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* 
                REAL-TIME CURRENCY INPUT
                - Formats as you type (e.g., 25.000.000)
                - Standard size styling (matches other inputs)
                - No arrows (type="text")
                - Preserves Cursor Position
            */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 group focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                <div className="flex items-center text-slate-500 mb-1">
                  <DollarSign size={14} className="mr-1" /> <span className="text-xs font-bold uppercase">Valor (COP)</span>
                </div>
                <input
                  ref={valorInputRef}
                  type="text"
                  name="valor"
                  value={formData.valor}
                  onChange={handleCurrencyChange}
                  placeholder="Ej: 25.000.000"
                  autoComplete="off"
                  className="w-full bg-transparent font-semibold text-slate-800 focus:outline-none"
                />
              </div>

              {/* Campaña (Read Only) */}
              <div className="bg-slate-100 p-3 rounded-lg border border-slate-200 transition-all">
                <div className="flex items-center text-slate-400 mb-1">
                  <Megaphone size={14} className="mr-1" /> <span className="text-xs font-bold uppercase">Campaña</span>
                </div>
                <input
                  type="text"
                  name="campana"
                  value={formData.campana || 'Sin campaña'}
                  readOnly
                  disabled
                  className="w-full bg-transparent font-semibold text-slate-600 focus:outline-none cursor-default"
                />
              </div>

              {/* Aeronave - Dropdown with Custom Logic */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 group focus-within:ring-1 focus-within:ring-blue-500 transition-all relative md:col-span-1">
                <div className="flex items-center text-slate-500 mb-1">
                  <Plane size={14} className="mr-1" /> <span className="text-xs font-bold uppercase">Aeronave</span>
                </div>

                <div className="relative">
                  <select
                    name="aeronave"
                    // If custom mode is active, show the "OTHER_CUSTOM" value in dropdown
                    value={isCustomAircraft ? "OTHER_CUSTOM" : formData.aeronave}
                    onChange={handleAircraftSelectChange}
                    className="w-full bg-transparent font-semibold text-slate-800 focus:outline-none appearance-none pr-6 cursor-pointer"
                  >
                    <option value="">Seleccionar...</option>

                    {/* Standard Categories */}
                    {Object.entries(AIRCRAFT_GROUPS).map(([category, models]) => (
                      <optgroup key={category} label={category}>
                        {models.map(model => (
                          <option key={model} value={model}>{model}</option>
                        ))}
                      </optgroup>
                    ))}

                    {/* Fixed "Otros" Category */}
                    <optgroup label="Otros">
                      <option value="Por definir">Por definir</option>
                      <option value="OTHER_CUSTOM">Otra aeronave (Especificar)</option>
                    </optgroup>
                  </select>
                  <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>

                {/* Conditional Custom Input */}
                {isCustomAircraft && (
                  <div className="mt-3 animate-fade-in">
                    <div className="flex items-center gap-2">
                      <div className="h-[1px] flex-1 bg-slate-200"></div>
                      <span className="text-[10px] uppercase text-slate-400 font-bold">Especificar Nombre</span>
                      <div className="h-[1px] flex-1 bg-slate-200"></div>
                    </div>
                    <div className="relative mt-2">
                      <input
                        ref={customAircraftInputRef}
                        type="text"
                        name="aeronave"
                        value={formData.aeronave}
                        onChange={handleChange}
                        placeholder="Escribe el nombre de la aeronave..."
                        className="w-full bg-white border border-blue-300 rounded-md px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200 shadow-sm"
                      />
                      <PenTool size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400" />
                    </div>
                  </div>
                )}
              </div>

              {/* Fecha Venta - Clickable Container with Auto-Trigger - ONLY SHOW IF WON */}
              {formData.crmStatus === CrmStatus.GANADOS && (
                <div
                  onClick={() => triggerDatePicker(fechaVentaRef)}
                  className="bg-green-50 p-3 rounded-lg border border-green-100 group hover:border-green-300 cursor-pointer transition-all relative md:col-span-1"
                >
                  <div className="flex items-center text-green-700 mb-1">
                    <Calendar size={14} className="mr-1" /> <span className="text-xs font-bold uppercase">Fecha Cierre / Venta</span>
                  </div>
                  <input
                    ref={fechaVentaRef}
                    type="date"
                    name="fechaVenta"
                    value={formData.fechaVenta || ''}
                    onChange={handleChange}
                    onKeyDown={handleDateKeyDown}
                    onClick={(e) => {
                      try {
                        if ('showPicker' in e.target) (e.target as any).showPicker();
                      } catch (err) { }
                    }}
                    className="w-full bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer"
                  />
                </div>
              )}

            </div>

            {/* Quick WhatsApp Actions Section */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center">
                <MessageCircle size={12} className="mr-1" /> Plantillas WhatsApp (con Vista Previa)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <button
                  onClick={() => handleOpenWA('interest')}
                  className="flex items-center px-4 py-3 bg-green-50 text-green-700 text-sm font-medium rounded-lg hover:bg-green-100 border border-green-200 transition-colors"
                >
                  <span className="mr-2">👋</span> Saludo Inicial
                </button>
                <button
                  onClick={() => handleOpenWA('quote')}
                  className="flex items-center px-4 py-3 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-100 border border-blue-200 transition-colors"
                >
                  <span className="mr-2">📋</span> Generar Cotización (AI)
                </button>
                <button
                  onClick={() => handleOpenWA('followup_quote')}
                  className="flex items-center px-4 py-3 bg-amber-50 text-amber-700 text-sm font-medium rounded-lg hover:bg-amber-100 border border-amber-200 transition-colors"
                >
                  <span className="mr-2">🛠️</span> Seguimiento Cotización
                </button>
                <button
                  onClick={() => handleOpenWA('closing')}
                  className="flex items-center px-4 py-3 bg-purple-50 text-purple-700 text-sm font-medium rounded-lg hover:bg-purple-100 border border-purple-200 transition-colors"
                >
                  <span className="mr-2">🔄</span> Reactivar Lead
                </button>
              </div>
            </div>

            {/* Email Actions Section */}
            <div className="mt-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center">
                <Mail size={12} className="mr-1" /> Acciones de Email
              </h4>
              <button
                onClick={handleOpenEmail}
                disabled={!formData.correo}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-sm transition-all border
                    ${!formData.correo
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    : 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700 shadow-sm'
                  }
                `}
              >
                <Mail size={18} /> {lead.source === 'APOLLO' && lead.crmStatus === CrmStatus.NUEVO ? "Redactar Email Outbound (AI)" : "Enviar Correo Electrónico"}
              </button>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t bg-slate-50 flex gap-3 shrink-0">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors"
            >
              <Save size={18} /> Guardar Cambios
            </button>
          </div>

        </div>
      </div>

      {/* Integrate the WhatsAppSelectionModal here */}
      {formData && (
        <WhatsAppSelectionModal
          lead={formData}
          isOpen={isWAModalOpen}
          onClose={() => setIsWAModalOpen(false)}
          initialTemplateId={selectedWATemplateId}
        />
      )}

      {formData && (
        <EmailSelectionModal
          lead={formData}
          isOpen={isEmailModalOpen}
          onClose={() => setIsEmailOpen(false)}
        />
      )}
    </>
    ,
    document.body
  );
};

export default LeadDetailModal;
