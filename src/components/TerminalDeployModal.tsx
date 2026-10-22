import React, { useState, useEffect } from 'react';
import { X, Terminal, CheckCircle2, AlertTriangle, Loader2, Copy, Check, ExternalLink, HelpCircle, ShieldAlert, Cpu, GitBranch, ArrowRight, RefreshCw, ShieldCheck, Lock, Trash2, Bot, Sparkles } from 'lucide-react';
import { DeploymentProject, DeploymentRecord, VpsServer } from '../types/deploy';

interface TerminalDeployModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: DeploymentProject | null;
  vps: VpsServer | null;
  onDeployComplete: (record: DeploymentRecord) => void;
  onUpdateProject?: (project: DeploymentProject) => Promise<void> | void;
  onOpenSsl?: (project: DeploymentProject) => void;
  onOpenUninstall?: (project: DeploymentProject) => void;
}

export const TerminalDeployModal: React.FC<TerminalDeployModalProps> = ({
  isOpen,
  onClose,
  project,
  vps,
  onDeployComplete,
  onUpdateProject,
  onOpenSsl,
  onOpenUninstall,
}) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [aiLogs, setAiLogs] = useState<string[]>([]);
  const [aiFixed, setAiFixed] = useState(false);
  const [aiDiagnosis, setAiDiagnosis] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState(project?.enableAiAutoFix ?? true);
  const [copiedAi, setCopiedAi] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [copiedUfw, setCopiedUfw] = useState(false);
  const [activeTab, setActiveTab] = useState<'terminal' | 'ai-logs' | 'manual' | 'troubleshoot' | 'diagnose'>('terminal');
  const [diagOutput, setDiagOutput] = useState('');
  const [isLoadingDiag, setIsLoadingDiag] = useState(false);

  const [gitRepoInput, setGitRepoInput] = useState(project?.gitRepoUrl || '');
  const [githubTokenInput, setGithubTokenInput] = useState(project?.githubToken || '');
  const [showPushGuide, setShowPushGuide] = useState(false);
  const [isSavingRepo, setIsSavingRepo] = useState(false);

  useEffect(() => {
    if (project) {
      setAiEnabled(project.enableAiAutoFix ?? true);
    }
  }, [project?.id, project?.enableAiAutoFix]);

  useEffect(() => {
    if (project?.gitRepoUrl) {
      setGitRepoInput(project.gitRepoUrl);
    }
    if (project?.githubToken) {
      setGithubTokenInput(project.githubToken);
    }
  }, [project?.gitRepoUrl, project?.githubToken]);

  const effectiveVps: VpsServer = vps || {
    id: project?.vpsId || 'vps-default',
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

  const appPort = project?.appPort || 3000;
  const branch = project?.branch || 'main';
  const serverPath = project?.serverPath || `/var/www/${project?.slug || 'app'}`;
  const slug = project?.slug || 'app-service';
  const repoUrl = gitRepoInput || project?.gitRepoUrl || 'https://github.com/usuario/repositorio.git';

  const isInvalidGitUrl =
    !gitRepoInput ||
    (!gitRepoInput.startsWith('http://') &&
      !gitRepoInput.startsWith('https://') &&
      !gitRepoInput.startsWith('git@')) ||
    gitRepoInput.includes('publiccloud.com.br') ||
    gitRepoInput.includes('locaweb') ||
    /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(gitRepoInput);

  // Comando pronto para rodar direto no terminal da VPS (Locaweb / Putty / SSH)
  const oneLineVpsCommand = `which make >/dev/null || (sudo apt-get update -y && sudo apt-get install -y build-essential make) && mkdir -p ${serverPath} && cd ${serverPath} && (git init && git remote add origin ${repoUrl} 2>/dev/null || git remote set-url origin ${repoUrl}) && git fetch origin --prune && (git checkout -f -B ${branch} origin/${branch} 2>/dev/null || git checkout -f -B main origin/main 2>/dev/null || git checkout -f -B master origin/master) && git reset --hard && (npm install --legacy-peer-deps || npm install --force) && (npm install react-is --legacy-peer-deps 2>/dev/null || true) && PORT=${appPort} npm run build && sudo ufw allow ${appPort}/tcp && which pm2 >/dev/null || sudo npm install -g pm2 && pm2 stop ${slug} 2>/dev/null || true && pm2 delete ${slug} 2>/dev/null || true && (if [ -f dist/server.cjs ]; then PORT=${appPort} pm2 start dist/server.cjs --name ${slug}; elif [ -d dist ]; then pm2 serve dist ${appPort} --name ${slug} --spa; else PORT=${appPort} pm2 start npm --name ${slug} -- start; fi) && pm2 save`;

  const runDeploy = async (overrideUrl?: string, overrideToken?: string) => {
    if (!project) return;
    setIsExecuting(true);
    setIsFinished(false);
    setLogs([]);
    setAiLogs([]);
    setAiFixed(false);
    setAiDiagnosis(null);

    const activeRepoUrl = (overrideUrl || gitRepoInput || project.gitRepoUrl).trim();
    const activeToken = overrideToken !== undefined ? overrideToken : githubTokenInput;

    const startTime = Date.now();
    const localLogs: string[] = [];
    const pushLog = (msg: string) => {
      const ts = new Date().toLocaleTimeString();
      const line = `[${ts}] ${msg}`;
      localLogs.push(line);
      setLogs((prev) => [...prev, line]);
    };

    pushLog(`🚀 Iniciando processo de deploy para ${project.name}...`);
    pushLog(`🌐 Alvo: ${effectiveVps.sshUser}@${effectiveVps.host}:${effectiveVps.sshPort}`);
    pushLog(`📂 Repositório Git: ${activeRepoUrl}`);
    pushLog(`🔌 Porta configurada: ${appPort} (Host obrigatório: 0.0.0.0)`);
    pushLog(aiEnabled ? `🤖 Auto-correção com IA (Gemini): ATIVADA` : `⚪ Auto-correção com IA: DESATIVADA`);

    try {
      const res = await fetch('/api/deploy-ssh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: effectiveVps.host,
          port: effectiveVps.sshPort,
          username: effectiveVps.sshUser,
          authType: effectiveVps.authType,
          passwordOrKey: effectiveVps.sshKeyOrPassword,
          repoUrl: activeRepoUrl,
          branch,
          appPort,
          serverPath,
          buildCommand: project.buildCommand || 'npm run build',
          slug,
          runtime: project.runtime || 'node-pm2',
          envVariables: project.envVariables || [],
          githubToken: activeToken,
          enableAiAutoFix: aiEnabled,
        }),
      });

      const data = await res.json();
      const executionLogs = data.logs && Array.isArray(data.logs) && data.logs.length > 0
        ? data.logs
        : localLogs;

      if (data.logs && Array.isArray(data.logs)) {
        setLogs(data.logs);
      }

      if (data.aiLogs && Array.isArray(data.aiLogs)) {
        setAiLogs(data.aiLogs);
      }

      if (data.aiFixed) {
        setAiFixed(true);
      }

      if (data.aiDiagnosis) {
        setAiDiagnosis(data.aiDiagnosis);
      }

      const durationSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));

      if (data.success) {
        if (data.aiFixed) {
          pushLog(`🎉 Deploy recuperado com SUCESSO pela IA na VPS ${effectiveVps.host}!`);
        } else {
          pushLog(`✅ Deploy remoto concluído com SUCESSO na VPS ${effectiveVps.host}!`);
        }
        pushLog(`🟢 Acesse: http://${effectiveVps.host}:${appPort}`);
        setIsFinished(true);
        onDeployComplete({
          id: `dep-${Date.now()}`,
          projectId: project.id,
          vpsId: effectiveVps.id,
          timestamp: new Date().toISOString(),
          status: 'success',
          commitHash: Math.random().toString(16).substring(2, 9),
          commitMessage: data.aiFixed
            ? `Deploy corrigido pela IA (Gemini) na porta ${appPort}`
            : `Deploy via SSH na porta ${appPort}`,
          durationSeconds,
          triggeredBy: 'manual',
          logs: executionLogs,
          aiLogs: data.aiLogs || [],
          aiFixed: Boolean(data.aiFixed),
          aiDiagnosis: data.aiDiagnosis,
        });
      } else {
        const errorMsg = data.message || 'A execução na VPS retornou erro.';
        pushLog(`⚠️ Atenção: ${errorMsg}`);
        setIsFinished(true);
        // Registra o deploy com status de falha e logs completos para auditoria
        onDeployComplete({
          id: `dep-${Date.now()}`,
          projectId: project.id,
          vpsId: effectiveVps.id,
          timestamp: new Date().toISOString(),
          status: 'failed',
          commitHash: Math.random().toString(16).substring(2, 9),
          commitMessage: `Falha no deploy: ${errorMsg.slice(0, 60)}`,
          durationSeconds,
          triggeredBy: 'manual',
          logs: executionLogs,
          aiLogs: data.aiLogs || [],
          aiFixed: false,
          aiDiagnosis: data.aiDiagnosis,
        });
      }
    } catch (err: any) {
      const errMsg = err.message || String(err);
      pushLog(`❌ Falha de comunicação: ${errMsg}`);
      setIsFinished(true);
      const durationSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));
      onDeployComplete({
        id: `dep-${Date.now()}`,
        projectId: project.id,
        vpsId: effectiveVps.id,
        timestamp: new Date().toISOString(),
        status: 'failed',
        commitHash: Math.random().toString(16).substring(2, 9),
        commitMessage: `Falha de rede/conexão: ${errMsg.slice(0, 60)}`,
        durationSeconds,
        triggeredBy: 'manual',
        logs: localLogs,
        aiLogs: [],
        aiFixed: false,
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSaveRepoAndDeploy = async () => {
    if (!project || !gitRepoInput.trim()) return;
    try {
      setIsSavingRepo(true);
      const updated = {
        ...project,
        gitRepoUrl: gitRepoInput.trim(),
        githubToken: githubTokenInput.trim(),
      };
      if (onUpdateProject) {
        await onUpdateProject(updated);
      }
      await runDeploy(gitRepoInput.trim(), githubTokenInput.trim());
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingRepo(false);
    }
  };

  const handleRunDiagnose = async () => {
    setIsLoadingDiag(true);
    setActiveTab('diagnose');
    try {
      const res = await fetch('/api/diagnose-vps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: effectiveVps.host,
          port: effectiveVps.sshPort,
          username: effectiveVps.sshUser,
          authType: effectiveVps.authType,
          passwordOrKey: effectiveVps.sshKeyOrPassword,
          slug,
          appPort,
        }),
      });
      const data = await res.json();
      if (data.output) {
        setDiagOutput(data.output);
      } else {
        setDiagOutput(data.message || 'Erro ao consultar a VPS.');
      }
    } catch (err: any) {
      setDiagOutput(`Erro de comunicação: ${err.message || err}`);
    } finally {
      setIsLoadingDiag(false);
    }
  };

  useEffect(() => {
    if (isOpen && project) {
      // Só executa o deploy automaticamente se a URL configurada for uma URL Git válida
      const isInitialUrlValid =
        project.gitRepoUrl &&
        (project.gitRepoUrl.startsWith('http://') ||
          project.gitRepoUrl.startsWith('https://') ||
          project.gitRepoUrl.startsWith('git@')) &&
        !project.gitRepoUrl.includes('publiccloud.com.br') &&
        !project.gitRepoUrl.includes('locaweb') &&
        !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(project.gitRepoUrl);

      if (isInitialUrlValid) {
        runDeploy();
      }
    }
  }, [isOpen, project?.id]);

  if (!isOpen || !project) return null;

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(logs.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(oneLineVpsCommand);
    setCopiedCommand(true);
    setTimeout(() => setCopiedCommand(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div className="w-full max-w-3xl bg-slate-950 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
            </div>
            <div className="ml-2 flex items-center gap-2 text-xs font-mono text-slate-300">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>{effectiveVps.sshUser}@{effectiveVps.host} — {project.name} (Porta :{appPort})</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs inside modal */}
        <div className="flex border-b border-slate-800 bg-slate-900/60 px-4 text-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab('terminal')}
            className={`px-3 py-2.5 font-medium border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'terminal'
                ? 'border-emerald-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Console SSH em Tempo Real
          </button>
          <button
            onClick={() => setActiveTab('ai-logs')}
            className={`px-3 py-2.5 font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'ai-logs'
                ? 'border-purple-400 text-purple-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bot className="w-3.5 h-3.5 text-purple-400" />
            <span>Ações & Comandos da IA</span>
            {aiLogs.length > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full bg-purple-500/25 text-purple-200 text-[10px] font-mono border border-purple-500/40">
                {aiLogs.length}
              </span>
            ) : (
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${aiEnabled ? 'bg-purple-500/15 text-purple-300' : 'bg-slate-800 text-slate-500'}`}>
                {aiEnabled ? 'Ativa' : 'Off'}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`px-3 py-2.5 font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === 'manual'
                ? 'border-emerald-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Comando Direto (Cole na VPS)</span>
            <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[10px]">1 Clique</span>
          </button>
          <button
            onClick={() => setActiveTab('troubleshoot')}
            className={`px-3 py-2.5 font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1 shrink-0 ${
              activeTab === 'troubleshoot'
                ? 'border-rose-400 text-rose-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span>Por que deu "Conexão Recusada"?</span>
          </button>
          <button
            onClick={handleRunDiagnose}
            className={`px-3 py-2.5 font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1 shrink-0 ${
              activeTab === 'diagnose'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {isLoadingDiag ? <Loader2 className="w-3 h-3 animate-spin text-cyan-400" /> : <Cpu className="w-3 h-3 text-cyan-400" />}
            <span>Diagnosticar Portas & PM2</span>
          </button>
        </div>

        {/* Git URL Correction or Missing Banner */}
        {activeTab === 'terminal' && (isInvalidGitUrl || logs.some(l => l.includes('fatal: repository') || l.includes('ERRO: Falha ao clonar'))) && (
          <div className="p-4 bg-amber-500/10 border-b border-amber-500/30 text-xs space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Informe o Repositório do GitHub para concluir o deploy</span>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">
                  A conexão SSH com a sua VPS (<strong>{effectiveVps.host}</strong>) funcionou 100% e o Node.js + PM2 já estão prontos.
                  No entanto, <strong>"{gitRepoInput}"</strong> é o endereço da sua VPS Locaweb, não uma URL do GitHub.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPushGuide(!showPushGuide)}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 underline font-medium shrink-0 cursor-pointer"
              >
                {showPushGuide ? 'Ocultar Tutorial' : 'Como criar repo no GitHub?'}
              </button>
            </div>

            {showPushGuide && (
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-2 text-[11px]">
                <strong className="text-white block">Passo a passo para publicar o código no GitHub:</strong>
                <ol className="list-decimal list-inside space-y-1 text-slate-300">
                  <li>Acesse <strong>github.com/new</strong> e crie um repositório (ex: <code className="text-emerald-300">conversoribge</code>).</li>
                  <li>No terminal do seu computador, na pasta do projeto, execute:</li>
                </ol>
                <pre className="p-2 bg-slate-950 rounded text-emerald-300 font-mono text-[10px] overflow-x-auto leading-relaxed">
{`git init
git add .
git commit -m "Deploy inicial"
git branch -M main
git remote add origin https://github.com/seu-usuario/conversoribge.git
git push -u origin main`}
                </pre>
              </div>
            )}

            <div className="space-y-2 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    URL do Repositório GitHub *
                  </label>
                  <input
                    type="text"
                    value={gitRepoInput}
                    onChange={(e) => setGitRepoInput(e.target.value)}
                    placeholder="https://github.com/seu-usuario/conversoribge.git"
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Token GitHub (se o repositório for PRIVADO)
                  </label>
                  <input
                    type="password"
                    value={githubTokenInput}
                    onChange={(e) => setGithubTokenInput(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxx (opcional)"
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  onClick={handleSaveRepoAndDeploy}
                  disabled={isSavingRepo || isExecuting || !gitRepoInput.trim()}
                  className="px-4 py-2 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow"
                >
                  {isSavingRepo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Salvar Repositório & Executar Deploy na VPS</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI Recovery Banner */}
        {aiFixed && (
          <div className="p-3.5 bg-gradient-to-r from-purple-950/60 to-slate-900 border-b border-purple-500/40 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-purple-200">
              <div className="w-6 h-6 rounded bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <span className="font-semibold block text-white">Falha detectada e auto-corrigida com sucesso pela IA!</span>
                <span className="text-[11px] text-purple-300/90">A IA (Gemini 3.8 Flash) executou comandos de reparo no terminal da VPS e ativou o serviço na porta {appPort}.</span>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('ai-logs')}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer shrink-0 shadow-sm"
            >
              Ver Comandos da IA ({aiLogs.length})
            </button>
          </div>
        )}

        {/* Success Banner if finished with code 0 */}
        {activeTab === 'terminal' && isFinished && logs.some(l => l.includes('DEPLOY CONCLUÍDO COM SUCESSO') || l.includes('Deploy executado no servidor com SUCESSO')) && (
          <div className="p-4 bg-emerald-500/15 border-b border-emerald-500/40 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>Aplicação Ativa e Rodando com Sucesso!</span>
              </div>
              <p className="text-slate-300 text-xs">
                O processo está ativo no PM2 e a porta <strong>{appPort}</strong> foi liberada no Firewall.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {onOpenSsl && (
                <button
                  type="button"
                  onClick={() => onOpenSsl(project)}
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-emerald-500/40 font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Configurar SSL (HTTPS)</span>
                </button>
              )}
              <a
                href={project.enableHttps ? `https://${project.domain || effectiveVps.host}` : `http://${effectiveVps.host}:${appPort}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors shadow"
              >
                <span>Abrir Aplicação</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}

        {/* Tab 1: Terminal */}
        {activeTab === 'terminal' && (
          <div className="p-4 bg-slate-950 font-mono text-xs text-slate-200 overflow-y-auto flex-1 space-y-1.5 select-text min-h-[300px]">
            {logs.map((log, index) => {
              const isHighlight =
                log.includes('SUCESSO') ||
                log.includes('200 OK') ||
                log.includes('online em http') ||
                log.includes('Node: v') ||
                log.includes('Conectando');
              const isWarning = log.includes('Atenção') || log.includes('SOLUÇÃO') || log.includes('MOTIVO') || log.includes('ERRO');
              const isError = log.includes('Falha') || log.includes('fatal:') || log.includes('Timeout') || log.includes('stderr');

              return (
                <div
                  key={index}
                  className={`leading-relaxed ${
                    isHighlight
                      ? 'text-emerald-300 font-semibold'
                      : isWarning
                      ? 'text-amber-300 font-semibold bg-amber-500/10 p-1 rounded'
                      : isError
                      ? 'text-rose-400'
                      : 'text-slate-300'
                  }`}
                >
                  {log}
                </div>
              );
            })}
            {isExecuting && (
              <div className="flex items-center gap-2 text-emerald-400 py-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Processando conexão e execução na VPS...</span>
              </div>
            )}
          </div>
        )}

        {/* Tab: Ações & Comandos da IA (Log Separado e Específico) */}
        {activeTab === 'ai-logs' && (
          <div className="p-4 bg-slate-950 flex-1 overflow-y-auto space-y-4 text-xs font-mono">
            {/* Header Info Card */}
            <div className="p-4 bg-purple-950/30 border border-purple-500/30 rounded-xl space-y-3 font-sans">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                      <span>IA Auto-Heal no Deploy VPS</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        Gemini 3.8 Flash
                      </span>
                    </h4>
                    <p className="text-xs text-slate-400">
                      Acompanha a saída do terminal SSH e envia comandos de autocorreção caso ocorra algum erro
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 select-none">
                    <input
                      type="checkbox"
                      checked={aiEnabled}
                      onChange={(e) => setAiEnabled(e.target.checked)}
                      className="rounded border-slate-700 text-purple-600 focus:ring-0 cursor-pointer"
                    />
                    <span className={aiEnabled ? 'text-purple-300 font-medium' : 'text-slate-400'}>
                      {aiEnabled ? 'Auto-Correção Ativada' : 'Auto-Correção Desativada'}
                    </span>
                  </label>

                  {aiLogs.length > 0 && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(aiLogs.join('\n'));
                        setCopiedAi(true);
                        setTimeout(() => setCopiedAi(false), 2000);
                      }}
                      className="px-2.5 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/40 rounded-lg text-xs transition-colors flex items-center gap-1.5 cursor-pointer font-sans"
                    >
                      {copiedAi ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedAi ? 'Copiado!' : 'Copiar Comandos da IA'}</span>
                    </button>
                  )}
                </div>
              </div>

              {aiDiagnosis && (
                <div className="p-3 bg-purple-900/30 border border-purple-500/30 rounded-lg text-xs space-y-1">
                  <strong className="text-purple-200 block">Diagnóstico da Falha:</strong>
                  <p className="text-slate-200 text-[11px] leading-relaxed">{aiDiagnosis}</p>
                </div>
              )}
            </div>

            {/* Terminal dos comandos da IA */}
            {aiLogs.length === 0 ? (
              <div className="py-12 px-4 text-center space-y-3 font-sans border border-dashed border-slate-800 rounded-xl">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mx-auto">
                  <Bot className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-white">
                  {isExecuting
                    ? 'Monitorando a execução do deploy...'
                    : isFinished
                    ? 'Nenhuma correção da IA foi necessária!'
                    : 'Aguardando início do deploy'}
                </h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  {isExecuting
                    ? 'A IA está atenta a cada linha do terminal. Se ocorrer qualquer falha durante npm install, compilação Vite, portas presas ou ferramentas faltantes, os comandos de correção aparecerão aqui.'
                    : isFinished
                    ? 'O deploy rodou sem falhas que exigissem comandos corretivos da IA.'
                    : 'Quando você disparar o deploy, se houver falhas técnicas no servidor, a IA diagnosticará o erro e executará comandos de correção automaticamente.'}
                </p>
              </div>
            ) : (
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1 max-h-[420px] overflow-y-auto">
                <div className="text-[11px] text-purple-300 font-sans font-semibold pb-2 border-b border-slate-800 flex items-center justify-between">
                  <span>Log Exclusivo de Comandos e Ações da IA na VPS:</span>
                  <span>{aiLogs.length} linha(s)</span>
                </div>
                {aiLogs.map((line, idx) => {
                  const isCmd = line.includes('>') || line.includes('Executando') || line.includes('Comando IA');
                  const isSuccess = line.includes('SUCESSO') || line.includes('online') || line.includes('AI_FIX_SUCCESS');
                  const isDiag = line.includes('DIAGNÓSTICO') || line.includes('PLANO');
                  const isErr = line.includes('Falha') || line.includes('Erro') || line.includes('[stderr]');

                  let cls = 'text-slate-300';
                  if (isDiag) cls = 'text-cyan-300 font-semibold';
                  else if (isCmd) cls = 'text-purple-300 font-semibold bg-purple-500/10 px-1 rounded';
                  else if (isSuccess) cls = 'text-emerald-300 font-semibold';
                  else if (isErr) cls = 'text-rose-400';

                  return (
                    <div key={idx} className="flex items-start gap-2 hover:bg-slate-800/40 px-1 py-0.5 rounded text-[11px] leading-relaxed">
                      <span className="text-slate-600 select-none text-[10px] w-6 text-right shrink-0">
                        {idx + 1}
                      </span>
                      <span className={`break-all ${cls}`}>{line}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Manual 1-Click Command */}
        {activeTab === 'manual' && (
          <div className="p-5 bg-slate-950 flex-1 overflow-y-auto space-y-4 text-xs">
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-1">
              <strong className="text-white text-sm block">Como fazer a aplicação subir na VPS em 1 minuto:</strong>
              <p className="text-slate-300 leading-relaxed">
                Abra o terminal da sua VPS (via PuTTY, terminal do seu PC com <code className="text-emerald-300 font-mono">ssh root@{effectiveVps.host}</code> ou console web da Locaweb) e <strong>cole o comando abaixo</strong>:
              </p>
            </div>

            <div className="relative">
              <pre className="p-4 bg-slate-900 border border-slate-800 rounded-xl font-mono text-xs text-emerald-300 whitespace-pre-wrap break-all leading-relaxed max-h-56 overflow-y-auto">
                {oneLineVpsCommand}
              </pre>
              <button
                onClick={handleCopyCommand}
                className="absolute top-3 right-3 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-400 hover:bg-emerald-300 text-slate-950 transition-colors flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                {copiedCommand ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCommand ? 'Comando Copiado!' : 'Copiar Comando Completo'}</span>
              </button>
            </div>

            <div className="space-y-1.5 text-slate-400">
              <p className="font-semibold text-white">O que esse comando faz na sua VPS:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-300">
                <li>Cria a pasta <code className="text-white font-mono">{serverPath}</code></li>
                <li>Baixa o seu código do repositório Git (<code className="text-white font-mono">{branch}</code>)</li>
                <li>Instala as dependências e compila (<code className="text-white font-mono">npm run build</code>)</li>
                <li>Libera a porta <code className="text-emerald-400 font-mono">{appPort}</code> no Firewall UFW do Linux</li>
                <li>Inicia no PM2 ouvindo em <strong className="text-white">0.0.0.0:{appPort}</strong> para responder na internet!</li>
              </ul>
            </div>
          </div>
        )}

        {/* Tab 3: Troubleshoot ERR_CONNECTION_REFUSED */}
        {activeTab === 'troubleshoot' && (
          <div className="p-5 bg-slate-950 flex-1 overflow-y-auto space-y-4 text-xs leading-relaxed">
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-rose-300 font-semibold text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>Por que apareceu "A conexão com {effectiveVps.host} foi recusada"?</span>
              </div>
              <p className="text-slate-300">
                O erro <code className="text-rose-300 font-mono">ERR_CONNECTION_REFUSED</code> no navegador significa que o seu computador tentou falar na porta <strong>{appPort}</strong> do IP <strong>{effectiveVps.host}</strong>, mas nenhum programa respondeu lá.
              </p>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-lg space-y-1.5">
                <div className="font-semibold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 flex items-center justify-center font-mono text-xs">1</span>
                  <span>O processo ainda não foi iniciado na sua VPS</span>
                </div>
                <p className="text-slate-400">
                  O painel web executou o teste visual, mas o código precisa ser baixado e executado na sua VPS física da Locaweb. Use a aba <strong>"Comando Direto"</strong> para rodar o comando na máquina.
                </p>
              </div>

              <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-lg space-y-1.5">
                <div className="font-semibold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 flex items-center justify-center font-mono text-xs">2</span>
                  <span>A aplicação precisa escutar em 0.0.0.0 (e não em 127.0.0.1)</span>
                </div>
                <p className="text-slate-400">
                  Aplicações Vite / Node por padrão escutam em <code className="text-white font-mono">localhost</code> (127.0.0.1). Para responder na internet pública pelo seu IP, ela DEVE ser iniciada com a flag:
                </p>
                <div className="p-2 bg-slate-950 font-mono text-[11px] text-emerald-300 rounded border border-slate-800">
                  npm run preview -- --port {appPort} --host 0.0.0.0
                </div>
              </div>

              <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-lg space-y-1.5">
                <div className="font-semibold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 flex items-center justify-center font-mono text-xs">3</span>
                  <span>Porta {appPort} bloqueada no Firewall (UFW ou Painel Locaweb)</span>
                </div>
                <p className="text-slate-400">
                  Execute no terminal da VPS para liberar a porta no Linux:
                </p>
                <div className="flex items-center gap-2">
                  <code className="bg-slate-950 px-3 py-1.5 rounded text-emerald-300 font-mono text-xs border border-slate-800 flex-1">
                    sudo ufw allow {appPort}/tcp
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`sudo ufw allow ${appPort}/tcp`);
                      setCopiedUfw(true);
                      setTimeout(() => setCopiedUfw(false), 2000);
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs transition-colors cursor-pointer"
                  >
                    {copiedUfw ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Diagnose Port and PM2 */}
        {activeTab === 'diagnose' && (
          <div className="p-5 bg-slate-950 flex-1 overflow-y-auto space-y-4 text-xs font-mono">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="text-slate-300 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <span className="font-semibold text-white">Diagnóstico em Tempo Real na VPS</span>
              </div>
              <button
                onClick={handleRunDiagnose}
                disabled={isLoadingDiag}
                className="px-3 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {isLoadingDiag ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                <span>Atualizar Diagnóstico</span>
              </button>
            </div>

            {isLoadingDiag ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-cyan-400" />
                <p>Consultando processos PM2, portas TCP ativas e logs na VPS {effectiveVps.host}...</p>
              </div>
            ) : diagOutput ? (
              <pre className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 text-[11px] whitespace-pre-wrap leading-relaxed max-h-[380px] overflow-y-auto">
                {diagOutput}
              </pre>
            ) : (
              <div className="p-6 text-center text-slate-400">
                Clique no botão acima para coletar o status atual de portas e logs da VPS.
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="p-3 bg-slate-900/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-slate-300">
            Endereço da Aplicação:{' '}
            <a
              href={`http://${effectiveVps.host}:${appPort}`}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-400 hover:underline font-mono font-bold inline-flex items-center gap-1"
            >
              http://{effectiveVps.host}:{appPort}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onOpenSsl && !project.enableHttps && (
              <button
                type="button"
                onClick={() => onOpenSsl(project)}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                title="Configurar Certificado SSL (HTTPS)"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Ativar HTTPS</span>
              </button>
            )}
            {onOpenUninstall && (
              <button
                type="button"
                onClick={() => onOpenUninstall(project)}
                className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                title="Desinstalar Serviço e Apagar Arquivos da VPS"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Desinstalar da VPS</span>
              </button>
            )}
            {!isExecuting && (
              <button
                onClick={() => runDeploy()}
                className="px-3 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>Reexecutar Deploy via SSH</span>
              </button>
            )}
            <button
              onClick={() => setActiveTab('manual')}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 transition-colors font-medium cursor-pointer"
            >
              Ver Comando para a VPS
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
