
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Lead, QualityIndicator } from '../types';
import { useLeads } from '../context/LeadsContext';
import { X, Calendar, DollarSign, Package, Save, MessageCircle, Phone, ChevronDown, Mail, ArrowRightLeft, ArrowRight, Tag, MapPin, PenTool, Megaphone, Sofa, Terminal, Star, CheckSquare, Square } from 'lucide-react';
import WhatsAppSelectionModal from './WhatsAppSelectionModal';

interface LeadDetailModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
}

// LISTADO DE ESPACIOS (AMADERARTE)
const PRODUCT_GROUPS: Record<string, string[]> = {
  "Espacios Principales": [
    "Cocina Integral",
    "Closet / Vestier",
    "Mueble de Baño",
    "Centro de Entretenimiento",
    "Estudio",
    "Recibidor",
    "Biblioteca"
  ],
  "Carpintería Arquitectónica": [
    "Puertas de Paso",
    "Puerta Principal",
    "Revestimiento Pared",
    "Cielo Raso Madera"
  ],
  "Mobiliario Suelto": [
    "Escritorio / Home Office",
    "Mesa de Comedor",
    "Bifé / Credenza",
    "Mesas de Noche"
  ],
  "Proyectos Completos": [
    "Apartamento Completo (Obra Blanca)",
    "Remodelación Total",
    "Carpintería General"
  ]
};

// Flatten list for easier checking
const ALL_PRODUCTS = Object.values(PRODUCT_GROUPS).flat();

const formatCurrency = (value: string) => {
  if (!value) return '';
  if (value.toLowerCase().includes('espacio') || value.toLowerCase().includes('pago')) return value;
  
  const rawValue = value.replace(/\D/g, '');
  if (!rawValue) return value;
  return new Intl.NumberFormat('es-CO').format(parseInt(rawValue));
};

const LeadDetailModal: React.FC<LeadDetailModalProps> = ({ lead, isOpen, onClose }) => {
  const { updateLead } = useLeads();
  
  // Inicialización directa si el lead existe
  const [formData, setFormData] = useState<Lead | null>(lead);
  
  // State for multi-select product logic
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [customProductText, setCustomProductText] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const [isWAModalOpen, setIsWAModalOpen] = useState(false);
  const [selectedWATemplateId, setSelectedWATemplateId] = useState<string | null>(null);

  const fechaIdaRef = useRef<HTMLInputElement>(null);
  const valorInputRef = useRef<HTMLInputElement>(null);
  const cursorRef = useRef<number | null>(null);

  useEffect(() => {
    if (lead) {
      const cleanValor = lead.valor ? lead.valor.trim() : '';
      const formattedValor = formatCurrency(cleanValor);
      
      setFormData({ ...lead, valor: formattedValor });

      // Parse existing aeronave (producto) string into array
      const currentProductsStr = lead.aeronave || "";
      // Split by common delimiters
      const parts = currentProductsStr.split(/[,|]/).map(s => s.trim()).filter(Boolean);
      
      // Separate known products from custom text
      const known: string[] = [];
      const custom: string[] = [];

      parts.forEach(p => {
          // Normalize for comparison
          const normalizedP = p.toLowerCase().trim();
          const match = ALL_PRODUCTS.find(ap => ap.toLowerCase() === normalizedP);
          
          if (match) {
              known.push(match);
          } else {
              custom.push(p);
          }
      });
      
      setSelectedProducts(known);
      setCustomProductText(custom.join(", "));
    }
  }, [lead]);

  // Handle clicking outside product dropdown
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
              setIsProductDropdownOpen(false);
          }
      };
      if (isProductDropdownOpen) {
          document.addEventListener('mousedown', handleClickOutside);
      }
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProductDropdownOpen]);

  useLayoutEffect(() => {
    if (valorInputRef.current && cursorRef.current !== null) {
        valorInputRef.current.setSelectionRange(cursorRef.current, cursorRef.current);
        cursorRef.current = null;
    }
  }, [formData?.valor]);

  if (!isOpen || !formData) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => prev ? { ...prev, [name]: value } : null);
  };

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const val = input.value;
    
    if (/[a-zA-Z]/.test(val)) {
        setFormData(prev => prev ? { ...prev, valor: val } : null);
        return;
    }

    const currentCursorPos = input.selectionStart || 0;
    const digitsBeforeCursor = val.slice(0, currentCursorPos).replace(/\D/g, '').length;
    const formatted = formatCurrency(val);
    
    let newCursorPos = 0;
    let digitsEncountered = 0;
    for (let i = 0; i < formatted.length; i++) {
        if (digitsEncountered === digitsBeforeCursor) break;
        if (/\d/.test(formatted[i])) digitsEncountered++;
        newCursorPos++;
    }
    cursorRef.current = newCursorPos;
    setFormData(prev => prev ? { ...prev, valor: formatted } : null);
  };

  const toggleProduct = (product: string) => {
      setSelectedProducts(prev => {
          if (prev.includes(product)) {
              return prev.filter(p => p !== product);
          } else {
              return [...prev, product];
          }
      });
  };

  const handleClearCustom = (e: React.MouseEvent) => {
      e.stopPropagation();
      setCustomProductText("");
  };

  const handleSave = () => {
    if (formData) {
      // Reconstruct single string for aeronave from selected products + custom text
      let finalProductStr = selectedProducts.join(", ");
      const cleanedCustom = customProductText.trim();
      
      if (cleanedCustom) {
          if (finalProductStr) finalProductStr += ", ";
          finalProductStr += cleanedCustom;
      }
      
      // LOG MANUAL PARA VERIFICACIÓN EN CONSOLA CRM
      const debugEvent = new CustomEvent('crm-debug-log', {
          detail: { 
            id: 'save_' + Math.random().toString(36).substr(2, 5),
            timestamp: new Date().toLocaleTimeString(),
            title: 'Preparando Guardado', 
            data: {
                seleccionados: selectedProducts,
                otros: cleanedCustom,
                stringFinal: finalProductStr || "Por definir"
            }, 
            type: 'info' 
          }
      });
      window.dispatchEvent(debugEvent);

      const leadToSave = {
          ...formData,
          aeronave: finalProductStr || "Por definir"
      };

      updateLead(leadToSave);
      onClose();
    }
  };

  const triggerDatePicker = (ref: React.RefObject<HTMLInputElement>) => {
    if (ref.current && !ref.current.disabled) {
      try { ref.current.showPicker(); } catch (error) { ref.current.focus(); }
    }
  };

  const handleOpenWA = (templateId: string) => {
      setSelectedWATemplateId(templateId);
      setIsWAModalOpen(true);
  };

  return createPortal(
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all scale-100 flex flex-col max-h-[90vh]">
        <div className="bg-amber-900 px-6 py-4 flex justify-between items-center shrink-0">
          <h2 className="text-white text-lg font-semibold">Detalles de Proyecto</h2>
          <button onClick={onClose} className="text-amber-200 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Header Info */}
          <div className="border-b pb-4">
            <h3 className="text-2xl font-bold text-slate-800">{formData.nombre} {formData.apellido}</h3>
            
            <div className="flex flex-col gap-2 mt-2">
              <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                <Mail size={16} className="text-amber-600" />
                <span>{formData.correo}</span>
              </div>
              <div className="inline-flex items-center gap-2 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-md shadow-sm w-fit mt-1 border border-slate-200">
                  <Phone size={14} className="text-green-600"/>
                  <span className="font-mono text-sm tracking-wide">{formData.whatsapp}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Fecha Inicio */}
            <div 
              onClick={() => triggerDatePicker(fechaIdaRef)}
              className="bg-slate-50 p-3 rounded-lg border border-slate-100 group hover:border-amber-300 cursor-pointer transition-all"
            >
              <div className="flex items-center text-slate-500 mb-1">
                <Calendar size={14} className="mr-1 text-amber-600" /> <span className="text-xs font-bold uppercase">Fecha Registro</span>
              </div>
              <input 
                ref={fechaIdaRef}
                type="text" 
                name="fecha"
                readOnly
                value={formData.createdAt ? new Date(formData.createdAt).toLocaleString() : formData.fecha}
                className="w-full bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer text-xs"
              />
            </div>

            {/* Ubicación (Origen) */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 group focus-within:ring-1 focus-within:ring-amber-500 transition-all">
              <div className="flex items-center text-slate-500 mb-1">
                <MapPin size={14} className="mr-1 text-amber-600" /> <span className="text-xs font-bold uppercase">Ubicación / Barrio</span>
              </div>
              <input 
                type="text" 
                name="origen"
                value={formData.origen}
                onChange={handleChange}
                placeholder="Ej: Cedritos, Bogotá"
                className="w-full bg-transparent font-semibold text-slate-800 focus:outline-none"
              />
            </div>

            {/* Detalle (Destino) */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 group focus-within:ring-1 focus-within:ring-amber-500 transition-all md:col-span-2">
              <div className="flex items-center text-slate-500 mb-1">
                <Package size={14} className="mr-1 text-green-600" /> <span className="text-xs font-bold uppercase">Dirección / Detalle</span>
              </div>
              <input 
                type="text" 
                name="destino"
                value={formData.destino}
                onChange={handleChange}
                placeholder="Dirección exacta o notas..."
                className="w-full bg-transparent font-semibold text-slate-800 focus:outline-none"
              />
            </div>

            {/* Quality Indicator */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 group focus-within:ring-1 focus-within:ring-amber-500 transition-all relative">
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
                  <option value={QualityIndicator.MQL}>MQL - Potencial</option>
                  <option value={QualityIndicator.SQL}>SQL - Ideal (+2 Espacios)</option>
                  <option value={QualityIndicator.NO}>Sin clasificar</option>
                </select>
                <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
            
            {/* Value / Presupuesto */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 group focus-within:ring-1 focus-within:ring-amber-500 transition-all">
              <div className="flex items-center text-slate-500 mb-1">
                <DollarSign size={14} className="mr-1" /> <span className="text-xs font-bold uppercase">Presupuesto / Medio Pago</span>
              </div>
              <input 
                ref={valorInputRef}
                type="text" 
                name="valor"
                value={formData.valor}
                onChange={handleCurrencyChange}
                placeholder="Ej: Contado / $10M"
                autoComplete="off"
                className="w-full bg-transparent font-semibold text-slate-800 focus:outline-none"
              />
            </div>

            {/* Producto (Espacios) MULTI-SELECT */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 group transition-all relative md:col-span-2" ref={dropdownRef}>
              <div className="flex items-center text-slate-500 mb-1">
                <Sofa size={14} className="mr-1" /> <span className="text-xs font-bold uppercase">Espacios / Interés</span>
              </div>
              
              {/* Trigger */}
              <div 
                className="w-full min-h-[30px] flex flex-wrap gap-1.5 cursor-pointer items-center relative pr-6"
                onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}
              >
                  {selectedProducts.length === 0 && !customProductText && (
                      <span className="text-slate-400 text-sm">Seleccionar espacios...</span>
                  )}
                  {selectedProducts.map(p => (
                      <span key={p} className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center">
                          {p}
                          <span className="ml-1 hover:text-amber-900" onClick={(e) => { e.stopPropagation(); toggleProduct(p); }}>×</span>
                      </span>
                  ))}
                  {customProductText && (
                      <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-300 flex items-center gap-1">
                          {customProductText}
                          <span className="hover:text-red-500 cursor-pointer p-0.5" onClick={handleClearCustom}>×</span>
                      </span>
                  )}
                  <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              {/* Dropdown Menu */}
              {isProductDropdownOpen && (
                  <div className="absolute top-full left-0 w-full bg-white border border-slate-200 shadow-xl rounded-lg mt-1 z-20 max-h-64 overflow-y-auto animate-fade-in p-2">
                      {Object.entries(PRODUCT_GROUPS).map(([category, models]) => (
                          <div key={category} className="mb-2">
                              <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-2">{category}</h5>
                              {models.map(model => {
                                  const isSelected = selectedProducts.includes(model);
                                  return (
                                      <div 
                                        key={model} 
                                        onClick={() => toggleProduct(model)}
                                        className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm ${isSelected ? 'bg-amber-50 text-amber-800' : 'hover:bg-slate-50 text-slate-700'}`}
                                      >
                                          {isSelected ? <CheckSquare size={16} className="text-amber-600" /> : <Square size={16} className="text-slate-300" />}
                                          <span>{model}</span>
                                      </div>
                                  )
                              })}
                          </div>
                      ))}
                      
                      {/* Custom Input Area inside Dropdown */}
                      <div className="border-t border-slate-100 pt-2 px-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Otro / Especificar</label>
                          <div className="relative">
                            <input 
                                type="text"
                                value={customProductText}
                                onChange={(e) => setCustomProductText(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="Escribe otro espacio..."
                                className="w-full border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-amber-400 pr-6"
                            />
                            {customProductText && (
                                <button 
                                    onClick={handleClearCustom}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500"
                                >
                                    <X size={12} />
                                </button>
                            )}
                          </div>
                      </div>
                  </div>
              )}
            </div>
          </div>

          {/* Quick WhatsApp Actions */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center">
                <MessageCircle size={12} className="mr-1"/> Plantillas WhatsApp
            </h4>
            <div className="grid grid-cols-2 gap-2">
                <button 
                    onClick={() => handleOpenWA('opening')}
                    className="flex items-center justify-center py-2.5 bg-green-50 text-green-700 text-xs font-medium rounded-lg hover:bg-green-100 border border-green-200 transition-colors"
                >
                    <span className="mr-1.5">👋</span> Abrir
                </button>
                <button 
                    onClick={() => handleOpenWA('schedule')}
                    className="flex items-center justify-center py-2.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-lg hover:bg-blue-100 border border-blue-200 transition-colors"
                >
                     <span className="mr-1.5">📅</span> Agendar
                </button>
                 <button 
                    onClick={() => handleOpenWA('followup')}
                    className="flex items-center justify-center py-2.5 bg-amber-50 text-amber-700 text-xs font-medium rounded-lg hover:bg-amber-100 border border-amber-200 transition-colors"
                >
                     <span className="mr-1.5">🧐</span> Seguimiento
                </button>
                 <button 
                    onClick={() => handleOpenWA('activation')}
                    className="flex items-center justify-center py-2.5 bg-purple-50 text-purple-700 text-xs font-medium rounded-lg hover:bg-purple-100 border border-purple-200 transition-colors"
                >
                     <span className="mr-1.5">⏳</span> Reactivar
                </button>
            </div>
            <button 
                onClick={() => handleOpenWA('review')}
                className="w-full mt-2 flex items-center justify-center py-2.5 bg-teal-50 text-teal-700 text-xs font-medium rounded-lg hover:bg-teal-100 border border-teal-200 transition-colors"
            >
                 <span className="mr-1.5">⭐</span> Pedir Reseña
            </button>
          </div>
          
          {/* DEBUG SECTION */}
          <div className="mt-4 pt-4 border-t border-slate-200">
             <details className="group">
                 <summary className="flex items-center gap-2 cursor-pointer text-xs text-slate-400 font-mono hover:text-amber-600 transition-colors select-none">
                     <Terminal size={12} />
                     <span>Datos Técnicos (Debug)</span>
                     <span className="ml-auto text-[10px] bg-slate-100 px-1.5 rounded text-slate-500 group-open:hidden">Ver JSON</span>
                 </summary>
                 <div className="mt-2 bg-slate-900 rounded-lg p-4 overflow-x-auto shadow-inner border border-slate-800">
                     <div className="text-[10px] text-slate-500 mb-2 font-mono uppercase border-b border-slate-800 pb-1">
                        Respuesta cruda desde Google Sheets:
                     </div>
                     <pre className="text-[10px] text-green-400 font-mono leading-relaxed whitespace-pre-wrap">
                         {JSON.stringify(formData.rawData, null, 2)}
                     </pre>
                 </div>
             </details>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex gap-3 shrink-0">
            <button onClick={onClose} className="flex-1 py-2.5 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors">
                Cancelar
             </button>
             <button onClick={handleSave} className="flex-1 py-2.5 bg-amber-700 hover:bg-amber-800 text-white font-medium rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors">
                <Save size={18} /> Guardar Cambios
             </button>
        </div>
      </div>
    </div>
    
    {formData && (
        <WhatsAppSelectionModal 
            lead={formData}
            isOpen={isWAModalOpen}
            onClose={() => setIsWAModalOpen(false)}
            initialTemplateId={selectedWATemplateId}
        />
    )}
    </>
    ,
    document.body
  );
};

export default LeadDetailModal;
