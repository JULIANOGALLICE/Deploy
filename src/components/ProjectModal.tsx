import React, { useState, useEffect } from 'react';
import { X, GitBranch, Folder, Radio, Plus, Trash2, Globe, Cpu, Bot, Sparkles } from 'lucide-react';
import { DeploymentProject, EnvVariable, RuntimeType, VpsServer } from '../types/deploy';
import { getProjectServer } from '../utils/serverMatcher';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (project: DeploymentProject) => Promise<void> | void;
  servers: VpsServer[];
  existingProjects: DeploymentProject[];
  projectToEdit?: DeploymentProject | null;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  onSave,
  servers,
  existingProjects,
  projectToEdit,
}) => {
  const [name, setName] = useState(projectToEdit?.name || '');
  const [gitRepoUrl, setGitRepoUrl] = useState(projectToEdit?.gitRepoUrl || '');
  const [branch, setBranch] = useState(projectToEdit?.branch || 'main');
  const [vpsId, setVpsId] = useState(
    getProjectServer(projectToEdit, servers)?.id || servers[0]?.id || 'vps-default'
  );
  const [appPort, setAppPort] = useState(projectToEdit?.appPort || 3000);
  const [serverPath, setServerPath] = useState(projectToEdit?.serverPath || '');
  const [runtime, setRuntime] = useState<RuntimeType>(projectToEdit?.runtime || 'node-pm2');
  const [buildCommand, setBuildCommand] = useState(projectToEdit?.buildCommand || 'npm run build');
  const [startCommand, setStartCommand] = useState(
    projectToEdit?.startCommand || 'npm run preview -- --port 3000 --host 0.0.0.0'
  );
  const [domain, setDomain] = useState(projectToEdit?.domain || '');
  const [enableHttps, setEnableHttps] = useState(projectToEdit?.enableHttps ?? true);
  const [autoDeployOnPush, setAutoDeployOnPush] = useState(projectToEdit?.autoDeployOnPush ?? true);
  const [enableAiAutoFix, setEnableAiAutoFix] = useState(projectToEdit?.enableAiAutoFix ?? true);
  const [githubToken, setGithubToken] = useState(projectToEdit?.githubToken || '');
  const [showGitHelp, setShowGitHelp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [envVariables, setEnvVariables] = useState<EnvVariable[]>(
    projectToEdit?.envVariables || [
      { key: 'NODE_ENV', value: 'production', isSecret: false },
      { key: 'PORT', value: '3000', isSecret: false },
    ]
  );

  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvVal, setNewEnvVal] = useState('');

  // Synchronize state whenever modal opens or projectToEdit changes
  useEffect(() => {
    if (projectToEdit) {
      setName(projectToEdit.name || '');
      setGitRepoUrl(projectToEdit.gitRepoUrl || '');
      setBranch(projectToEdit.branch || 'main');
      const resolvedServer = getProjectServer(projectToEdit, servers);
      setVpsId(resolvedServer?.id || servers[0]?.id || 'vps-default');
      setAppPort(projectToEdit.appPort || 3000);
      setServerPath(projectToEdit.serverPath || '');
      setRuntime(projectToEdit.runtime || 'node-pm2');
      setBuildCommand(projectToEdit.buildCommand || 'npm run build');
      setStartCommand(projectToEdit.startCommand || `npm run preview -- --port ${projectToEdit.appPort || 3000}`);
      setDomain(projectToEdit.domain || '');
      setEnableHttps(projectToEdit.enableHttps ?? true);
      setAutoDeployOnPush(projectToEdit.autoDeployOnPush ?? true);
      setEnableAiAutoFix(projectToEdit.enableAiAutoFix ?? true);
      setGithubToken(projectToEdit.githubToken || '');
      setEnvVariables(
        projectToEdit.envVariables && projectToEdit.envVariables.length > 0
          ? projectToEdit.envVariables
          : [
              { key: 'NODE_ENV', value: 'production', isSecret: false },
              { key: 'PORT', value: String(projectToEdit.appPort || 3000), isSecret: false },
            ]
      );
    } else {
      setName('');
      setGitRepoUrl('');
      setBranch('main');
      setVpsId(servers[0]?.id || 'vps-default');
      // Default to next available port (e.g. 3000, 3001, 3002...)
      const occupiedPorts = existingProjects.map((p) => p.appPort);
      let nextPort = 3000;
      while (occupiedPorts.includes(nextPort)) {
        nextPort += 1;
      }
      setAppPort(nextPort);
      setServerPath('');
      setRuntime('node-pm2');
      setBuildCommand('npm run build');
      setStartCommand(`npm run preview -- --port ${nextPort} --host 0.0.0.0`);
      setDomain('');
      setEnableHttps(true);
      setAutoDeployOnPush(true);
      setEnableAiAutoFix(true);
      setGithubToken('');
      setEnvVariables([
        { key: 'NODE_ENV', value: 'production', isSecret: false },
        { key: 'PORT', value: String(nextPort), isSecret: false },
      ]);
    }
    setErrorMsg(null);
  }, [projectToEdit, isOpen, servers]);

  if (!isOpen) return null;

  const handleNameChange = (val: string) => {
    setName(val);
    const slug = val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!projectToEdit) {
      setServerPath(`/var/www/${slug || 'app'}`);
    }
  };

  const handlePortChange = (port: number) => {
    setAppPort(port);
    // Update start command port if applicable
    if (startCommand.includes('--port')) {
      setStartCommand(startCommand.replace(/--port \d+/, `--port ${port}`));
    }
    // Update env var PORT
    setEnvVariables(prev =>
      prev.map(ev => (ev.key === 'PORT' ? { ...ev, value: String(port) } : ev))
    );
  };

  const addEnvVariable = () => {
    if (!newEnvKey.trim()) return;
    setEnvVariables([...envVariables, { key: newEnvKey.trim().toUpperCase(), value: newEnvVal.trim(), isSecret: false }]);
    setNewEnvKey('');
    setNewEnvVal('');
  };

  const removeEnvVariable = (index: number) => {
    setEnvVariables(envVariables.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !gitRepoUrl.trim()) return;

    let cleanRepoUrl = gitRepoUrl.trim();
    if (cleanRepoUrl.startsWith('github.com/')) {
      cleanRepoUrl = `https://${cleanRepoUrl}`;
    }

    const isValidGit =
      cleanRepoUrl.startsWith('https://') ||
      cleanRepoUrl.startsWith('http://') ||
      cleanRepoUrl.startsWith('git@');

    const isHostName =
      cleanRepoUrl.includes('publiccloud.com.br') ||
      cleanRepoUrl.includes('locaweb') ||
      /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(cleanRepoUrl);

    if (!isValidGit || isHostName) {
      setErrorMsg(
        isHostName
          ? `O endereço digitado (${cleanRepoUrl}) é o host/domínio da VPS da Locaweb! Você precisa informar a URL do GitHub onde o código do projeto está hospedado (ex: https://github.com/usuario/conversoribge.git).`
          : 'A URL do repositório deve começar com https:// (ex: https://github.com/usuario/projeto.git).'
      );
      return;
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const randomSecret = 'whsec_' + Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const newProject: DeploymentProject = {
        id: projectToEdit?.id || `proj-${Date.now()}`,
        vpsId: vpsId || servers[0]?.id || 'vps-default',
        name: name.trim(),
        slug: projectToEdit?.slug || slug || 'app-service',
        gitRepoUrl: cleanRepoUrl,
        branch: branch.trim() || 'main',
        serverPath: serverPath.trim() || `/var/www/${slug}`,
        appPort: Number(appPort) || 3000,
        runtime,
        buildCommand: buildCommand.trim() || 'npm run build',
        startCommand: startCommand.trim() || `npm run preview -- --port ${appPort}`,
        domain: domain.trim() || '',
        enableHttps,
        webhookSecret: projectToEdit?.webhookSecret || randomSecret,
        autoDeployOnPush,
        enableAiAutoFix,
        githubToken: githubToken.trim() || '',
        envVariables,
        status: projectToEdit?.status || 'running',
        commitHash: projectToEdit?.commitHash || '',
        commitMessage: projectToEdit?.commitMessage || '',
        lastDeployedAt: projectToEdit?.lastDeployedAt || '',
      };

      await onSave(newProject);
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro ao salvar aplicação no Firebase. Verifique a conexão.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if port is already taken on this VPS
  const isPortConflict = existingProjects.some(
    p => p.vpsId === vpsId && p.appPort === Number(appPort) && p.id !== projectToEdit?.id
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden my-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-semibold text-white">
              {projectToEdit ? 'Editar Aplicação Git' : 'Cadastrar Aplicação para Deploy Contínuo'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-lg text-xs text-rose-300 flex items-start gap-2">
              <span className="font-bold">⚠️</span>
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {/* Nome e VPS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Nome da Aplicação *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ex: Meu App AI Studio"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Servidor VPS de Destino *
              </label>
              <select
                value={vpsId}
                onChange={(e) => setVpsId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                {servers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.host})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Repositório Git e Branch */}
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-300">
                    URL do Repositório Git (GitHub) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowGitHelp(!showGitHelp)}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
                  >
                    {showGitHelp ? 'Ocultar passo a passo' : 'Como criar repositório no GitHub?'}
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={gitRepoUrl}
                  onChange={(e) => setGitRepoUrl(e.target.value)}
                  placeholder="https://github.com/seu-usuario/conversoribge.git"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Branch Principal
                </label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Aviso específico se o usuário digitou o hostname ou IP da VPS */}
            {(gitRepoUrl.includes('publiccloud.com.br') ||
              gitRepoUrl.includes('locaweb') ||
              /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(gitRepoUrl)) && (
              <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-lg text-xs space-y-1">
                <div className="text-amber-300 font-semibold flex items-center gap-1.5">
                  <span>⚠️</span>
                  <span>Atenção: Você digitou o endereço da VPS Locaweb ({gitRepoUrl})!</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Para o deploy funcionar, a VPS precisa saber de <strong>onde baixar o código</strong>. O endereço do repositório deve ser a URL do seu GitHub (ex: <code className="text-white font-mono bg-slate-900 px-1 py-0.5 rounded">https://github.com/julianogallice/conversoribge.git</code>).
                </p>
              </div>
            )}

            {/* Guia Rápido de como enviar do AI Studio para o GitHub */}
            {showGitHelp && (
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs">
                <div className="font-semibold text-emerald-400">
                  Como colocar o projeto do AI Studio no GitHub:
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[11px] leading-relaxed">
                  <li>Crie um novo repositório vazio no GitHub em <strong>github.com/new</strong> (pode ser público ou privado).</li>
                  <li>Baixe os arquivos do projeto ou abra a pasta no terminal do seu computador.</li>
                  <li>Execute os comandos abaixo para enviar o código para o GitHub:</li>
                </ol>
                <pre className="p-2.5 bg-slate-900 rounded-lg text-emerald-300 font-mono text-[10px] overflow-x-auto leading-relaxed">
{`git init
git add .
git commit -m "Deploy inicial"
git branch -M main
git remote add origin https://github.com/seu-usuario/seu-repositorio.git
git push -u origin main`}
                </pre>
                <div className="text-[11px] text-slate-400">
                  Depois cole o link gerado acima no campo <strong>URL do Repositório Git</strong>.
                </div>
              </div>
            )}

            {/* Token do GitHub opcional (Repositórios Privados) */}
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Token do GitHub (Personal Access Token) — <span className="text-slate-500">Opcional, somente se o repositório for PRIVADO</span>
              </label>
              <input
                type="password"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx (deixe em branco se for repositório público)"
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* SELEÇÃO DE PORTA (DESTAQUE PARA O PEDIDO DO USUÁRIO) */}
          <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  Porta em que a Aplicação vai rodar (Internal Port) *
                </label>
                <p className="text-[11px] text-slate-400">
                  Cada aplicação na VPS precisa de uma porta única (ex: 3000, 3001, 8080).
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {[3000, 3001, 8080, 5000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handlePortChange(preset)}
                    className={`text-[11px] px-2 py-0.5 rounded font-mono transition-colors cursor-pointer ${
                      appPort === preset
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    :{preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="number"
                required
                min={1024}
                max={65535}
                value={appPort}
                onChange={(e) => handlePortChange(Number(e.target.value))}
                className="w-36 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
              />
              {isPortConflict && (
                <div className="text-xs text-rose-400 font-medium">
                  ⚠️ Atenção: A porta {appPort} já está sendo utilizada por outra aplicação nesta VPS!
                </div>
              )}
              {!isPortConflict && (
                <div className="text-xs text-emerald-400">
                  ✓ Porta {appPort} disponível nesta VPS
                </div>
              )}
            </div>
          </div>

          {/* Runtime & Diretório */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Modo de Execução (Runtime)
              </label>
              <select
                value={runtime}
                onChange={(e) => setRuntime(e.target.value as RuntimeType)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="node-pm2">Node.js + PM2 (Recomendado para React/Vite/Express)</option>
                <option value="docker">Docker & Docker Compose</option>
                <option value="nginx-static">Nginx Servindo Estático (/dist)</option>
                <option value="systemd">Serviço Linux Systemd Nativo</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Caminho da Pasta no Servidor
              </label>
              <input
                type="text"
                value={serverPath}
                onChange={(e) => setServerPath(e.target.value)}
                placeholder="/var/www/meu-app"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Comandos de Build e Start */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Comando de Build
              </label>
              <input
                type="text"
                value={buildCommand}
                onChange={(e) => setBuildCommand(e.target.value)}
                placeholder="npm run build"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Comando de Inicialização (Start)
              </label>
              <input
                type="text"
                value={startCommand}
                onChange={(e) => setStartCommand(e.target.value)}
                placeholder="npm run preview -- --port 3000"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Domínio e Proxy Reverso */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Domínio Público (Opcional - Nginx)
              </label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="Ex: app.meusite.com.br"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={autoDeployOnPush}
                  onChange={(e) => setAutoDeployOnPush(e.target.checked)}
                  className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                />
                <span>Deploy automático a cada Push no GitHub (CI/CD)</span>
              </label>
            </div>
          </div>

          {/* Autocorreção Inteligente com IA (AI Self-Healing) */}
          <div className="p-3.5 bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-950 border border-purple-500/35 rounded-xl space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-white">
                    <span>Inteligência Artificial no Deploy (AI Self-Healing)</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/25 text-purple-200 border border-purple-500/40">
                      Gemini 3.8 Flash
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Acompanha o terminal em tempo real e corrige automaticamente erros na VPS
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={enableAiAutoFix}
                  onChange={(e) => setEnableAiAutoFix(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed border-t border-purple-900/40 pt-2">
              💡 <strong>Como funciona:</strong> Se ocorrer qualquer falha durante compilação Vite/Rollup, pacotes faltando (<code className="text-purple-300">react-is</code>, <code className="text-purple-300">make</code>), conflitos de <code className="text-purple-300">npm peer dependencies</code> ou porta ocupada (<code className="text-purple-300">fuser</code>), a IA diagnostica o terminal e executa comandos específicos de reparo direto no servidor, mantendo um <strong>log separado auditável</strong> de todas as correções.
            </p>
          </div>

          {/* Variáveis de Ambiente (.env) */}
          <div className="pt-2 border-t border-slate-800">
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Variáveis de Ambiente (.env da Produção)
            </label>
            <div className="space-y-2 mb-2">
              {envVariables.map((ev, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={ev.key}
                    readOnly
                    className="w-1/3 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-slate-300 font-mono"
                  />
                  <input
                    type="text"
                    value={ev.value}
                    onChange={(e) => {
                      const updated = [...envVariables];
                      updated[idx].value = e.target.value;
                      setEnvVariables(updated);
                    }}
                    className="flex-1 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => removeEnvVariable(idx)}
                    className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="CHAVE (ex: API_KEY)"
                value={newEnvKey}
                onChange={(e) => setNewEnvKey(e.target.value)}
                className="w-1/3 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
              <input
                type="text"
                placeholder="VALOR"
                value={newEnvVal}
                onChange={(e) => setNewEnvVal(e.target.value)}
                className="flex-1 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={addEnvVariable}
                className="px-2.5 py-1 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded transition-colors"
              >
                + Add
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-lg text-xs text-rose-300">
              {errorMsg}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3 h-3 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                  <span>Salvando no Firebase...</span>
                </>
              ) : (
                <span>{projectToEdit ? 'Atualizar no Firebase' : 'Salvar no Firebase & Gerar CI/CD'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
