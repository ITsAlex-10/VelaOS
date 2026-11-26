import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { LeadsPage } from './pages/LeadsPage';
import { ClientsPage } from './pages/ClientsPage';
import { ClientProfilePage } from './pages/ClientProfilePage';
import { ProjectsPage } from './pages/ProjectsPage';
import { MeetingsPage } from './pages/MeetingsPage';
import { FinancesPage } from './pages/FinancesPage';
import { ChatPage } from './pages/ChatPage';
import { LoginPage } from './pages/LoginPage';
import { SettingsPage } from './pages/SettingsPage';
import { ProspectingPage } from './pages/ProspectingPage';
import { ProspectsPage } from './pages/ProspectsPage';
import { Client } from './types';
import { initAuth, logout } from './lib/firebase';

import { WorkspaceProvider, useWorkspace } from './contexts/WorkspaceContext';
import { BackgroundActionProvider } from './contexts/BackgroundActionContext';

function AppContent() {
  const { isAuthenticated, isLoading, setToken, enterLocalSession, clearLocalSession, clients, prospects, leads } = useWorkspace();
  
  // Persist active tab state based on rememberMe selection
  const [activeTab, setActiveTab] = useState<string>(() => {
    const isRemembered = localStorage.getItem('vela_remember_me') === 'true';
    const storedTab = isRemembered
      ? localStorage.getItem('vela_active_tab')
      : sessionStorage.getItem('vela_active_tab');
    if (!storedTab || storedTab === 'client-profile') return 'dashboard';
    return storedTab;
  });

  const [prospectsFilter, setProspectsFilter] = useState<'Por Agendar' | 'Reunião Agendada' | 'Pendente' | 'Falhado'>('Por Agendar');

  const handleSetActiveTab = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'client-profile') return;
    const isRemembered = localStorage.getItem('vela_remember_me') === 'true';
    if (isRemembered) {
      localStorage.setItem('vela_active_tab', tab);
    } else {
      sessionStorage.setItem('vela_active_tab', tab);
    }
  };

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const selectedClient = (clients || []).find(c => c.id === selectedClientId) || 
                         (prospects || []).find(p => p.id === selectedClientId) ||
                         (leads || []).find(l => l.id === selectedClientId) || null;

  const isSelectedProspect = Boolean(
    selectedClient && (
      (prospects || []).some(p => p.id === selectedClient.id) ||
      selectedClient.status === 'Por Agendar' ||
      selectedClient.status === 'Reunião Agendada' ||
      selectedClient.status === 'Falhado'
    )
  );

  const isSelectedLead = Boolean(
    selectedClient &&
    !isSelectedProspect && (
      (leads || []).some(l => l.id === selectedClient.id) ||
      selectedClient.status === 'Lead' ||
      selectedClient.status === 'Por contactar' ||
      selectedClient.status === 'Não atendeu' ||
      selectedClient.status === 'Ligar mais tarde' ||
      selectedClient.status === 'Não interessado'
    )
  );

  const selectedEntityTab: 'leads' | 'prospects' | 'clients' = isSelectedProspect
    ? 'prospects'
    : isSelectedLead
    ? 'leads'
    : 'clients';

  const lastSelectedEntityTabRef = React.useRef<'leads' | 'prospects' | 'clients'>('clients');
  if (selectedClient) {
    lastSelectedEntityTabRef.current = selectedEntityTab;
  }

  const [preSelectedChatClientId, setPreSelectedChatClientId] = useState<string | null>(null);

  const handleLogout = async () => {
    await logout();
    clearLocalSession();
    localStorage.removeItem('vela_active_tab');
    sessionStorage.removeItem('vela_active_tab');
    localStorage.removeItem('vela_remember_me');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen cinematic-bg flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-vela-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginPage 
        onLogin={(token, mode, remember) => {
          if (token) {
            setToken(token);
          } else if (mode) {
            enterLocalSession(mode, remember);
          }
          handleSetActiveTab('dashboard');
          setSelectedClientId(null);
          setPreSelectedChatClientId(null);
        }} 
      />
    );
  }

  const handleClientClick = (client: Client) => {
    setSelectedClientId(client.id);
    handleSetActiveTab('client-profile');
  };

  const handleBackToClients = () => {
    const returnTab = selectedClient ? selectedEntityTab : lastSelectedEntityTabRef.current;
    setSelectedClientId(null);
    handleSetActiveTab(returnTab);
  };

  const getTabLabel = (tab: string) => {
    const labels: Record<string, string> = {
      leads: 'Leads',
      prospects: 'Prospects',
      clients: 'Clientes',
      projects: 'Projetos',
      prospecting: 'Prospeção',
      meetings: 'Reuniões',
      finance: 'Finanças',
      chat: 'Mensagens',
      settings: 'Definições',
    };
    return labels[tab] || tab;
  };

  return (
    <Layout 
      activeTab={activeTab === 'client-profile' ? selectedEntityTab : activeTab} 
      setActiveTab={(tab) => {
        handleSetActiveTab(tab);
        setSelectedClientId(null);
      }}
      onLogout={handleLogout}
    >
      {activeTab === 'dashboard' && <Dashboard onClientClick={handleClientClick} />}
      {activeTab === 'leads' && (
        <LeadsPage 
          onLeadClick={handleClientClick}
          onNavigateToClients={() => handleSetActiveTab('clients')}
          onNavigateToProspecting={() => handleSetActiveTab('prospecting')}
        />
      )}
      {activeTab === 'prospects' && (
        <ProspectsPage 
          onProspectClick={handleClientClick}
          activeFilter={prospectsFilter}
          onFilterChange={setProspectsFilter}
        />
      )}
      {activeTab === 'clients' && (
        <ClientsPage 
          onClientClick={handleClientClick} 
          onNavigateToLeads={() => setActiveTab('leads')}
        />
      )}
      {activeTab === 'projects' && <ProjectsPage />}
      {activeTab === 'prospecting' && (
        <ProspectingPage onNavigateToClients={() => setActiveTab('leads')} />
      )}
      {activeTab === 'finance' && <FinancesPage />}
      {activeTab === 'meetings' && <MeetingsPage />}
      {activeTab === 'chat' && (
        <ChatPage 
          preSelectedClientId={preSelectedChatClientId || undefined} 
          onClearSelection={() => setPreSelectedChatClientId(null)}
        />
      )}
      {activeTab === 'settings' && <SettingsPage />}
      {activeTab === 'client-profile' && selectedClient && (
        <ClientProfilePage 
          client={selectedClient} 
          onBack={handleBackToClients} 
          onSeeInProjects={() => {
            setActiveTab('projects');
            setSelectedClientId(null);
          }}
          onOpenChat={(clientId) => {
            setPreSelectedChatClientId(clientId);
            setActiveTab('chat');
            setSelectedClientId(null);
          }}
        />
      )}
      
      {/* Fallback for unhandled tabs */}
      {['other-future-tabs'].includes(activeTab) && (
        <div className="flex flex-col items-center justify-center h-[70vh] text-center space-y-4">
          <div className="w-16 h-16 glass rounded-2xl flex items-center justify-center text-zinc-600">
            <span className="text-2xl font-display font-black italic">V</span>
          </div>
          <div>
            <h3 className="text-xl font-display font-medium text-white mb-2 uppercase tracking-tight">
              Módulo de {getTabLabel(activeTab)}
            </h3>
            <p className="text-zinc-500 text-sm max-w-xs">
              Este módulo faz parte da próxima fase do Vela OS. 
              Atualmente focado no Painel (Dashboard) e na Gestão de Clientes.
            </p>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default function App() {
  return (
    <BackgroundActionProvider>
      <WorkspaceProvider>
        <AppWithQuotaBanner />
      </WorkspaceProvider>
    </BackgroundActionProvider>
  );
}

function AppWithQuotaBanner() {
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  useEffect(() => {
    const handleQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
  }, []);

  return (
    <>
      {mapsQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}
      <AppContent />
    </>
  );
}
