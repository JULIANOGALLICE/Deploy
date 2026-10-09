import React, { useState } from 'react';
import { X, Terminal, Copy, Check, CheckCircle2, AlertCircle, Clock, Server, GitBranch, ArrowUpRight, Search } from 'lucide-react';
import { DeploymentProject, DeploymentRecord, VpsServer } from '../types/deploy';

interface DeployLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: DeploymentRecord | null;
  project?: DeploymentProject;
  server?: VpsServer;
}

export const DeployLogsModal: React.FC<DeployLogsModalProps> = ({
  isOpen,
  onClose,
  record,
  project,
  server,
}) => {
  const [copied, setCopied] = useState(false);
  const [filterText, setFilterText] = useState('');

  if (!isOpen || !record) return null;

  const logs = record.logs && Array.isArray(record.logs) && record.logs.length > 0
    ? record.logs
    : [
        `[${new Date(record.timestamp).toLocaleTimeString()}] 🚀 Deploy registrado: ${record.commitMessage}`,
        `[${new Date(record.timestamp).toLocaleTimeString()}] 🌐 Servidor VPS: ${server?.host || '177.153.67.226'}:${project?.appPort || '3000'}`,
        `[${new Date(record.timestamp).toLocaleTimeString()}] 📌 Commit: ${record.commitHash}`,
        `[${new Date(record.timestamp).toLocaleTimeString()}] ⏱️ Duração: ${record.durationSeconds}s`,
        `[${new Date(record.timestamp).toLocaleTimeString()}] Status: ${record.status === 'success' ? '✅ Executado com sucesso' : '❌ Falha registrada'}`,
      ];

  const filteredLogs = filterText.trim()
    ? logs.filter((l) => l.toLowerCase().includes(filterText.toLowerCase()))
    : logs;

  const handleCopy = () => {
    navigator.clipboard.writeText(logs.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isSuccess = record.status === 'success';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                isSuccess
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}
            >
              {isSuccess ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  Logs de Execução do Deploy
                </h2>
                <span
                  className={`text-[10px] font-semibold font-mono uppercase px-2 py-0.5 rounded-full border ${
                    isSuccess
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                  }`}
                >
                  {isSuccess ? 'Sucesso' : 'Falha'}
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <span className="text-white font-medium">{project?.name || 'Aplicação'}</span>
                <span>•</span>
                <span className="font-mono text-slate-300">({record.commitHash})</span>
                <span>•</span>
                <span>{new Date(record.timestamp).toLocaleString()}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg transition-colors cursor-pointer border border-slate-700"
              title="Copiar todos os logs"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado!' : 'Copiar Logs'}</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Info Badges Row */}
        <div className="px-6 py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Server className="w-3.5 h-3.5 text-slate-500" />
              <span>VPS:</span>
              <span className="text-white font-mono">{server?.host || '177.153.67.226'}:{project?.appPort || '3000'}</span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-400">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>Duração:</span>
              <span className="text-emerald-400 font-mono font-medium">{record.durationSeconds}s</span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-400">
              <GitBranch className="w-3.5 h-3.5 text-slate-500" />
              <span>Origem:</span>
              <span className="text-slate-300 capitalize">{record.triggeredBy.replace('_', ' ')}</span>
            </div>
          </div>

          {/* Quick search input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filtrar logs..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Terminal Body */}
        <div className="p-4 flex-1 bg-slate-950 overflow-y-auto font-mono text-xs text-slate-300 space-y-1 select-text">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              Nenhuma linha de log corresponde ao filtro "{filterText}".
            </div>
          ) : (
            filteredLogs.map((line, idx) => {
              const isError =
                line.includes('❌') ||
                line.includes('ERRO') ||
                line.includes('Error') ||
                line.includes('Failed') ||
                line.includes('[stderr]');
              const isSuccessLine =
                line.includes('✅') ||
                line.includes('SUCESSO') ||
                line.includes('Success') ||
                line.includes('🎉');
              const isWarning = line.includes('⚠️') || line.includes('WARN');
              const isSection = line.includes('===') || line.includes('🔍') || line.includes('🚀');

              let lineClass = 'text-slate-300';
              if (isError) lineClass = 'text-rose-400 bg-rose-500/10 px-1 rounded';
              else if (isSuccessLine) lineClass = 'text-emerald-400 font-medium';
              else if (isWarning) lineClass = 'text-amber-300';
              else if (isSection) lineClass = 'text-cyan-400 font-semibold';

              return (
                <div key={idx} className="flex items-start gap-3 hover:bg-slate-900/60 px-2 py-0.5 rounded leading-relaxed">
                  <span className="text-slate-600 select-none text-[11px] w-8 text-right shrink-0">
                    {idx + 1}
                  </span>
                  <span className={`break-all ${lineClass}`}>{line}</span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Total de linhas gravadas no Firestore: <span className="text-white font-mono font-medium">{logs.length}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors cursor-pointer text-xs font-medium"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
