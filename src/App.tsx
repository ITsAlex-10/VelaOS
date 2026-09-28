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
import { Client } from './types';
import { initAuth, logout } from './lib/firebase';

import { WorkspaceProvider, useWorkspace } from './contexts/WorkspaceContext';
import { BackgroundActionProvider } from './contexts/BackgroundActionContext';

function AppContent() {
  const { accessToken, isLoading, setToken, clients } = useWorkspace();
  
  // Persist active tab state based on rememberMe selection
  const [activeTab, setActiveTab] = useState<string>(() => {
    const isRemembered = localStorage.getItem('vela_remember_me') === 'true';
    if (isRemembered) {
      return localStorage.getItem('vela_active_tab') || 'dashboard';
    } else {
      return sessionStorage.getItem('vela_active_tab') || 'dashboard';
    }
  });

  const handleSetActiveTab = (tab: string) => {
    setActiveTab(tab);
    const isRemembered = localStorage.getItem('vela_remember_me') === 'true';
    if (isRemembered) {
      localStorage.setItem('vela_active_tab', tab);
    } else {
      sessionStorage.setItem('vela_active_tab', tab);
    }
  };

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const selectedClient = clients.find(c => c.id === selectedClientId) || null;

  const [preSelectedProjectId, setPreSelectedProjectId] = useState<string | null>(null);
  const [preSelectedChatClientId, setPreSelectedChatClientId] = useState<string | null>(null);

  const handleLogout = async () => {
    await logout();
    setToken(null);
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

  if (!accessToken) {
    return (
      <LoginPage 
        onLogin={(token) => {
          setToken(token || 'DEMO_USER');
          handleSetActiveTab('dashboard');
          setSelectedClientId(null);
          setPreSelectedProjectId(null);
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
    setSelectedClientId(null);
    if (selectedClient && (selectedClient.status === 'Lead' || selectedClient.status === 'Pendente')) {
      handleSetActiveTab('leads');
    } else {
      handleSetActiveTab('clients');
    }
  };

  const getTabLabel = (tab: string) => {
    const labels: Record<string, string> = {
      leads: 'Leads',
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
      activeTab={activeTab === 'client-profile' ? (selectedClient?.status === 'Lead' || selectedClient?.status === 'Pendente' ? 'leads' : 'clients') : activeTab} 
      setActiveTab={(tab) => {
        handleSetActiveTab(tab);
        setSelectedClientId(null);
        setPreSelectedProjectId(null);
      }}
      onLogout={handleLogout}
    >
      {activeTab === 'dashboard' && <Dashboard onClientClick={handleClientClick} />}
      {activeTab === 'leads' && (
        <LeadsPage 
          onLeadClick={handleClientClick}
          onNavigateToClients={() => setActiveTab('clients')}
          onNavigateToProspecting={() => setActiveTab('prospecting')}
        />
      )}
      {activeTab === 'clients' && (
        <ClientsPage 
          onClientClick={handleClientClick} 
          onNavigateToLeads={() => setActiveTab('leads')}
        />
      )}
      {activeTab === 'projects' && (
        <ProjectsPage 
          preSelectedId={preSelectedProjectId || undefined} 
          onClearSelection={() => setPreSelectedProjectId(null)}
        />
      )}
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
          onSeeInProjects={(clientId) => {
            setPreSelectedProjectId(clientId);
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
        <AppContent />
      </WorkspaceProvider>
    </BackgroundActionProvider>
  );
}
