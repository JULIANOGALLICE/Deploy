import React, { useState } from 'react';
import { GitBranch, Terminal, Shield, Copy, Check, ExternalLink, Zap, Globe, RefreshCw, Key } from 'lucide-react';
import { DeploymentProject, VpsServer } from '../types/deploy';
import {
  generateGitHubActionsWorkflow,
  generateWebhookScript,
  generateNginxConfig,
  generateDeployBashScript,
} from '../utils/generators';
import { getProjectServer } from '../utils/serverMatcher';

interface ContinuousDeployTabProps {
  projects: DeploymentProject[];
  servers: VpsServer[];
  selectedProjectId?: string;
  onDeployProject: (project: DeploymentProject) => void;
}

export const ContinuousDeployTab: React.FC<ContinuousDeployTabProps> = ({
  projects,
  servers,
  selectedProjectId,
  onDeployProject,
}) => {
  const [activeProjectId, setActiveProjectId] = useState<string>(
    selectedProjectId || projects[0]?.id || ''
  );
  const [pipelineMode, setPipelineMode] = useState<'github-actions' | 'vps-webhook' | 'nginx' | 'bash'>(
    'github-actions'
  );
  const [copied, setCopied] = useState<string | null>(null);

  const currentProject = projects.find((p) => p.id === activeProjectId) || projects[0];
  const currentServer = getProjectServer(currentProject, servers) || servers[0];

  if (!currentProject || !currentServer) {
    return (
      <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl">
        <p className="text-slate-400 text-sm">
          Cadastre ao menos um servidor VPS e uma aplicação Git para gerar a esteira de CI/CD contínua.
        </p>
      </div>
    );
  }

  const githubActionsCode = generateGitHubActionsWorkflow(currentServer, currentProject);
  const webhookScriptCode = generateWebhookScript(currentServer, currentProject);
  const nginxConfigCode = generateNginxConfig(currentServer, currentProject);
  const bashScriptCode = generateDeployBashScript(currentServer, currentProject);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header & Project Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Pipeline de Deploy Contínuo (CI/CD)</h2>
          <p className="text-xs text-slate-400">
            Configure a sincronização automática entre seu repositório Git e o servidor VPS na porta escolhida.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Aplicação:</label>
          <select
            value={currentProject.id}
            onChange={(e) => setActiveProjectId(e.target.value)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-semibold text-white focus:outline-none focus:border-emerald-500"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (Porta :{p.appPort})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Banner for Current Project */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-white flex items-center gap-2">
              <span>{currentProject.name}</span>
              <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                Porta :{currentProject.appPort}
              </span>
            </div>
            <div className="text-slate-400 font-mono text-[11px]">
              VPS: {currentServer.sshUser}@{currentServer.host} · Branch: {currentProject.branch}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onDeployProject(currentProject)}
            className="px-3 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer"
          >
            Testar Deploy Agora
          </button>
        </div>
      </div>

      {/* Pipeline Mode Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setPipelineMode('github-actions')}
          className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
            pipelineMode === 'github-actions'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'text-slate-400 hover:text-white bg-slate-900'
          }`}
        >
          <GitBranch className="w-3.5 h-3.5" />
          <span>Opção 1: GitHub Actions (Recomendado)</span>
        </button>

        <button
          onClick={() => setPipelineMode('vps-webhook')}
          className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
            pipelineMode === 'vps-webhook'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'text-slate-400 hover:text-white bg-slate-900'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Opção 2: Webhook Nativo na VPS</span>
        </button>

        <button
          onClick={() => setPipelineMode('nginx')}
          className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
            pipelineMode === 'nginx'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'text-slate-400 hover:text-white bg-slate-900'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Opção 3: Nginx Proxy & HTTPS (Porta {currentProject.appPort})</span>
        </button>

        <button
          onClick={() => setPipelineMode('bash')}
          className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
            pipelineMode === 'bash'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'text-slate-400 hover:text-white bg-slate-900'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Opção 4: Script Bash Standalone</span>
        </button>
      </div>

      {/* Content depending on selected mode */}

      {/* 1. GITHUB ACTIONS */}
      {pipelineMode === 'github-actions' && (
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Arquivo: <code className="text-emerald-400">.github/workflows/deploy.yml</code>
                </h3>
                <p className="text-xs text-slate-400">
                  Salve este arquivo dentro do seu repositório Git. Toda vez que você fizer <code className="text-slate-200">git push</code> na branch <code className="text-slate-200">{currentProject.branch}</code>, o GitHub disparará a atualização na VPS automaticamente.
                </p>
              </div>

              <button
                onClick={() => copyToClipboard(githubActionsCode, 'gha')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
              >
                {copied === 'gha' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied === 'gha' ? 'Copiado!' : 'Copiar Workflow YAML'}</span>
              </button>
            </div>

            <div className="bg-slate-950 rounded-lg p-3.5 border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto max-h-80">
              <pre>{githubActionsCode}</pre>
            </div>
          </div>

          {/* GitHub Secrets Guide */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-3">
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <Key className="w-4 h-4 text-emerald-400" />
              Segredos que você deve cadastrar no GitHub (Repository Secrets)
            </h4>
            <p className="text-xs text-slate-400">
              No seu repositório GitHub, acesse <strong>Settings → Secrets and variables → Actions → New repository secret</strong> e adicione as 4 variáveis abaixo:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <div className="font-mono text-emerald-400 font-semibold">VPS_HOST</div>
                <div className="text-slate-400 text-[11px] mt-0.5">
                  Valor: <code className="text-white font-mono">{currentServer.host}</code> (IP do seu servidor)
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <div className="font-mono text-emerald-400 font-semibold">VPS_USER</div>
                <div className="text-slate-400 text-[11px] mt-0.5">
                  Valor: <code className="text-white font-mono">{currentServer.sshUser}</code> (Usuário com permissão na VPS)
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <div className="font-mono text-emerald-400 font-semibold">VPS_PORT</div>
                <div className="text-slate-400 text-[11px] mt-0.5">
                  Valor: <code className="text-white font-mono">{currentServer.sshPort}</code> (Porta SSH, padrão 22)
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <div className="font-mono text-emerald-400 font-semibold">VPS_SSH_KEY</div>
                <div className="text-slate-400 text-[11px] mt-0.5">
                  Valor: Conteúdo completo da sua chave privada (<code className="text-white font-mono">id_ed25519</code> ou <code className="text-white font-mono">id_rsa</code>)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. VPS WEBHOOK */}
      {pipelineMode === 'vps-webhook' && (
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">Servidor Listener de Webhook na VPS</h3>
                <p className="text-xs text-slate-400">
                  Um serviço em Node.js que escuta requisições na porta 9000 e executa o deploy quando o GitHub avisa que houve um push.
                </p>
              </div>

              <button
                onClick={() => copyToClipboard(webhookScriptCode, 'wh-script')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
              >
                {copied === 'wh-script' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied === 'wh-script' ? 'Copiado!' : 'Copiar webhook-server.js'}</span>
              </button>
            </div>

            <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">URL do Webhook para configurar no GitHub:</span>
                <button
                  onClick={() =>
                    copyToClipboard(
                      `http://${currentServer.host}:9000/webhook/deploy-${currentProject.slug}`,
                      'wh-url'
                    )
                  }
                  className="text-emerald-400 hover:underline text-[11px] cursor-pointer"
                >
                  {copied === 'wh-url' ? 'Copiado!' : 'Copiar URL'}
                </button>
              </div>
              <code className="block bg-slate-900 p-2 rounded text-emerald-300 font-mono text-[11px] select-all">
                http://{currentServer.host}:9000/webhook/deploy-{currentProject.slug}
              </code>

              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-400">Secret Token (Segredo HMAC):</span>
                <button
                  onClick={() => copyToClipboard(currentProject.webhookSecret, 'wh-sec')}
                  className="text-emerald-400 hover:underline text-[11px] cursor-pointer"
                >
                  {copied === 'wh-sec' ? 'Copiado!' : 'Copiar Secret'}
                </button>
              </div>
              <code className="block bg-slate-900 p-2 rounded text-slate-300 font-mono text-[11px] select-all">
                {currentProject.webhookSecret}
              </code>
            </div>

            <div className="bg-slate-950 rounded-lg p-3.5 border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto max-h-72">
              <pre>{webhookScriptCode}</pre>
            </div>
          </div>
        </div>
      )}

      {/* 3. NGINX REVERSE PROXY */}
      {pipelineMode === 'nginx' && (
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Mapeamento Nginx (Porta 80/443 → Porta {currentProject.appPort})
                </h3>
                <p className="text-xs text-slate-400">
                  O Nginx recebe o tráfego da internet (domínio) e redireciona internamente para sua aplicação rodando em <code className="text-emerald-400">localhost:{currentProject.appPort}</code>.
                </p>
              </div>

              <button
                onClick={() => copyToClipboard(nginxConfigCode, 'nginx')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
              >
                {copied === 'nginx' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied === 'nginx' ? 'Copiado!' : 'Copiar Config Nginx'}</span>
              </button>
            </div>

            <div className="bg-slate-950 rounded-lg p-3.5 border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto max-h-72">
              <pre>{nginxConfigCode}</pre>
            </div>

            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-slate-300 space-y-1">
              <div className="font-semibold text-emerald-400">Como ativar no Ubuntu / Debian:</div>
              <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-400">
                <li>Salve o arquivo acima em <code className="text-white">/etc/nginx/sites-available/{currentProject.slug}</code></li>
                <li>Ative com: <code className="text-white">sudo ln -s /etc/nginx/sites-available/{currentProject.slug} /etc/nginx/sites-enabled/</code></li>
                <li>Teste a sintaxe: <code className="text-white">sudo nginx -t && sudo systemctl reload nginx</code></li>
                <li>Gere o SSL grátis: <code className="text-white">sudo certbot --nginx -d {currentProject.domain || 'seudominio.com'}</code></li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* 4. BASH SCRIPT */}
      {pipelineMode === 'bash' && (
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Script de Deploy Local (<code className="text-emerald-400">deploy.sh</code>)
                </h3>
                <p className="text-xs text-slate-400">
                  Script shell para rodar diretamente dentro do servidor na pasta do projeto.
                </p>
              </div>

              <button
                onClick={() => copyToClipboard(bashScriptCode, 'bash')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
              >
                {copied === 'bash' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied === 'bash' ? 'Copiado!' : 'Copiar deploy.sh'}</span>
              </button>
            </div>

            <div className="bg-slate-950 rounded-lg p-3.5 border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto max-h-80">
              <pre>{bashScriptCode}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
