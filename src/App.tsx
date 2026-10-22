/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { auth, googleProvider, testFirestoreConnection } from './lib/firebase';
import {
  subscribeToServers,
  subscribeToProjects,
  subscribeToDeployments,
  saveVpsServer,
  deleteVpsServer,
  saveDeploymentProject,
  deleteDeploymentProject,
  saveDeploymentRecord,
  seedInitialDataIfEmpty,
} from './services/firestoreService';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { VpsManager } from './components/VpsManager';
import { ProjectManager } from './components/ProjectManager';
import { ContinuousDeployTab } from './components/ContinuousDeployTab';
import { PortManager } from './components/PortManager';
import { GuideTab } from './components/GuideTab';
import { VpsModal } from './components/VpsModal';
import { ProjectModal } from './components/ProjectModal';
import { TerminalDeployModal } from './components/TerminalDeployModal';
import { SslModal } from './components/SslModal';
import { UninstallModal } from './components/UninstallModal';
import { initialServers, initialProjects, initialDeployments } from './data/initialData';
import { DeploymentProject, DeploymentRecord, VpsServer } from './types/deploy';
import { getServerProjects, getProjectServer } from './utils/serverMatcher';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'projects' | 'servers' | 'ports' | 'cicd' | 'guide'>('dashboard');

  // Firebase Auth state
  const [user, setUser] = useState<User | null>(null);

  // Firestore Realtime Collections state (initialized with initialData while syncing)
  const [servers, setServers] = useState<VpsServer[]>(initialServers);
  const [projects, setProjects] = useState<DeploymentProject[]>(initialProjects);
  const [deployments, setDeployments] = useState<DeploymentRecord[]>(initialDeployments);
  const [isFirebaseLoaded, setIsFirebaseLoaded] = useState(false);

  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr));
    }, 3500);
  };

  // Auth & Firestore Subscriptions
  useEffect(() => {
    // 1. Auth listener
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    // 2. Test Connection and Seed Initial Data if Firestore is empty
    testFirestoreConnection();
    seedInitialDataIfEmpty().catch(console.error);

    // 3. Realtime subscriptions to Firestore
    const unsubServers = subscribeToServers((updatedServers) => {
      if (updatedServers.length > 0) {
        setServers(updatedServers);
      } else {
        setServers([]);
      }
      setIsFirebaseLoaded(true);
    });

    const unsubProjects = subscribeToProjects((updatedProjects) => {
      if (updatedProjects.length > 0) {
        setProjects(updatedProjects);
      } else {
        setProjects([]);
      }
    });

    const unsubDeployments = subscribeToDeployments((updatedRecords) => {
      if (updatedRecords.length > 0) {
        setDeployments(updatedRecords);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubServers();
      unsubProjects();
      unsubDeployments();
    };
  }, []);

  // Modals state
  const [isVpsModalOpen, setIsVpsModalOpen] = useState(false);
  const [serverToEdit, setServerToEdit] = useState<VpsServer | null>(null);

  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<DeploymentProject | null>(null);

  // Terminal Deploy Modal state
  const [isTerminalModalOpen, setIsTerminalModalOpen] = useState(false);
  const [terminalProject, setTerminalProject] = useState<DeploymentProject | null>(null);

  // SSL Modal state
  const [isSslModalOpen, setIsSslModalOpen] = useState(false);
  const [sslProject, setSslProject] = useState<DeploymentProject | null>(null);

  // Uninstall / Clean VPS Modal state
  const [isUninstallModalOpen, setIsUninstallModalOpen] = useState(false);
  const [uninstallMode, setUninstallMode] = useState<'project' | 'vps-wipe'>('project');
  const [uninstallProject, setUninstallProject] = useState<DeploymentProject | null>(null);
  const [uninstallVps, setUninstallVps] = useState<VpsServer | null>(null);

  // CI/CD focus project
  const [cicdFocusedProjectId, setCicdFocusedProjectId] = useState<string | undefined>(undefined);

  // Service toggle loading state
  const [togglingProjectId, setTogglingProjectId] = useState<string | null>(null);

  // VPS Handlers with Firestore Persistence
  const handleSaveServer = async (server: VpsServer) => {
    try {
      await saveVpsServer(server);
      showToast(`Servidor "${server.name}" salvo no Firebase Firestore!`);
    } catch (error) {
      console.error(error);
      showToast('Erro ao salvar servidor no Firebase.', 'error');
      throw error;
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    try {
      const serverToRemove = servers.find((s) => s.id === serverId);
      if (!serverToRemove) return;

      // Não deixar excluir o servidor enquanto tiver aplicações ativas!
      const linkedProjects = getServerProjects(serverToRemove, projects, servers);
      if (linkedProjects.length > 0) {
        showToast(
          `Não é permitido excluir o servidor: existem ${linkedProjects.length} aplicação(ões) vinculada(s) ou ativas nele. Desinstale as aplicações antes de remover a VPS.`,
          'error'
        );
        return;
      }

      await deleteVpsServer(serverId);
      showToast(`Servidor "${serverToRemove.name}" excluído do Firebase!`);
    } catch (error) {
      console.error(error);
      showToast('Erro ao excluir servidor do Firebase.', 'error');
      throw error;
    }
  };

  // Project Handlers with Firestore Persistence
  const handleSaveProject = async (project: DeploymentProject) => {
    try {
      await saveDeploymentProject(project);
      showToast(`Aplicação "${project.name}" (Porta :${project.appPort}) salva no Firebase!`);
    } catch (error) {
      console.error(error);
      showToast('Erro ao salvar aplicação no Firebase.', 'error');
      throw error;
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      const projectToRemove = projects.find((p) => p.id === projectId);
      // Não deixar excluir a aplicação enquanto ela não for desinstalada do servidor!
      if (projectToRemove && projectToRemove.status === 'running') {
        showToast(
          `Não é permitido excluir diretamente: A aplicação "${projectToRemove.name}" ainda está ativa no servidor. Use o botão "Desinstalar da VPS" para removê-la com segurança.`,
          'error'
        );
        return;
      }

      await deleteDeploymentProject(projectId);
      showToast(`Aplicação "${projectToRemove?.name || projectId}" excluída do Firebase!`);
    } catch (error) {
      console.error(error);
      showToast('Erro ao excluir aplicação do Firebase.', 'error');
      throw error;
    }
  };

  const handleToggleProjectStatus = async (project: DeploymentProject) => {
    const isCurrentlyRunning = project.status === 'running';
    const action = isCurrentlyRunning ? 'stop' : 'start';
    const targetVps = getProjectServer(project, servers);

    if (!targetVps || !targetVps.sshKeyOrPassword) {
      showToast(
        `Para pausar/iniciar na VPS, configure a Senha ou Chave SSH no cadastro do servidor "${targetVps?.name || 'VPS'}".`,
        'error'
      );
      return;
    }

    try {
      setTogglingProjectId(project.id);
      showToast(
        isCurrentlyRunning
          ? `🛑 Conectando via SSH para pausar "${project.name}" (pm2 stop) na VPS...`
          : `▶️ Conectando via SSH para iniciar "${project.name}" (pm2 start) na VPS...`
      );

      const res = await fetch('/api/control-service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: targetVps.host,
          port: targetVps.sshPort,
          username: targetVps.sshUser,
          authType: targetVps.authType,
          passwordOrKey: targetVps.sshKeyOrPassword,
          slug: project.slug,
          action,
          serverPath: project.serverPath,
          appPort: project.appPort,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        showToast(
          `Falha ao ${isCurrentlyRunning ? 'pausar' : 'iniciar'} na VPS: ${data.message || 'Erro de execução'}`,
          'error'
        );
        return;
      }

      // Sucesso no servidor real! Agora atualiza o status no Firebase Firestore
      const updatedStatus = isCurrentlyRunning ? 'stopped' : 'running';
      const updatedProject = { ...project, status: updatedStatus as any };
      await saveDeploymentProject(updatedProject);

      showToast(
        isCurrentlyRunning
          ? `🛑 Serviço "${project.name}" foi pausado no servidor real (PM2 parado, porta :${project.appPort} liberada)!`
          : `▶️ Serviço "${project.name}" foi iniciado no servidor real com sucesso!`
      );
    } catch (error: any) {
      console.error(error);
      showToast(`Erro ao controlar serviço na VPS: ${error.message || error}`, 'error');
    } finally {
      setTogglingProjectId(null);
    }
  };

  // Launch live deploy
  const handleTriggerDeploy = (project: DeploymentProject) => {
    setTerminalProject(project);
    setIsTerminalModalOpen(true);
  };

  const handleDeployFinished = async (record: DeploymentRecord) => {
    try {
      await saveDeploymentRecord(record);
      if (terminalProject) {
        const isSuccess = record.status === 'success';
        const updatedProject = {
          ...terminalProject,
          status: isSuccess ? ('running' as const) : ('failed' as const),
          lastDeployedAt: record.timestamp,
          commitHash: record.commitHash,
        };
        await saveDeploymentProject(updatedProject);
      }
      if (record.aiFixed) {
        showToast(`🎉 Deploy recuperado e corrigido automaticamente pela IA!`);
      } else if (record.status === 'success') {
        showToast(`Deploy da aplicação finalizado com sucesso e registrado no Firebase!`);
      } else {
        showToast(`Deploy finalizado com erro na VPS. Consulte os logs no histórico.`, 'error');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleViewCiCd = (project: DeploymentProject) => {
    setCicdFocusedProjectId(project.id);
    setActiveTab('cicd');
  };

  // SSL Handlers
  const handleOpenSsl = (project: DeploymentProject) => {
    setSslProject(project);
    setIsSslModalOpen(true);
  };

  const handleSslSuccess = async (updatedProject: DeploymentProject) => {
    try {
      await saveDeploymentProject(updatedProject);
      showToast(`Certificado SSL ativado com sucesso para https://${updatedProject.domain}!`);
    } catch (error) {
      console.error(error);
      showToast('Certificado instalado na VPS, mas erro ao salvar no Firebase.', 'error');
    }
  };

  // Uninstall / Clean VPS Handlers
  const handleOpenUninstallProject = (project: DeploymentProject) => {
    setUninstallProject(project);
    const targetVps = getProjectServer(project, servers) || servers[0] || null;
    setUninstallVps(targetVps);
    setUninstallMode('project');
    setIsUninstallModalOpen(true);
  };

  const handleOpenWipeVps = (vps: VpsServer) => {
    setUninstallVps(vps);
    setUninstallProject(null);
    setUninstallMode('vps-wipe');
    setIsUninstallModalOpen(true);
  };

  const handleUninstallSuccess = async (targetId: string) => {
    try {
      if (uninstallMode === 'project') {
        await deleteDeploymentProject(targetId);
        showToast('Aplicação e arquivos desinstalados da VPS com sucesso!');
      } else {
        // Wipe mode: remove all projects for this VPS
        const linked = projects.filter((p) => p.vpsId === targetId);
        for (const p of linked) {
          await deleteDeploymentProject(p.id);
        }
        showToast('Limpeza completa da VPS concluída! Todas as aplicações foram removidas.');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleSelectProjectFromPortMap = (projectId: string) => {
    const proj = projects.find((p) => p.id === projectId);
    if (proj) {
      setProjectToEdit(proj);
      setIsProjectModalOpen(true);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      showToast('Autenticado com Google no Firebase com sucesso!');
    } catch (error) {
      console.error('Erro no login Google:', error);
      showToast('Não foi possível fazer login com o Google.', 'error');
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await signOut(auth);
      showToast('Desconectado com sucesso.');
    } catch (error) {
      console.error(error);
    }
  };

  const activeVpsForTerminal =
    servers.find((s) => s.id === terminalProject?.vpsId) || servers[0] || null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onNewProject={() => {
          setProjectToEdit(null);
          setIsProjectModalOpen(true);
        }}
        onNewServer={() => {
          setServerToEdit(null);
          setIsVpsModalOpen(true);
        }}
        isFirebaseConnected={isFirebaseLoaded}
        user={user}
        onLogin={handleGoogleLogin}
        onLogout={handleGoogleLogout}
      />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'dashboard' && (
          <DashboardView
            servers={servers}
            projects={projects}
            deployments={deployments}
            onDeployProject={handleTriggerDeploy}
            onSelectTab={setActiveTab}
            onConfigureSsl={handleOpenSsl}
            onUninstallProject={handleOpenUninstallProject}
            onToggleStatus={handleToggleProjectStatus}
            togglingProjectId={togglingProjectId}
          />
        )}

        {activeTab === 'projects' && (
          <ProjectManager
            projects={projects}
            servers={servers}
            onAddProject={() => {
              setProjectToEdit(null);
              setIsProjectModalOpen(true);
            }}
            onEditProject={(proj) => {
              setProjectToEdit(proj);
              setIsProjectModalOpen(true);
            }}
            onDeleteProject={handleDeleteProject}
            onDeployProject={handleTriggerDeploy}
            onToggleStatus={handleToggleProjectStatus}
            onViewCiCd={handleViewCiCd}
            onConfigureSsl={handleOpenSsl}
            onUninstallProject={handleOpenUninstallProject}
            togglingProjectId={togglingProjectId}
          />
        )}

        {activeTab === 'servers' && (
          <VpsManager
            servers={servers}
            projects={projects}
            onAddServer={() => {
              setServerToEdit(null);
              setIsVpsModalOpen(true);
            }}
            onEditServer={(srv) => {
              setServerToEdit(srv);
              setIsVpsModalOpen(true);
            }}
            onDeleteServer={handleDeleteServer}
            onWipeServer={handleOpenWipeVps}
            onNavigateToProjects={() => setActiveTab('projects')}
          />
        )}

        {activeTab === 'ports' && (
          <PortManager
            servers={servers}
            projects={projects}
            onSelectProject={handleSelectProjectFromPortMap}
          />
        )}

        {activeTab === 'cicd' && (
          <ContinuousDeployTab
            projects={projects}
            servers={servers}
            selectedProjectId={cicdFocusedProjectId}
            onDeployProject={handleTriggerDeploy}
          />
        )}

        {activeTab === 'guide' && <GuideTab />}
      </main>

      {/* Modals */}
      <VpsModal
        isOpen={isVpsModalOpen}
        onClose={() => {
          setIsVpsModalOpen(false);
          setServerToEdit(null);
        }}
        onSave={handleSaveServer}
        serverToEdit={serverToEdit}
        projects={projects}
        allServers={servers}
      />

      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => {
          setIsProjectModalOpen(false);
          setProjectToEdit(null);
        }}
        onSave={handleSaveProject}
        servers={servers}
        existingProjects={projects}
        projectToEdit={projectToEdit}
      />

      <TerminalDeployModal
        isOpen={isTerminalModalOpen}
        onClose={() => {
          setIsTerminalModalOpen(false);
          setTerminalProject(null);
        }}
        project={terminalProject}
        vps={activeVpsForTerminal}
        onDeployComplete={handleDeployFinished}
        onUpdateProject={handleSaveProject}
        onOpenSsl={handleOpenSsl}
        onOpenUninstall={handleOpenUninstallProject}
      />

      <SslModal
        isOpen={isSslModalOpen}
        onClose={() => {
          setIsSslModalOpen(false);
          setSslProject(null);
        }}
        project={sslProject}
        vps={servers.find((s) => s.id === sslProject?.vpsId) || servers[0] || null}
        onSslSuccess={handleSslSuccess}
      />

      <UninstallModal
        isOpen={isUninstallModalOpen}
        onClose={() => {
          setIsUninstallModalOpen(false);
          setUninstallProject(null);
          setUninstallVps(null);
        }}
        mode={uninstallMode}
        project={uninstallProject}
        vps={uninstallVps || servers.find((s) => s.id === uninstallProject?.vpsId) || servers[0] || null}
        onSuccess={handleUninstallSuccess}
      />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white shadow-2xl animate-fade-in">
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span>GitVPS Deploy</span>
            <span>·</span>
            <span className="text-emerald-400 flex items-center gap-1 font-mono text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Firebase Firestore Sincronizado
            </span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <button
              onClick={() => setActiveTab('guide')}
              className="hover:text-emerald-400 transition-colors cursor-pointer"
            >
              Documentação & Guia
            </button>
            <span>·</span>
            <button
              onClick={() => setActiveTab('ports')}
              className="hover:text-emerald-400 transition-colors cursor-pointer"
            >
              Mapa de Portas
            </button>
            <span>·</span>
            <button
              onClick={() => setActiveTab('cicd')}
              className="hover:text-emerald-400 transition-colors cursor-pointer"
            >
              GitHub Actions
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
