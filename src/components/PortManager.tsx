import React, { useState } from 'react';
import { Shield, Server, CheckCircle2, AlertTriangle, ArrowRight, Zap, Copy, Check } from 'lucide-react';
import { DeploymentProject, VpsServer } from '../types/deploy';
import { getServerProjects } from '../utils/serverMatcher';

interface PortManagerProps {
  servers: VpsServer[];
  projects: DeploymentProject[];
  onSelectProject: (projectId: string) => void;
}

export const PortManager: React.FC<PortManagerProps> = ({
  servers,
  projects,
  onSelectProject,
}) => {
  const [selectedServerId, setSelectedServerId] = useState<string>(servers[0]?.id || '');
  const [copiedPort, setCopiedPort] = useState<number | null>(null);

  const selectedServer = servers.find((s) => s.id === selectedServerId) || servers[0];
  const serverProjects = getServerProjects(selectedServer, projects, servers);

  // Default system ports + app ports
  const systemPorts = [
    { port: selectedServer?.sshPort || 22, name: 'SSH Server', service: 'OpenSSH Daemon', type: 'system' as const },
    { port: 80, name: 'HTTP Web Server', service: 'Nginx / Certbot', type: 'system' as const },
    { port: 443, name: 'HTTPS Seguro (SSL)', service: 'Nginx (Let\'s Encrypt)', type: 'system' as const },
  ];

  const appPortMap = serverProjects.map((p) => ({
    port: p.appPort,
    name: p.name,
    service: `${p.runtime === 'docker' ? 'Docker Container' : 'PM2 Node.js'} (${p.slug})`,
    domain: p.domain,
    type: 'app' as const,
    projectId: p.id,
  }));

  // Detect collisions
  const portCounts: Record<number, number> = {};
  serverProjects.forEach((p) => {
    portCounts[p.appPort] = (portCounts[p.appPort] || 0) + 1;
  });

  const conflicts = Object.keys(portCounts)
    .filter((port) => portCounts[Number(port)] > 1)
    .map(Number);

  // Suggested free ports
  const occupiedPorts = new Set([...systemPorts.map((sp) => sp.port), ...appPortMap.map((ap) => ap.port)]);
  const suggestedPorts = [3000, 3001, 3002, 4000, 5000, 8000, 8080, 8081, 9000].filter(
    (port) => !occupiedPorts.has(port)
  );

  const handleCopyUfw = (port: number) => {
    navigator.clipboard.writeText(`sudo ufw allow ${port}/tcp`);
    setCopiedPort(port);
    setTimeout(() => setCopiedPort(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Gerenciamento e Mapa de Portas na VPS</h2>
          <p className="text-xs text-slate-400">
            Controle em qual porta cada projeto vai funcionar, detecte conflitos e gere regras de firewall UFW.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Servidor VPS:</label>
          <select
            value={selectedServer?.id}
            onChange={(e) => setSelectedServerId(e.target.value)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-semibold text-white focus:outline-none focus:border-emerald-500"
          >
            {servers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.host})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Conflict Warning if any */}
      {conflicts.length > 0 && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <div className="font-semibold text-rose-300">
              Conflito Detectado: Portas duplicadas no servidor {selectedServer?.name}!
            </div>
            <p className="text-rose-200/80">
              As portas <strong className="text-white font-mono">{conflicts.join(', ')}</strong> estão alocadas para mais de uma aplicação simultaneamente. Apenas um processo conseguirá escutar na porta. Edite a aplicação para atribuir uma porta diferente.
            </p>
          </div>
        </div>
      )}

      {/* Recommended Available Ports */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-emerald-400" />
          <span className="text-slate-300 font-medium">Portas livres sugeridas para novas aplicações:</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {suggestedPorts.slice(0, 5).map((port) => (
            <span
              key={port}
              className="px-2.5 py-1 rounded bg-slate-800 text-emerald-300 font-mono text-xs border border-slate-700/80"
            >
              :{port}
            </span>
          ))}
        </div>
      </div>

      {/* Interactive Port Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* System Ports */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-400" />
              Portas Essenciais do Sistema
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">3 reservadas</span>
          </div>

          <div className="space-y-2.5">
            {systemPorts.map((sp) => (
              <div
                key={sp.port}
                className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-lg flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="font-mono font-bold text-white bg-slate-800 px-2 py-1 rounded">
                    :{sp.port}
                  </div>
                  <div>
                    <div className="text-slate-200 font-medium">{sp.name}</div>
                    <div className="text-slate-500 text-[11px] font-mono">{sp.service}</div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-emerald-400 font-medium">Liberada no UFW</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Applications Ports */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-400" />
              Portas de Aplicações Git nesta VPS
            </h3>
            <span className="text-[11px] text-emerald-400 font-mono">
              {appPortMap.length} ativas
            </span>
          </div>

          {appPortMap.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 bg-slate-950/40 rounded-lg">
              Nenhuma aplicação Git cadastrada neste servidor ainda.
            </div>
          ) : (
            <div className="space-y-2.5">
              {appPortMap.map((ap) => {
                const hasConflict = conflicts.includes(ap.port);
                return (
                  <div
                    key={ap.projectId}
                    className={`p-3 bg-slate-950/70 border rounded-lg flex items-center justify-between text-xs ${
                      hasConflict ? 'border-rose-500/50 bg-rose-950/10' : 'border-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`font-mono font-bold px-2 py-1 rounded ${
                          hasConflict
                            ? 'text-rose-300 bg-rose-500/20'
                            : 'text-emerald-300 bg-emerald-500/10'
                        }`}
                      >
                        :{ap.port}
                      </div>
                      <div>
                        <div className="text-slate-200 font-medium flex items-center gap-2">
                          <span>{ap.name}</span>
                          {hasConflict && (
                            <span className="text-[10px] text-rose-400 font-bold">
                              [CONFLITO]
                            </span>
                          )}
                        </div>
                        <div className="text-slate-500 text-[11px] font-mono">
                          {ap.domain ? `Nginx -> ${ap.domain}` : `Acesso direto :${ap.port}`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopyUfw(ap.port)}
                        className="px-2 py-1 text-[11px] text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded flex items-center gap-1 cursor-pointer"
                        title="Copiar comando UFW"
                      >
                        {copiedPort === ap.port ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>UFW</span>
                      </button>
                      <button
                        onClick={() => onSelectProject(ap.projectId)}
                        className="text-emerald-400 hover:text-emerald-300 p-1 cursor-pointer"
                        title="Ver aplicação"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* How Port Forwarding & Nginx works explanation */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-3 text-xs leading-relaxed text-slate-300">
        <h4 className="font-semibold text-white text-sm">
          Como funciona a escolha de portas na sua VPS?
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-slate-400">
          <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
            <strong className="text-white block">1. Porta Interna da Aplicação</strong>
            <p>
              Ao configurar <code className="text-emerald-300 font-mono">PORT=3000</code> ou <code className="text-emerald-300 font-mono">PORT=8080</code>, sua aplicação Node/Docker roda escutando nesse número exclusivo dentro da VPS.
            </p>
          </div>
          <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
            <strong className="text-white block">2. Nginx como Proxy Reverso</strong>
            <p>
              O Nginx escuta nas portas públicas 80 (HTTP) e 443 (HTTPS) com certificado SSL. Ele lê o domínio requisitado e repassa os dados internamente para a porta <code className="text-emerald-300 font-mono">localhost:PORTA</code>.
            </p>
          </div>
          <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
            <strong className="text-white block">3. Firewall UFW no Linux</strong>
            <p>
              Se você quiser acessar diretamente pelo IP (<code className="text-slate-300 font-mono">http://IP:PORTA</code>), execute <code className="text-white font-mono">sudo ufw allow PORTA/tcp</code> no servidor para liberar o acesso externo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
