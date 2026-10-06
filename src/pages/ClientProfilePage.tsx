import React from 'react';
import { GlassCard, Badge, Button, Modal, Input } from '../components/UI';
import { formatCurrency, cn } from '../lib/utils';
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  Globe, 
  Calendar, 
  MessageSquare,
  Plus,
  FileText,
  Clock,
  ChevronRight,
  Download,
  MoreVertical,
  Trash2,
  Briefcase,
  Archive,
  CheckCircle2,
  Loader2,
  Pencil,
  Check,
  X
} from 'lucide-react';
import { Client, ProjectStage, Meeting } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { StatusTransitionModal } from '../components/StatusTransitionModal';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';

interface ClientProfilePageProps {
  client: Client;
  onBack: () => void;
  onSeeInProjects: (clientId: string) => void;
  onOpenChat: (clientId: string) => void;
}

import { useWorkspace } from '../contexts/WorkspaceContext';
import { useBackgroundAction } from '../contexts/BackgroundActionContext';

export const ClientProfilePage: React.FC<ClientProfilePageProps> = ({ client, onBack, onSeeInProjects, onOpenChat }) => {
  const { scheduleMeet, refreshStatus, updateClient, deleteClient, getClientFiles, getOrCreateChatSpace, accessToken, meetings, uploadFile } = useWorkspace();
  const { runBackgroundAction } = useBackgroundAction();
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [showSyncSuccess, setShowSyncSuccess] = React.useState(false);
  const [driveFiles, setDriveFiles] = React.useState<any[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  // Filter meetings for this client with robust matching
  const clientMeetings = (meetings || []).filter(m => {
    const mSummary = (m.clientName || '').toLowerCase().trim();
    const cName = (client.name || '').toLowerCase().trim();
    const cContact = (client.contactName || '').toLowerCase().trim();
    
    if (!cName && !cContact) return false;
    
    // 1. Direct inclusion
    if (cName && mSummary.includes(cName)) return true;
    if (cContact && mSummary.includes(cContact)) return true;
    
    // 2. Reverse inclusion (if summary is a substring of the full name, e.g. "Rui Miguel")
    if (mSummary.length > 4 && cName.includes(mSummary)) return true;

    // 3. Significant word overlap
    // Remove "Reunião:", "com", etc.
    const cleanSummary = mSummary.replace(/reunião|reuniao|com|de|para|:/g, ' ').replace(/\s+/g, ' ').trim();
    const nameWords = cName.split(' ').filter(w => w.length > 2);
    
    if (nameWords.length === 0) return false;
    
    const matchedWords = nameWords.filter(nw => cleanSummary.includes(nw));
    
    // If we match any word from the client name in the summary, consider it a match
    // especially for specific business names like "Atelier", "Auditório", etc.
    if (matchedWords.length >= 1) return true;

    return false;
  });
  
  // Meeting Modal State
  const [showMeetModal, setShowMeetModal] = React.useState(false);
  const [meetDate, setMeetDate] = React.useState(new Date(Date.now() + 3600000).toISOString().slice(0, 16));

  const handleInternalSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetDate) return;

    const scheduledDate = meetDate;
    const summary = `Reunião: ${client.name}`;

    // 1. Close modal IMMEDIATELY
    setShowMeetModal(false);
    setMeetDate(new Date(Date.now() + 3600000).toISOString().slice(0, 16));

    // 2. Process in background
    runBackgroundAction({
      title: `A agendar reunião com "${client.name}"...`,
      action: async () => {
        await scheduleMeet(summary, scheduledDate + ":00");
      },
      errorMessage: `Erro ao agendar reunião com "${client.name}".`
    });
  };
  
  // Note creation state
  const [isAddingNote, setIsAddingNote] = React.useState(false);
  const [isSavingNote, setIsSavingNote] = React.useState(false);
  const [showNoteSuccess, setShowNoteSuccess] = React.useState(false);
  const [newNoteContent, setNewNoteContent] = React.useState('');

  // Note editing state
  const [editingNoteId, setEditingNoteId] = React.useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = React.useState<string>('');

  // Local state for financial inputs to allow fluid editing
  const [localTotalValue, setLocalTotalValue] = React.useState(client.totalValue || 0);
  const [localReceivedAmount, setLocalReceivedAmount] = React.useState(client.receivedAmount || 0);

  // Sync local state when client prop updates (but not during active editing)
  React.useEffect(() => {
    setLocalTotalValue(client.totalValue || 0);
  }, [client.totalValue]);

  React.useEffect(() => {
    setLocalReceivedAmount(client.receivedAmount || 0);
  }, [client.receivedAmount]);

  React.useEffect(() => {
    if (client.driveFolderId && accessToken) {
      setIsLoadingFiles(true);
      getClientFiles(client.driveFolderId)
        .then(files => {
          setDriveFiles(files || []);
        })
        .catch(err => {
          console.error("Erro ao carregar ficheiros do Drive:", err);
        })
        .finally(() => {
          setIsLoadingFiles(false);
        });
    } else {
      setDriveFiles([]);
    }
  }, [client.id, client.driveFolderId, accessToken, getClientFiles]);

  const handleSyncSession = async () => {
    setIsSyncing(true);
    try {
      await refreshStatus();
      setShowSyncSuccess(true);
      setTimeout(() => setShowSyncSuccess(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSendMessage = () => {
    if (!accessToken) {
      alert("Ligue o Google Workspace para usar o Chat.");
      return;
    }
    onOpenChat(client.id);
  };

  const [liquidatingId, setLiquidatingId] = React.useState<string | null>(null);
  const [profileTransitionTarget, setProfileTransitionTarget] = React.useState<{ client: Client, status: ProjectStage } | null>(null);

  const handleLiquidate = async (amount: number, paymentId: string) => {
    setLiquidatingId(paymentId);
    try {
      await updateClient(client.id, {
        receivedAmount: client.receivedAmount + amount,
        payments: (client.payments || []).map(p => p.id === paymentId ? { ...p, status: 'received' } : p),
        lastInteraction: new Date().toISOString()
      });
    } finally {
      setLiquidatingId(null);
    }
  };

  const [showDeleteModal, setShowDeleteModal] = React.useState(false);

  const [isEditingInfo, setIsEditingInfo] = React.useState(false);
  const [editFormData, setEditFormData] = React.useState({
    name: '',
    contactName: '',
    email: '',
    phone: '',
    dashboardEmail: '',
    serviceType: ''
  });

  const [isEditingFinance, setIsEditingFinance] = React.useState(false);
  const [editFinanceFormData, setEditFinanceFormData] = React.useState({
    totalValue: 0,
    receivedAmount: 0
  });

  const handleSaveFinance = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditingFinance(false);

    runBackgroundAction({
      title: 'A atualizar valores financeiros...',
      action: async () => {
        await updateClient(client.id, {
          totalValue: editFinanceFormData.totalValue,
          receivedAmount: editFinanceFormData.receivedAmount,
          lastInteraction: new Date().toISOString()
        });
      },
      errorMessage: 'Erro ao atualizar os valores financeiros.'
    });
  };

  const handleSaveInfo = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditingInfo(false);
    
    runBackgroundAction({
      title: 'A atualizar informações...',
      action: async () => {
        await updateClient(client.id, {
          name: editFormData.name,
          contactName: editFormData.contactName,
          email: editFormData.email,
          phone: editFormData.phone,
          dashboardEmail: editFormData.dashboardEmail,
          serviceType: editFormData.serviceType,
          lastInteraction: new Date().toISOString()
        });
      },
      errorMessage: 'Erro ao atualizar as informações.'
    });
  };

  const handleArchive = () => {
    onBack();
    runBackgroundAction({
      title: `A arquivar conta "${client.name}"...`,
      action: async () => {
        await updateClient(client.id, { status: 'Terminado' });
      },
      errorMessage: `Erro ao arquivar conta "${client.name}".`
    });
  };

  const handleDelete = () => {
    setShowDeleteModal(true);
  };

  const handleAddNote = () => {
    setIsAddingNote(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !client.driveFolderId) return;

    setIsUploading(true);
    try {
      await uploadFile(client.id, client.driveFolderId, file);
      // Refresh list
      const files = await getClientFiles(client.driveFolderId);
      setDriveFiles(files);
    } catch (err) {
      console.error(err);
      alert("Erro ao carregar ficheiro.");
    } finally {
      setIsUploading(false);
    }
  };

  const [isDragging, setIsDragging] = React.useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (!file || !client.driveFolderId) return;

    setIsUploading(true);
    try {
      await uploadFile(client.id, client.driveFolderId, file);
      // Refresh list
      const files = await getClientFiles(client.driveFolderId);
      setDriveFiles(files);
    } catch (err) {
      console.error(err);
      alert("Erro ao carregar ficheiro.");
    } finally {
      setIsUploading(false);
    }
  };

  const submitNote = () => {
    if (!newNoteContent.trim()) {
      setIsAddingNote(false);
      return;
    }

    const content = newNoteContent.trim();
    const newNote = {
      id: Math.random().toString(36).substring(7),
      content: content,
      author: 'Alex Sosa',
      date: new Date().toLocaleDateString('pt-PT')
    };

    // 1. Close note editor immediately
    setIsAddingNote(false);
    setNewNoteContent('');

    // 2. Process in background
    runBackgroundAction({
      title: 'A guardar nota...',
      action: async () => {
        await updateClient(client.id, {
          notes: [...(client.notes || []), newNote]
        });
      },
      errorMessage: 'Erro ao guardar a nota.'
    });
  };

  const handleDeleteNote = (noteId: string) => {
    const updatedNotes = (client.notes || []).filter(n => n.id !== noteId);
    runBackgroundAction({
      title: 'A eliminar nota...',
      action: async () => {
        await updateClient(client.id, {
          notes: updatedNotes
        });
      },
      errorMessage: 'Erro ao eliminar a nota.'
    });
  };

  const handleStartEditNote = (noteId: string, currentContent: string) => {
    setEditingNoteId(noteId);
    setEditingNoteContent(currentContent);
  };

  const handleSaveEditNote = (noteId: string) => {
    if (!editingNoteContent.trim()) return;
    const updatedNotes = (client.notes || []).map(n => {
      if (n.id === noteId) {
        return {
          ...n,
          content: editingNoteContent.trim(),
          date: new Date().toLocaleDateString('pt-PT')
        };
      }
      return n;
    });

    setEditingNoteId(null);
    setEditingNoteContent('');

    runBackgroundAction({
      title: 'A atualizar nota...',
      action: async () => {
        await updateClient(client.id, {
          notes: updatedNotes
        });
      },
      errorMessage: 'Erro ao atualizar a nota.'
    });
  };

  return (
    <div className="space-y-12 py-10 px-4">
      <Modal 
        isOpen={showMeetModal} 
        onClose={() => setShowMeetModal(false)} 
        title={`Agendar Reunião: ${client.name}`}
      >
        <form onSubmit={handleInternalSchedule} className="space-y-4">
          <Input 
            label="Data e Hora" 
            type="datetime-local"
            value={meetDate}
            onChange={e => setMeetDate(e.target.value)}
            required
          />
          <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-2 mb-6">
            O evento será criado no Google Calendar com link Meet automático para <strong>{client.name}</strong>.
          </p>
          <Button 
            type="submit" 
            className="w-full py-4 mt-4 transition-all"
          >
            Confirmar e Sincronizar
          </Button>
        </form>
      </Modal>

      {profileTransitionTarget && (
        <StatusTransitionModal
          isOpen={!!profileTransitionTarget}
          onClose={() => setProfileTransitionTarget(null)}
          client={profileTransitionTarget.client}
          targetStatus={profileTransitionTarget.status}
          onConfirm={async (data) => {
            await updateClient(profileTransitionTarget.client.id, data);
          }}
        />
      )}

      {showDeleteModal && (
        <ConfirmDeleteModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          itemName={client.name}
          itemType={client.status === 'Lead' ? 'Lead' : (client.status === 'Pendente' ? 'Proposta Pendente' : 'Cliente')}
          subtitle={client.contactName ? `Contacto: ${client.contactName}` : (client.email ? `Email: ${client.email}` : undefined)}
          warningNote={`Tem a certeza de que deseja eliminar permanentemente "${client.name}" e todos os registos associados? Esta ação não pode ser revertida.`}
          onConfirm={async () => {
            await deleteClient(client.id);
            onBack();
          }}
        />
      )}

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div className="flex items-center gap-8">
          <button 
            onClick={onBack}
            className="w-14 h-14 glass rounded-2xl flex items-center justify-center text-zinc-500 hover:text-white hover:border-vela-red/30 transition-all group"
          >
            <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <h2 className="text-4xl font-display font-bold tracking-tight text-white leading-none">{client.name}</h2>
              <div className="relative inline-block">
                <select
                  value={client.status}
                  onChange={(e) => {
                    const newStatus = e.target.value as ProjectStage;
                    if (newStatus !== client.status) {
                      setProfileTransitionTarget({ client, status: newStatus });
                    }
                  }}
                  className={cn(
                    "appearance-none bg-transparent pl-3 pr-8 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border font-sans cursor-pointer focus:outline-none transition-all",
                    client.status === 'Terminado' ? "text-red-500 border-red-500/20 bg-red-500/5" : 
                    client.status === 'Cliente' ? "text-emerald-400 border-emerald-400/20 bg-emerald-500/5" : 
                    client.status === 'Pendente' ? "text-yellow-400 border-yellow-400/20 bg-yellow-400/5" : 
                    client.status === 'Reunião Agendada' ? "text-emerald-400 border-emerald-400/20 bg-emerald-500/5" :
                    client.status === 'Por Agendar' ? "text-amber-500 border-amber-500/20 bg-amber-500/5" :
                    client.status === 'Falhado' ? "text-rose-500 border-red-500/20 bg-rose-500/5" :
                    "text-orange-500 border-orange-500/20 bg-orange-500/5"
                  )}
                >
                  <option value="Lead" className="bg-zinc-950 text-white">Lead</option>
                  <option value="Pendente" className="bg-zinc-950 text-white">Pendente</option>
                  <option value="Cliente" className="bg-zinc-950 text-white">Cliente</option>
                  <option value="Terminado" className="bg-zinc-950 text-white">Terminado</option>
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                  <ChevronRight size={10} className="rotate-90" />
                </div>
              </div>
            </div>
            <p className="text-sm text-zinc-500 font-medium font-sans uppercase tracking-[0.1em]">Conta Principal // {client.dashboardEmail ? `Acesso: ${client.dashboardEmail}` : 'Gerida por Alex Sosa'}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {client.status === 'Cliente' && (
            <Button 
              variant="secondary" 
              className="flex items-center gap-3 animate-in fade-in zoom-in-95 duration-300" 
              onClick={handleSendMessage}
            >
              <MessageSquare size={18} strokeWidth={1.5} /> Mensagem
            </Button>
          )}
          <Button 
            disabled={isSyncing || showSyncSuccess}
            className={cn(
               "flex items-center gap-3 shadow-2xl shadow-vela-red/20 min-w-[200px] justify-center transition-all",
               showSyncSuccess && "bg-emerald-500 hover:bg-emerald-500 shadow-emerald-500/20"
            )} 
            onClick={handleSyncSession}
          >
            {isSyncing ? (
              <Loader2 size={18} className="animate-spin" />
            ) : showSyncSuccess ? (
              <CheckCircle2 size={18} />
            ) : (
              <Calendar size={18} strokeWidth={2} />
            )}
            {isSyncing ? 'Sincronizando...' : showSyncSuccess ? 'Sincronizado' : 'Sincronizar Sessão'}
          </Button>

          <button
            type="button"
            onClick={handleDelete}
            title={`Eliminar ${client.status === 'Lead' ? 'Lead' : 'Cliente'}`}
            className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/5 hover:border-red-500/30 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 flex items-center justify-center transition-all group shrink-0"
          >
            <Trash2 size={18} strokeWidth={1.5} className="group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Left Column: Details */}
        <div className="space-y-10">
          <GlassCard className="p-8 border-white/5 bg-white/[0.01]">
            <div className="flex justify-between items-center mb-10">
              <h4 className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 font-black font-sans">Informações</h4>
              <button 
                type="button"
                onClick={() => {
                  setEditFormData({
                    name: client.name || '',
                    contactName: client.contactName || '',
                    email: client.email || '',
                    phone: client.phone || '',
                    dashboardEmail: client.dashboardEmail || '',
                    serviceType: client.serviceType || ''
                  });
                  setIsEditingInfo(true);
                }}
                className="text-[10px] font-black uppercase tracking-widest text-vela-red hover:text-vela-red/80 transition-all font-sans cursor-pointer"
              >
                Editar
              </button>
            </div>
            <div className="space-y-8">
              <div className="flex items-center gap-6 group">
                <div className="w-12 h-12 glass rounded-2xl flex items-center justify-center text-vela-red transition-all group-hover:scale-110">
                  <Mail size={20} strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-zinc-700 font-black uppercase tracking-[0.15em] font-sans mb-1">Email Direto</p>
                  <p className="text-sm font-bold text-white font-display truncate">{client.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-6 group">
                <div className="w-12 h-12 glass rounded-2xl flex items-center justify-center text-emerald-500 transition-all group-hover:scale-110">
                  <Phone size={20} strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-zinc-700 font-black uppercase tracking-[0.15em] font-sans mb-1">Contacto Telefónico</p>
                  <p className="text-sm font-bold text-white font-display">{client.phone || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-center gap-6 group">
                <div className="w-12 h-12 glass rounded-2xl flex items-center justify-center text-zinc-500 transition-all group-hover:scale-110">
                  <Briefcase size={20} strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-zinc-700 font-black uppercase tracking-[0.15em] font-sans mb-1">Responsável Interno</p>
                  <p className="text-sm font-bold text-white font-display">{client.contactName}</p>
                </div>
              </div>

              {/* Authorized Client Access Emails */}
              {client.clientUsers && client.clientUsers.length > 0 && (
                <div className="pt-6 border-t border-white/5 space-y-4">
                  <p className="text-[9px] text-zinc-600 font-black uppercase tracking-[0.15em] font-sans">Acessos Autorizados (Clientes)</p>
                  <div className="space-y-3">
                    {client.clientUsers.map(cu => (
                      <div key={cu.id} className="flex items-center gap-3 bg-white/[0.01] border border-white/5 p-3 rounded-xl hover:bg-white/[0.02] transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-vela-red/10 border border-vela-red/20 flex items-center justify-center text-[10px] text-vela-red font-black">
                          {cu.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-white truncate">{cu.name}</p>
                          <p className="text-[9px] text-zinc-500 truncate">{cu.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </GlassCard>

          {client.status === 'Lead' && (
            <GlassCard className="p-6 border-white/5 bg-white/[0.01]">
              <button 
                type="button"
                onClick={handleDelete}
                className="w-full py-3.5 rounded-2xl bg-red-500/5 border border-red-500/10 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-red-400 hover:bg-red-500/10 hover:border-red-500/25 transition-all font-sans"
              >
                <Trash2 size={14} /> Eliminar Lead
              </button>
            </GlassCard>
          )}

          {client.status !== 'Lead' && (
            <GlassCard className="p-8 border-white/5 bg-white/[0.01] animate-in fade-in slide-in-from-left-4 duration-500">
              <div className="flex justify-between items-center mb-10">
                <h4 className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 font-black font-sans">Matriz Financeira</h4>
                <div className="flex items-center gap-4">
                  <button 
                    type="button"
                    onClick={() => {
                      setEditFinanceFormData({
                        totalValue: client.totalValue || 0,
                        receivedAmount: client.receivedAmount || 0
                      });
                      setIsEditingFinance(true);
                    }}
                    className="text-[10px] font-black uppercase tracking-widest text-vela-red hover:text-vela-red/80 transition-all font-sans cursor-pointer"
                  >
                    Editar
                  </button>
                  <Badge variant={client.receivedAmount >= client.totalValue && client.totalValue > 0 ? "success" : "warning"}>
                    {client.receivedAmount >= client.totalValue && client.totalValue > 0 ? 'LIQUIDADO' : 'PENDENTE'}
                  </Badge>
                </div>
              </div>
              {/* Finantial Info mapping ... */}
              <div className="space-y-8">

                 <div className="grid grid-cols-2 gap-8">
                    <div>
                      <p className="text-[10px] text-zinc-700 font-black uppercase tracking-[0.15em] font-sans mb-2">Valor Total (€)</p>
                      <p className="text-2xl font-bold text-white tracking-tight font-display">{formatCurrency(client.totalValue)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-zinc-700 font-black uppercase tracking-[0.15em] font-sans mb-2">Liquidado (€)</p>
                      <p className="text-2xl font-bold text-emerald-500 tracking-tight font-display">{formatCurrency(client.receivedAmount)}</p>
                    </div>
                 </div>
                 
                 <div className="space-y-3">
                   <div className="flex justify-between text-[10px] text-zinc-600 font-black uppercase tracking-[0.2em] font-sans">
                     <span>Rácio de Liquidação</span>
                     <span>{client.totalValue > 0 ? Math.round((client.receivedAmount / client.totalValue) * 100) : 0}%</span>
                   </div>
                   <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${client.totalValue > 0 ? (client.receivedAmount / client.totalValue) * 100 : 0}%` }}
                        className="h-full bg-vela-red"
                      />
                   </div>
                 </div>


              </div>
            </GlassCard>
          )}
        </div>

        {/* Center Column: Project & Timeline */}
        <div className="lg:col-span-2 space-y-10">
          <AnimatePresence mode="wait">
            <motion.div
              key="active-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-10"
            >
              <GlassCard className="p-0 overflow-hidden border-white/5 bg-white/[0.01]">
                {/* Meeting section remains visible for Leads */}
                <div className="px-8 py-6 border-b border-white/8 flex items-center justify-between bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-vela-red animate-pulse" />
                    <h4 className="text-[11px] font-black text-white uppercase tracking-[0.2em] font-sans">REUNIÕES</h4>
                  </div>
                  <div className="flex items-center gap-4">
                    <Button 
                      variant="primary" 
                      className="text-[10px] py-3 h-10 px-6 font-black uppercase tracking-[0.2em] shadow-lg shadow-vela-red/20 transition-all hover:scale-[1.02] active:scale-[0.98]" 
                      onClick={() => setShowMeetModal(true)}
                    >
                      <Plus size={14} className="mr-2" /> Agendar
                    </Button>
                    <button className="text-zinc-600 hover:text-white transition-colors"><MoreVertical size={20} /></button>
                  </div>
                </div>
                
                <div className="px-8 py-10">
                  <div className="flex items-center justify-between mb-8">
                     <h5 className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 font-black font-sans">Histórico & Agenda</h5>
                  </div>
                  <div className="space-y-4">
                     {clientMeetings.length > 0 ? clientMeetings.map(m => (
                       <div key={m.id} className="flex items-center justify-between p-5 bg-white/[0.02] border border-white/5 rounded-2xl group hover:border-vela-red/20 transition-all">
                         <div className="flex items-center gap-6">
                            <div className="w-10 h-10 glass rounded-xl flex items-center justify-center text-vela-red">
                              <Calendar size={18} strokeWidth={1.5} />
                            </div>
                            <div className="space-y-1">
                               <p className="text-sm font-bold text-white font-display">Sessão {m.type}: {m.date} às {m.time}</p>
                               <p className="text-[9px] text-zinc-600 uppercase font-black">Sincronizado via Workspace</p>
                            </div>
                         </div>
                         {m.link && (
                            <button 
                              onClick={() => window.open(m.link, '_blank')}
                              className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-vela-red transition-all shadow-lg"
                            >
                              <Globe size={16} />
                            </button>
                         )}
                       </div>
                     )) : (
                       <div className="text-center py-12 opacity-30">
                         <Calendar size={32} strokeWidth={1} className="mx-auto mb-3" />
                         <p className="text-[10px] uppercase font-black tracking-widest">Nenhuma reunião detectada</p>
                       </div>
                     )}
                  </div>
                </div>
              </GlassCard>

              {/* Show Project section only if NOT a Lead */}
              {client.status !== 'Lead' ? (
                <GlassCard className="p-10 border-vela-red/20 bg-vela-red/[0.01]">
                  <div className="flex flex-col items-center text-center py-6">
                    <div className="w-16 h-16 glass rounded-2xl flex items-center justify-center text-vela-red mb-8 shadow-2xl shadow-vela-red/20">
                      <Briefcase size={28} strokeWidth={1.5} />
                    </div>
                    <h3 className="text-xl font-display font-black text-white tracking-tight uppercase italic mb-4">Repositório de Documentação</h3>
                    
                    {/* Drag and Drop Universal Upload Zone */}
                    <div 
                      className={cn(
                        "w-full p-8 border-2 border-dashed rounded-2xl transition-all duration-300 flex flex-col items-center justify-center cursor-pointer mb-6 relative overflow-hidden group/drop",
                        isDragging 
                          ? "border-vela-red bg-vela-red/5 scale-[1.02]" 
                          : "border-white/10 bg-white/[0.01] hover:border-white/20 hover:bg-white/[0.02]"
                      )}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input 
                        type="file" 
                        className="hidden" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload}
                        accept=".pdf,.doc,.docx,.png,.jpg,.xlsx,.zip"
                      />
                      
                      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-zinc-500 group-hover/drop:text-vela-red group-hover/drop:scale-110 transition-all mb-4">
                        {isUploading ? (
                          <Loader2 size={24} className="animate-spin text-vela-red" />
                        ) : (
                          <FileText size={24} strokeWidth={1.5} />
                        )}
                      </div>

                      <p className="text-xs font-bold text-zinc-300 mb-1 text-center">
                        {isUploading ? "A enviar para o Google Drive..." : "Arraste um ficheiro ou clique para carregar"}
                      </p>
                      <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest font-sans text-center">
                        PDF, DOCX, Imagem, Excel (Até 10MB)
                      </p>

                      {isDragging && (
                        <div className="absolute inset-0 bg-vela-red/10 backdrop-blur-xs flex items-center justify-center animate-fade-in pointer-events-none">
                          <p className="text-xs font-black text-vela-red uppercase tracking-widest">Solte o ficheiro aqui!</p>
                        </div>
                      )}
                    </div>

                    <p className="text-sm text-zinc-500 max-w-sm mb-8 leading-relaxed font-sans">
                      Todos os ficheiros do cliente estão centralizados na gestão de projetos do **Vela Workspace** via Google Drive.
                    </p>

                    <div className="w-full space-y-3 mb-8 text-left">
                      {isLoadingFiles ? (
                        <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-600 font-bold uppercase tracking-widest py-8 font-sans">
                          <Loader2 size={14} className="animate-spin" /> Sincronizando ficheiros...
                        </div>
                      ) : driveFiles.length > 0 ? (
                        driveFiles.map(file => (
                          <div key={file.id} className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all cursor-pointer group" onClick={() => window.open(file.webViewLink || `https://drive.google.com/open?id=${file.id}`, '_blank')}>
                            <div className="flex items-center gap-3">
                              <FileText size={16} className="text-zinc-600 group-hover:text-vela-red transition-colors" />
                              <div className="flex flex-col">
                                <span className="text-[11px] font-bold text-zinc-300 truncate max-w-[200px]">{file.name}</span>
                                <span className="text-[8px] text-zinc-600 font-sans uppercase tracking-tighter">Última Modificação: {new Date(file.modifiedTime).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <ChevronRight size={14} className="text-zinc-700 group-hover:translate-x-1 transition-transform" />
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] text-zinc-700 font-bold uppercase tracking-widest text-center py-8 bg-white/[0.01] rounded-xl border border-dashed border-white/5 font-sans">Nenhum ficheiro detectado na pasta do cliente</p>
                      )}
                    </div>

                    <div className="flex w-full gap-4">
                      <Button 
                        variant="outline"
                        className="flex-1 py-4 text-[9px] font-black uppercase tracking-[0.2em] font-sans"
                        onClick={() => client.driveFolderId && window.open(`https://drive.google.com/drive/folders/${client.driveFolderId}`, '_blank')}
                        disabled={!client.driveFolderId}
                      >
                        Abrir Drive
                      </Button>
                      <Button 
                        variant="primary" 
                        className="flex-[2] py-4 text-[9px] font-black uppercase tracking-[0.2em] shadow-xl shadow-vela-red/10 group font-sans"
                        onClick={() => onSeeInProjects(client.id)}
                      >
                        Gestão de Projetos <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform ml-2" />
                      </Button>
                    </div>
                  </div>
                </GlassCard>
              ) : (
                <GlassCard className="p-10 border-white/5 bg-white/[0.01] flex flex-col items-center justify-center text-center py-20 opacity-50">
                  <Briefcase size={40} className="text-zinc-800 mb-6" strokeWidth={1} />
                  <h3 className="text-lg font-display font-black text-white tracking-tight uppercase italic mb-2">Projeto Não Iniciado</h3>
                  <p className="text-xs text-zinc-600 font-sans max-w-xs leading-relaxed">
                    Converta este Lead em **Pendente** para iniciar a infraestrutura de projeto e sincronização Cloud Drive.
                  </p>
                  <Button 
                    variant="outline" 
                    className="mt-8 text-[10px] font-black uppercase tracking-widest"
                    onClick={() => setProfileTransitionTarget({ client, status: 'Pendente' })}
                  >
                    Iniciar Projeto & Apresentar Proposta
                  </Button>
                </GlassCard>
              )}
            </motion.div>
          </AnimatePresence>

          <GlassCard className="p-8 border-white/5 bg-white/[0.01]">
            <div className="flex items-center justify-between mb-8">
              <h4 className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 font-black font-sans">Notas</h4>
              <button 
                className="p-2 glass rounded-xl text-zinc-600 hover:text-white transition-all" 
                title="Adicionar Nota"
                onClick={handleAddNote}
              >
                <Plus size={18} />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
               {isAddingNote && (
                  <div className="bg-white/[0.04] p-5 rounded-2xl border border-vela-red/30 shadow-xl shadow-vela-red/5 space-y-4 animate-in zoom-in-95 duration-200">
                    <textarea
                      autoFocus
                      placeholder="Digite a nota de inteligência..."
                      className="w-full bg-transparent text-sm text-white outline-none resize-none h-24 placeholder:text-zinc-700 font-sans"
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                    />
                    <div className="flex justify-end gap-3 translate-y-1">
                      <button 
                        onClick={() => { setIsAddingNote(false); setNewNoteContent(''); }}
                        className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 hover:text-white transition-colors font-sans"
                      >
                        Cancelar
                      </button>
                      <button 
                        onClick={submitNote}
                        disabled={isSavingNote || showNoteSuccess}
                        className={cn(
                          "text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 px-3 py-1 rounded-lg font-sans",
                          showNoteSuccess 
                            ? "text-emerald-500 bg-emerald-500/10" 
                            : "text-vela-red hover:opacity-80"
                        )}
                      >
                        {isSavingNote ? (
                          <Loader2 size={10} className="animate-spin" />
                        ) : showNoteSuccess ? (
                          <CheckCircle2 size={10} />
                        ) : null}
                        {isSavingNote ? 'Guardando...' : showNoteSuccess ? 'Guardado' : 'Guardar Nota'}
                      </button>
                    </div>
                  </div>
               )}
               {(client.notes || []).map(note => (
                  <div key={note.id} className="bg-white/[0.02] p-5 rounded-2xl border border-white/8 hover:border-white/20 transition-all group relative">
                    {editingNoteId === note.id ? (
                      <div className="space-y-4 animate-in fade-in duration-150">
                        <textarea
                          autoFocus
                          className="w-full bg-white/[0.04] p-3 rounded-xl border border-white/10 text-sm text-white outline-none resize-none h-24 placeholder:text-zinc-700 font-sans focus:border-vela-red/30 focus:ring-1 focus:ring-vela-red/20"
                          value={editingNoteContent}
                          onChange={(e) => setEditingNoteContent(e.target.value)}
                        />
                        <div className="flex justify-between items-center pt-2 border-t border-white/5">
                          <button 
                            type="button"
                            onClick={() => handleDeleteNote(note.id)}
                            className="text-[9px] font-black uppercase tracking-wider text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 font-sans"
                            title="Eliminar esta Nota"
                          >
                            <Trash2 size={12} />
                            <span>Eliminar</span>
                          </button>
                          <div className="flex items-center gap-3">
                            <button 
                              type="button"
                              onClick={() => { setEditingNoteId(null); setEditingNoteContent(''); }}
                              className="text-[9px] font-black uppercase tracking-wider text-zinc-500 hover:text-white transition-colors font-sans px-2 py-1"
                            >
                              Cancelar
                            </button>
                            <button 
                              type="button"
                              onClick={() => handleSaveEditNote(note.id)}
                              className="text-[9px] font-black uppercase tracking-wider text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 font-sans"
                            >
                              <Check size={11} />
                              <span>Guardar</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Common Edit Button - Sleek pencil icon on the top right */}
                        <button
                          type="button"
                          onClick={() => handleStartEditNote(note.id, note.content)}
                          className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.08] border border-white/5 text-zinc-600 hover:text-white transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                          title="Editar Nota"
                        >
                          <Pencil size={11} />
                        </button>

                        <p className="text-sm text-zinc-400 leading-relaxed font-medium italic group-hover:text-zinc-300 transition-colors pr-6">
                          "{note.content}"
                        </p>
                        <div className="flex justify-between items-center mt-6 pt-4 border-t border-white/5">
                           <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 font-black font-sans">Agente: {note.author}</span>
                           <span className="text-[10px] text-zinc-700 font-sans italic">{note.date}</span>
                        </div>
                      </>
                    )}
                  </div>
               ))}
            </div>
          </GlassCard>
        </div>
      </div>

      <Modal 
        isOpen={isEditingInfo} 
        onClose={() => setIsEditingInfo(false)} 
        title="Editar Informações"
      >
        <form onSubmit={handleSaveInfo} className="space-y-4">
          <Input 
            label="Nome da Empresa / Entidade" 
            placeholder="Ex: Velocity Studio" 
            value={editFormData.name}
            onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
            required
          />
          <Input 
            label="Nome do Responsável" 
            placeholder="Ex: João Silva" 
            value={editFormData.contactName}
            onChange={e => setEditFormData({ ...editFormData, contactName: e.target.value })}
            required
          />
          <Input 
            label="Email Direto" 
            placeholder="Ex: joao@empresa.com" 
            value={editFormData.email}
            type="email"
            onChange={e => setEditFormData({ ...editFormData, email: e.target.value })}
            required
          />
          <Input 
            label="Contacto Telefónico" 
            placeholder="Ex: +351 912 345 678" 
            value={editFormData.phone}
            onChange={e => setEditFormData({ ...editFormData, phone: e.target.value })}
          />
          <Input 
            label="Serviço Adjudicado" 
            placeholder="Ex: Design & Dev" 
            value={editFormData.serviceType}
            onChange={e => setEditFormData({ ...editFormData, serviceType: e.target.value })}
          />
          <Input 
            label="Email de Acesso ao Painel" 
            placeholder="Ex: joao.acesso@gmail.com" 
            value={editFormData.dashboardEmail}
            type="email"
            onChange={e => setEditFormData({ ...editFormData, dashboardEmail: e.target.value })}
          />
          <Button 
            type="submit" 
            className="w-full py-4 mt-4 bg-vela-red hover:bg-vela-red/90 text-white"
          >
            Guardar Alterações
          </Button>
        </form>
      </Modal>

      <Modal 
        isOpen={isEditingFinance} 
        onClose={() => setIsEditingFinance(false)} 
        title="Editar Valores Financeiros"
      >
        <form onSubmit={handleSaveFinance} className="space-y-4">
          <Input 
            label="Valor Total (€)" 
            placeholder="Ex: 5000" 
            type="number"
            step="0.01"
            value={editFinanceFormData.totalValue}
            onChange={e => setEditFinanceFormData({ ...editFinanceFormData, totalValue: parseFloat(e.target.value) || 0 })}
            required
          />
          <Input 
            label="Valor Liquidado (€)" 
            placeholder="Ex: 1500" 
            type="number"
            step="0.01"
            value={editFinanceFormData.receivedAmount}
            onChange={e => setEditFinanceFormData({ ...editFinanceFormData, receivedAmount: parseFloat(e.target.value) || 0 })}
            required
          />
          <Button 
            type="submit" 
            className="w-full py-4 mt-4 bg-vela-red hover:bg-vela-red/90 text-white"
          >
            Guardar Valores
          </Button>
        </form>
      </Modal>
    </div>
  );
};
