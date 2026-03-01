
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Link, CheckCircle, AlertCircle, HelpCircle } from 'lucide-react';
import { getApiUrl, setApiUrl } from '../services/sheetsService';
import { useLeads } from '../context/LeadsContext';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ConfigModal: React.FC<ConfigModalProps> = ({ isOpen, onClose }) => {
  const { refreshLeads } = useLeads();
  const [url, setUrl] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setUrl(getApiUrl());
      setIsSaved(false);
    }
  }, [isOpen]);

  const handleSave = () => {
    setApiUrl(url);
    setIsSaved(true);
    // Reload leads to confirm connection works (and to switch data source)
    refreshLeads(true);
    setTimeout(() => {
        setIsSaved(false);
        onClose();
    }, 1500);
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col" 
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 flex justify-between items-center shrink-0">
          <h2 className="text-white text-lg font-semibold flex items-center gap-2">
            <div className="bg-slate-800 p-1.5 rounded-lg text-blue-400">
                <Link size={18} />
            </div>
            Conexión Backend
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
            
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-3">
                <HelpCircle className="text-blue-500 shrink-0 mt-0.5" size={20} />
                <div className="text-sm text-blue-800">
                    <p className="font-bold mb-1">¿Cómo configuro mi cuenta?</p>
                    <p className="leading-relaxed opacity-90">
                        Para enviar correos desde TU cuenta (ej: ventas@flapz.com), debes hacer un "Deploy" del Google Apps Script desde esa cuenta y pegar la URL aquí.
                    </p>
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">URL del Google Apps Script</label>
                <input 
                    type="text" 
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-3 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                />
                <p className="text-[11px] text-slate-400">
                    Asegúrate de que la URL termine en <code className="bg-slate-100 px-1 rounded text-slate-600">/exec</code>
                </p>
            </div>

            {/* Status Feedback */}
            {isSaved && (
                <div className="flex items-center gap-2 text-green-600 text-sm font-medium bg-green-50 p-3 rounded-lg animate-fade-in">
                    <CheckCircle size={16} />
                    <span>Conexión actualizada correctamente. Recargando datos...</span>
                </div>
            )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
            <button 
                onClick={onClose}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors text-sm"
            >
                Cancelar
            </button>
            <button 
                onClick={handleSave}
                disabled={!url.includes('script.google.com')}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
                <Save size={16} /> Guardar Conexión
            </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfigModal;
