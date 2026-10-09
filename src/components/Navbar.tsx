import React from 'react';
import { Server, Rocket, Plus, Database, Cloud, CheckCircle2, User, LogIn, LogOut } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';

interface NavbarProps {
  activeTab: 'dashboard' | 'projects' | 'servers' | 'ports' | 'cicd' | 'guide';
  setActiveTab: (tab: 'dashboard' | 'projects' | 'servers' | 'ports' | 'cicd' | 'guide') => void;
  onNewProject: () => void;
  onNewServer: () => void;
  isFirebaseConnected?: boolean;
  user?: FirebaseUser | null;
  onLogin?: () => void;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onNewProject,
  onNewServer,
  isFirebaseConnected = true,
  user,
  onLogin,
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 backdrop-blur px-4 lg:px-8 py-3.5">
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        {/* Zone 1: Single text element wordmark + Cloud status */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Rocket className="w-4 h-4" />
          </div>
          <button 
            onClick={() => setActiveTab('dashboard')} 
            className="text-lg font-bold tracking-tight text-white hover:text-emerald-400 transition-colors cursor-pointer text-left"
          >
            GitVPS Deploy
          </button>

          {/* Firebase Cloud Live Badge */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Firestore Nuvem</span>
          </div>
        </div>

        {/* Zone 2: 4-6 clean text navigation links */}
        <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'dashboard'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            Visão Geral
          </button>
          <button
            onClick={() => setActiveTab('projects')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'projects'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            Aplicações Git
          </button>
          <button
            onClick={() => setActiveTab('servers')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'servers'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            Servidores VPS
          </button>
          <button
            onClick={() => setActiveTab('ports')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'ports'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            Mapa de Portas
          </button>
          <button
            onClick={() => setActiveTab('cicd')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'cicd'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            Automação CI/CD
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'guide'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            Guia & Tutoriais
          </button>
        </nav>

        {/* Zone 3: Actions + User Auth */}
        <div className="flex items-center gap-2">
          {user ? (
            <div
              className="hidden sm:flex items-center gap-2 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs"
              title={`Operador DevOps autenticado: ${user.email}. Identifica você nas operações de deploy.`}
            >
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="w-5 h-5 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <User className="w-4 h-4 text-emerald-400" />
              )}
              <span className="text-slate-300 font-mono text-[11px] truncate max-w-[120px]">
                {user.displayName || user.email}
              </span>
              <button
                onClick={onLogout}
                className="text-slate-400 hover:text-rose-400 ml-1 p-0.5 cursor-pointer"
                title="Desconectar conta Google"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : onLogin ? (
            <button
              onClick={onLogin}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
              title="Para que serve? Vincula sua conta Google como Administrador DevOps no painel para auditoria e controle de acesso aos servidores e banco na nuvem."
            >
              <LogIn className="w-3.5 h-3.5 text-emerald-400" />
              <span>Login Google</span>
            </button>
          ) : null}

          <button
            onClick={onNewServer}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 border border-slate-700/80 rounded-lg hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
          >
            <Server className="w-3.5 h-3.5 text-slate-400" />
            <span>+ Adicionar VPS</span>
          </button>
          <button
            onClick={onNewProject}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer shadow-sm shadow-emerald-500/10"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Aplicação</span>
          </button>
        </div>
      </div>

      {/* Mobile nav bar row */}
      <div className="flex md:hidden overflow-x-auto gap-1 mt-2.5 pt-2 border-t border-slate-800/60 text-xs">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-2.5 py-1 rounded whitespace-nowrap ${
            activeTab === 'dashboard' ? 'bg-slate-800 text-white' : 'text-slate-400'
          }`}
        >
          Visão Geral
        </button>
        <button
          onClick={() => setActiveTab('projects')}
          className={`px-2.5 py-1 rounded whitespace-nowrap ${
            activeTab === 'projects' ? 'bg-slate-800 text-white' : 'text-slate-400'
          }`}
        >
          Aplicações
        </button>
        <button
          onClick={() => setActiveTab('servers')}
          className={`px-2.5 py-1 rounded whitespace-nowrap ${
            activeTab === 'servers' ? 'bg-slate-800 text-white' : 'text-slate-400'
          }`}
        >
          Servidores
        </button>
        <button
          onClick={() => setActiveTab('ports')}
          className={`px-2.5 py-1 rounded whitespace-nowrap ${
            activeTab === 'ports' ? 'bg-slate-800 text-white' : 'text-slate-400'
          }`}
        >
          Portas
        </button>
        <button
          onClick={() => setActiveTab('cicd')}
          className={`px-2.5 py-1 rounded whitespace-nowrap ${
            activeTab === 'cicd' ? 'bg-slate-800 text-white' : 'text-slate-400'
          }`}
        >
          CI/CD
        </button>
        <button
          onClick={() => setActiveTab('guide')}
          className={`px-2.5 py-1 rounded whitespace-nowrap ${
            activeTab === 'guide' ? 'bg-slate-800 text-white' : 'text-slate-400'
          }`}
        >
          Guia
        </button>
      </div>
    </header>
  );
};
