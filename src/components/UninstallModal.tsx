import React, { useState } from 'react';
import { X, Trash2, AlertTriangle, Terminal, CheckCircle2, Loader2, ShieldAlert, FolderX, Server } from 'lucide-react';
import { DeploymentProject, VpsServer } from '../types/deploy';

interface UninstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'project' | 'vps-wipe';
  project?: DeploymentProject | null;
  vps?: VpsServer | null;
  onSuccess: (targetId: string) => Promise<void> | void;
}

export const UninstallModal: React.FC<UninstallModalProps> = ({
  isOpen,
  onClose,
  mode,
  project,
  vps,
  onSuccess,
}) => {
  const [deleteFilesOnVps, setDeleteFilesOnVps] = useState(true);
  const [deleteFromPanel, setDeleteFromPanel] = useState(true);
  const [confirmationInput, setConfirmationInput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const effectiveVps: VpsServer = vps || {
    id: project?.vpsId || 'default-vps',
    name: 'Servidor VPS',
    host: '177.153.67.226',
    ipAddress: '177.153.67.226',
    sshPort: 22,
    sshUser: 'root',
    authType: 'password',
    os: 'Ubuntu 24.04 LTS',
    status: 'connected',
    cpuCores: 2,
    ramGb: 4,
    diskGb: 50,
    firewallUfwActive: true,
    createdAt: new Date().toISOString(),
  };

  const isWipeMode = mode === 'vps-wipe';
  const confirmationRequired = isWipeMode ? confirmationInput.trim().toUpperCase() === 'LIMPAR' : true;

  const handleExecuteUninstall = async () => {
    setIsExecuting(true);
    setIsFinished(false);
    setIsSuccess(false);
    setLogs([]);

    const pushLog = (msg: string) => {
      const ts = new Date().toLocaleTimeString();
      setLogs((prev) => [...prev, `[${ts}] ${msg}`]);
    };

    if (isWipeMode) {
      // Clean Entire VPS
      pushLog(`🧹 Conectando à VPS ${effectiveVps.host} para limpeza completa...`);
      try {
        const res = await fetch('/api/clean-vps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            host: effectiveVps.host,
            port: effectiveVps.sshPort,
            username: effectiveVps.sshUser,
            authType: effectiveVps.authType,
            passwordOrKey: effectiveVps.sshKeyOrPassword,
          }),
        });

        const data = await res.json();
        if (data.logs && Array.isArray(data.logs)) {
          setLogs(data.logs);
        }
        setIsFinished(true);
        if (data.success) {
          setIsSuccess(true);
          pushLog(`🎉 Limpeza da VPS concluída! Todos os serviços e arquivos foram removidos.`);
          await onSuccess(effectiveVps.id);
        } else {
          pushLog(`⚠️ ${data.message || 'Erro durante a limpeza.'}`);
        }
      } catch (err: any) {
        pushLog(`❌ Falha de conexão: ${err.message || err}`);
        setIsFinished(true);
      } finally {
        setIsExecuting(false);
      }
    } else {
      // Uninstall single project
      if (!project) return;

      if (deleteFilesOnVps) {
        pushLog(`🛑 Conectando à VPS para desinstalar o serviço '${project.slug}'...`);
        pushLog(`📂 Diretório a ser excluído: ${project.serverPath}`);
        pushLog(`🔌 Porta a ser liberada: :${project.appPort}`);

        try {
          const res = await fetch('/api/uninstall-project', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              host: effectiveVps.host,
              port: effectiveVps.sshPort,
              username: effectiveVps.sshUser,
              authType: effectiveVps.authType,
              passwordOrKey: effectiveVps.sshKeyOrPassword,
              slug: project.slug,
              serverPath: project.serverPath,
              domain: project.domain || '',
              appPort: project.appPort,
            }),
          });

          const data = await res.json();
          if (data.logs && Array.isArray(data.logs)) {
            setLogs(data.logs);
          }
          setIsFinished(true);
          if (data.success) {
            setIsSuccess(true);
            pushLog(`✅ Serviço '${project.name}' desinstalado da VPS com sucesso!`);
            if (deleteFromPanel) {
              await onSuccess(project.id);
            }
          } else {
            pushLog(`⚠️ ${data.message || 'Erro ao desinstalar da VPS.'}`);
          }
        } catch (err: any) {
          pushLog(`❌ Falha de comunicação com o servidor: ${err.message || err}`);
          setIsFinished(true);
        } finally {
          setIsExecuting(false);
        }
      } else {
        // Only remove from panel
        if (deleteFromPanel) {
          await onSuccess(project.id);
          onClose();
        }
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950/80 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>{isWipeMode ? 'Limpeza Completa da VPS (Apagar Tudo)' : 'Desinstalar Serviço da VPS'}</span>
              </h2>
              <p className="text-xs text-slate-400">
                {isWipeMode
                  ? 'Finalizar todos os processos e remover todos os arquivos em /var/www/'
                  : `Remover ${project?.name || 'serviço'} e apagar todos os arquivos instalados`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isExecuting}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(92vh-130px)]">
          {!isWipeMode && project ? (
            <div className="space-y-4">
              {/* Items being removed list */}
              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3 text-xs">
                <span className="text-[11px] font-semibold text-slate-300 block uppercase tracking-wider">
                  O que será desinstalado e apagado:
                </span>
                <ul className="space-y-2 text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                    <span>
                      <strong>Processo PM2:</strong> <code className="text-rose-300 bg-slate-900 px-1.5 py-0.5 rounded font-mono">{project.slug}</code> será parado e excluído da inicialização.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                    <span>
                      <strong>Pasta e Arquivos do Projeto:</strong> <code className="text-rose-300 bg-slate-900 px-1.5 py-0.5 rounded font-mono">{project.serverPath}</code> será apagada permanentemente.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                    <span>
                      <strong>Proxy Nginx & SSL:</strong> Configuração em <code className="text-slate-400 font-mono">/etc/nginx/sites-available/{project.slug}</code> será removida.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                    <span>
                      <strong>Porta de Rede:</strong> Porta <code className="text-emerald-300 font-mono">:{project.appPort}</code> será liberada para novas aplicações.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Options */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deleteFilesOnVps}
                    onChange={(e) => setDeleteFilesOnVps(e.target.checked)}
                    className="rounded border-slate-700 text-rose-500 focus:ring-rose-400"
                  />
                  <span>Desinstalar da VPS (apagar PM2, arquivos em {project.serverPath} e Nginx)</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deleteFromPanel}
                    onChange={(e) => setDeleteFromPanel(e.target.checked)}
                    className="rounded border-slate-700 text-rose-500 focus:ring-rose-400"
                  />
                  <span>Excluir cadastro da aplicação do painel (Firebase Firestore)</span>
                </label>
              </div>
            </div>
          ) : (
            /* Wipe Mode */
            <div className="space-y-4">
              <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-2 text-xs text-rose-200">
                <div className="flex items-center gap-2 font-bold text-sm text-rose-300">
                  <ShieldAlert className="w-5 h-5 shrink-0" />
                  <span>Atenção: Ação Destrutiva e Irreversível</span>
                </div>
                <p className="leading-relaxed">
                  Isso irá conectar na VPS <strong>{effectiveVps.host}</strong> e:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-300">
                  <li>Parar e apagar <strong>todos</strong> os processos rodando no PM2 (<code className="text-rose-300 font-mono">pm2 delete all</code>).</li>
                  <li>Apagar <strong>todas</strong> as pastas e códigos de aplicações em <code className="text-rose-300 font-mono">/var/www/*</code>.</li>
                  <li>Limpar as configurações de proxy reverso personalizadas do Nginx.</li>
                </ul>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Para confirmar, digite <strong className="text-white">LIMPAR</strong> abaixo:
                </label>
                <input
                  type="text"
                  value={confirmationInput}
                  onChange={(e) => setConfirmationInput(e.target.value)}
                  placeholder="LIMPAR"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isExecuting}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleExecuteUninstall}
              disabled={isExecuting || !confirmationRequired || (!deleteFilesOnVps && !deleteFromPanel)}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition-all cursor-pointer shadow-lg shadow-rose-900/40 disabled:opacity-50"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Desinstalando na VPS...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>
                    {isWipeMode ? 'Confirmar Limpeza Completa da VPS' : 'Desinstalar e Apagar Tudo'}
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Terminal Logs Output */}
          {(logs.length > 0 || isExecuting) && (
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                  <Terminal className="w-3.5 h-3.5 text-rose-400" />
                  Terminal de Desinstalação da VPS
                </span>
                {isFinished && (
                  <span className={`text-[11px] font-medium flex items-center gap-1 ${isSuccess ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {isSuccess ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                    {isSuccess ? 'Desinstalado com Sucesso' : 'Finalizado com avisos'}
                  </span>
                )}
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-[11px] text-slate-300 max-h-52 overflow-y-auto space-y-1 select-text">
                {logs.map((line, i) => (
                  <div
                    key={i}
                    className={
                      line.includes('COMPLETA') || line.includes('✅') || line.includes('sucesso')
                        ? 'text-emerald-300 font-semibold'
                        : line.includes('🛑') || line.includes('❌') || line.includes('Apagando')
                        ? 'text-rose-400'
                        : 'text-slate-300'
                    }
                  >
                    {line}
                  </div>
                ))}
                {isExecuting && (
                  <div className="flex items-center gap-2 text-rose-400 py-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Executando remoção na VPS...</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
