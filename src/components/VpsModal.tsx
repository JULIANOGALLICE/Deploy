import React, { useState, useEffect } from 'react';
import { X, Server, Key, Shield, HardDrive, Cpu, RefreshCw, CheckCircle2, AlertTriangle, Activity, Box } from 'lucide-react';
import { DeploymentProject, VpsServer } from '../types/deploy';
import { getServerProjects } from '../utils/serverMatcher';

interface VpsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (server: VpsServer) => Promise<void> | void;
  serverToEdit?: VpsServer | null;
  projects?: DeploymentProject[];
  allServers?: VpsServer[];
}

export const VpsModal: React.FC<VpsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  serverToEdit,
  projects = [],
  allServers = [],
}) => {
  const [name, setName] = useState(serverToEdit?.name || '');
  const [host, setHost] = useState(serverToEdit?.host || '');
  const [sshPort, setSshPort] = useState(serverToEdit?.sshPort || 22);
  const [sshUser, setSshUser] = useState(serverToEdit?.sshUser || 'root');
  const [authType, setAuthType] = useState<'key' | 'password'>(serverToEdit?.authType || 'password');
  const [sshKeyOrPassword, setSshKeyOrPassword] = useState(serverToEdit?.sshKeyOrPassword || '');
  const [os, setOs] = useState<VpsServer['os']>(serverToEdit?.os || 'Ubuntu 24.04 LTS');
  const [cpuCores, setCpuCores] = useState(serverToEdit?.cpuCores || 2);
  const [ramGb, setRamGb] = useState(serverToEdit?.ramGb || 4);
  const [diskGb, setDiskGb] = useState(serverToEdit?.diskGb || 50);
  const [notes, setNotes] = useState(serverToEdit?.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Live VPS probe state
  const [isProbing, setIsProbing] = useState(false);
  const [probeMessage, setProbeMessage] = useState<string | null>(null);
  const [probeSuccess, setProbeSuccess] = useState<boolean | null>(null);
  const [detectedPm2Apps, setDetectedPm2Apps] = useState<Array<{ name: string; status: string; pid?: number }> | null>(null);

  // Synchronize state when serverToEdit or modal open state changes
  useEffect(() => {
    if (serverToEdit) {
      setName(serverToEdit.name || '');
      setHost(serverToEdit.host || serverToEdit.ipAddress || '');
      setSshPort(serverToEdit.sshPort || 22);
      setSshUser(serverToEdit.sshUser || 'root');
      setAuthType(serverToEdit.authType || 'password');
      setSshKeyOrPassword(serverToEdit.sshKeyOrPassword || '');
      setOs(serverToEdit.os || 'Ubuntu 24.04 LTS');
      setCpuCores(serverToEdit.cpuCores || 2);
      setRamGb(serverToEdit.ramGb || 4);
      setDiskGb(serverToEdit.diskGb || 50);
      setNotes(serverToEdit.notes || '');
    } else {
      setName('');
      setHost('');
      setSshPort(22);
      setSshUser('root');
      setAuthType('password');
      setSshKeyOrPassword('');
      setOs('Ubuntu 24.04 LTS');
      setCpuCores(2);
      setRamGb(4);
      setDiskGb(50);
      setNotes('');
    }
    setErrorMsg(null);
    setProbeMessage(null);
    setProbeSuccess(null);
    setDetectedPm2Apps(null);
  }, [serverToEdit, isOpen]);

  if (!isOpen) return null;

  // Linked applications in the panel for this server
  const linkedProjects = serverToEdit
    ? getServerProjects(serverToEdit, projects, allServers)
    : [];

  const handleProbeServer = async () => {
    if (!host.trim()) {
      setErrorMsg('Informe o IP ou host do servidor para sondar.');
      return;
    }
    if (!sshKeyOrPassword.trim()) {
      setErrorMsg('Informe a senha ou chave SSH para conectar à VPS.');
      return;
    }

    try {
      setIsProbing(true);
      setErrorMsg(null);
      setProbeMessage(null);

      const res = await fetch('/api/probe-vps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: host.trim(),
          port: Number(sshPort) || 22,
          username: sshUser.trim() || 'root',
          authType,
          passwordOrKey: sshKeyOrPassword.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setProbeSuccess(true);
        if (data.os) setOs(data.os);
        if (data.cpuCores) setCpuCores(data.cpuCores);
        if (data.ramGb) setRamGb(data.ramGb);
        if (data.diskGb) setDiskGb(data.diskGb);
        if (data.pm2Apps) setDetectedPm2Apps(data.pm2Apps);
        setProbeMessage(data.message || 'Dados atualizados da VPS com sucesso!');
      } else {
        setProbeSuccess(false);
        setProbeMessage(data.message || 'Não foi possível conectar à VPS.');
      }
    } catch (err: any) {
      setProbeSuccess(false);
      setProbeMessage(`Falha ao sondar VPS: ${err.message || err}`);
    } finally {
      setIsProbing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !host.trim()) {
      setErrorMsg('Por favor, preencha o Nome e o Host (IP) do servidor.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      const newServer: VpsServer = {
        id: serverToEdit?.id || `vps-${Date.now()}`,
        name: name.trim(),
        host: host.trim(),
        ipAddress: host.trim(),
        sshPort: Number(sshPort) || 22,
        sshUser: sshUser.trim() || 'root',
        authType,
        sshKeyOrPassword: (sshKeyOrPassword || '').trim(),
        os,
        status: 'connected',
        cpuCores: Number(cpuCores) || 2,
        ramGb: Number(ramGb) || 4,
        diskGb: Number(diskGb) || 50,
        firewallUfwActive: true,
        notes: (notes || '').trim(),
        createdAt: serverToEdit?.createdAt || new Date().toISOString(),
      };

      await onSave(newServer);
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro ao salvar servidor no Firebase. Verifique sua conexão.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-base font-semibold text-white">
                {serverToEdit ? `Editar Servidor: ${serverToEdit.name}` : 'Cadastrar Novo Servidor VPS'}
              </h3>
              {serverToEdit && (
                <p className="text-[11px] text-slate-400 font-mono">
                  {serverToEdit.sshUser}@{serverToEdit.host}:{serverToEdit.sshPort}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Current State & Applications Banner */}
          {serverToEdit && (
            <div className="p-3.5 bg-slate-950/90 rounded-lg border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  Estado Atual do Servidor
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Conectado / Online
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[11px] pt-1 border-t border-slate-800/80">
                <div>
                  <span className="text-slate-500 block">SISTEMA ATUAL</span>
                  <span className="text-slate-200 font-medium truncate block">{os}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">RECURSOS</span>
                  <span className="text-slate-200 font-medium block">{cpuCores} vCPU · {ramGb}GB RAM</span>
                </div>
                <div>
                  <span className="text-slate-500 block">APPS ATIVAS</span>
                  <span className="text-emerald-400 font-medium block">
                    {linkedProjects.length} instalada(s)
                  </span>
                </div>
              </div>

              {linkedProjects.length > 0 && (
                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-[10px] text-slate-400 block mb-1 font-semibold uppercase">
                    Aplicações vinculadas a esta VPS:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {linkedProjects.map((p) => (
                      <span
                        key={p.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-700/80 text-[11px] text-slate-200 font-mono"
                      >
                        <Box className="w-3 h-3 text-emerald-400" />
                        {p.name} (:{p.appPort})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Nome do Servidor / Identificador *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Servidor Produção (Hetzner / DigitalOcean)"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Endereço IP ou Domínio (Host) *
              </label>
              <input
                type="text"
                required
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="Ex: 168.119.45.102 ou vps.meusite.com"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Porta SSH
              </label>
              <input
                type="number"
                value={sshPort}
                onChange={(e) => setSshPort(Number(e.target.value))}
                placeholder="22"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Usuário SSH
              </label>
              <input
                type="text"
                value={sshUser}
                onChange={(e) => setSshUser(e.target.value)}
                placeholder="root ou deploy"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Sistema Operacional
              </label>
              <select
                value={os}
                onChange={(e) => setOs(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="Ubuntu 24.04 LTS">Ubuntu 24.04 LTS</option>
                <option value="Ubuntu 22.04 LTS">Ubuntu 22.04 LTS</option>
                <option value="Debian 12">Debian 12</option>
                <option value="Alpine Linux">Alpine Linux</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-300">
                Tipo de Autenticação SSH
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAuthType('key')}
                  className={`text-xs px-2.5 py-1 rounded transition-colors ${
                    authType === 'key'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Chave Privada (Recomendado)
                </button>
                <button
                  type="button"
                  onClick={() => setAuthType('password')}
                  className={`text-xs px-2.5 py-1 rounded transition-colors ${
                    authType === 'password'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Senha
                </button>
              </div>
            </div>

            <textarea
              rows={3}
              value={sshKeyOrPassword}
              onChange={(e) => setSshKeyOrPassword(e.target.value)}
              placeholder={
                authType === 'key'
                  ? 'Cole aqui sua chave privada SSH (id_rsa ou id_ed25519) ou configure como segredo no GitHub...'
                  : 'Digite a senha do usuário SSH (armazenada de forma segura)...'
              }
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              {authType === 'key'
                ? '💡 A chave privada é necessária para que o GitHub Actions ou script automático acesse a VPS sem pedir senha interativa.'
                : '⚠️ Autenticação por chave é mais segura e rápida para automações contínuas.'}
            </p>

            {/* Live probe button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleProbeServer}
                disabled={isProbing || !host.trim() || !sshKeyOrPassword.trim()}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isProbing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    <span>Conectando via SSH e detectando hardware & apps...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                    <span>🔍 Testar Conexão SSH e Atualizar Specs Reais da VPS</span>
                  </>
                )}
              </button>

              {probeMessage && (
                <div
                  className={`mt-2 p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
                    probeSuccess
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                      : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                  }`}
                >
                  {probeSuccess ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 space-y-1">
                    <div>{probeMessage}</div>
                    {detectedPm2Apps && detectedPm2Apps.length > 0 && (
                      <div className="pt-1 border-t border-emerald-500/20 text-[11px]">
                        <span className="font-semibold">Apps PM2 em execução na VPS ({detectedPm2Apps.length}): </span>
                        <span>{detectedPm2Apps.map((a) => `${a.name} [${a.status}]`).join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-1">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Cores CPU</label>
              <input
                type="number"
                value={cpuCores}
                onChange={(e) => setCpuCores(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">RAM (GB)</label>
              <input
                type="number"
                value={ramGb}
                onChange={(e) => setRamGb(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Disco SSD (GB)</label>
              <input
                type="number"
                value={diskGb}
                onChange={(e) => setDiskGb(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Observações / Finalidade (Opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Servidor dedicado aos clientes do Brasil, hospedado na Hetzner"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-lg text-xs text-rose-300">
              {errorMsg}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
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
                <span>{serverToEdit ? 'Atualizar no Firebase' : 'Salvar Servidor VPS no Firebase'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
