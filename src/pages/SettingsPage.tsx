import React from 'react';
import { GlassCard, Button, Modal, Input, Select, Badge } from '../components/UI';
import { 
  Database,
  ExternalLink,
  Shield,
  Globe,
  Lock,
  Loader2,
  Trash2,
  RefreshCw,
  Folder,
  Plus
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
  const [nicheSheetsData, setNicheSheetsData] = React.useState<Array<any>>([]);
  const [looseSheets, setLooseSheets] = React.useState<Array<any>>([]);

  const fetchNicheSheetsData = React.useCallback(async () => {
    try {
      const res = await fetch('/api/backend/list-niche-sheets');
      const data = await res.json();
      if (data.success) {
        setNicheSheetsData(data.niches || []);
        setLooseSheets(data.looseSheets || []);
      }
    } catch (e) {
      console.error("Failed to load niche sheets:", e);
    }
  }, []);

  const [isNicheModalOpen, setIsNicheModalOpen] = React.useState(false);
  const [newNicheInput, setNewNicheInput] = React.useState('');

  const [isSheetModalOpen, setIsSheetModalOpen] = React.useState(false);
  const [activeNicheForSheet, setActiveNicheForSheet] = React.useState<{ name: string; folderId: string } | null>(null);
  const [newSheetInput, setNewSheetInput] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const submitCreateNiche = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNicheInput.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/backend/create-niche-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nicheName: newNicheInput.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setNewNicheInput('');
        setIsNicheModalOpen(false);
        fetchNicheSheetsData();
      } else {
        alert('Erro ao criar pasta de nicho.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de rede ao criar pasta de nicho.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitCreateSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeNicheForSheet || !newSheetInput.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/backend/create-regional-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          nicheName: activeNicheForSheet.name, 
          regionName: newSheetInput.trim(), 
          folderId: activeNicheForSheet.folderId 
        })
      });
      const data = await res.json();
      if (data.success) {
        setNewSheetInput('');
        setIsSheetModalOpen(false);
        setActiveNicheForSheet(null);
        fetchNicheSheetsData();
      } else {
        alert('Erro ao criar folha sheets.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de rede ao criar folha sheets.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSheet = async (fileId: string, title: string) => {
    if (!confirm(`Tem a certeza que deseja apagar a folha/pasta "${title}"?`)) return;
    try {
      let res = await fetch(`/api/backend/delete-sheet/${encodeURIComponent(fileId)}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        res = await fetch('/api/backend/delete-sheet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileId })
        });
      }
      const data = await res.json();
      if (data.success) {
        alert('Ficheiro apagado com sucesso.');
        fetchNicheSheetsData();
      } else {
        alert('Erro ao apagar ficheiro.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao apagar ficheiro.');
    }
  };

  const handleClearAllNiches = async () => {
    if (!confirm("Tem a certeza que deseja eliminar todas as pastas e folhas sheets dentro da zona de Folhas de Prospeção por Nicho?")) return;
    try {
      const res = await fetch('/api/backend/clear-all-niches', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert('Todas as pastas de nicho e folhas regionais foram eliminadas com sucesso.');
        fetchNicheSheetsData();
      } else {
        alert('Erro ao eliminar pastas e folhas de nicho.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de rede ao eliminar pastas e folhas de nicho.');
    }
  };

  React.useEffect(() => {
    fetchNicheSheetsData();
  }, [fetchNicheSheetsData]);

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
      if (e.message?.includes('401') || String(e).includes('401')) {
        setToken(null);
      } else {
        console.warn("Error finding sheets:", e);
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
    <div className="space-y-8 pb-16">
      {/* Top 2-Col Grid: Databases & Real System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Core Database Section (7 cols) */}
        <GlassCard className="lg:col-span-7 p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4 pb-5 mb-6 border-b border-white/[0.06]">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-vela-red/10 border border-vela-red/20 flex items-center justify-center text-vela-red shrink-0">
                <Database size={20} strokeWidth={1.75} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Bases de Dados Centralizadas
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Sincronização entre Firebase (tempo real) e Google Sheets
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={findSheet}
              disabled={isSearching}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] hover:border-white/[0.14] text-xs font-semibold text-zinc-300 hover:text-white hover:-translate-y-[1px] active:translate-y-0 transition-all duration-150 disabled:opacity-50 disabled:hover:translate-y-0 shrink-0"
            >
              {isSearching ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              <span>Atualizar</span>
            </button>
          </div>

          <div className="divide-y divide-white/[0.06]">
            {/* 1. Folha de Leads */}
            <div className="py-4 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-white">Folha de Leads</h4>
                  <Badge variant="warning">Google Sheets</Badge>
                </div>
                <p className="text-xs text-zinc-400">Sincroniza automaticamente todas as Leads registadas.</p>
              </div>
              <Button
                variant="secondary"
                onClick={() => leadsSheetUrl ? window.open(leadsSheetUrl, '_blank') : alert('Folha de Leads mestre não encontrada ou ainda sem dados registados.')}
                disabled={isSearching || !leadsSheetUrl}
                className="text-xs py-2 px-4 shrink-0"
              >
                <ExternalLink size={13} />
                <span>Abrir Folha</span>
              </Button>
            </div>

            {/* 2. Folha de Prospects */}
            <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-white">Folha de Prospects</h4>
                  <Badge variant="success">Google Sheets</Badge>
                </div>
                <p className="text-xs text-zinc-400">Sincroniza reuniões e prospects qualificados.</p>
              </div>
              <Button
                variant="secondary"
                onClick={() => prospectsSheetUrl ? window.open(prospectsSheetUrl, '_blank') : alert('Folha de Prospects mestre não encontrada ou ainda sem dados registados.')}
                disabled={isSearching || !prospectsSheetUrl}
                className="text-xs py-2 px-4 shrink-0"
              >
                <ExternalLink size={13} />
                <span>Abrir Folha</span>
              </Button>
            </div>

            {/* 3. Folha de Clientes */}
            <div className="py-4 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-white">Folha de Clientes</h4>
                  <Badge variant="primary">Backup Firebase</Badge>
                </div>
                <p className="text-xs text-zinc-400">Cópia de segurança automática no Google Drive a partir do Firebase.</p>
              </div>
              <Button
                variant="secondary"
                onClick={() => clientsSheetUrl ? window.open(clientsSheetUrl, '_blank') : alert('Folha de Clientes mestre não encontrada ou ainda sem dados registados.')}
                disabled={isSearching || !clientsSheetUrl}
                className="text-xs py-2 px-4 shrink-0"
              >
                <ExternalLink size={13} />
                <span>Abrir Folha</span>
              </Button>
            </div>
          </div>
        </GlassCard>

        {/* Infrastructure Status (5 cols — Live State) */}
        <GlassCard className="lg:col-span-5 p-6 sm:p-8">
          <div className="pb-5 mb-5 border-b border-white/[0.06]">
            <h3 className="text-base font-bold text-white tracking-tight">Estado das Integrações</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Ligações ativas nesta sessão</p>
          </div>

          <div className="divide-y divide-white/[0.06]">
            {[
              {
                label: 'Base de Dados Firebase',
                icon: Database,
                status: `${clients.length} registos`,
                active: true
              },
              {
                label: 'Google Drive (Pastas)',
                icon: Folder,
                status: syncStatus.drive ? 'Ligado' : 'Desligado',
                active: syncStatus.drive
              },
              {
                label: 'Google Sheets (Sync)',
                icon: Globe,
                status: syncStatus.sheets ? 'Sincronizado' : 'Aguarda token',
                active: syncStatus.sheets
              },
              {
                label: 'Google Calendar & Meet',
                icon: Shield,
                status: syncStatus.calendar ? 'Ativo' : 'Desligado',
                active: syncStatus.calendar
              },
              {
                label: 'Sessão OAuth Workspace',
                icon: Lock,
                status: accessToken ? 'Autenticada' : 'Sem token',
                active: !!accessToken
              }
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <item.icon size={15} className={item.active ? "text-vela-red" : "text-zinc-600"} />
                  <span className="text-xs font-medium text-zinc-200">{item.label}</span>
                </div>
                <span className={cn(
                  "text-xs font-semibold tabular-nums",
                  item.active ? "text-emerald-400" : "text-zinc-500"
                )}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Niche Prospecting Sheets Section */}
      <GlassCard className="p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-6 border-b border-white/[0.06]">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Folder size={20} strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                Folhas de Prospeção por Nicho
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Pastas por setor e folhas regionais partilhadas para exportação de leads
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="success"
            onClick={() => setIsNicheModalOpen(true)}
            className="text-xs px-4 py-2.5 shrink-0"
          >
            <Plus size={14} /> Criar Pasta de Nicho
          </Button>
        </div>

        {nicheSheetsData.length > 0 ? (
          <div className="space-y-5">
            {nicheSheetsData.map((niche) => (
              <div key={niche.folderId} className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <Folder size={18} className="text-emerald-400 shrink-0" />
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        {niche.nicheName}
                      </h4>
                      <a
                        href={niche.folderLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 hover:translate-x-0.5 inline-flex items-center gap-1 mt-0.5 transition-all duration-150"
                      >
                        <span>Abrir pasta no Drive</span>
                        <ExternalLink size={10} />
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setActiveNicheForSheet({ name: niche.nicheName, folderId: niche.folderId });
                        setIsSheetModalOpen(true);
                      }}
                      className="text-[11px] py-2 px-3"
                    >
                      <Plus size={13} /> Criar Folha Regional
                    </Button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSheet(niche.docId || niche.folderId, `Pasta ${niche.nicheName}`)}
                      className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-red-500/15 hover:border-red-500/25 text-zinc-400 hover:text-red-400 hover:-translate-y-[1px] active:translate-y-0 transition-all duration-150"
                      title="Apagar Pasta"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {niche.sheets && niche.sheets.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {niche.sheets.map((sheet: any) => (
                      <div key={sheet.spreadsheetId} className="p-3.5 rounded-xl bg-[#0D0D0F]/60 border border-white/[0.06] hover:border-white/[0.14] hover:-translate-y-[1px] transition-all duration-150 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-500 block">Folha Regional</span>
                          <p className="text-xs font-semibold text-white truncate mt-0.5">{sheet.title}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <a
                            href={sheet.webViewLink}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] border border-transparent hover:border-white/[0.1] text-zinc-300 hover:text-white hover:-translate-y-[1px] transition-all duration-150"
                            title="Abrir Folha"
                          >
                            <ExternalLink size={13} />
                          </a>
                          <button
                            type="button"
                            onClick={() => handleDeleteSheet(sheet.spreadsheetId, sheet.title)}
                            className="p-2 rounded-lg bg-white/[0.03] hover:bg-red-500/15 text-zinc-500 hover:text-red-400 hover:-translate-y-[1px] transition-all duration-150"
                            title="Apagar Folha"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500">Nenhuma folha regional criada nesta pasta.</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 border border-dashed border-white/[0.08] rounded-xl text-zinc-500">
            <Database size={26} className="mx-auto mb-3 opacity-50" />
            <p className="text-xs font-semibold text-zinc-300">Nenhuma pasta de nicho configurada</p>
            <p className="text-xs text-zinc-500 mt-1">Crie uma pasta de nicho para organizar as suas folhas regionais de prospeção.</p>
          </div>
        )}
      </GlassCard>

      {/* Client Access Control */}
      <GlassCard className="p-6 sm:p-8">
        <div className="flex items-center gap-3.5 pb-5 mb-6 border-b border-white/[0.06]">
          <div className="w-11 h-11 rounded-xl bg-vela-red/10 border border-vela-red/20 flex items-center justify-center text-vela-red shrink-0">
            <Shield size={20} strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Controlo de Acessos de Clientes
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Conceda e gerencie permissões de visualização por projeto para utilizadores externos
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Form Column */}
          <div className="space-y-4">
            <Select
              label="Selecionar Cliente"
              value={selectedClientName}
              onChange={(e) => {
                setSelectedClientName(e.target.value);
                setSelectedProjectId('');
              }}
            >
              <option value="" className="bg-zinc-950 text-zinc-500">-- Escolher Cliente --</option>
              {uniqueClientNames.map(name => (
                <option key={name} value={name} className="bg-zinc-950 text-white">{name}</option>
              ))}
            </Select>

            {selectedClientName && (
              <div className="space-y-1.5">
                <Select
                  label="Selecionar Projeto"
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  disabled={projectsForSelectedClient.length === 1}
                >
                  <option value="" className="bg-zinc-950 text-zinc-500">-- Escolher Projeto --</option>
                  {projectsForSelectedClient.map(project => (
                    <option key={project.id} value={project.id} className="bg-zinc-950 text-white">
                      {project.serviceType} ({project.status})
                    </option>
                  ))}
                </Select>
                {projectsForSelectedClient.length === 1 && (
                  <p className="text-[11px] text-emerald-400 font-medium ml-0.5">
                    Projeto único selecionado automaticamente.
                  </p>
                )}
              </div>
            )}

            {selectedProjectId && (
              <form onSubmit={handleAddClientUser} className="space-y-4 pt-4 border-t border-white/[0.06]">
                <Input
                  label="Nome Completo"
                  type="text"
                  placeholder="Ex: Ana Silva"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  required
                />

                <Input
                  label="Endereço de E-mail"
                  type="email"
                  placeholder="Ex: ana.silva@cliente.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  required
                />

                <Button type="submit" disabled={isAddingUser} className="w-full py-3">
                  {isAddingUser && <Loader2 size={14} className="animate-spin" />}
                  Atribuir Acesso
                </Button>
              </form>
            )}
          </div>

          {/* List Column */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 flex flex-col justify-between min-h-[300px]">
            {selectedProject ? (
              <div className="space-y-4">
                <div className="border-b border-white/[0.06] pb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">Acessos Ativos</h4>
                  <p className="text-xs text-zinc-500 mt-0.5">{selectedProject.name} · {selectedProject.serviceType}</p>
                </div>

                <div className="space-y-2.5 max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
                  {selectedProject.clientUsers && selectedProject.clientUsers.length > 0 ? (
                    selectedProject.clientUsers.map(user => (
                      <div key={user.id} className="flex items-center justify-between p-3 rounded-xl bg-[#0D0D0F]/50 border border-white/[0.06] hover:border-white/[0.12] transition-colors duration-150">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-vela-red/10 border border-vela-red/20 flex items-center justify-center text-xs text-vela-red font-bold shrink-0">
                            {user.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                            <p className="text-[11px] text-zinc-400 truncate">{user.email}</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveClientUser(user.id)}
                          className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 hover:-translate-y-[1px] hover:scale-105 active:scale-95 transition-all duration-150 shrink-0"
                          title="Revogar Acesso"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-zinc-500">
                      <Shield size={24} className="mx-auto mb-2 opacity-40" />
                      <p className="text-xs">Sem utilizadores adicionais autorizados.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center my-auto py-8 text-zinc-500">
                <Lock size={28} className="mb-3 opacity-40" />
                <p className="text-xs max-w-xs leading-relaxed">
                  Selecione um cliente e respetivo projeto para gerir permissões de acesso.
                </p>
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center gap-2.5 text-zinc-500">
              <Shield size={14} className="shrink-0" />
              <p className="text-[11px] leading-relaxed">
                Os emails configurados recebem acesso restrito apenas à área de cliente do projeto selecionado.
              </p>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Modal: Criar Pasta de Nicho */}
      <Modal
        isOpen={isNicheModalOpen}
        onClose={() => setIsNicheModalOpen(false)}
        title="Criar Pasta de Nicho"
        subtitle="Introduza o nome do setor ou nicho (ex: Imobiliárias, Clínicas, Restaurantes)."
        size="sm"
      >
        <form onSubmit={submitCreateNiche} className="space-y-5">
          <Input
            label="Nome do Nicho"
            type="text"
            value={newNicheInput}
            onChange={(e) => setNewNicheInput(e.target.value)}
            placeholder="Ex: Imobiliárias"
            autoFocus
            required
          />

          <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsNicheModalOpen(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black font-bold"
            >
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              Criar Pasta
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Criar Folha Sheets */}
      <Modal
        isOpen={isSheetModalOpen && !!activeNicheForSheet}
        onClose={() => setIsSheetModalOpen(false)}
        title="Criar Folha Sheets"
        subtitle={activeNicheForSheet ? `Nicho: ${activeNicheForSheet.name}` : undefined}
        size="sm"
      >
        <form onSubmit={submitCreateSheet} className="space-y-5">
          <p className="text-xs text-zinc-400 leading-relaxed">
            Introduza o nome pretendido para a nova folha Google Sheets (ex: Lisboa, Porto, Zona Norte).
          </p>
          <Input
            label="Nome da Folha"
            type="text"
            value={newSheetInput}
            onChange={(e) => setNewSheetInput(e.target.value)}
            placeholder="Ex: Lisboa"
            autoFocus
            required
          />

          <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsSheetModalOpen(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black font-bold"
            >
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              Criar Folha Sheets
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
