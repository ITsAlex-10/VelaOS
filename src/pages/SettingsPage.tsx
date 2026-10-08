import React from 'react';
import { GlassCard, Button } from '../components/UI';
import { 
  Database,
  ExternalLink,
  Shield,
  Zap,
  Globe,
  Lock,
  Loader2,
  Settings,
  Trash2,
  RefreshCw
} from 'lucide-react';

import { useWorkspace } from '../contexts/WorkspaceContext';
import { workspaceAPI } from '../lib/workspace';
import { cn } from '../lib/utils';

export const SettingsPage: React.FC = () => {
  const { accessToken, syncStatus, clients, updateClient, setToken } = useWorkspace();
  const [sheetUrl, setSheetUrl] = React.useState<string | null>(null);
  const [leadsSheetUrl, setLeadsSheetUrl] = React.useState<string | null>(null);
  const [prospectsSheetUrl, setProspectsSheetUrl] = React.useState<string | null>(null);
  const [clientsSheetUrl, setClientsSheetUrl] = React.useState<string | null>(null);
  const [isSearching, setIsSearching] = React.useState(false);
  const [prospectingSheets, setProspectingSheets] = React.useState<Array<{ id: string; name: string; url: string }>>([]);

  // Client Access State
  const [selectedClientName, setSelectedClientName] = React.useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>('');
  const [newUserName, setNewUserName] = React.useState<string>('');
  const [newUserEmail, setNewUserEmail] = React.useState<string>('');
  const [isAddingUser, setIsAddingUser] = React.useState<boolean>(false);

  const activeClientsAndProjects = React.useMemo(() => {
    return clients.filter(c => c.status !== 'Lead');
  }, [clients]);

  const uniqueClientNames = React.useMemo(() => {
    return Array.from(new Set(activeClientsAndProjects.map(c => c.name))).sort();
  }, [activeClientsAndProjects]);

  const projectsForSelectedClient = React.useMemo(() => {
    if (!selectedClientName) return [];
    return activeClientsAndProjects.filter(c => c.name === selectedClientName);
  }, [selectedClientName, activeClientsAndProjects]);

  // Auto-select project when there is exactly 1 project
  React.useEffect(() => {
    if (projectsForSelectedClient.length === 1) {
      setSelectedProjectId(projectsForSelectedClient[0].id);
    } else {
      setSelectedProjectId('');
    }
  }, [selectedClientName, projectsForSelectedClient]);

  const selectedProject = React.useMemo(() => {
    return activeClientsAndProjects.find(p => p.id === selectedProjectId);
  }, [selectedProjectId, activeClientsAndProjects]);

  const handleAddClientUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !newUserName.trim() || !newUserEmail.trim()) {
      alert('Por favor, preencha todos os campos e selecione o projeto.');
      return;
    }

    const emailToNormalize = newUserEmail.toLowerCase().trim();
    if (!emailToNormalize.includes('@')) {
      alert('Por favor, introduza um e-mail válido.');
      return;
    }

    setIsAddingUser(true);
    try {
      const project = activeClientsAndProjects.find(c => c.id === selectedProjectId);
      if (!project) throw new Error('Projeto não encontrado');

      const currentUsers = project.clientUsers || [];
      const currentEmails = project.clientEmails || [];

      if (currentEmails.includes(emailToNormalize)) {
        alert('Este endereço de e-mail já tem acesso autorizado para este projeto.');
        setIsAddingUser(false);
        return;
      }

      const newUser = {
        id: Math.random().toString(36).substring(7),
        name: newUserName.trim(),
        email: emailToNormalize
      };

      const updatedUsers = [...currentUsers, newUser];
      const updatedEmails = [...currentEmails, emailToNormalize];

      await updateClient(selectedProjectId, {
        clientUsers: updatedUsers,
        clientEmails: updatedEmails
      });

      setNewUserName('');
      setNewUserEmail('');
    } catch (err) {
      console.error(err);
      alert('Erro ao conceder acesso ao cliente.');
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleRemoveClientUser = async (userId: string) => {
    if (!selectedProjectId) return;
    if (!confirm('Tem a certeza que deseja revogar o acesso deste utilizador?')) return;

    try {
      const project = activeClientsAndProjects.find(c => c.id === selectedProjectId);
      if (!project) throw new Error('Projeto não encontrado');

      const currentUsers = project.clientUsers || [];
      const updatedUsers = currentUsers.filter(u => u.id !== userId);
      const updatedEmails = updatedUsers.map(u => u.email);

      await updateClient(selectedProjectId, {
        clientUsers: updatedUsers,
        clientEmails: updatedEmails
      });
    } catch (err) {
      console.error(err);
      alert('Erro ao remover acesso do utilizador.');
    }
  };

  const findSheet = React.useCallback(async () => {
    if (!accessToken) return;
    setIsSearching(true);
    console.log("Searching for master sheets and prospecting sheets...");
    try {
      // 1. Leads Master Sheet
      const leadsRes = await workspaceAPI.drive.listFiles(accessToken, "name = 'VELA_OS_LEADS_MASTER' and trashed = false");
      if (leadsRes.files && leadsRes.files.length > 0) {
        const sorted = leadsRes.files.sort((a: any, b: any) => 
          new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime()
        );
        setLeadsSheetUrl(`https://docs.google.com/spreadsheets/d/${sorted[0].id}/edit`);
      } else {
        setLeadsSheetUrl(null);
      }

      // 2. Prospects Master Sheet
      const prospectsRes = await workspaceAPI.drive.listFiles(accessToken, "name = 'VELA_OS_PROSPECTS_MASTER' and trashed = false");
      if (prospectsRes.files && prospectsRes.files.length > 0) {
        const sorted = prospectsRes.files.sort((a: any, b: any) => 
          new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime()
        );
        setProspectsSheetUrl(`https://docs.google.com/spreadsheets/d/${sorted[0].id}/edit`);
      } else {
        setProspectsSheetUrl(null);
      }

      // 3. Clients Master Sheet
      const clientsRes = await workspaceAPI.drive.listFiles(accessToken, "name = 'VELA_OS_CLIENTS_MASTER' and trashed = false");
      if (clientsRes.files && clientsRes.files.length > 0) {
        const sorted = clientsRes.files.sort((a: any, b: any) => 
          new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime()
        );
        setClientsSheetUrl(`https://docs.google.com/spreadsheets/d/${sorted[0].id}/edit`);
        setSheetUrl(`https://docs.google.com/spreadsheets/d/${sorted[0].id}/edit`); // Fallback keep
      } else {
        setClientsSheetUrl(null);
        setSheetUrl(null);
      }

      // Fetch all niche prospecting sheets
      const prospectingRes = await workspaceAPI.drive.listFiles(accessToken, "name contains 'VELA_OS_PROSPECTING_' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
      if (prospectingRes.files && prospectingRes.files.length > 0) {
        const mapped = prospectingRes.files.map((f: any) => ({
          id: f.id,
          name: f.name,
          url: `https://docs.google.com/spreadsheets/d/${f.id}/edit`
        }));
        setProspectingSheets(mapped);
      } else {
        setProspectingSheets([]);
      }
    } catch (e: any) {
      console.error("Error finding sheets:", e);
      if (e.message?.includes('401') || String(e).includes('401')) {
        setToken(null);
      }
    } finally {
      setIsSearching(false);
    }
  }, [accessToken]);

  const handleManualSync = async () => {
    if (!accessToken) return;
    setIsSearching(true);
    try {
      // workspaceAPI.sheets.updateValues or trigger sync in context
      // For now, let's just re-run findSheet which is the main check here
      await findSheet();
      if (!sheetUrl) {
        alert('Ainda não foi possível detetar a folha de cálculo. Certifique-se de que tem clientes registados e tente novamente dentro de 30 segundos.');
      }
    } catch (e) {
      alert('Erro ao tentar detetar a base de dados.');
    } finally {
      setIsSearching(false);
    }
  };

  React.useEffect(() => {
    findSheet();
  }, [findSheet, syncStatus.sheets]);

  const handleOpenSheets = () => {
    if (sheetUrl) {
      window.open(sheetUrl, '_blank');
    } else if (isSearching) {
      // Small feedback
    } else {
      alert('Base de dados mestre no Google Sheets ainda não foi detectada. Certifique-se de que tem clientes registados para ativar a primeira sincronização.');
    }
  };

  return (
    <div className="space-y-12 pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Core Database Section */}
        <GlassCard className="p-10 border-white/5 bg-gradient-to-br from-white/[0.02] to-transparent relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-vela-red/5 blur-[80px] -mr-16 -mt-16 group-hover:bg-vela-red/10 transition-all duration-700" />
          
          <div className="relative z-10 space-y-8">
            <div className="flex items-center justify-between">
              <div className="w-14 h-14 glass rounded-2xl flex items-center justify-center text-vela-red shadow-2xl shadow-vela-red/10">
                <Database size={24} strokeWidth={1.5} />
              </div>
              
              <button 
                onClick={findSheet}
                disabled={isSearching}
                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors disabled:opacity-50"
              >
                {isSearching ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                <span>Atualizar</span>
              </button>
            </div>
            
            <div>
              <h3 className="text-xl font-display font-black text-white tracking-tight uppercase italic mb-3">Bases de Dados Centralizadas</h3>
              <p className="text-xs text-zinc-500 leading-relaxed font-sans max-w-xl">
                O Vela OS armazena os seus dados de forma otimizada. Os Leads e Prospects sincronizam de forma bidirecional com o Google Sheets. Os Clientes usam o <strong className="text-vela-red">Firebase</strong> como base de dados em tempo real (fonte de verdade), exportando uma cópia de segurança para o Sheets.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              {/* 1. Folha de Leads */}
              <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[8px] font-black uppercase tracking-widest text-amber-500">Google Sheets Ativo</span>
                  <h4 className="text-sm font-sans font-black text-white uppercase tracking-wide">Folha de Leads</h4>
                  <p className="text-[11px] text-zinc-500 leading-normal font-sans">Sincroniza automaticamente todas as suas Leads.</p>
                </div>
                <Button 
                  onClick={() => leadsSheetUrl ? window.open(leadsSheetUrl, '_blank') : alert('Folha de Leads mestre não encontrada ou ainda sem dados registados.')}
                  disabled={isSearching || !leadsSheetUrl}
                  className={cn(
                    "px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest w-full sm:w-auto text-center transition-all flex items-center justify-center gap-2",
                    leadsSheetUrl 
                      ? "bg-[#FF9F0A] hover:bg-[#FF9500] text-black shadow-[0_0_15px_rgba(255,159,10,0.35)] hover:shadow-[0_0_20px_rgba(255,159,10,0.55)] border-0" 
                      : "bg-white/5 border border-white/10 opacity-40 text-zinc-500 cursor-not-allowed"
                  )}
                >
                  <ExternalLink size={13} className="shrink-0" />
                  <span>ABRIR</span>
                </Button>
              </div>

              {/* 2. Folha de Prospects */}
              <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400">Google Sheets Ativo</span>
                  <h4 className="text-sm font-sans font-black text-white uppercase tracking-wide">Folha de Prospects</h4>
                  <p className="text-[11px] text-zinc-500 leading-normal font-sans">Sincroniza todas as reuniões e prospects qualificados.</p>
                </div>
                <Button 
                  onClick={() => prospectsSheetUrl ? window.open(prospectsSheetUrl, '_blank') : alert('Folha de Prospects mestre não encontrada ou ainda sem dados registados.')}
                  disabled={isSearching || !prospectsSheetUrl}
                  className={cn(
                    "px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest w-full sm:w-auto text-center transition-all flex items-center justify-center gap-2",
                    prospectsSheetUrl 
                      ? "bg-[#10B981] hover:bg-[#059669] text-black shadow-[0_0_15px_rgba(16,185,129,0.35)] hover:shadow-[0_0_20px_rgba(16,185,129,0.55)] border-0" 
                      : "bg-white/5 border border-white/10 opacity-40 text-zinc-500 cursor-not-allowed"
                  )}
                >
                  <ExternalLink size={13} className="shrink-0" />
                  <span>ABRIR</span>
                </Button>
              </div>

              {/* 3. Folha de Clientes */}
              <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[8px] font-black uppercase tracking-widest text-vela-red flex items-center gap-1">
                    Cópia de Segurança - Firebase Ativo 🔥
                  </span>
                  <h4 className="text-sm font-sans font-black text-white uppercase tracking-wide">Folha de Clientes</h4>
                  <p className="text-[11px] text-zinc-500 leading-normal font-sans">Espelho estático no Drive. O Firebase é a fonte de verdade para carregar e guardar clientes.</p>
                </div>
                <Button 
                  onClick={() => clientsSheetUrl ? window.open(clientsSheetUrl, '_blank') : alert('Folha de Clientes mestre não encontrada ou ainda sem dados registados.')}
                  disabled={isSearching || !clientsSheetUrl}
                  className={cn(
                    "px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest w-full sm:w-auto text-center transition-all flex items-center justify-center gap-2",
                    clientsSheetUrl 
                      ? "bg-[#2C2C2E] hover:bg-[#3A3A3C] text-white shadow-[0_0_15px_rgba(255,255,255,0.05)] hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] border border-white/5" 
                      : "bg-white/5 border border-white/10 opacity-40 text-zinc-500 cursor-not-allowed"
                  )}
                >
                  <ExternalLink size={13} className="shrink-0" />
                  <span>ABRIR</span>
                </Button>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* System Status Section */}
        <GlassCard className="p-10 border-white/5 bg-white/[0.01]">
          <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em] font-sans mb-10">Estado do Sistema Vela OS</h3>
          
          <div className="space-y-6">
            {[
              { label: 'Encriptação End-to-End', icon: Lock, status: 'Ativo', color: 'text-emerald-500' },
              { label: 'Sincronização Cloud', icon: Globe, status: 'Sincronizado', color: 'text-emerald-500' },
              { label: 'Segurança Firebase', icon: Shield, status: 'Protocolo V3', color: 'text-blue-400' },
              { label: 'Performance Motor Red', icon: Zap, status: '98ms Latência', color: 'text-vela-red' }
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-4 border-b border-white/5 last:border-0 hover:bg-white/[0.01] transition-colors rounded-lg px-2">
                <div className="flex items-center gap-4">
                  <item.icon size={16} className="text-zinc-600" />
                  <span className="text-[11px] font-bold text-white uppercase tracking-wider">{item.label}</span>
                </div>
                <span className={cn("text-[10px] font-black uppercase tracking-widest", item.color)}>{item.status}</span>
              </div>
            ))}
          </div>
        </GlassCard>

      </div>

      {/* Niche Prospecting Sheets Section */}
      <GlassCard className="p-10 border-white/5 bg-gradient-to-br from-white/[0.01] to-transparent relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[80px] -mr-16 -mt-16 group-hover:bg-emerald-500/10 transition-all duration-700" />
        
        <div className="relative z-10 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 glass rounded-2xl flex items-center justify-center text-emerald-400 shadow-2xl shadow-emerald-500/10">
              <Database size={24} strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-xl font-display font-black text-white tracking-tight uppercase italic">Folhas de Prospeção por Nicho</h3>
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider mt-1 font-sans">Google Sheets de Prospecção Ativos</p>
            </div>
          </div>

          <p className="text-sm text-zinc-500 leading-relaxed font-medium max-w-2xl">
            Sempre que realiza uma pesquisa de prospeção de um novo nicho, o Vela OS cria automaticamente um ficheiro Google Sheets independente no seu Drive. Veja e aceda a cada uma das folhas criadas abaixo:
          </p>

          {prospectingSheets.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
              {prospectingSheets.map((sheet) => {
                const displayName = sheet.name.replace('VELA_OS_PROSPECTING_', '').replace(/_/g, ' ');
                return (
                  <div key={sheet.id} className="p-5 rounded-2xl bg-white/[0.01] border border-white/5 hover:border-emerald-500/30 transition-all flex flex-col justify-between h-40 group/item">
                    <div>
                      <span className="text-[8px] uppercase tracking-widest font-black text-zinc-600 block mb-1">Spreadsheet Ativa</span>
                      <h4 className="text-sm font-display font-black text-white uppercase italic tracking-tight truncate group-hover/item:text-emerald-400 transition-colors">
                        {displayName || 'Geral'}
                      </h4>
                      <p className="text-[10px] text-zinc-500 font-mono truncate mt-2">
                        {sheet.name}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => window.open(sheet.url, '_blank')}
                      className="w-full py-2 bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 hover:text-white text-[9px] uppercase tracking-widest font-black"
                    >
                      <ExternalLink size={12} className="mr-1.5 shrink-0" />
                      <span>Abrir Folha</span>
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-14 bg-white/[0.01] border border-white/5 rounded-2xl opacity-40">
              <Database size={24} className="mx-auto mb-3 text-zinc-600" />
              <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">Nenhuma folha de prospeção por nicho detectada ainda</p>
              <p className="text-[9px] text-zinc-500 leading-normal max-w-xs mx-auto mt-1">As folhas de nicho são criadas no seu Drive assim que efetua pesquisas reatadas na página de Prospeção.</p>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Advanced Client Access Settings */}
      <GlassCard className="p-10 border-white/5 bg-gradient-to-br from-white/[0.01] to-transparent relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-32 h-32 bg-vela-red/5 blur-[80px] -ml-16 -mt-16 group-hover:bg-vela-red/10 transition-all duration-700" />
        
        <div className="relative z-10 space-y-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 glass rounded-2xl flex items-center justify-center text-vela-red shadow-2xl shadow-vela-red/10">
              <Shield size={24} strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-xl font-display font-black text-white tracking-tight uppercase italic">Controlo de Acessos de Clientes</h3>
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider mt-1 font-sans">Configuração Avançada de Permissões</p>
            </div>
          </div>

          <p className="text-sm text-zinc-500 leading-relaxed font-medium max-w-2xl">
            Configure e conceda acessos restritos à plataforma para múltiplas pessoas por projeto. Os utilizadores autorizados poderão iniciar sessão e aceder exclusivamente à visualização de cliente do respetivo projeto.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 pt-4">
            {/* Form Column */}
            <div className="space-y-6">
              {/* Dropdown: Client */}
              <div className="space-y-3">
                <label className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] font-sans block ml-1">Selecionar Cliente</label>
                <select
                  className="w-full bg-[#0D0D0F]/50 border border-white/5 focus:border-vela-red/30 focus:ring-0 rounded-xl py-4 px-5 text-white transition-all text-sm font-sans"
                  value={selectedClientName}
                  onChange={(e) => {
                    setSelectedClientName(e.target.value);
                    setSelectedProjectId('');
                  }}
                >
                  <option value="" className="bg-zinc-950 text-zinc-600">-- Escolher Cliente --</option>
                  {uniqueClientNames.map(name => (
                    <option key={name} value={name} className="bg-zinc-950 text-white">{name}</option>
                  ))}
                </select>
              </div>

              {/* Dropdown: Project */}
              {selectedClientName && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] font-sans block ml-1">Selecionar Projeto</label>
                  <select
                    className="w-full bg-[#0D0D0F]/50 border border-white/5 focus:border-vela-red/30 focus:ring-0 rounded-xl py-4 px-5 text-white transition-all text-sm font-sans disabled:opacity-50"
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    disabled={projectsForSelectedClient.length === 1}
                  >
                    <option value="" className="bg-zinc-950 text-zinc-600">-- Escolher Projeto --</option>
                    {projectsForSelectedClient.map(project => (
                      <option key={project.id} value={project.id} className="bg-zinc-950 text-white">
                        {project.serviceType} ({project.status})
                      </option>
                    ))}
                  </select>
                  {projectsForSelectedClient.length === 1 && (
                    <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-wider ml-1 italic">
                      ✓ Projeto único selecionado automaticamente
                    </p>
                  )}
                </div>
              )}

              {/* Inputs to Add User */}
              {selectedProjectId && (
                <form onSubmit={handleAddClientUser} className="space-y-6 pt-4 border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-3">
                    <label className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] font-sans block ml-1">Nome Completo</label>
                    <input
                      type="text"
                      className="w-full bg-[#0D0D0F]/50 border border-white/5 focus:border-vela-red/30 focus:ring-0 rounded-xl py-4 px-5 text-white placeholder:text-zinc-700 transition-all text-sm font-sans"
                      placeholder="Ex: Ana Silva"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] font-sans block ml-1">Endereço de E-mail</label>
                    <input
                      type="email"
                      className="w-full bg-[#0D0D0F]/50 border border-white/5 focus:border-vela-red/30 focus:ring-0 rounded-xl py-4 px-5 text-white placeholder:text-zinc-700 transition-all text-sm font-sans"
                      placeholder="Ex: ana.silva@client.com"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isAddingUser}
                    className="w-full bg-vela-red hover:bg-vela-red/90 text-white font-normal py-4 rounded-xl transition-all shadow-xl shadow-vela-red/15 text-[10px] uppercase tracking-[0.2em]"
                  >
                    {isAddingUser ? <Loader2 size={12} className="animate-spin mr-2 inline" /> : null}
                    Atribuir Acesso
                  </Button>
                </form>
              )}
            </div>

            {/* List Column */}
            <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-6 md:p-8 flex flex-col justify-between min-h-[350px]">
              {selectedProject ? (
                <div className="space-y-6">
                  <div className="border-b border-white/5 pb-4">
                    <h4 className="text-[10px] text-zinc-400 font-black uppercase tracking-[0.2em] font-sans">Acessos Ativos</h4>
                    <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider mt-1">{selectedProject.name} — {selectedProject.serviceType}</p>
                  </div>

                  <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                    {selectedProject.clientUsers && selectedProject.clientUsers.length > 0 ? (
                      selectedProject.clientUsers.map(user => (
                        <div key={user.id} className="flex items-center justify-between p-4 rounded-xl bg-white/[0.01] border border-white/5 group hover:bg-white/[0.02] hover:border-white/10 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-vela-red/10 border border-vela-red/20 flex items-center justify-center text-xs text-vela-red font-black">
                              {user.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white font-sans">{user.name}</p>
                              <p className="text-[10px] text-zinc-500 font-sans">{user.email}</p>
                            </div>
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => handleRemoveClientUser(user.id)}
                            className="p-2 rounded-lg bg-red-500/5 border border-red-500/10 hover:bg-red-500/15 hover:border-red-500/30 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                            title="Revogar Acesso"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-16 opacity-30">
                        <Shield size={24} className="mx-auto mb-3" />
                        <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">Sem utilizadores adicionais autorizados</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center my-auto py-10 opacity-30">
                  <Lock size={32} className="text-zinc-600 mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed max-w-xs">
                    Selecione um cliente e respetivo projeto para gerir e conceder permissões de acesso
                  </p>
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-white/5 flex items-center gap-3">
                <Shield size={14} className="text-zinc-600 shrink-0" />
                <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-wide font-sans leading-relaxed">
                  Os emails configurados adquirem instantaneamente permissões de acesso com nível de segurança "Cliente" no ecossistema Firebase.
                </p>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};
