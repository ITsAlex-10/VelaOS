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
  X,
  MapPin,
  ExternalLink,
  Sparkles,
  Building,
  User,
  UserCheck,
  Repeat,
  Pause,
  Play,
  Euro
} from 'lucide-react';
import { BillingFrequency, Client, CustomIntervalUnit, ProjectStage, Meeting, Payment, RecurringBillingConfig } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { StatusTransitionModal } from '../components/StatusTransitionModal';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { RecurringBillingFields } from '../components/RecurringBillingFields';
import { calculateNextBillingDate, formatFrequencyLabel, getTodayISO } from '../lib/billing';

interface ClientProfilePageProps {
  client: Client;
  onBack: () => void;
  onSeeInProjects: (clientId: string) => void;
  onOpenChat: (clientId: string) => void;
}

import { useWorkspace } from '../contexts/WorkspaceContext';
import { useBackgroundAction } from '../contexts/BackgroundActionContext';

export const ClientProfilePage: React.FC<ClientProfilePageProps> = ({ client, onBack, onSeeInProjects, onOpenChat }) => {
  const { scheduleMeet, refreshStatus, updateClient, deleteClient, deleteProject, getClientFiles, getOrCreateChatSpace, accessToken, meetings, uploadFile, deleteFile, clients } = useWorkspace();
  const { runBackgroundAction } = useBackgroundAction();
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [showSyncSuccess, setShowSyncSuccess] = React.useState(false);
  const [driveFiles, setDriveFiles] = React.useState<any[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [fileToDelete, setFileToDelete] = React.useState<{id: string, name: string} | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Projects associated with this client
  const associatedProjects = clients.filter(c => c.parentClientId === client.id);
  const aggregatedTotalValue = (client.totalValue || 0) + associatedProjects.reduce((sum, p) => sum + (p.totalValue || 0), 0);
  const aggregatedReceivedAmount = (client.receivedAmount || 0) + associatedProjects.reduce((sum, p) => sum + (p.receivedAmount || 0), 0);
  const [selectedProject, setSelectedProject] = React.useState<Client>(client);

  // Sync selectedProject when client changes
  React.useEffect(() => {
    setSelectedProject(client);
  }, [client.id]);

  // Sync selectedProject when clients state updates
  React.useEffect(() => {
    const updatedProject = clients.find(c => c.id === selectedProject.id);
    if (updatedProject) {
      setSelectedProject(updatedProject);
    }
  }, [clients, selectedProject.id]);

  // Filter meetings for this client - only show if associated
  const clientMeetings = (meetings || []).filter(m => selectedProject.associatedMeetingId ? m.id === selectedProject.associatedMeetingId : false);
  
  // Meeting Modal State
  const [showMeetModal, setShowMeetModal] = React.useState(false);
  const [showSelectMeetModal, setShowSelectMeetModal] = React.useState(false);
  const [meetDate, setMeetDate] = React.useState(new Date(Date.now() + 3600000).toISOString().slice(0, 16));

  const handleInternalSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetDate) return;

    const scheduledDate = meetDate;
    const summary = `Reunião: ${selectedProject.name}`;

    // 1. Close modal IMMEDIATELY
    setShowMeetModal(false);
    setMeetDate(new Date(Date.now() + 3600000).toISOString().slice(0, 16));

    // 2. Process in background
    runBackgroundAction({
      title: `A agendar reunião com "${selectedProject.name}"...`,
      action: async () => {
        await scheduleMeet(summary, scheduledDate + ":00");
      },
      errorMessage: `Erro ao agendar reunião com "${selectedProject.name}".`
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
  const [localTotalValue, setLocalTotalValue] = React.useState(selectedProject.totalValue || 0);
  const [localReceivedAmount, setLocalReceivedAmount] = React.useState(selectedProject.receivedAmount || 0);

  // Sync local state when selectedProject prop updates (but not during active editing)
  React.useEffect(() => {
    setLocalTotalValue(selectedProject.totalValue || 0);
  }, [selectedProject.totalValue]);

  React.useEffect(() => {
    setLocalReceivedAmount(selectedProject.receivedAmount || 0);
  }, [selectedProject.receivedAmount]);

  React.useEffect(() => {
    setIsLoadingFiles(true);
    const fetchFiles = selectedProject.driveFolderId ? getClientFiles(selectedProject.driveFolderId) : Promise.resolve([]);
    
    fetchFiles
      .then(files => {
        let list = files || [];
        if (selectedProject.proposalFileName && selectedProject.proposalFileUrl) {
          const hasProp = list.some((f: any) => f.name === selectedProject.proposalFileName || f.webViewLink === selectedProject.proposalFileUrl);
          if (!hasProp) {
            list.unshift({
              id: selectedProject.id + '_prop',
              name: selectedProject.proposalFileName,
              mimeType: 'application/pdf',
              webViewLink: selectedProject.proposalFileUrl,
              modifiedTime: new Date().toISOString()
            });
          }
        }
        setDriveFiles(list);
      })
      .catch(err => {
        console.error("Erro ao carregar ficheiros:", err);
        if (selectedProject.proposalFileName && selectedProject.proposalFileUrl) {
          setDriveFiles([{
            id: selectedProject.id + '_prop',
            name: selectedProject.proposalFileName,
            mimeType: 'application/pdf',
            webViewLink: selectedProject.proposalFileUrl,
            modifiedTime: new Date().toISOString()
          }]);
        } else {
          setDriveFiles([]);
        }
      })
      .finally(() => {
        setIsLoadingFiles(false);
      });
  }, [selectedProject.id, selectedProject.driveFolderId, selectedProject.proposalFileName, selectedProject.proposalFileUrl, accessToken, getClientFiles]);

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
  const [confirmLiquidateId, setConfirmLiquidateId] = React.useState<string | null>(null);
  const [confirmLiquidateDate, setConfirmLiquidateDate] = React.useState<string>(getTodayISO());
  const [profileTransitionTarget, setProfileTransitionTarget] = React.useState<{ client: Client, status: ProjectStage } | null>(null);

  const handleLiquidate = async (amount: number, paymentId: string, dateStr?: string) => {
    setLiquidatingId(paymentId);
    const liquidationDate = dateStr || getTodayISO();
    try {
      const targetPayment = (selectedProject.payments || []).find(p => p.id === paymentId);
      const isRecurringPayment = targetPayment?.type === 'recurring';
      const updatedRecurring = isRecurringPayment && selectedProject.recurringBilling
        ? {
            ...selectedProject.recurringBilling,
            cyclesPaid: (selectedProject.recurringBilling.cyclesPaid || 0) + 1
          }
        : selectedProject.recurringBilling;

      await updateClient(selectedProject.id, {
        receivedAmount: (selectedProject.receivedAmount || 0) + amount,
        payments: (selectedProject.payments || []).map(p =>
          p.id === paymentId
            ? { ...p, status: 'received' as const, date: liquidationDate }
            : p
        ),
        ...(updatedRecurring ? { recurringBilling: updatedRecurring } : {}),
        lastInteraction: new Date().toISOString()
      });
      setConfirmLiquidateId(null);
    } finally {
      setLiquidatingId(null);
    }
  };

  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [showDeleteProjectModal, setShowDeleteProjectModal] = React.useState(false);

  const [isEditingInfo, setIsEditingInfo] = React.useState(false);
  const [editFormData, setEditFormData] = React.useState({
    name: '',
    contactName: '',
    email: '',
    phone: '',
    dashboardEmail: '',
    serviceType: '',
    clientType: 'individual' as 'individual' | 'empresarial',
    nif: '',
    fiscalAddress: ''
  });

  const [isEditingFinance, setIsEditingFinance] = React.useState(false);
  const [editFinanceFormData, setEditFinanceFormData] = React.useState({
    totalValue: '',
    receivedAmount: ''
  });
  const [editFinanceLiquidatedDate, setEditFinanceLiquidatedDate] = React.useState<string>(getTodayISO());
  const [editRecurringEnabled, setEditRecurringEnabled] = React.useState(false);
  const [editRecurringAmount, setEditRecurringAmount] = React.useState('');
  const [editRecurringFreq, setEditRecurringFreq] = React.useState<BillingFrequency>('monthly');
  const [editCustomVal, setEditCustomVal] = React.useState('');
  const [editCustomUnit, setEditCustomUnit] = React.useState<CustomIntervalUnit>('months');
  const [editNextDate, setEditNextDate] = React.useState(getTodayISO());
  const [editRecurringActive, setEditRecurringActive] = React.useState(true);

  const [isAddingPayment, setIsAddingPayment] = React.useState(false);
  const [newPaymentAmount, setNewPaymentAmount] = React.useState('');
  const [newPaymentDate, setNewPaymentDate] = React.useState(getTodayISO());
  const [newPaymentDesc, setNewPaymentDesc] = React.useState('');
  const [newPaymentStatus, setNewPaymentStatus] = React.useState<'pending' | 'received'>('pending');

  const handleSaveFinance = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditingFinance(false);

    const parsedCustomVal = Math.max(1, parseInt(editCustomVal, 10) || 1);
    const parsedRecAmount = Math.max(0, parseFloat(editRecurringAmount) || 0);
    const nextDateVal = editNextDate || getTodayISO();

    let recurringUpdate: RecurringBillingConfig | undefined = undefined;
    if (editRecurringEnabled) {
      recurringUpdate = {
        enabled: true,
        amount: parsedRecAmount,
        frequency: editRecurringFreq,
        ...(editRecurringFreq === 'custom'
          ? { customIntervalValue: parsedCustomVal, customIntervalUnit: editCustomUnit }
          : {}),
        startDate: selectedProject.recurringBilling?.startDate || nextDateVal,
        nextBillingDate: nextDateVal,
        active: editRecurringActive,
        cyclesPaid: selectedProject.recurringBilling?.cyclesPaid || 0
      };
    } else if (selectedProject.recurringBilling) {
      recurringUpdate = {
        ...selectedProject.recurringBilling,
        enabled: false,
        active: false
      };
    }

    const prevReceived = selectedProject.receivedAmount || 0;
    const newTotalValue = Math.max(0, parseFloat(editFinanceFormData.totalValue) || 0);
    const newReceived = Math.max(0, parseFloat(editFinanceFormData.receivedAmount) || 0);
    const liqDate = editFinanceLiquidatedDate || getTodayISO();

    let updatedPayments: Payment[] = [...(selectedProject.payments || [])];
    const trackedReceived = updatedPayments
      .filter(p => p.status === 'received')
      .reduce((acc, p) => acc + (p.amount || 0), 0);

    const deltaFromTracked = newReceived - trackedReceived;
    if (deltaFromTracked > 0.005) {
      let toConsumeFromPending = Math.max(0, newReceived - prevReceived);
      const adjustedPayments: Payment[] = [];
      for (const p of updatedPayments) {
        if (p.status === 'pending' && toConsumeFromPending > 0.005) {
          if ((p.amount || 0) <= toConsumeFromPending + 0.005) {
            toConsumeFromPending = Math.max(0, toConsumeFromPending - (p.amount || 0));
            continue;
          } else {
            adjustedPayments.push({
              ...p,
              amount: Number(((p.amount || 0) - toConsumeFromPending).toFixed(2))
            });
            toConsumeFromPending = 0;
            continue;
          }
        }
        adjustedPayments.push(p);
      }

      adjustedPayments.push({
        id: 'p-' + Math.random().toString(36).substring(7),
        amount: Number(deltaFromTracked.toFixed(2)),
        date: liqDate,
        status: 'received',
        type: editRecurringEnabled || selectedProject.recurringBilling?.enabled ? 'recurring' : 'final',
        description: prevReceived === 0 ? 'Liquidação inicial' : 'Liquidação registada'
      });
      updatedPayments = adjustedPayments;
    }

    runBackgroundAction({
      title: 'A atualizar valores financeiros...',
      action: async () => {
        await updateClient(selectedProject.id, {
          totalValue: newTotalValue,
          receivedAmount: newReceived,
          payments: updatedPayments,
          ...(recurringUpdate ? { recurringBilling: recurringUpdate } : {}),
          lastInteraction: new Date().toISOString()
        });
      },
      errorMessage: 'Erro ao atualizar os valores financeiros.'
    });
  };

  const handleToggleRecurringActive = () => {
    const rb = selectedProject.recurringBilling;
    if (!rb) return;
    runBackgroundAction({
      title: rb.active ? 'A pausar cobrança recorrente...' : 'A reativar cobrança recorrente...',
      action: async () => {
        await updateClient(selectedProject.id, {
          recurringBilling: { ...rb, active: !rb.active },
          lastInteraction: new Date().toISOString()
        });
      },
      errorMessage: 'Erro ao alterar estado da recorrência.'
    });
  };

  const handleGenerateNextCycle = () => {
    const rb = selectedProject.recurringBilling;
    if (!rb || !rb.amount) return;
    const cycleDate = rb.nextBillingDate || getTodayISO();
    const newPayment: Payment = {
      id: 'p-' + Math.random().toString(36).substring(7),
      amount: rb.amount,
      date: cycleDate,
      status: 'pending',
      type: 'recurring',
      description: `Ciclo Recorrente (${formatFrequencyLabel(rb)})`
    };
    const nextDate = calculateNextBillingDate(
      cycleDate,
      rb.frequency,
      rb.customIntervalValue,
      rb.customIntervalUnit
    );
    runBackgroundAction({
      title: 'A gerar próximo ciclo recorrente...',
      action: async () => {
        await updateClient(selectedProject.id, {
          payments: [...(selectedProject.payments || []), newPayment],
          totalValue: (selectedProject.totalValue || 0) + rb.amount,
          recurringBilling: { ...rb, nextBillingDate: nextDate },
          lastInteraction: new Date().toISOString()
        });
      },
      errorMessage: 'Erro ao gerar próximo ciclo recorrente.'
    });
  };

  const handleAddManualPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newPaymentAmount) || 0;
    if (amt <= 0) return;
    const isRec = !!selectedProject.recurringBilling?.enabled;
    const payment: Payment = {
      id: 'p-' + Math.random().toString(36).substring(7),
      amount: amt,
      date: newPaymentDate || getTodayISO(),
      status: newPaymentStatus,
      type: isRec ? 'recurring' : 'final',
      description: newPaymentDesc.trim() || (isRec ? 'Pagamento Recorrente' : 'Pagamento Adicional')
    };

    setIsAddingPayment(false);
    setNewPaymentAmount('');
    setNewPaymentDesc('');
    setNewPaymentDate(getTodayISO());
    setNewPaymentStatus('pending');

    runBackgroundAction({
      title: 'A registar pagamento...',
      action: async () => {
        await updateClient(selectedProject.id, {
          payments: [...(selectedProject.payments || []), payment],
          totalValue: (selectedProject.totalValue || 0) + amt,
          receivedAmount: (selectedProject.receivedAmount || 0) + (newPaymentStatus === 'received' ? amt : 0),
          lastInteraction: new Date().toISOString()
        });
      },
      errorMessage: 'Erro ao registar pagamento.'
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
          clientType: editFormData.clientType,
          nif: editFormData.nif,
          fiscalAddress: editFormData.fiscalAddress,
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
        await updateClient(selectedProject.id, { status: 'Terminado' });
      },
      errorMessage: `Erro ao arquivar conta "${client.name}".`
    });
  };

  const handleDelete = () => {
    if (selectedProject.id !== client.id) {
      setShowDeleteProjectModal(true);
    } else {
      setShowDeleteModal(true);
    }
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

  const handleDeleteFile = async () => {
    if (!fileToDelete || !client.driveFolderId) return;
    setIsLoadingFiles(true);
    try {
      await deleteFile(fileToDelete.id);
      setFileToDelete(null);
      // Refresh list using client.driveFolderId
      const files = await getClientFiles(client.driveFolderId);
      setDriveFiles(files);
    } catch (err) {
      console.error(err);
      alert("Erro ao apagar ficheiro.");
    } finally {
      setIsLoadingFiles(false);
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
        await updateClient(selectedProject.id, {
          notes: [...(selectedProject.notes || []), newNote]
        });
      },
      errorMessage: 'Erro ao guardar a nota.'
    });
  };

  const handleDeleteNote = (noteId: string) => {
    const updatedNotes = (selectedProject.notes || []).filter(n => n.id !== noteId);
    runBackgroundAction({
      title: 'A eliminar nota...',
      action: async () => {
        await updateClient(selectedProject.id, {
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
    const updatedNotes = (selectedProject.notes || []).map(n => {
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
        await updateClient(selectedProject.id, {
          notes: updatedNotes
        });
      },
      errorMessage: 'Erro ao atualizar a nota.'
    });
  };

  return (
    <div className="space-y-8 pb-12">
      <Modal 
        isOpen={showMeetModal} 
        onClose={() => setShowMeetModal(false)} 
        title="Agendar Reunião"
        subtitle={client.name}
        size="sm"
      >
        <form onSubmit={handleInternalSchedule} className="space-y-5">
          <Input 
            label="Data e Hora" 
            type="datetime-local"
            value={meetDate}
            onChange={e => setMeetDate(e.target.value)}
            icon={<Calendar size={15} />}
            required
          />
          <p className="text-xs text-zinc-400 leading-relaxed">
            O evento será criado no Google Calendar com link Google Meet automático para <span className="text-white font-semibold">{client.name}</span>.
          </p>
          <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
            <Button 
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setShowMeetModal(false)}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              className="flex-1"
            >
              Confirmar e Sincronizar
            </Button>
          </div>
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

      {showDeleteProjectModal && (
        <ConfirmDeleteModal
          isOpen={showDeleteProjectModal}
          onClose={() => setShowDeleteProjectModal(false)}
          itemName={`${selectedProject.name} (${selectedProject.serviceType || 'Geral'})`}
          itemType="Projeto"
          subtitle={`Cliente: ${client.name}`}
          warningNote="Apenas este projeto será eliminado. A ficha do cliente e eventuais outros projetos continuarão ativos."
          onConfirm={async () => {
            await deleteProject(selectedProject.id);
            setSelectedProject(client);
          }}
        />
      )}

      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-white/[0.06]">
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06] hover:border-white/20 hover:-translate-x-0.5 transition-all duration-150 shrink-0 mt-0.5"
            title="Voltar"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-white uppercase leading-none">
                {client.name}
              </h2>
              <Badge
                variant={
                  selectedProject.status === 'Terminado' || selectedProject.status === 'Falhado'
                    ? 'danger'
                    : selectedProject.status === 'Cliente' || selectedProject.status === 'Reunião Agendada'
                    ? 'success'
                    : 'warning'
                }
              >
                {selectedProject.status}
              </Badge>
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs text-zinc-400">
              <span>Conta Principal</span>
              <span className="text-zinc-600">·</span>
              <span>{client.dashboardEmail ? `Acesso: ${client.dashboardEmail}` : 'Gerida por Alex Sosa'}</span>
              {selectedProject.projectStartDate && (
                <>
                  <span className="text-zinc-600">·</span>
                  <span className="tabular-nums text-zinc-400">
                    Início {new Date(`${selectedProject.projectStartDate}T00:00:00`).toLocaleDateString('pt-PT')}
                  </span>
                </>
              )}
              {selectedProject.projectEndDate && (
                <>
                  <span className="text-zinc-600">·</span>
                  <span className="tabular-nums text-emerald-400">
                    Fim {new Date(`${selectedProject.projectEndDate}T00:00:00`).toLocaleDateString('pt-PT')}
                  </span>
                </>
              )}
            </div>

            {/* Project Selector & Delete Project Trigger */}
            {associatedProjects.length > 0 ? (
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Projeto:</span>
                <select
                  value={selectedProject.id}
                  onChange={(e) => {
                    const proj = clients.find(c => c.id === e.target.value) || client;
                    setSelectedProject(proj);
                  }}
                  className="h-8 bg-[#141418] border border-white/[0.06] hover:border-white/20 rounded-lg px-2.5 text-xs font-medium text-white focus:outline-none focus:border-vela-red/40 transition-colors duration-150 cursor-pointer"
                >
                  {!client.projectRemoved && (
                    <option value={client.id}>{client.name} ({client.serviceType || 'Geral'})</option>
                  )}
                  {associatedProjects.map(proj => (
                    <option key={proj.id} value={proj.id}>{proj.name} ({proj.serviceType})</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowDeleteProjectModal(true)}
                  title="Eliminar apenas este projeto (mantém o cliente)"
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-red-500/30 hover:bg-red-500/10 text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-red-400 hover:-translate-y-[1px] active:translate-y-0 transition-all duration-150"
                >
                  <Trash2 size={12} />
                  Eliminar Projeto
                </button>
              </div>
            ) : !client.projectRemoved && client.status !== 'Lead' && client.status !== 'Reunião Agendada' && client.status !== 'Por Agendar' ? (
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <span className="text-xs text-zinc-500">
                  Projeto: <span className="text-zinc-200 font-medium">{selectedProject.serviceType || 'Geral'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowDeleteProjectModal(true)}
                  title="Eliminar apenas este projeto (mantém o cliente)"
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-red-500/30 hover:bg-red-500/10 text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-red-400 hover:-translate-y-[1px] active:translate-y-0 transition-all duration-150"
                >
                  <Trash2 size={11} />
                  Eliminar Projeto
                </button>
              </div>
            ) : client.projectRemoved ? (
              <p className="text-xs text-amber-400/90 font-medium pt-1">
                Sem projeto ativo associado
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {client.status === 'Cliente' && (
            <Button
              variant="secondary"
              className="h-9 px-4 text-xs"
              onClick={handleSendMessage}
            >
              <MessageSquare size={15} />
              <span>Mensagem</span>
            </Button>
          )}
          <Button
            disabled={isSyncing || showSyncSuccess}
            className={cn(
              "h-9 px-4 text-xs",
              showSyncSuccess && "bg-emerald-500 hover:bg-emerald-500"
            )}
            onClick={handleSyncSession}
          >
            {isSyncing ? (
              <Loader2 size={15} className="animate-spin" />
            ) : showSyncSuccess ? (
              <CheckCircle2 size={15} />
            ) : (
              <Calendar size={15} />
            )}
            <span>{isSyncing ? 'Sincronizando...' : showSyncSuccess ? 'Sincronizado' : 'Sincronizar Sessão'}</span>
          </Button>

          <button
            type="button"
            onClick={handleDelete}
            title={selectedProject.id !== client.id ? "Eliminar Projeto Atual" : `Eliminar ${client.status === 'Lead' ? 'Lead' : 'Cliente'}`}
            className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-red-500/30 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 hover:-translate-y-[1px] hover:scale-105 active:scale-95 flex items-center justify-center transition-all duration-150 shrink-0"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details & Financials */}
        <div className="space-y-6">
          <GlassCard className="p-6 space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-white/[0.06]">
              <h4 className="text-[11px] uppercase tracking-wider text-zinc-400 font-bold">Informações</h4>
              <button
                type="button"
                onClick={() => {
                  setEditFormData({
                    name: client.name || '',
                    contactName: client.contactName || '',
                    email: client.email || '',
                    phone: client.phone || '',
                    dashboardEmail: client.dashboardEmail || '',
                    serviceType: client.serviceType || '',
                    clientType: client.clientType || 'individual',
                    nif: client.nif || '',
                    fiscalAddress: client.fiscalAddress || ''
                  });
                  setIsEditingInfo(true);
                }}
                className="text-[11px] font-bold uppercase tracking-wider text-vela-red hover:text-vela-red/80 hover:-translate-y-[1px] transition-all duration-150 cursor-pointer"
              >
                Editar
              </button>
            </div>

            {/* Contacto & Entidade */}
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Building size={16} className="text-vela-red shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Empresa / Entidade</p>
                  <p className="text-sm font-medium text-white truncate">{client.name || 'Não especificado'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <User size={16} className="text-zinc-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Responsável</p>
                  <p className="text-sm font-medium text-white truncate">{client.contactName || 'Não especificado'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail size={16} className="text-zinc-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Email Direto</p>
                  <p className="text-sm font-medium text-white truncate">{client.email || 'Não especificado'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone size={16} className="text-zinc-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Contacto Telefónico</p>
                  <p className="text-sm font-medium text-white tabular-nums">{client.phone || 'Não especificado'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Briefcase size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Serviço Adjudicado</p>
                  <p className="text-sm font-medium text-white">{client.serviceType || 'Não especificado'}</p>
                </div>
              </div>
            </div>

            {/* Acesso ao Painel */}
            <div className="pt-4 border-t border-white/[0.06] space-y-4">
              <div className="flex items-start gap-3">
                <Globe size={16} className="text-zinc-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Email de Acesso ao Painel</p>
                  <p className="text-sm font-medium text-white truncate">{client.dashboardEmail || 'Não especificado'}</p>
                </div>
              </div>

              {client.clientUsers && client.clientUsers.length > 0 && (
                <div className="space-y-2 pt-1">
                  <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Acessos Autorizados</p>
                  <div className="space-y-2">
                    {client.clientUsers.map(cu => (
                      <div key={cu.id} className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.06] p-2.5 rounded-xl">
                        <div className="w-7 h-7 rounded-lg bg-vela-red/10 border border-vela-red/20 flex items-center justify-center text-[10px] text-vela-red font-bold shrink-0">
                          {cu.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{cu.name}</p>
                          <p className="text-[10px] text-zinc-500 truncate">{cu.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Dados Fiscais */}
            <div className="pt-4 border-t border-white/[0.06] space-y-3.5">
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Dados Fiscais</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Tipo</p>
                  <p className="text-xs font-semibold text-white mt-0.5 capitalize">
                    {client.clientType === 'empresarial' ? 'Empresarial' : client.clientType === 'individual' ? 'Individual' : 'Não especificado'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">NIF</p>
                  <p className="text-xs font-semibold text-white mt-0.5 tabular-nums">{client.nif || 'Não especificado'}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Morada Fiscal</p>
                <p className="text-xs font-medium text-zinc-300 mt-0.5 leading-relaxed">{client.fiscalAddress || 'Não especificado'}</p>
              </div>
            </div>
          </GlassCard>

          {client.status === 'Lead' && (
            <GlassCard className="p-4">
              <button
                type="button"
                onClick={handleDelete}
                className="w-full h-10 rounded-xl bg-red-500/5 border border-red-500/15 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-red-400 hover:bg-red-500/15 hover:border-red-500/30 hover:-translate-y-[1px] active:translate-y-0 transition-all duration-150"
              >
                <Trash2 size={14} /> Eliminar Lead
              </button>
            </GlassCard>
          )}

          {selectedProject.status !== 'Lead' && selectedProject.status !== 'Reunião Agendada' && selectedProject.status !== 'Por Agendar' && (() => {
            const displayTotal = selectedProject.id === client.id ? aggregatedTotalValue : (selectedProject.totalValue || 0);
            const displayReceived = selectedProject.id === client.id ? aggregatedReceivedAmount : (selectedProject.receivedAmount || 0);
            const ratio = displayTotal > 0 ? Math.min(100, Math.round((displayReceived / displayTotal) * 100)) : 0;
            const rb = selectedProject.recurringBilling;
            const paymentsList = selectedProject.payments || [];

            return (
              <GlassCard className="p-6 space-y-6">
                <div className="flex justify-between items-center pb-4 border-b border-white/[0.06]">
                  <h4 className="text-[11px] uppercase tracking-wider text-zinc-400 font-bold">Matriz Financeira</h4>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setEditFinanceFormData({
                          totalValue: selectedProject.totalValue ? String(selectedProject.totalValue) : '',
                          receivedAmount: selectedProject.receivedAmount ? String(selectedProject.receivedAmount) : ''
                        });
                        setEditFinanceLiquidatedDate(getTodayISO());
                        const currRb = selectedProject.recurringBilling;
                        setEditRecurringEnabled(!!currRb?.enabled);
                        setEditRecurringAmount(currRb?.amount ? String(currRb.amount) : (selectedProject.totalValue ? String(selectedProject.totalValue) : ''));
                        setEditRecurringFreq(currRb?.frequency || 'monthly');
                        setEditCustomVal(currRb?.customIntervalValue ? String(currRb.customIntervalValue) : '');
                        setEditCustomUnit(currRb?.customIntervalUnit || 'months');
                        setEditNextDate(currRb?.nextBillingDate || getTodayISO());
                        setEditRecurringActive(currRb?.active ?? true);
                        setIsEditingFinance(true);
                      }}
                      className="text-[11px] font-bold uppercase tracking-wider text-vela-red hover:text-vela-red/80 hover:-translate-y-[1px] transition-all duration-150 cursor-pointer"
                    >
                      Editar
                    </button>
                    <Badge variant={displayReceived >= displayTotal && displayTotal > 0 ? "success" : "warning"}>
                      {displayReceived >= displayTotal && displayTotal > 0 ? 'Liquidado' : 'Pendente'}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-1">Valor Total</p>
                      <p className="text-xl font-display font-bold text-white tabular-nums">{formatCurrency(displayTotal)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-1">Liquidado</p>
                      <p className="text-xl font-display font-bold text-emerald-400 tabular-nums">{formatCurrency(displayReceived)}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] text-zinc-500 font-semibold uppercase tracking-wider tabular-nums">
                      <span>Rácio de Liquidação</span>
                      <span>{ratio}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${ratio}%` }}
                        className="h-full bg-vela-red"
                      />
                    </div>
                  </div>

                  {/* Cobrança Recorrente Sub-panel */}
                  {rb?.enabled && (
                    <div className="pt-5 border-t border-white/[0.06] space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Repeat size={14} className="text-vela-red" />
                          <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                            Cobrança Recorrente
                          </span>
                        </div>
                        <Badge variant={rb.active ? 'success' : 'default'}>
                          {rb.active ? 'Ativa' : 'Pausada'}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs">
                        <div>
                          <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider block mb-0.5">Valor / Ciclo</span>
                          <span className="text-white font-bold tabular-nums">{formatCurrency(rb.amount)}</span>
                          <span className="text-[11px] text-zinc-400 block">{formatFrequencyLabel(rb)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider block mb-0.5">Próxima Cobrança</span>
                          <span className="text-emerald-400 font-bold tabular-nums">{rb.nextBillingDate || '—'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleToggleRecurringActive}
                          className="flex-1 h-8 px-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] hover:border-white/[0.14] text-[10px] font-bold uppercase tracking-wider text-zinc-300 hover:-translate-y-[1px] active:translate-y-0 transition-all duration-150 flex items-center justify-center gap-1.5"
                        >
                          {rb.active ? <Pause size={12} /> : <Play size={12} />}
                          {rb.active ? 'Pausar' : 'Retomar'}
                        </button>
                        <button
                          type="button"
                          onClick={handleGenerateNextCycle}
                          className="flex-1 h-8 px-3 rounded-lg bg-vela-red/10 hover:bg-vela-red/20 border border-vela-red/25 hover:border-vela-red/40 text-[10px] font-bold uppercase tracking-wider text-vela-red hover:-translate-y-[1px] active:translate-y-0 transition-all duration-150 flex items-center justify-center gap-1.5"
                        >
                          <Plus size={12} /> Próximo Ciclo
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Plano / Histórico de Pagamentos */}
                  <div className="pt-5 border-t border-white/[0.06] space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider tabular-nums">
                        Pagamentos ({paymentsList.length})
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsAddingPayment(!isAddingPayment)}
                        className="text-[10px] font-bold uppercase tracking-wider text-vela-red hover:text-vela-red/80 hover:-translate-y-[1px] transition-all duration-150 flex items-center gap-1"
                      >
                        <Plus size={12} /> {isAddingPayment ? 'Fechar' : 'Registar'}
                      </button>
                    </div>

                    {isAddingPayment && (
                      <form onSubmit={handleAddManualPayment} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.08] space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            placeholder="Valor (€)"
                            value={newPaymentAmount}
                            onChange={(e) => setNewPaymentAmount(e.target.value)}
                            required
                            className="w-full h-9 bg-[#0D0D0F] border border-white/[0.08] rounded-lg px-3 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-vela-red/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none tabular-nums"
                          />
                          <input
                            type="date"
                            value={newPaymentDate}
                            onChange={(e) => setNewPaymentDate(e.target.value)}
                            required
                            className="w-full h-9 bg-[#0D0D0F] border border-white/[0.08] rounded-lg px-3 text-xs text-white focus:outline-none focus:border-vela-red/40 tabular-nums"
                          />
                        </div>
                        <input
                          type="text"
                          placeholder="Descrição (ex: Mensalidade Novembro)"
                          value={newPaymentDesc}
                          onChange={(e) => setNewPaymentDesc(e.target.value)}
                          className="w-full h-9 bg-[#0D0D0F] border border-white/[0.08] rounded-lg px-3 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-vela-red/40"
                        />
                        <div className="flex items-center gap-2">
                          <select
                            value={newPaymentStatus}
                            onChange={(e) => setNewPaymentStatus(e.target.value as 'pending' | 'received')}
                            className="flex-1 h-9 bg-[#0D0D0F] border border-white/[0.08] rounded-lg px-3 text-xs text-white focus:outline-none"
                          >
                            <option value="pending">Pendente</option>
                            <option value="received">Liquidado</option>
                          </select>
                          <button
                            type="submit"
                            className="h-9 px-4 rounded-lg bg-vela-red hover:bg-vela-red/90 text-white text-[10px] font-bold uppercase tracking-wider"
                          >
                            Adicionar
                          </button>
                        </div>
                      </form>
                    )}

                    {paymentsList.length > 0 ? (
                      <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                        {paymentsList.map((p) => (
                          <div key={p.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold text-white truncate">
                                  {p.description || (p.type === 'adjudication' ? 'Adjudicação' : p.type === 'recurring' ? 'Recorrente' : 'Tranche Final')}
                                </p>
                                <p className="text-[11px] text-zinc-500 tabular-nums">{p.date}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={cn("font-bold tabular-nums", p.status === 'received' ? "text-emerald-400" : "text-amber-400")}>
                                  {formatCurrency(p.amount)}
                                </span>
                                {p.status === 'pending' ? (
                                  <button
                                    type="button"
                                    disabled={liquidatingId === p.id}
                                    onClick={() => {
                                      setConfirmLiquidateId(p.id);
                                      setConfirmLiquidateDate(getTodayISO());
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase tracking-wider hover:-translate-y-[1px] active:translate-y-0 transition-all duration-150 disabled:opacity-50"
                                  >
                                    {liquidatingId === p.id ? '...' : 'Liquidar'}
                                  </button>
                                ) : (
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500/80 px-1">
                                    Pago
                                  </span>
                                )}
                              </div>
                            </div>

                            {p.status === 'pending' && confirmLiquidateId === p.id && (
                              <div className="pt-2 border-t border-white/[0.06] flex items-center gap-2">
                                <input
                                  type="date"
                                  value={confirmLiquidateDate}
                                  onChange={(e) => setConfirmLiquidateDate(e.target.value)}
                                  className="flex-1 h-8 bg-[#0D0D0F] border border-white/[0.08] rounded-lg px-2.5 text-[11px] text-white focus:outline-none focus:border-emerald-500/50 tabular-nums"
                                  required
                                />
                                <button
                                  type="button"
                                  disabled={liquidatingId === p.id}
                                  onClick={() => handleLiquidate(p.amount, p.id, confirmLiquidateDate)}
                                  className="h-8 px-2.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold uppercase tracking-wider hover:-translate-y-[1px] transition-all duration-150"
                                >
                                  Confirmar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmLiquidateId(null)}
                                  className="h-8 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-[10px] font-bold uppercase tracking-wider hover:-translate-y-[1px] transition-all duration-150"
                                >
                                  Cancelar
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-600 text-center py-3">
                        Sem pagamentos registados
                      </p>
                    )}
                  </div>

                  {selectedProject.proposalFileUrl && (
                    <div className="pt-5 border-t border-white/[0.06]">
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2.5">Ficheiro da Proposta</p>
                      <a
                        href={selectedProject.proposalFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-vela-red/30 hover:-translate-y-[1px] transition-all duration-150 group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText size={15} className="text-zinc-500 group-hover:text-vela-red transition-colors duration-150 shrink-0" />
                          <span className="text-xs font-medium text-zinc-300 truncate">
                            {selectedProject.proposalFileName || 'Visualizar Proposta'}
                          </span>
                        </div>
                        <Download size={14} className="text-zinc-500 group-hover:text-white group-hover:translate-y-[1px] transition-all duration-150 shrink-0" />
                      </a>
                    </div>
                  )}
                </div>
              </GlassCard>
            );
          })()}
        </div>

        {/* Center Column: Meetings, Documentation & Notes */}
        <div className="lg:col-span-2 space-y-6">
          <AnimatePresence mode="wait">
            <motion.div
              key="active-view"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-6"
            >
              {/* Reuniões */}
              <GlassCard className="p-0 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-3 bg-white/[0.01]">
                  <div className="flex items-center gap-2.5">
                    <Calendar size={15} className="text-vela-red" />
                    <h4 className="text-[11px] font-bold text-white uppercase tracking-wider">Reuniões</h4>
                    <span className="text-[11px] text-zinc-500 font-semibold tabular-nums">({clientMeetings.length})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="primary"
                      className="h-8 px-3.5 text-[11px]"
                      onClick={() => setShowMeetModal(true)}
                    >
                      <Plus size={13} /> Agendar
                    </Button>
                    {!client.associatedMeetingId && (
                      <Button
                        variant="outline"
                        className="h-8 px-3.5 text-[11px]"
                        onClick={() => setShowSelectMeetModal(true)}
                      >
                        Selecionar
                      </Button>
                    )}
                  </div>
                </div>

                <div className="p-6">
                  <div className="space-y-3">
                    {clientMeetings.length > 0 ? clientMeetings.map(m => (
                      <div key={m.id} className="flex items-center justify-between gap-4 p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl hover:bg-white/[0.03] hover:border-white/15 transition-all duration-150">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-vela-red/10 border border-vela-red/20 flex items-center justify-center text-vela-red shrink-0">
                            <Calendar size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate tabular-nums">
                              Sessão {m.type}: {m.date} às {m.time}
                            </p>
                            <p className="text-[11px] text-zinc-500 font-medium">Sincronizado via Workspace</p>
                          </div>
                        </div>
                        {m.link && (
                          <button
                            type="button"
                            onClick={() => window.open(m.link, '_blank')}
                            title="Abrir link da reunião"
                            className="w-9 h-9 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-zinc-400 hover:text-white hover:bg-vela-red hover:border-vela-red hover:-translate-y-[1px] hover:scale-105 active:scale-95 transition-all duration-150 shrink-0"
                          >
                            <Globe size={15} />
                          </button>
                        )}
                      </div>
                    )) : (
                      <div className="text-center py-10 text-zinc-500">
                        <Calendar size={26} strokeWidth={1.5} className="mx-auto mb-2.5 text-zinc-600" />
                        <p className="text-xs font-medium text-zinc-500">Nenhuma reunião agendada para este cliente.</p>
                      </div>
                    )}
                  </div>
                </div>
              </GlassCard>

              {/* Show Project section only if NOT a Lead */}
              {client.status !== 'Lead' ? (
                <GlassCard className="p-6 space-y-6">
                  <div className="flex items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2.5">
                      <Briefcase size={15} className="text-vela-red" />
                      <h3 className="text-[11px] font-bold text-white uppercase tracking-wider">
                        Repositório de Documentação
                      </h3>
                    </div>
                    <span className="text-[11px] text-zinc-500 font-medium">Google Drive</span>
                  </div>

                  {/* Drag and Drop Upload Zone */}
                  <div
                    className={cn(
                      "w-full p-6 border border-dashed rounded-xl transition-colors flex flex-col items-center justify-center cursor-pointer relative overflow-hidden group/drop",
                      isDragging
                        ? "border-vela-red bg-vela-red/5"
                        : "border-white/[0.1] bg-white/[0.01] hover:border-white/25 hover:bg-white/[0.02]"
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

                    <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-zinc-400 group-hover/drop:text-vela-red transition-colors mb-3">
                      {isUploading ? (
                        <Loader2 size={20} className="animate-spin text-vela-red" />
                      ) : (
                        <FileText size={20} strokeWidth={1.5} />
                      )}
                    </div>

                    <p className="text-xs font-semibold text-zinc-200 mb-1 text-center">
                      {isUploading ? "A enviar para o Google Drive..." : "Arraste um ficheiro ou clique para carregar"}
                    </p>
                    <p className="text-[11px] text-zinc-500 text-center">
                      PDF, DOCX, Imagem, Excel (até 10MB) · Sincronizado com o <strong className="text-zinc-300 font-semibold">Vela Workspace</strong>
                    </p>

                    {isDragging && (
                      <div className="absolute inset-0 bg-vela-red/10 flex items-center justify-center pointer-events-none">
                        <p className="text-xs font-bold text-vela-red uppercase tracking-wider">Solte o ficheiro aqui</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    {isLoadingFiles ? (
                      <div className="flex items-center justify-center gap-2 text-xs text-zinc-500 py-6">
                        <Loader2 size={14} className="animate-spin" /> A sincronizar ficheiros...
                      </div>
                    ) : driveFiles.length > 0 ? (
                      driveFiles.map(file => (
                        <div key={file.id} className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.035] hover:border-white/15 hover:-translate-y-[1px] transition-all duration-150 cursor-pointer group">
                          <div className="flex items-center gap-3 flex-1 min-w-0" onClick={() => window.open(file.webViewLink || `https://drive.google.com/open?id=${file.id}`, '_blank')}>
                            <FileText size={16} className="text-zinc-500 group-hover:text-vela-red transition-colors duration-150 shrink-0" />
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-semibold text-zinc-200 truncate">{file.name}</span>
                              <span className="text-[11px] text-zinc-500 tabular-nums">
                                Modificado em {new Date(file.modifiedTime || Date.now()).toLocaleDateString('pt-PT')}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setFileToDelete({ id: file.id, name: file.name })}
                              className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 hover:scale-105 active:scale-95 rounded-lg transition-all duration-150"
                              title="Eliminar ficheiro"
                            >
                              <Trash2 size={14} />
                            </button>
                            <ChevronRight size={14} className="text-zinc-600 group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-[color,transform] duration-150" />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-zinc-500 text-center py-6 bg-white/[0.01] rounded-xl border border-dashed border-white/[0.06]">
                        Nenhum ficheiro detetado na pasta do cliente
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1 h-9 text-xs"
                      onClick={() => client.driveFolderId && window.open(`https://drive.google.com/drive/folders/${client.driveFolderId}`, '_blank')}
                      disabled={!client.driveFolderId}
                    >
                      Abrir Drive
                    </Button>
                    <Button
                      variant="primary"
                      className="flex-[2] h-9 text-xs group"
                      onClick={() => onSeeInProjects(client.id)}
                    >
                      <span>Gestão de Projetos</span>
                      <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                    </Button>
                  </div>
                </GlassCard>
              ) : (
                <GlassCard className="p-8 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-zinc-500">
                    <Briefcase size={22} strokeWidth={1.5} />
                  </div>
                  <div className="space-y-1 max-w-sm">
                    <h3 className="text-base font-display font-bold text-white uppercase tracking-tight">Projeto Não Iniciado</h3>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Converta esta Lead para <strong className="text-zinc-300 font-semibold">Pendente</strong> para iniciar a infraestrutura de projeto e sincronização no Google Drive.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="h-9 px-4 text-xs"
                    onClick={() => setProfileTransitionTarget({ client, status: 'Pendente' })}
                  >
                    Iniciar Projeto & Apresentar Proposta
                  </Button>
                </GlassCard>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Notas */}
          <GlassCard className="p-6 space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
              <h4 className="text-[11px] uppercase tracking-wider text-zinc-400 font-bold">Notas</h4>
              <button
                type="button"
                className="h-8 px-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-zinc-300 hover:text-white hover:bg-white/[0.06] hover:border-white/[0.15] hover:-translate-y-[1px] active:translate-y-0 transition-all duration-150 inline-flex items-center gap-1.5 text-[11px] font-semibold"
                title="Adicionar Nota"
                onClick={handleAddNote}
              >
                <Plus size={14} />
                <span>Nova Nota</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isAddingNote && (
                <div className="bg-white/[0.03] p-4 rounded-xl border border-vela-red/30 space-y-3">
                  <textarea
                    autoFocus
                    placeholder="Escreva uma nota comercial ou técnica..."
                    className="w-full bg-transparent text-xs text-white outline-none resize-none h-24 placeholder:text-zinc-600 leading-relaxed"
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                  />
                  <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
                    <button
                      type="button"
                      onClick={() => { setIsAddingNote(false); setNewNoteContent(''); }}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-white transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={submitNote}
                      disabled={isSavingNote || showNoteSuccess}
                      className={cn(
                        "px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5",
                        showNoteSuccess
                          ? "text-emerald-400 bg-emerald-500/10"
                          : "bg-vela-red/15 text-vela-red hover:bg-vela-red/25"
                      )}
                    >
                      {isSavingNote ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : showNoteSuccess ? (
                        <CheckCircle2 size={11} />
                      ) : null}
                      {isSavingNote ? 'Guardando...' : showNoteSuccess ? 'Guardado' : 'Guardar'}
                    </button>
                  </div>
                </div>
              )}

              {(selectedProject.notes || []).map(note => (
                <div key={note.id} className="bg-white/[0.02] p-4 rounded-xl border border-white/[0.06] hover:border-white/15 transition-colors duration-150 group relative flex flex-col justify-between">
                  {editingNoteId === note.id ? (
                    <div className="space-y-3">
                      <textarea
                        autoFocus
                        className="w-full bg-[#0D0D0F] p-3 rounded-lg border border-white/[0.1] text-xs text-white outline-none resize-none h-24 placeholder:text-zinc-600 focus:border-vela-red/40 leading-relaxed"
                        value={editingNoteContent}
                        onChange={(e) => setEditingNoteContent(e.target.value)}
                      />
                      <div className="flex justify-between items-center pt-2 border-t border-white/[0.06]">
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(note.id)}
                          className="text-[10px] font-bold uppercase tracking-wider text-red-400 hover:text-red-300 hover:-translate-y-[1px] transition-all duration-150 flex items-center gap-1"
                          title="Eliminar esta Nota"
                        >
                          <Trash2 size={12} />
                          <span>Eliminar</span>
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => { setEditingNoteId(null); setEditingNoteContent(''); }}
                            className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-white hover:-translate-y-[1px] transition-all duration-150 px-2 py-1"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEditNote(note.id)}
                            className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg hover:-translate-y-[1px] transition-all duration-150 flex items-center gap-1"
                          >
                            <Check size={11} />
                            <span>Guardar</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleStartEditNote(note.id, note.content)}
                        className="absolute top-3.5 right-3.5 p-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-500 hover:text-white hover:scale-105 active:scale-95 transition-all duration-150 opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Editar Nota"
                      >
                        <Pencil size={12} />
                      </button>

                      <p className="text-xs text-zinc-300 leading-relaxed pr-7 whitespace-pre-wrap">
                        {note.content}
                      </p>
                      <div className="flex justify-between items-center mt-4 pt-3 border-t border-white/[0.06]">
                        <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">{note.author}</span>
                        <span className="text-[10px] text-zinc-500 tabular-nums">{note.date}</span>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {!isAddingNote && (selectedProject.notes || []).length === 0 && (
                <div className="col-span-full text-center py-8 text-xs text-zinc-500">
                  Ainda não existem notas registadas.
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      </div>

      <Modal 
        isOpen={isEditingInfo} 
        onClose={() => setIsEditingInfo(false)} 
        title="Editar Informações"
        subtitle={client.name}
        size="lg"
      >
        <form onSubmit={handleSaveInfo} className="space-y-6">
          {/* Secção 1: Identificação & Serviço */}
          <div className="space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              01 · Identificação & Serviço
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input 
                label="Nome da Empresa / Entidade" 
                placeholder="Ex: Velocity Studio" 
                value={editFormData.name}
                onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                icon={<Building size={15} />}
                required
              />
              <Input 
                label="Nome do Responsável" 
                placeholder="Ex: João Silva" 
                value={editFormData.contactName}
                onChange={e => setEditFormData({ ...editFormData, contactName: e.target.value })}
                icon={<User size={15} />}
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input 
                label="Serviço Adjudicado" 
                placeholder="Ex: Design & Dev" 
                value={editFormData.serviceType}
                onChange={e => setEditFormData({ ...editFormData, serviceType: e.target.value })}
                icon={<Briefcase size={15} />}
              />
              <Input 
                label="Email Direto" 
                placeholder="Ex: joao@empresa.com" 
                value={editFormData.email}
                type="email"
                onChange={e => setEditFormData({ ...editFormData, email: e.target.value })}
                icon={<Mail size={15} />}
                required
              />
            </div>
          </div>

          {/* Secção 2: Acesso & Contacto */}
          <div className="space-y-4 pt-5 border-t border-white/[0.06]">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              02 · Acesso & Contacto
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input 
                label="Contacto Telefónico" 
                placeholder="Ex: +351 912 345 678" 
                value={editFormData.phone}
                onChange={e => setEditFormData({ ...editFormData, phone: e.target.value })}
                icon={<Phone size={15} />}
              />
              <Input 
                label="Email de Acesso ao Painel" 
                placeholder="Ex: joao.acesso@gmail.com" 
                value={editFormData.dashboardEmail}
                type="email"
                onChange={e => setEditFormData({ ...editFormData, dashboardEmail: e.target.value })}
                icon={<UserCheck size={15} />}
              />
            </div>
          </div>

          {/* Secção 3: Dados Fiscais */}
          <div className="space-y-4 pt-5 border-t border-white/[0.06]">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              03 · Dados Fiscais
            </p>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 block ml-0.5">
                Tipo de Cliente
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-[#16161A] border border-white/[0.08] rounded-xl">
                <button
                  type="button"
                  onClick={() => setEditFormData({ ...editFormData, clientType: 'individual' })}
                  className={cn(
                    "py-2.5 px-4 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                    editFormData.clientType === 'individual'
                      ? "bg-vela-red text-white shadow-sm"
                      : "text-zinc-400 hover:text-white"
                  )}
                >
                  Individual
                </button>
                <button
                  type="button"
                  onClick={() => setEditFormData({ ...editFormData, clientType: 'empresarial' })}
                  className={cn(
                    "py-2.5 px-4 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                    editFormData.clientType === 'empresarial'
                      ? "bg-vela-red text-white shadow-sm"
                      : "text-zinc-400 hover:text-white"
                  )}
                >
                  Empresarial
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input 
                label="NIF" 
                placeholder="Ex: 512345678" 
                value={editFormData.nif}
                onChange={e => setEditFormData({ ...editFormData, nif: e.target.value })}
                className="tabular-nums"
              />
              <Input 
                label="Morada Fiscal" 
                placeholder="Ex: Rua das Flores, nº 12, Lisboa" 
                value={editFormData.fiscalAddress}
                onChange={e => setEditFormData({ ...editFormData, fiscalAddress: e.target.value })}
                icon={<MapPin size={15} />}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setIsEditingInfo(false)}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              className="flex-1"
            >
              Guardar Alterações
            </Button>
          </div>
        </form>
      </Modal>

      <Modal 
        isOpen={isEditingFinance} 
        onClose={() => setIsEditingFinance(false)} 
        title="Editar Valores Financeiros"
        subtitle={selectedProject.name}
        size="md"
      >
        <form onSubmit={handleSaveFinance} className="space-y-6">
          {/* Secção 1: Resumo Financeiro */}
          <div className="space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              01 · Resumo Financeiro
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input 
                label="Valor Total (€)" 
                placeholder="Ex: 5000" 
                type="number"
                step="0.01"
                value={editFinanceFormData.totalValue}
                onChange={e => setEditFinanceFormData({ ...editFinanceFormData, totalValue: e.target.value })}
                icon={<Euro size={15} />}
                className="tabular-nums font-semibold"
                required
              />
              <Input 
                label="Valor Liquidado (€)" 
                placeholder="Ex: 1500" 
                type="number"
                step="0.01"
                value={editFinanceFormData.receivedAmount}
                onChange={e => setEditFinanceFormData({ ...editFinanceFormData, receivedAmount: e.target.value })}
                icon={<Euro size={15} />}
                className="tabular-nums font-semibold"
              />
            </div>
            {(parseFloat(editFinanceFormData.receivedAmount) || 0) > 0 && (
              <Input
                label="Data da Liquidação"
                type="date"
                value={editFinanceLiquidatedDate}
                onChange={e => setEditFinanceLiquidatedDate(e.target.value)}
                icon={<Calendar size={15} />}
                required
              />
            )}
          </div>

          {/* Secção 2: Cobrança Recorrente */}
          <div className="space-y-4 pt-5 border-t border-white/[0.06]">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
              02 · Cobrança Recorrente
            </p>
            <label
              htmlFor="editRecurringEnabled"
              className="flex items-center gap-3 p-3.5 bg-white/[0.02] border border-white/[0.08] rounded-xl cursor-pointer select-none hover:border-white/15 transition-colors"
            >
              <input
                type="checkbox"
                id="editRecurringEnabled"
                checked={editRecurringEnabled}
                onChange={(e) => setEditRecurringEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-white/15 bg-white/5 text-vela-red focus:ring-vela-red cursor-pointer"
              />
              <Repeat size={14} className="text-vela-red shrink-0" />
              <span className="text-xs font-semibold text-white">
                Ativar Pagamento Recorrente
              </span>
            </label>

            {editRecurringEnabled && (
              <div className="space-y-4">
                <Input
                  label="Valor por Ciclo (€)"
                  placeholder="Ex: 450"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editRecurringAmount}
                  onChange={e => setEditRecurringAmount(e.target.value)}
                  icon={<Euro size={15} />}
                  className="tabular-nums font-semibold"
                  required
                />

                <RecurringBillingFields
                  frequency={editRecurringFreq}
                  onFrequencyChange={setEditRecurringFreq}
                  customIntervalValue={editCustomVal}
                  onCustomIntervalValueChange={setEditCustomVal}
                  customIntervalUnit={editCustomUnit}
                  onCustomIntervalUnitChange={setEditCustomUnit}
                  startDate={editNextDate}
                  onStartDateChange={setEditNextDate}
                  dateLabel="Próxima Data de Cobrança"
                />

                <label
                  htmlFor="editRecurringActive"
                  className="flex items-center gap-3 p-3.5 bg-white/[0.02] border border-white/[0.08] rounded-xl cursor-pointer select-none hover:border-white/15 transition-colors"
                >
                  <input
                    type="checkbox"
                    id="editRecurringActive"
                    checked={editRecurringActive}
                    onChange={(e) => setEditRecurringActive(e.target.checked)}
                    className="w-4 h-4 rounded border-white/15 bg-white/5 text-vela-red focus:ring-vela-red cursor-pointer"
                  />
                  <span className="text-xs font-medium text-zinc-200">
                    Subscrição Ativa (Gerar ciclos automaticamente)
                  </span>
                </label>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setIsEditingFinance(false)}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              className="flex-1"
            >
              Guardar Valores
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showSelectMeetModal}
        onClose={() => setShowSelectMeetModal(false)}
        title="Selecionar Reunião"
        subtitle={selectedProject.name}
        size="md"
      >
        <div className="space-y-4">
          {meetings.length > 0 ? (
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
              {meetings.map(m => (
                <button
                  key={m.id}
                  type="button"
                  className="w-full text-left p-4 bg-white/[0.02] border border-white/[0.08] rounded-xl hover:border-vela-red/40 hover:bg-white/[0.04] transition-all cursor-pointer flex items-center justify-between gap-4"
                  onClick={async () => {
                    await updateClient(selectedProject.id, { associatedMeetingId: m.id });
                    setShowSelectMeetModal(false);
                  }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{m.clientName}</p>
                    <p className="text-xs text-zinc-400 mt-0.5 tabular-nums">{m.date} às {m.time}</p>
                  </div>
                  <ChevronRight size={16} className="text-zinc-500 shrink-0" />
                </button>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center border border-dashed border-white/10 rounded-xl">
              <p className="text-xs text-zinc-400">Não existem reuniões agendadas para associar.</p>
            </div>
          )}
          <div className="flex justify-end pt-4 border-t border-white/[0.06]">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowSelectMeetModal(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!fileToDelete}
        onClose={() => setFileToDelete(null)}
        title="Eliminar Ficheiro"
        subtitle={fileToDelete?.name}
        size="sm"
      >
        <div className="space-y-5">
          <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
            <p className="text-sm text-zinc-300 leading-relaxed">
              Tem a certeza que pretende eliminar o ficheiro <span className="text-white font-semibold">{fileToDelete?.name}</span>? Esta ação é permanente e não pode ser desfeita.
            </p>
          </div>
          <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
            <Button variant="secondary" className="flex-1" onClick={() => setFileToDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              className="flex-1 bg-red-600 hover:bg-red-500 border-red-600"
              onClick={handleDeleteFile}
            >
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
