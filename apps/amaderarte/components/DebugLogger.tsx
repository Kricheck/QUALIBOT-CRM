
import React, { useState, useEffect, useRef } from 'react';
import { Terminal, X, ChevronDown, ChevronUp, Trash2, Activity, Server, Monitor, AlertTriangle, ClipboardCopy, Check } from 'lucide-react';

interface LogEntry {
  id: string;
  timestamp: string;
  title: string;
  data: any;
  type: 'info' | 'success' | 'error' | 'request';
}

const DebugLogger: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [copied, setCopied] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  
  const [lastVersions, setLastVersions] = useState({ client: '', server: '' });

  useEffect(() => {
    const handleLog = (e: Event) => {
      const customEvent = e as CustomEvent<LogEntry>;
      const detail = customEvent.detail;
      setLogs(prev => [...prev, detail]);
      
      // Detect versions from logs
      if (detail.data) {
          if (detail.data.frontendVersion) setLastVersions(v => ({...v, client: detail.data.frontendVersion}));
          // If server responds with version, track it
          if (detail.data.backendVersion) setLastVersions(v => ({...v, server: detail.data.backendVersion}));
          // If server responds with serverVersion key (from handshake)
          if (detail.data.serverVersion) setLastVersions(v => ({...v, server: detail.data.serverVersion}));
      }

      if (detail.type === 'error') setIsOpen(true);
    };

    window.addEventListener('crm-debug-log', handleLog);
    return () => window.removeEventListener('crm-debug-log', handleLog);
  }, []);

  useEffect(() => {
    if (endRef.current) {
        endRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, isOpen]);

  // Derived state to check if versions are mismatched or legacy
  const isLegacyServer = lastVersions.server === 'LEGACY' || lastVersions.server === 'LEGACY_ARRAY';
  const hasServerContact = !!lastVersions.server;

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-4 left-4 p-2 rounded-full shadow-lg transition-all z-50 border animate-pulse ${
            isLegacyServer ? 'bg-red-800 text-red-200 border-red-500' : 'bg-slate-800 text-green-400 border-slate-600'
        }`}
        title="Abrir Consola de Debug"
      >
        {isLegacyServer ? <AlertTriangle size={20} /> : <Terminal size={20} />}
      </button>
    );
  }

  return (
    <div className={`fixed bottom-4 left-4 bg-slate-900 w-full max-w-lg rounded-lg shadow-2xl z-50 border flex flex-col transition-all duration-300 ${
        isLegacyServer ? 'border-red-500' : 'border-slate-700'
    } ${isMinimized ? 'h-14' : 'h-[500px]'}`}>
      
      {/* Header */}
      <div className={`flex flex-col rounded-t-lg border-b shrink-0 ${isLegacyServer ? 'bg-red-900/50 border-red-700' : 'bg-slate-800 border-slate-700'}`}>
          <div className="flex items-center justify-between p-2 cursor-pointer" onClick={() => setIsMinimized(!isMinimized)}>
            <div className="flex items-center gap-2 font-mono text-sm font-bold">
                {isLegacyServer ? <AlertTriangle size={16} className="text-red-400" /> : <Activity size={16} className="text-green-400" />}
                <span className={isLegacyServer ? 'text-red-200' : 'text-green-400'}>
                    {isLegacyServer ? 'ERROR VERSION' : 'CRM Handshake'}
                </span>
                <span className={`px-1.5 rounded text-[10px] ${logs.some(l => l.type === 'error') ? 'bg-red-950 text-red-200' : 'bg-slate-700 text-slate-300'}`}>
                    {logs.length}
                </span>
            </div>
            <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const text = logs.map(l =>
                      `[${l.timestamp}] ${l.type.toUpperCase()} ${l.title}${l.data ? '\n' + JSON.stringify(l.data, null, 2) : ''}`
                    ).join('\n\n');
                    navigator.clipboard.writeText(text).then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    });
                  }}
                  className="text-slate-400 hover:text-blue-400 p-1"
                  title="Copiar todos los logs"
                >
                  {copied ? <Check size={14} className="text-green-400" /> : <ClipboardCopy size={14} />}
                </button>
                <button onClick={(e) => { e.stopPropagation(); setLogs([]); }} className="text-slate-400 hover:text-red-400 p-1" title="Limpiar"><Trash2 size={14} /></button>
                <button onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }} className="text-slate-400 hover:text-white p-1">
                    {isMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                <button onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} className="text-slate-400 hover:text-white p-1"><X size={16} /></button>
            </div>
          </div>
          
          {/* Version Status Bar */}
          {!isMinimized && (
              <div className="flex justify-between px-3 py-1 bg-black/30 text-[10px] font-mono border-t border-white/10">
                  <div className="flex items-center gap-1 text-blue-300">
                      <Monitor size={10} /> Client: {lastVersions.client || '...'}
                  </div>
                  <div className={`flex items-center gap-1 ${isLegacyServer ? 'text-red-400 font-bold' : 'text-amber-300'}`}>
                      <Server size={10} /> Server: {lastVersions.server || 'Esperando...'}
                  </div>
              </div>
          )}
      </div>

      {/* Body */}
      {!isMinimized && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3 font-mono text-xs scrollbar-thin scrollbar-thumb-slate-700">
            {logs.length === 0 && (
                <div className="text-slate-600 text-center mt-10 italic">
                    Esperando eventos...<br/>
                    Realiza una acción para ver logs.
                </div>
            )}
            {logs.map((log) => (
                <div key={log.id} className="border-l-2 pl-2 py-1 animate-fade-in group" style={{
                    borderColor: log.type === 'error' ? '#ef4444' : log.type === 'success' ? '#10b981' : log.type === 'request' ? '#3b82f6' : '#94a3b8'
                }}>
                    <div className="flex justify-between text-slate-500 mb-0.5">
                        <span className={`font-bold uppercase ${
                            log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : log.type === 'request' ? 'text-blue-400' : 'text-slate-400'
                        }`}>{log.title}</span>
                        <span>{log.timestamp}</span>
                    </div>
                    {log.data && (
                        <div className="bg-black/20 p-2 rounded mt-1 overflow-x-auto">
                           {/* Render key fields cleanly */}
                           {log.data.backendVersion && <div className="text-amber-400 mb-1">► Server Ver: {log.data.backendVersion}</div>}
                           
                           <pre className="text-slate-300 whitespace-pre-wrap break-all">
                                {typeof log.data === 'string' ? log.data : JSON.stringify(log.data, null, 2)}
                           </pre>
                        </div>
                    )}
                </div>
            ))}
            <div ref={endRef} />
        </div>
      )}
    </div>
  );
};

export default DebugLogger;
