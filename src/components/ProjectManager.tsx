import React, { useState } from 'react';
import { GitBranch, Play, RefreshCw, Square, Edit2, Trash2, ExternalLink, Settings2, Plus, Terminal, ShieldCheck, Lock, ShieldAlert, AlertTriangle, Bot, Sparkles } from 'lucide-react';
import { DeploymentProject, VpsServer } from '../types/deploy';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { getProjectServer } from '../utils/serverMatcher';

interface ProjectManagerProps {
  projects: DeploymentProject[];
  servers: VpsServer[];
  onAddProject: () => void;
  onEditProject: (project: DeploymentProject) => void;
  onDeleteProject: (projectId: string) => Promise<void> | void;
  onDeployProject: (project: DeploymentProject) => void;
  onToggleStatus: (project: DeploymentProject) => void;
  onViewCiCd: (project: DeploymentProject) => void;
  onConfigureSsl?: (project: DeploymentProject) => void;
  onUninstallProject?: (project: DeploymentProject) => void;
  togglingProjectId?: string | null;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({
  projects,
  servers,
  onAddProject,
  onEditProject,
  onDeleteProject,
  onDeployProject,
  onToggleStatus,
  onViewCiCd,
  onConfigureSsl,
  onUninstallProject,
  togglingProjectId,
}) => {
  const [projectToDelete, setProjectToDelete] = useState<DeploymentProject | null>(null);
  const [blockedProjectDelete, setBlockedProjectDelete] = useState<DeploymentProject | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAttempt = (project: DeploymentProject) => {
    // Se a aplicação está rodando ou tem servidor associado, exigir desinstalação na VPS primeiro!
    if (onUninstallProject) {
      onUninstallProject(project);
    } else {
      setBlockedProjectDelete(project);
    }
  };
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Aplicações Git Cadastradas</h2>
          <p className="text-xs text-slate-400">
            Gerencie repositórios, portas alocadas (ex: 3000, 8080) e acione deploys contínuos na sua VPS.
          </p>
        </div>
        <button
          onClick={onAddProject}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Nova Aplicação</span>
        </button>
      </div>

      {/* Projects List */}
      <div className="space-y-4">
        {projects.map((project) => {
          const vps = getProjectServer(project, servers);
          const isRunning = project.status === 'running';

          return (
            <div
              key={project.id}
              className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4 hover:border-slate-700/80 transition-all"
            >
              {/* Row 1: Title, Status, Port, Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3.5 h-3.5 rounded-full ${
                      isRunning ? 'bg-emerald-400 shadow-sm shadow-emerald-500/50' : 'bg-slate-600'
                    }`}
                  />
                  <div>
                    <h3 className="text-base font-semibold text-white flex items-center gap-2 flex-wrap">
                      <span>{project.name}</span>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        Porta :{project.appPort}
                      </span>
                      {project.enableAiAutoFix ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1" title="IA Gemini 3.8 Flash monitorando terminal para autocorreção automática na VPS">
                          <Bot className="w-3 h-3 text-purple-400" />
                          <span>IA Auto-Heal Ativa</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1" title="Autocorreção por IA desativada para este projeto">
                          <Bot className="w-3 h-3 text-slate-500" />
                          <span>IA Desativada</span>
                        </span>
                      )}
                      {project.enableHttps && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          <span>HTTPS Ativo</span>
                        </span>
                      )}
                      {(!project.gitRepoUrl?.startsWith('http') || project.gitRepoUrl?.includes('publiccloud.com.br')) && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          ⚠️ Repositório GitHub Inválido
                        </span>
                      )}
                    </h3>
                    <div className="text-xs text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                      <span className="truncate max-w-[280px]">
                        {project.gitRepoUrl}
                      </span>
                      <span>·</span>
                      <span>branch: {project.branch}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => onDeployProject(project)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Deploy Agora</span>
                  </button>

                  {onConfigureSsl && (
                    <button
                      onClick={() => onConfigureSsl(project)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer border ${
                        project.enableHttps
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
                          : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                      }`}
                      title="Configurar Certificado SSL e HTTPS"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{project.enableHttps ? 'SSL Ativo' : 'Instalar SSL'}</span>
                    </button>
                  )}

                  <button
                    onClick={() => onViewCiCd(project)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    <span>CI/CD</span>
                  </button>

                  <button
                    onClick={() => onToggleStatus(project)}
                    disabled={togglingProjectId === project.id}
                    className={`p-1.5 rounded transition-all cursor-pointer border ${
                      togglingProjectId === project.id
                        ? 'bg-slate-800 border-slate-700 text-emerald-400 opacity-80 cursor-wait'
                        : isRunning
                        ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/15 border-amber-500/30 bg-amber-500/5'
                        : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/15 border-emerald-500/30 bg-emerald-500/5'
                    }`}
                    title={
                      togglingProjectId === project.id
                        ? 'Conectando à VPS para executar comando no PM2...'
                        : isRunning
                        ? 'Pausar Serviço no Servidor Real (pm2 stop)'
                        : 'Iniciar Serviço no Servidor Real (pm2 start)'
                    }
                  >
                    {togglingProjectId === project.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                    ) : isRunning ? (
                      <Square className="w-4 h-4 fill-amber-400/20" />
                    ) : (
                      <Play className="w-4 h-4 fill-emerald-400/20" />
                    )}
                  </button>

                  <button
                    onClick={() => onEditProject(project)}
                    className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Editar Configurações"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteAttempt(project)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-300 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 rounded-lg transition-colors cursor-pointer"
                    title="Desinstalar Serviço e Apagar Arquivos da VPS"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Desinstalar da VPS</span>
                  </button>
                </div>
              </div>

              {/* Row 2: Details grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 px-3.5 bg-slate-950/70 rounded-lg border border-slate-800/80 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Servidor VPS</span>
                  <span className="text-slate-300 font-mono font-medium truncate block">
                    {vps ? `${vps.name} (${vps.host})` : 'Não definido'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Diretório na VPS</span>
                  <span className="text-slate-300 font-mono truncate block">
                    {project.serverPath}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Runtime & Start</span>
                  <span className="text-slate-300 capitalize truncate block">
                    {project.runtime === 'node-pm2' ? 'Node.js (PM2)' : project.runtime}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">URL de Acesso</span>
                  {project.enableHttps ? (
                    <a
                      href={`https://${project.domain || vps?.host}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-400 hover:underline font-mono truncate flex items-center gap-1 font-semibold"
                    >
                      <Lock className="w-3 h-3 text-emerald-400" />
                      <span>https://{project.domain || vps?.host}</span>
                    </a>
                  ) : (
                    <a
                      href={`http://${vps?.host || 'localhost'}:${project.appPort}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-slate-300 hover:text-emerald-400 hover:underline font-mono truncate block"
                    >
                      {vps?.host || 'IP'}:{project.appPort}
                    </a>
                  )}
                </div>
              </div>

              {/* Row 3: Meta & Commit info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-400 gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded text-[11px]">
                    Commit: {project.commitHash || 'main-latest'}
                  </span>
                  <span className="truncate max-w-md">{project.commitMessage || 'Última versão sincronizada'}</span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  {project.lastDeployedAt
                    ? `Último deploy: ${new Date(project.lastDeployedAt).toLocaleString()}`
                    : 'Aguardando primeiro deploy'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Desinstalação Obrigatória antes da Exclusão */}
      {blockedProjectDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-rose-500/40 rounded-xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Desinstalação Obrigatória</h3>
                <p className="text-xs text-slate-400">
                  Desinstale da VPS antes de excluir do painel
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-300 space-y-2 leading-relaxed bg-slate-950/70 p-3.5 rounded-lg border border-slate-800">
              <p>
                A aplicação <strong className="text-white">{blockedProjectDelete.name}</strong> está alocada na porta <strong className="text-emerald-400">:{blockedProjectDelete.appPort}</strong> e instalada na VPS.
              </p>
              <p>
                Não é permitido excluí-la diretamente do painel sem desinstalar, para não deixar processos PM2 zumbis rodando em segundo plano e bloqueando a porta.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setBlockedProjectDelete(null)}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              {onUninstallProject && (
                <button
                  type="button"
                  onClick={() => {
                    const p = blockedProjectDelete;
                    setBlockedProjectDelete(null);
                    onUninstallProject(p);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Desinstalar da VPS Agora</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão da Aplicação */}
      <ConfirmDeleteModal
        isOpen={!!projectToDelete}
        title="Excluir Aplicação Git"
        message="Tem certeza que deseja excluir esta aplicação? Todas as configurações de porta, caminhos e histórico de deploy associados serão removidos do Firebase Firestore."
        itemName={projectToDelete ? `${projectToDelete.name} (Porta :${projectToDelete.appPort})` : undefined}
        isLoading={isDeleting}
        onCancel={() => setProjectToDelete(null)}
        onConfirm={async () => {
          if (!projectToDelete) return;
          try {
            setIsDeleting(true);
            await onDeleteProject(projectToDelete.id);
            setProjectToDelete(null);
          } finally {
            setIsDeleting(false);
          }
        }}
      />
    </div>
  );
};
