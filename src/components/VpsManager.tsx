import React, { useState } from 'react';
import { Server, Terminal, Shield, Plus, Edit2, Trash2, Check, Copy, HardDrive, Cpu, ExternalLink, AlertTriangle, ShieldAlert, Box, RefreshCw } from 'lucide-react';
import { DeploymentProject, VpsServer } from '../types/deploy';
import { generateVPSBootstrapScript } from '../utils/generators';
import { getServerProjects } from '../utils/serverMatcher';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface VpsManagerProps {
  servers: VpsServer[];
  projects: DeploymentProject[];
  onAddServer: () => void;
  onEditServer: (server: VpsServer) => void;
  onDeleteServer: (serverId: string) => Promise<void> | void;
  onWipeServer?: (server: VpsServer) => void;
  onNavigateToProjects?: () => void;
}

export const VpsManager: React.FC<VpsManagerProps> = ({
  servers,
  projects,
  onAddServer,
  onEditServer,
  onDeleteServer,
  onWipeServer,
  onNavigateToProjects,
}) => {
  const [selectedServerId, setSelectedServerId] = useState<string>(servers[0]?.id || '');
  const [testingSshId, setTestingSshId] = useState<string | null>(null);
  const [sshTestSuccessId, setSshTestSuccessId] = useState<string | null>(null);
  const [sshTestErrorId, setSshTestErrorId] = useState<string | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);
  const [serverToDelete, setServerToDelete] = useState<VpsServer | null>(null);
  const [blockedServerDelete, setBlockedServerDelete] = useState<{
    server: VpsServer;
    activeProjects: DeploymentProject[];
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const selectedServer = servers.find((s) => s.id === selectedServerId) || servers[0];

  const handleTestSsh = async (server: VpsServer) => {
    setTestingSshId(server.id);
    setSshTestSuccessId(null);
    setSshTestErrorId(null);

    try {
      const res = await fetch('/api/test-ssh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: server.host,
          port: server.sshPort || 22,
          username: server.sshUser || 'root',
          authType: server.authType,
          passwordOrKey: server.sshKeyOrPassword,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSshTestSuccessId(server.id);
        setTimeout(() => setSshTestSuccessId(null), 4000);
      } else {
        setSshTestErrorId(server.id);
        setTimeout(() => setSshTestErrorId(null), 4000);
      }
    } catch {
      setSshTestErrorId(server.id);
      setTimeout(() => setSshTestErrorId(null), 4000);
    } finally {
      setTestingSshId(null);
    }
  };

  const bootstrapScript = selectedServer
    ? generateVPSBootstrapScript(
        selectedServer,
        getServerProjects(selectedServer, projects, servers)
      )
    : '';

  const handleCopyBootstrap = () => {
    navigator.clipboard.writeText(bootstrapScript);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleDeleteClick = (server: VpsServer) => {
    const linked = getServerProjects(server, projects, servers);
    if (linked.length > 0) {
      // Bloquear exclusão se tiver aplicações ativas!
      setBlockedServerDelete({ server, activeProjects: linked });
    } else {
      setServerToDelete(server);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Servidores VPS Cadastrados</h2>
          <p className="text-xs text-slate-400">
            Cadastre suas instâncias VPS (Ubuntu, Debian, etc.) para deploy automatizado via SSH.
          </p>
        </div>
        <button
          onClick={onAddServer}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Novo Servidor VPS</span>
        </button>
      </div>

      {/* Grid of Servers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {servers.map((server) => {
          const serverProjects = getServerProjects(server, projects, servers);
          const runningCount = serverProjects.filter((p) => p.status === 'running').length;
          const isSelected = server.id === selectedServerId;

          return (
            <div
              key={server.id}
              onClick={() => setSelectedServerId(server.id)}
              className={`bg-slate-900/90 border rounded-xl p-5 space-y-4 cursor-pointer transition-all ${
                isSelected
                  ? 'border-emerald-500/60 ring-1 ring-emerald-500/20 bg-slate-900'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Server className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{server.name}</h3>
                    <div className="text-xs font-mono text-slate-400">
                      {server.sshUser}@{server.host}:{server.sshPort}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditServer(server);
                    }}
                    className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                    title="Editar VPS"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(server);
                    }}
                    className={`p-1.5 rounded transition-colors cursor-pointer ${
                      serverProjects.length > 0
                        ? 'text-slate-500 hover:text-amber-400 hover:bg-amber-500/10'
                        : 'text-slate-400 hover:text-rose-400 hover:bg-slate-800'
                    }`}
                    title={
                      serverProjects.length > 0
                        ? `Exclusão bloqueada: possui ${serverProjects.length} aplicação(ões) vinculada(s)`
                        : 'Remover VPS'
                    }
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Specs */}
              <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-slate-950/60 rounded-lg border border-slate-800/80 text-xs">
                <div>
                  <div className="text-[10px] text-slate-500">SISTEMA</div>
                  <div className="text-slate-300 font-medium truncate">{server.os}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">RECURSOS</div>
                  <div className="text-slate-300 font-medium">
                    {server.cpuCores} vCPU · {server.ramGb}GB RAM
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">APPS ATIVAS</div>
                  <div className="text-emerald-400 font-mono font-medium">
                    {serverProjects.length} {serverProjects.length === 1 ? 'app' : 'apps'} ({runningCount} online)
                  </div>
                </div>
              </div>

              {/* Applications Tag Pills */}
              {serverProjects.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] uppercase font-semibold text-slate-500">
                    Aplicações neste servidor:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {serverProjects.map((p) => (
                      <span
                        key={p.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300"
                      >
                        <Box className="w-3 h-3 text-emerald-400" />
                        {p.name} <span className="text-emerald-400">(:{p.appPort})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* SSH Test & Info */}
              <div className="flex items-center justify-between pt-1">
                <div className="text-xs text-slate-400">
                  Autenticação:{' '}
                  <span className="text-white">
                    {server.authType === 'key' ? 'Chave SSH Privada' : 'Senha'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTestSsh(server);
                  }}
                  disabled={testingSshId === server.id}
                  className="px-2.5 py-1 text-xs font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                >
                  {testingSshId === server.id ? (
                    <span className="flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" />
                      Testando SSH...
                    </span>
                  ) : sshTestSuccessId === server.id ? (
                    <span className="text-emerald-400 flex items-center gap-1 font-medium">
                      <Check className="w-3 h-3" /> SSH Conectado!
                    </span>
                  ) : sshTestErrorId === server.id ? (
                    <span className="text-rose-400 flex items-center gap-1 font-medium">
                      <AlertTriangle className="w-3 h-3" /> Falha de Conexão
                    </span>
                  ) : (
                    'Testar Conexão SSH'
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bootstrap One-Click Setup Script Section */}
      {selectedServer && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                Script de Inicialização da VPS (One-Click Setup)
              </h3>
              <p className="text-xs text-slate-400">
                Cole este script na sua VPS recém-contratada para instalar Node.js 20, PM2, Docker, Nginx e liberar as portas no UFW.
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              {onWipeServer && (
                <button
                  type="button"
                  onClick={() => onWipeServer(selectedServer)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-300 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 rounded-lg transition-colors cursor-pointer"
                  title="Parar processos PM2 e apagar pastas em /var/www/"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Limpar VPS (Reset Geral)</span>
                </button>
              )}
              <button
                onClick={handleCopyBootstrap}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer"
              >
                {copiedScript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedScript ? 'Copiado!' : 'Copiar Script Bash'}</span>
              </button>
            </div>
          </div>

          <div className="bg-slate-950 rounded-lg p-3.5 border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto max-h-72">
            <pre>{bootstrapScript}</pre>
          </div>

          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-slate-300 leading-relaxed">
            <strong className="text-emerald-400">Como executar na sua VPS:</strong> Conecte via terminal{' '}
            <code className="text-white font-mono bg-slate-900 px-1 py-0.5 rounded">
              ssh {selectedServer.sshUser}@{selectedServer.host}
            </code>
            , cole o comando acima e aperte Enter. Em menos de 2 minutos seu servidor estará 100% pronto para receber qualquer deploy!
          </div>
        </div>
      )}

      {/* Modal de Exclusão Bloqueada (Servidor com Aplicações Ativas) */}
      {blockedServerDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Exclusão Bloqueada</h3>
                <p className="text-xs text-slate-400">
                  O servidor possui aplicações ativas vinculadas
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-300 space-y-2 leading-relaxed bg-slate-950/70 p-3.5 rounded-lg border border-slate-800">
              <p>
                Não é permitido excluir o servidor{' '}
                <strong className="text-white">{blockedServerDelete.server.name}</strong> (
                {blockedServerDelete.server.host}) enquanto houver{' '}
                <strong className="text-amber-400">
                  {blockedServerDelete.activeProjects.length} aplicação(ões)
                </strong>{' '}
                rodando ou cadastradas nele:
              </p>

              <div className="space-y-1.5 pt-1">
                {blockedServerDelete.activeProjects.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800 font-mono text-[11px]"
                  >
                    <span className="text-white font-medium">{p.name}</span>
                    <span className="text-emerald-400 font-bold">Porta :{p.appPort}</span>
                  </div>
                ))}
              </div>

              <p className="text-slate-400 text-[11px] pt-1">
                ⚠️ Para evitar processos zumbis ou deixar arquivos órfãos consumindo recursos na sua VPS, desinstale as aplicações antes de remover o servidor.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setBlockedServerDelete(null)}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Entendi, Fechar
              </button>
              {onNavigateToProjects && (
                <button
                  type="button"
                  onClick={() => {
                    setBlockedServerDelete(null);
                    onNavigateToProjects();
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors cursor-pointer"
                >
                  Ir para Aplicações para Desinstalar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão do Servidor (permitido somente se 0 apps vinculadas) */}
      <ConfirmDeleteModal
        isOpen={!!serverToDelete}
        title="Excluir Servidor VPS"
        message="Tem certeza que deseja remover este servidor? Todas as configurações associadas a ele serão apagadas permanentemente do Firebase Firestore."
        itemName={serverToDelete ? `${serverToDelete.name} (${serverToDelete.host})` : undefined}
        isLoading={isDeleting}
        onCancel={() => setServerToDelete(null)}
        onConfirm={async () => {
          if (!serverToDelete) return;
          try {
            setIsDeleting(true);
            await onDeleteServer(serverToDelete.id);
            setServerToDelete(null);
          } finally {
            setIsDeleting(false);
          }
        }}
      />
    </div>
  );
};
