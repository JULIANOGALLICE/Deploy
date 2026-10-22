import React, { useState } from 'react';
import { Server, GitBranch, Play, CheckCircle2, AlertCircle, Clock, ShieldCheck, ArrowUpRight, Cpu, Lock, Trash2, ExternalLink, Square, RefreshCw, Terminal, FileText, ChevronRight, Bot, Sparkles } from 'lucide-react';
import { DeploymentProject, DeploymentRecord, VpsServer } from '../types/deploy';
import { getProjectServer } from '../utils/serverMatcher';
import { DeployLogsModal } from './DeployLogsModal';

interface DashboardViewProps {
  servers: VpsServer[];
  projects: DeploymentProject[];
  deployments: DeploymentRecord[];
  onDeployProject: (project: DeploymentProject) => void;
  onSelectTab: (tab: 'dashboard' | 'projects' | 'servers' | 'ports' | 'cicd' | 'guide') => void;
  onConfigureSsl?: (project: DeploymentProject) => void;
  onUninstallProject?: (project: DeploymentProject) => void;
  onToggleStatus?: (project: DeploymentProject) => void;
  togglingProjectId?: string | null;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  servers,
  projects,
  deployments,
  onDeployProject,
  onSelectTab,
  onConfigureSsl,
  onUninstallProject,
  onToggleStatus,
  togglingProjectId,
}) => {
  const [selectedRecordForLogs, setSelectedRecordForLogs] = useState<DeploymentRecord | null>(null);
  const runningProjects = projects.filter((p) => p.status === 'running');
  const connectedServers = servers.filter((s) => s.status === 'connected');
  const distinctPorts = Array.from(new Set(projects.map((p) => p.appPort)));

  return (
    <div className="space-y-6">
      {/* Top Banner / Hero */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800/80 border border-slate-800 rounded-2xl p-6 lg:p-8">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            CI/CD Contínuo para Servidores VPS
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Automatize a instalação e deploy de projetos Git em sua VPS
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            Cadastre seu servidor via SSH, aponte o repositório Git, defina a porta de execução
            (ex: 3000, 8080) e receba scripts prontos de atualização contínua por Webhooks ou GitHub Actions.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={() => onSelectTab('cicd')}
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer"
            >
              Ver Pipeline de Deploy Contínuo (CI/CD)
            </button>
            <button
              onClick={() => onSelectTab('guide')}
              className="px-4 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              Guia Passo a Passo Completo
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 mb-1">Servidores VPS Ativos</div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums">
            {connectedServers.length} <span className="text-xs text-slate-500 font-normal">/ {servers.length}</span>
          </div>
          <div className="text-[11px] text-emerald-400 mt-1">Conexão SSH validada</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 mb-1">Aplicações Git em Execução</div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums">
            {runningProjects.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">PM2 e Docker</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 mb-1">Portas Alocadas</div>
          <div className="text-2xl font-bold text-emerald-400 font-mono tabular-nums">
            {distinctPorts.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {distinctPorts.map((p) => `:${p}`).join(' ')}
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 mb-1">Deploys Realizados</div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums">
            {deployments.length}
          </div>
          <div className="text-[11px] text-emerald-400 mt-1">Zero downtime</div>
        </div>
      </div>

      {/* Quick Deploy Table / Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Aplicações Prontas para Deploy</h2>
            <p className="text-xs text-slate-400">
              Dispare um deploy imediato ou veja os parâmetros de porta e repositório.
            </p>
          </div>
          <button
            onClick={() => onSelectTab('projects')}
            className="text-xs font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
          >
            <span>Gerenciar todas</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => {
            const vps = getProjectServer(project, servers);
            return (
              <div
                key={project.id}
                className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:border-slate-700 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="text-sm font-semibold text-white">{project.name}</h3>
                        {project.enableHttps && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-0.5">
                            <Lock className="w-2.5 h-2.5" />
                            HTTPS
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 font-mono truncate max-w-[200px]">
                        {project.gitRepoUrl.replace('https://github.com/', '')}
                      </div>
                      {(!project.gitRepoUrl?.startsWith('http') || project.gitRepoUrl?.includes('publiccloud.com.br')) && (
                        <div className="mt-1">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-block">
                            ⚠️ Ajustar URL do Git
                          </span>
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      :{project.appPort}
                    </span>
                  </div>

                  <div className="text-xs space-y-1.5 text-slate-300">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Servidor VPS:</span>
                      <span className="font-mono text-slate-300">{vps?.name || 'Não vinculado'}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Branch:</span>
                      <span className="font-mono text-slate-300">{project.branch}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Acesso:</span>
                      {project.enableHttps ? (
                        <a
                          href={`https://${project.domain || vps?.host}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-400 hover:underline font-mono truncate flex items-center gap-1 font-semibold"
                        >
                          <Lock className="w-3 h-3" />
                          https://{project.domain || vps?.host}
                        </a>
                      ) : (
                        <span className="font-mono text-slate-300">
                          {vps?.host || 'IP'}:{project.appPort}
                        </span>
                      )}
                    </div>
                    {project.commitHash && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Último commit:</span>
                        <span className="font-mono text-slate-400">{project.commitHash}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        project.status === 'running' ? 'bg-emerald-400' : 'bg-amber-400'
                      }`}
                    ></span>
                    <span className={project.status === 'running' ? 'text-slate-300' : 'text-amber-300 font-medium'}>
                      {project.status === 'running' ? 'Ativo' : 'Pausado'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {onToggleStatus && (
                      <button
                        onClick={() => onToggleStatus(project)}
                        disabled={togglingProjectId === project.id}
                        className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                          togglingProjectId === project.id
                            ? 'bg-slate-800 text-emerald-400 border-slate-700 opacity-80 cursor-wait'
                            : project.status === 'running'
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                        }`}
                        title={
                          togglingProjectId === project.id
                            ? 'Executando comando no PM2 da VPS...'
                            : project.status === 'running'
                            ? 'Pausar Serviço no Servidor Real (pm2 stop)'
                            : 'Iniciar Serviço no Servidor Real (pm2 start)'
                        }
                      >
                        {togglingProjectId === project.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                        ) : project.status === 'running' ? (
                          <Square className="w-3.5 h-3.5 fill-amber-400/20" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-emerald-400/20" />
                        )}
                      </button>
                    )}
                    {onConfigureSsl && (
                      <button
                        onClick={() => onConfigureSsl(project)}
                        className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                          project.enableHttps
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                        title="Configurar Certificado SSL (HTTPS)"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      </button>
                    )}
                    {onUninstallProject && (
                      <button
                        onClick={() => onUninstallProject(project)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs transition-colors cursor-pointer"
                        title="Desinstalar Serviço da VPS"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => onDeployProject(project)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Deploy</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Deployment History */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <span>Histórico Recente de Deploys</span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              {deployments.length} registro(s)
            </span>
          </h3>
          <span className="text-[11px] text-slate-400">
            Armazenamento permanente de logs no Firestore
          </span>
        </div>

        {deployments.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-800/80 rounded-xl">
            Nenhum deploy realizado ainda. Clique no botão "Deploy" em qualquer aplicação para iniciar.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {deployments.slice(0, 10).map((dep) => {
              const project = projects.find((p) => p.id === dep.projectId);
              const vps = servers.find((s) => s.id === dep.vpsId);
              const isSuccess = dep.status === 'success';
              const logCount = dep.logs && Array.isArray(dep.logs) ? dep.logs.length : 0;

              return (
                <div key={dep.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-slate-800/20 px-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center border shrink-0 ${
                        isSuccess
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                      }`}
                      title={isSuccess ? 'Deploy finalizado com sucesso' : 'Deploy falhou'}
                    >
                      {isSuccess ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="text-white font-medium flex items-center gap-2">
                        <span>{project?.name || 'Aplicação'}</span>
                        <span className="font-mono text-[11px] text-slate-400">
                          ({dep.commitHash})
                        </span>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                            isSuccess
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                          }`}
                        >
                          {isSuccess ? 'Sucesso' : 'Falha'}
                        </span>
                        {dep.aiFixed && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded border bg-purple-500/15 text-purple-300 border-purple-500/30 flex items-center gap-1" title="Deploy recuperado e corrigido automaticamente pela IA Gemini 3.8 Flash">
                            <Sparkles className="w-3 h-3 text-purple-400" />
                            <span>Corrigido por IA</span>
                          </span>
                        )}
                        {!dep.aiFixed && dep.aiLogs && dep.aiLogs.length > 0 && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded border bg-purple-500/15 text-purple-300 border-purple-500/30 flex items-center gap-1" title="Ações executadas pela IA">
                            <Bot className="w-3 h-3 text-purple-400" />
                            <span>IA ({dep.aiLogs.length})</span>
                          </span>
                        )}
                      </div>
                      <div className="text-slate-400 text-[11px] flex flex-wrap items-center gap-2 mt-0.5">
                        <span>{dep.commitMessage}</span>
                        <span>•</span>
                        <span className="font-mono">{vps?.host || '177.153.67.226'}:{project?.appPort || '3000'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <div className="text-right text-slate-400 font-mono text-[11px]">
                      <div>{new Date(dep.timestamp).toLocaleTimeString()}</div>
                      <div className="text-emerald-400">{dep.durationSeconds}s</div>
                    </div>

                    <button
                      onClick={() => setSelectedRecordForLogs(dep)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors cursor-pointer"
                      title="Ver logs completos da execução no terminal"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      <span>Ver Logs ({logCount})</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Logs de Execução */}
      {selectedRecordForLogs && (
        <DeployLogsModal
          isOpen={Boolean(selectedRecordForLogs)}
          onClose={() => setSelectedRecordForLogs(null)}
          record={selectedRecordForLogs}
          project={projects.find((p) => p.id === selectedRecordForLogs.projectId)}
          server={servers.find((s) => s.id === selectedRecordForLogs.vpsId)}
        />
      )}
    </div>
  );
};
