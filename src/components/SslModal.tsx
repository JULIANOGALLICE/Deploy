import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Lock, Globe, Mail, Loader2, CheckCircle2, AlertTriangle, ExternalLink, HelpCircle, Terminal, RefreshCw, Copy, Check } from 'lucide-react';
import { DeploymentProject, VpsServer } from '../types/deploy';

interface SslModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: DeploymentProject | null;
  vps: VpsServer | null;
  onSslSuccess?: (updatedProject: DeploymentProject) => void;
}

export const SslModal: React.FC<SslModalProps> = ({
  isOpen,
  onClose,
  project,
  vps,
  onSslSuccess,
}) => {
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

  const vpsHost = (vps?.host || effectiveVps.host || '177.153.67.226').trim();
  const projectSlug = (project?.slug || project?.name || 'app')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, '-');
  const autoNipDomain = `${projectSlug}.${vpsHost}.nip.io`;

  const [domain, setDomain] = useState(autoNipDomain);
  const [email, setEmail] = useState('julianogallice@gmail.com');
  const [certType, setCertType] = useState<'letsencrypt' | 'selfsigned'>('letsencrypt');
  const [isExecuting, setIsExecuting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [copiedIp, setCopiedIp] = useState(false);
  const [showDnsHelp, setShowDnsHelp] = useState(false);

  useEffect(() => {
    if (project) {
      const targetVpsHost = (vps?.host || effectiveVps.host || '177.153.67.226').trim();
      const currentSlug = (project.slug || project.name || 'app')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9_-]/g, '-');
      const expectedAutoNip = `${currentSlug}.${targetVpsHost}.nip.io`;

      // Se o projeto já tem um domínio próprio salvo no banco que não seja um IP puro e nem localhost ou .nip.io sem o slug
      const hasCustomDomain =
        project.domain &&
        project.domain !== targetVpsHost &&
        project.domain !== `${targetVpsHost}.nip.io` &&
        !project.domain.includes('localhost') &&
        project.domain.includes('.');

      if (hasCustomDomain) {
        setDomain(project.domain!);
        if (!/^\d{1,3}\.\d{1,3}/.test(project.domain!) && !project.domain!.includes('.nip.io')) {
          setEmail(`admin@${project.domain!.replace(/^https?:\/\//, '')}`);
        } else {
          setEmail('julianogallice@gmail.com');
        }
      } else {
        // AUTOMATICAMENTE coloca o nome do projeto na frente do nip.io!
        // Exemplo: https://conversoribge.177.153.67.226.nip.io
        setDomain(expectedAutoNip);
        setEmail('julianogallice@gmail.com');
      }

      setCertType('letsencrypt');
      setLogs([]);
      setIsFinished(false);
      setIsSuccess(false);
    }
  }, [project, vps]);

  if (!isOpen || !project) return null;

  const handleCopyIp = () => {
    navigator.clipboard.writeText(effectiveVps.host);
    setCopiedIp(true);
    setTimeout(() => setCopiedIp(false), 2000);
  };

  const cleanDomain = domain.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const isBareIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(cleanDomain);
  const subdomainMatch = cleanDomain.match(/^([a-zA-Z0-9_-]+)\.(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  const isSubdomainOnIp = Boolean(subdomainMatch);

  const handleInstallSsl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cleanDomain) return;

    let targetDomain = cleanDomain;
    // Se o usuário digitou nome.ip (ex: conversoribge.177.153.67.226), adiciona .nip.io automaticamente!
    if (/^([a-zA-Z0-9_-]+)\.(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.test(targetDomain)) {
      targetDomain = `${targetDomain}.nip.io`;
    } else if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(targetDomain) && certType === 'letsencrypt') {
      // Se digitou apenas o IP puro (ex: 177.153.67.226), coloca o nome do projeto na frente do nip.io!
      targetDomain = `${projectSlug}.${targetDomain}.nip.io`;
    }

    setIsExecuting(true);
    setIsFinished(false);
    setIsSuccess(false);
    setLogs([]);

    const pushLog = (msg: string) => {
      const ts = new Date().toLocaleTimeString();
      setLogs((prev) => [...prev, `[${ts}] ${msg}`]);
    };

    const isTargetBareIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(targetDomain);
    const effectiveType = isTargetBareIp && certType === 'letsencrypt' ? 'selfsigned' : certType;

    pushLog(`🔒 Iniciando configuração de SSL para '${targetDomain}'...`);
    pushLog(`📡 Servidor VPS: ${effectiveVps.sshUser}@${effectiveVps.host}:${effectiveVps.sshPort}`);
    pushLog(`🔌 Redirecionando HTTPS (Porta 443) -> Aplicação (Porta ${project.appPort})`);
    pushLog(`🛡️ Tipo de certificado: ${effectiveType === 'letsencrypt' ? "Let's Encrypt (Oficial & Gratuito)" : "Autoassinado OpenSSL"}`);

    try {
      const res = await fetch('/api/setup-ssl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: effectiveVps.host,
          port: effectiveVps.sshPort,
          username: effectiveVps.sshUser,
          authType: effectiveVps.authType,
          passwordOrKey: effectiveVps.sshKeyOrPassword,
          domain: targetDomain,
          email: email.trim() || 'julianogallice@gmail.com',
          appPort: project.appPort,
          slug: project.slug,
          certType: effectiveType,
        }),
      });

      const data = await res.json();

      if (data.logs && Array.isArray(data.logs)) {
        setLogs(data.logs);
      }

      setIsFinished(true);
      if (data.success) {
        setIsSuccess(true);
        pushLog(`🎉 HTTPS ATIVO COM SUCESSO NA PORTA 443 EM: https://${targetDomain}`);
        pushLog(`👉 Acesse sem porta: https://${targetDomain}`);
        pushLog(`⚠️ Não coloque :${project.appPort} na URL, pois a porta ${project.appPort} é HTTP simples.`);

        const updatedProject: DeploymentProject = {
          ...project,
          domain: targetDomain,
          enableHttps: true,
          sslType: (data.effectiveCertType as any) || effectiveType,
          sslInstalledAt: new Date().toISOString(),
        };

        if (onSslSuccess) {
          onSslSuccess(updatedProject);
        }
      } else {
        pushLog(`⚠️ ${data.message || 'Houve um aviso durante a emissão do certificado.'}`);
      }
    } catch (err: any) {
      pushLog(`❌ Erro ao comunicar com a VPS: ${err.message || err}`);
      setIsFinished(true);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950/80 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Instalar Certificado SSL (HTTPS)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Nginx + Certbot
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Acesse <strong className="text-white">{project.name}</strong> com cadeado verde e criptografia HTTPS na porta 443
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(92vh-130px)]">
          {/* Status info bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 text-xs">
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-medium">Aplicação</span>
              <span className="text-white font-medium">{project.name}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-medium">Porta Interna</span>
              <span className="text-emerald-400 font-mono font-medium">:{project.appPort}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-medium">IP da VPS (Alvo DNS)</span>
              <div className="flex items-center gap-1.5 font-mono text-cyan-300">
                <span>{effectiveVps.host}</span>
                <button
                  type="button"
                  onClick={handleCopyIp}
                  className="p-0.5 text-slate-400 hover:text-white cursor-pointer"
                  title="Copiar IP"
                >
                  {copiedIp ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleInstallSsl} className="space-y-4">
            {/* Cert Type Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Tipo de Certificado SSL
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCertType('letsencrypt')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    certType === 'letsencrypt'
                      ? 'bg-emerald-500/10 border-emerald-500/50 text-white'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold text-xs text-white">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Let's Encrypt (Recomendado)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                    Certificado oficial gratuito reconhecido por todos os navegadores. Requer domínio apontando para o IP da VPS.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setCertType('selfsigned')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    certType === 'selfsigned'
                      ? 'bg-cyan-500/10 border-cyan-500/50 text-white'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold text-xs text-white">
                    <Lock className="w-4 h-4 text-cyan-400" />
                    <span>Autoassinado OpenSSL (Imediato)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                    Gera SSL na hora, mesmo para IP ou domínio sem DNS propagado. O navegador pede apenas para aceitar o certificado.
                  </p>
                </button>
              </div>
            </div>

            {/* Domain & Email */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Domínio ou Subdomínio SSL *
                  </label>
                  <div className="relative">
                    <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      placeholder={`ex: ${autoNipDomain}`}
                      className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[11px]">
                    <span className="text-slate-400">Padrão com o nome da aplicação:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setDomain(autoNipDomain);
                        setEmail('julianogallice@gmail.com');
                        setCertType('letsencrypt');
                      }}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-colors cursor-pointer flex items-center gap-1.5 ${
                        domain === autoNipDomain
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-semibold'
                          : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white hover:border-slate-600'
                      }`}
                    >
                      <span>🌟 {autoNipDomain}</span>
                      {domain === autoNipDomain && (
                        <span className="text-[10px] bg-emerald-500/30 text-emerald-200 px-1 py-0.2 rounded font-sans">
                          Ativo
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    E-mail para Alertas de Renovação
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@seusite.com.br"
                      className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* IP Subdomain Helper Banner */}
              {isSubdomainOnIp && (
                <div className="p-3.5 bg-rose-500/15 border border-rose-500/35 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 text-rose-300 font-semibold">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Subdomínio em IP Numérico Não Existe no DNS ({cleanDomain})</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    A especificação IPv4 e os servidores DNS da internet <strong>não aceitam subdomínios diretos sobre endereços IP</strong> (como <code className="text-amber-300 bg-slate-900 px-1 py-0.5 rounded">{cleanDomain}</code>). O Let's Encrypt e os navegadores recusarão a conexão porque esse endereço não resolve no DNS.
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    Para funcionar perfeitamente com SSL válido, adicione o sufixo DNS gratuito <code className="text-emerald-300">.nip.io</code>:
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (subdomainMatch) {
                          setDomain(`${subdomainMatch[1]}.${subdomainMatch[2]}.nip.io`);
                          setEmail('julianogallice@gmail.com');
                          setCertType('letsencrypt');
                        }
                      }}
                      className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1"
                    >
                      <span>👉 Corrigir para: {subdomainMatch?.[1]}.{subdomainMatch?.[2]}.nip.io</span>
                    </button>
                  </div>
                </div>
              )}

              {/* IP Address Helper Banner */}
              {isBareIp && (
                <div className="p-3.5 bg-amber-500/15 border border-amber-500/35 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 text-amber-300 font-semibold">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Endereço IP Detectado ({cleanDomain})</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    A autoridade certificadora <strong>Let's Encrypt não emite certificados para IPs numéricos puros</strong>. Para resolver isso facilmente, escolha uma das opções abaixo:
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const subPrefix = project.slug || 'app';
                        setDomain(`${subPrefix}.${cleanDomain}.nip.io`);
                        setEmail('julianogallice@gmail.com');
                        setCertType('letsencrypt');
                      }}
                      className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1"
                    >
                      <span>🌟 Subdomínio da Aplicação: {project.slug || 'nfe'}.{cleanDomain}.nip.io</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDomain(`${cleanDomain}.nip.io`);
                        setEmail('julianogallice@gmail.com');
                        setCertType('letsencrypt');
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium cursor-pointer flex items-center gap-1"
                    >
                      <span>{cleanDomain}.nip.io</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCertType('selfsigned')}
                      className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1"
                    >
                      <span>🔒 Autoassinado OpenSSL</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Explicação de como funciona e regra da porta 443 */}
            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-xs space-y-1">
              <span className="text-white font-semibold flex items-center gap-1.5 text-[11px]">
                <HelpCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                Como acessar após ativar o HTTPS:
              </span>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                O Nginx escuta na porta padrão <strong className="text-emerald-400">443 (HTTPS)</strong> e repassa internamente para a aplicação na porta <code className="text-slate-200">:{project.appPort}</code>.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                <div className="p-2 bg-slate-900 rounded border border-emerald-500/30">
                  <span className="text-emerald-300 font-semibold block">✅ Forma Correta:</span>
                  <code className="text-white font-mono">https://{cleanDomain || 'seu-site'}</code> (sem porta no final)
                </div>
                <div className="p-2 bg-slate-900 rounded border border-rose-500/30">
                  <span className="text-rose-300 font-semibold block">❌ Incorreta:</span>
                  <code className="text-slate-400 font-mono">https://{cleanDomain || 'seu-site'}:{project.appPort}</code> (gera <em>ERR_SSL_PROTOCOL_ERROR</em>)
                </div>
              </div>
            </div>

            {/* DNS Instructions banner */}
            {certType === 'letsencrypt' && !isBareIp && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-amber-300 font-semibold text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Importante: Apontamento de DNS necessário</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDnsHelp(!showDnsHelp)}
                    className="text-[11px] text-amber-400 hover:underline cursor-pointer"
                  >
                    {showDnsHelp ? 'Ocultar Detalhes' : 'Como apontar o DNS?'}
                  </button>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Para que o Let's Encrypt consiga emitir o certificado, o domínio <strong>{cleanDomain || 'seu-dominio.com.br'}</strong> precisa apontar (Entrada Tipo A) para o IP da sua VPS: <code className="text-emerald-400 font-mono font-bold bg-slate-900 px-1.5 py-0.5 rounded">{effectiveVps.host}</code>.
                </p>

                {showDnsHelp && (
                  <div className="pt-2 border-t border-amber-500/20 text-[11px] space-y-1 text-slate-300 font-mono">
                    <p className="text-white font-sans font-medium">Exemplo de Entrada no seu Gerenciador DNS (Cloudflare, Registro.br, Locaweb):</p>
                    <div className="grid grid-cols-3 gap-1 bg-slate-950 p-2 rounded border border-slate-800 text-[10px]">
                      <div><strong>Tipo:</strong> A</div>
                      <div><strong>Nome/Host:</strong> {cleanDomain.split('.')[0] || 'app'}</div>
                      <div><strong>Destino:</strong> {effectiveVps.host}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action Button */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isExecuting}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isExecuting || !cleanDomain}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Configurando Nginx & Emitindo SSL...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Instalar Certificado & Ativar HTTPS</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Real-time Terminal Log Stream */}
          {(logs.length > 0 || isExecuting) && (
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  Terminal de Execução na VPS
                </span>
                {isFinished && (
                  <span className={`text-[11px] font-medium flex items-center gap-1 ${isSuccess ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {isSuccess ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                    {isSuccess ? 'Concluído com Sucesso' : 'Execução finalizada com avisos'}
                  </span>
                )}
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-[11px] text-slate-300 max-h-56 overflow-y-auto space-y-1 select-text">
                {logs.map((line, i) => {
                  const isSuccessLine = line.includes('SUCESSO') || line.includes('✅') || line.includes('🎉') || line.includes('HTTPS ativo');
                  const isWarnLine = line.includes('Aviso') || line.includes('⚠️') || line.includes('💡');
                  const isErrLine = line.includes('❌') || line.includes('Erro') || line.includes('stderr');

                  return (
                    <div
                      key={i}
                      className={
                        isSuccessLine
                          ? 'text-emerald-300 font-semibold'
                          : isWarnLine
                          ? 'text-amber-300'
                          : isErrLine
                          ? 'text-rose-400'
                          : 'text-slate-300'
                      }
                    >
                      {line}
                    </div>
                  );
                })}
                {isExecuting && (
                  <div className="flex items-center gap-2 text-emerald-400 py-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Aguardando resposta do servidor VPS...</span>
                  </div>
                )}
              </div>

              {/* Success Result Box */}
              {isSuccess && (
                <div className="p-4 bg-emerald-500/15 border border-emerald-500/40 rounded-xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="text-emerald-400 font-bold text-sm flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        HTTPS Ativo no Nginx (Porta 443)!
                      </span>
                      <p className="text-slate-200 text-xs">
                        O proxy reverso está ativo e encaminhando para a aplicação interna :<strong>{project.appPort}</strong>.
                      </p>
                    </div>
                    <a
                      href={`https://${cleanDomain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors shrink-0 shadow"
                    >
                      <span>Abrir https://{cleanDomain}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  <div className="p-2.5 bg-slate-950/80 rounded-lg border border-emerald-500/30 text-[11px] text-slate-300 space-y-1">
                    <div className="text-white font-medium">⚠️ Atenção: Como acessar no navegador:</div>
                    <div>
                      ✅ <strong className="text-emerald-300">Correto:</strong>{' '}
                      <code className="font-mono bg-slate-900 px-1 py-0.5 rounded text-white">https://{cleanDomain}</code> (porta padrão 443, sem porta no final)
                    </div>
                    <div>
                      ❌ <strong className="text-rose-300">Incorreto:</strong>{' '}
                      <code className="font-mono bg-slate-900 px-1 py-0.5 rounded text-slate-400">https://{cleanDomain}:{project.appPort}</code> (gera <em>ERR_SSL_PROTOCOL_ERROR</em> pois a porta {project.appPort} é HTTP simples)
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
