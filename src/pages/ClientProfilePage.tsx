import React from 'react';
import { GlassCard, Badge, Button, Modal, Input, Select } from '../components/UI';
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
  Euro,
  Folder,
  FolderOpen,
  Layers,
  Upload
} from 'lucide-react';
import { BillingFrequency, Client, CustomIntervalUnit, PaidTrafficPlatform, ProjectStage, Meeting, Payment, RecurringBillingConfig, SocialMediaPlatform, WebsiteProjectLinks } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { StatusTransitionModal } from '../components/StatusTransitionModal';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { RecurringBillingFields } from '../components/RecurringBillingFields';
import {
  WebsiteLinksFields,
  WebsiteLinkButtons,
  EditWebsiteLinksModal,
  EMPTY_WEBSITE_LINKS,
  isWebsiteGoogleService,
  buildWebsiteLinksPayload
} from '../components/WebsiteLinksSection';
import {
  ServicePlatformsFields,
  ServicePlatformButtons,
  EditServicePlatformsModal,
  isSocialMediaService,
  isPaidTrafficService,
  hasServicePlatforms,
  normalizeSocialMediaPlatforms,
  normalizePaidTrafficPlatforms,
  getIncludedPlatformsForEntity
} from '../components/ServicePlatformsSection';
import { calculateNextBillingDate, formatFrequencyLabel, getTodayISO } from '../lib/billing';

interface ClientProfilePageProps {
  client: Client;
  onBack: () => void;
  onSeeInProjects: (clientId: string) => void;
  onOpenChat: (clientId: string) => void;
}

import { useWorkspace } from '../contexts/WorkspaceContext';
import { useBackgroundAction } from '../contexts/BackgroundActionContext';
import { ScheduleMeetingModal, EntityCollection } from '../components/ScheduleMeetingModal';
import { EditMeetingModal } from '../components/EditMeetingModal';
import { OpenHostingerLinksButton } from '../components/HostingerPrepSelector';

export const ClientProfilePage: React.FC<ClientProfilePageProps> = ({ client, onBack, onSeeInProjects, onOpenChat }) => {
  const { refreshStatus, updateClient, updateProspect, deleteClient, deleteProject, getClientFiles, ensureProjectDriveFolders, getOrCreateChatSpace, accessToken, meetings, uploadFile, deleteFile, clients, prospects } = useWorkspace();
  const { runBackgroundAction } = useBackgroundAction();
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [showSyncSuccess, setShowSyncSuccess] = React.useState(false);
  const [driveFiles, setDriveFiles] = React.useState<any[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [fileToDelete, setFileToDelete] = React.useState<{id: string, name: string} | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const isProspectEntity = React.useMemo(
    () => !(clients || []).some(c => c.id === client.id) && (prospects || []).some(p => p.id === client.id),
    [clients, prospects, client.id]
  );

  const liveClient = React.useMemo<Client>(() => {
    return (
      (clients || []).find(c => c.id === client.id) ||
      ((prospects || []).find(p => p.id === client.id) as Client | undefined) ||
      client
    );
  }, [clients, prospects, client]);

  // Projects associated with this client
  const associatedProjects = (clients || []).filter(c => c.parentClientId === liveClient.id);
  const clientProjects = React.useMemo(() => {
    const list: Client[] = [];
    if (!liveClient.projectRemoved && liveClient.status !== 'Lead') {
      list.push(liveClient);
    }
    list.push(...associatedProjects);
    return list;
  }, [liveClient, associatedProjects]);

  const aggregatedTotalValue = clientProjects.reduce((sum, p) => sum + (p.totalValue || 0), 0);
  const aggregatedReceivedAmount = clientProjects.reduce((sum, p) => sum + (p.receivedAmount || 0), 0);
  const [selectedProject, setSelectedProject] = React.useState<Client>(() =>
    client.projectRemoved && associatedProjects.length > 0 ? associatedProjects[0] : client
  );
  const [viewMode, setViewMode] = React.useState<'all' | 'individual'>(() =>
    clientProjects.length > 1 ? 'all' : 'individual'
  );

  const hasProjects = clientProjects.length > 0;
  const isAllProjectsView = hasProjects && viewMode === 'all';

  // Sync selectedProject and viewMode when client changes
  React.useEffect(() => {
    const nextList: Client[] = [];
    if (!client.projectRemoved && client.status !== 'Lead') {
      nextList.push(client);
    }
    nextList.push(...associatedProjects);
    const nextProj = client.projectRemoved && associatedProjects.length > 0 ? associatedProjects[0] : client;
    setSelectedProject(nextProj);
    setViewMode(nextList.length > 1 ? 'all' : 'individual');
    setIsAddingPayment(false);
    setConfirmLiquidateId(null);
    setIsAddingNote(false);
    setEditingNoteId(null);
  }, [client.id]);

  // Sync selectedProject when clients or prospects state updates
  React.useEffect(() => {
    const updatedProject =
      (clients || []).find(c => c.id === selectedProject.id) ||
      ((prospects || []).find(p => p.id === selectedProject.id) as Client | undefined);
    if (updatedProject) {
      if (updatedProject.id === liveClient.id && updatedProject.projectRemoved && associatedProjects.length > 0) {
        setSelectedProject(associatedProjects[0]);
      } else {
        setSelectedProject(updatedProject);
      }
    }
  }, [clients, prospects, selectedProject.id]);

  // Filter meetings for active view (all client projects vs selected individual service)
  const displayedMeetings = React.useMemo(() => {
    const getProjectMeetingIds = (proj: Client) => {
      const ids = new Set<string>();
      if (proj.associatedMeetingId) ids.add(proj.associatedMeetingId);
      if (Array.isArray(proj.associatedMeetingIds)) {
        proj.associatedMeetingIds.forEach(id => id && ids.add(id));
      }
      return ids;
    };

    if (isAllProjectsView) {
      const meetingServiceMap = new Map<string, string[]>();
      clientProjects.forEach((p) => {
        const ids = getProjectMeetingIds(p);
        ids.forEach((meetingId) => {
          const list = meetingServiceMap.get(meetingId) || [];
          list.push(p.serviceType || 'Projeto Geral');
          meetingServiceMap.set(meetingId, list);
        });
      });
      return (meetings || [])
        .filter((m) => meetingServiceMap.has(m.id))
        .map((m) => ({
          meeting: m,
          services: meetingServiceMap.get(m.id) || []
        }));
    }

    const activeIds = getProjectMeetingIds(selectedProject);
    return (meetings || [])
      .filter((m) => activeIds.has(m.id))
      .map((m) => ({
        meeting: m,
        services: [selectedProject.serviceType || 'Projeto Geral']
      }));
  }, [isAllProjectsView, clientProjects, meetings, selectedProject]);
  
  // Meeting Modal State
  const [showMeetModal, setShowMeetModal] = React.useState(false);
  const [showSelectMeetModal, setShowSelectMeetModal] = React.useState(false);
  const [editingMeeting, setEditingMeeting] = React.useState<Meeting | null>(null);

  const initialMeetingEntity = React.useMemo<{ collection: EntityCollection; id: string }>(
    () => ({
      collection: isProspectEntity ? 'prospects' : 'clients',
      id: liveClient.id,
    }),
    [isProspectEntity, liveClient.id]
  );

  // Note creation state
  const [isAddingNote, setIsAddingNote] = React.useState(false);
  const [isSavingNote, setIsSavingNote] = React.useState(false);
  const [showNoteSuccess, setShowNoteSuccess] = React.useState(false);
  const [newNoteContent, setNewNoteContent] = React.useState('');
  const [noteTargetProjectId, setNoteTargetProjectId] = React.useState<string>(() => selectedProject.id);

  React.useEffect(() => {
    setNoteTargetProjectId(selectedProject.id);
  }, [selectedProject.id]);

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
    const clientRootFolderId =
      selectedProject.clientDriveFolderId ||
      client.clientDriveFolderId ||
      associatedProjects.find(p => p.clientDriveFolderId)?.clientDriveFolderId ||
      '';
    const siblingFolderIds = new Set(
      clientProjects
        .filter(p => p.id !== selectedProject.id && p.driveFolderId)
        .map(p => p.driveFolderId as string)
    );
    const currentServiceName = (selectedProject.serviceType || '').trim().toLowerCase();
    const siblingServiceNames = new Set(
      clientProjects
        .filter(p => p.id !== selectedProject.id)
        .map(p => (p.serviceType || '').trim().toLowerCase())
        .filter(name => Boolean(name) && name !== currentServiceName)
    );

    const fetchFiles = selectedProject.driveFolderId ? getClientFiles(selectedProject.driveFolderId) : Promise.resolve([]);
    
    fetchFiles
      .then(files => {
        let list = files || [];
        // If legacy project shares the root client folder ID, exclude sibling project subfolders
        if (clientRootFolderId && selectedProject.driveFolderId === clientRootFolderId) {
          list = list.filter((f: any) => {
            if (f.mimeType === 'application/vnd.google-apps.folder') {
              if (siblingFolderIds.has(f.id)) return false;
              if (siblingServiceNames.has((f.name || '').trim().toLowerCase())) return false;
            }
            return true;
          });
        }
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
  }, [selectedProject.id, selectedProject.driveFolderId, selectedProject.clientDriveFolderId, selectedProject.proposalFileName, selectedProject.proposalFileUrl, client.clientDriveFolderId, accessToken, getClientFiles]);

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
  const [confirmLiquidateAmount, setConfirmLiquidateAmount] = React.useState<string>('');
  const [profileTransitionTarget, setProfileTransitionTarget] = React.useState<{ client: Client, status: ProjectStage } | null>(null);

  const handleLiquidate = async (amount: number, paymentId: string, dateStr?: string, targetProjectId?: string) => {
    const projId = targetProjectId || selectedProject.id;
    const targetProj = clients.find(c => c.id === projId) || selectedProject;
    const targetPayment = (targetProj.payments || []).find(p => p.id === paymentId);
    const maxPayable = targetPayment ? (targetPayment.amount || 0) : amount;
    const liqAmt = Number(Math.min(maxPayable, Math.max(0, amount)).toFixed(2));
    if (liqAmt <= 0) return;

    setLiquidatingId(paymentId);
    const liquidationDate = dateStr || getTodayISO();
    try {
      const preservedSaleDate =
        targetPayment?.saleDate ||
        targetProj.saleDate ||
        targetProj.proposal?.acceptedAt ||
        targetProj.projectStartDate ||
        targetPayment?.date ||
        liquidationDate;

      const isPartial = Boolean(targetPayment && liqAmt < (targetPayment.amount || 0) - 0.005);
      let nextPayments: Payment[];

      if (isPartial && targetPayment) {
        const remainingPendingAmt = Number(((targetPayment.amount || 0) - liqAmt).toFixed(2));
        nextPayments = (targetProj.payments || []).flatMap(p => {
          if (p.id !== paymentId) return [p];
          return [
            {
              ...p,
              amount: remainingPendingAmt,
              saleDate: p.saleDate || preservedSaleDate,
            },
            {
              id: 'p-' + Math.random().toString(36).substring(7),
              amount: liqAmt,
              date: liquidationDate,
              saleDate: preservedSaleDate,
              status: 'received' as const,
              type: p.type,
              description: p.description ? `${p.description} (Parcial)` : 'Liquidação parcial',
            }
          ];
        });
      } else {
        nextPayments = (targetProj.payments || []).map(p =>
          p.id === paymentId
            ? {
                ...p,
                status: 'received' as const,
                saleDate: p.saleDate || preservedSaleDate,
                date: liquidationDate,
              }
            : p
        );
      }

      const isRecurringPayment = targetPayment?.type === 'recurring' && !isPartial;
      const updatedRecurring = isRecurringPayment && targetProj.recurringBilling
        ? {
            ...targetProj.recurringBilling,
            cyclesPaid: (targetProj.recurringBilling.cyclesPaid || 0) + 1
          }
        : targetProj.recurringBilling;

      await updateClient(targetProj.id, {
        receivedAmount: Number(((targetProj.receivedAmount || 0) + liqAmt).toFixed(2)),
        payments: nextPayments,
        ...(updatedRecurring ? { recurringBilling: updatedRecurring } : {}),
        lastInteraction: new Date().toISOString()
      });
      setConfirmLiquidateId(null);
      setConfirmLiquidateAmount('');
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
  const [editWebsiteLinks, setEditWebsiteLinks] = React.useState<WebsiteProjectLinks>(EMPTY_WEBSITE_LINKS);
  const [editSocialPlatforms, setEditSocialPlatforms] = React.useState<SocialMediaPlatform[]>([]);
  const [editPaidPlatforms, setEditPaidPlatforms] = React.useState<PaidTrafficPlatform[]>([]);
  const [editingLinksProject, setEditingLinksProject] = React.useState<Client | null>(null);
  const [editingPlatformsProject, setEditingPlatformsProject] = React.useState<Client | null>(null);

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

    const preservedSaleDate =
      selectedProject.saleDate ||
      selectedProject.proposal?.acceptedAt ||
      selectedProject.projectStartDate ||
      liqDate;

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
              saleDate: p.saleDate || preservedSaleDate,
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
        saleDate: preservedSaleDate,
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
      saleDate: cycleDate,
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
    const amt = Number((parseFloat(newPaymentAmount) || 0).toFixed(2));
    if (amt <= 0) return;
    const isRec = !!selectedProject.recurringBilling?.enabled;
    const paymentDate = newPaymentDate || getTodayISO();
    const currentTotal = selectedProject.totalValue || 0;
    const currentReceived = selectedProject.receivedAmount || 0;
    const unpaidBalance = Math.max(0, currentTotal - currentReceived);
    const preservedSaleDate =
      selectedProject.saleDate ||
      selectedProject.proposal?.acceptedAt ||
      selectedProject.projectStartDate ||
      paymentDate;

    const payment: Payment = {
      id: 'p-' + Math.random().toString(36).substring(7),
      amount: amt,
      date: paymentDate,
      saleDate: newPaymentStatus === 'received' && unpaidBalance > 0.005 ? preservedSaleDate : paymentDate,
      status: newPaymentStatus,
      type: isRec ? 'recurring' : 'final',
      description: newPaymentDesc.trim() || (isRec ? 'Pagamento Recorrente' : 'Pagamento Adicional')
    };

    let updatedPayments: Payment[] = [...(selectedProject.payments || [])];
    let nextTotalValue = currentTotal;
    let nextReceivedAmount = currentReceived;

    if (newPaymentStatus === 'received') {
      nextReceivedAmount = Number((currentReceived + amt).toFixed(2));
      if (unpaidBalance > 0.005) {
        let toConsume = Math.min(amt, unpaidBalance);
        const adjusted: Payment[] = [];
        for (const p of updatedPayments) {
          if (p.status === 'pending' && toConsume > 0.005) {
            if ((p.amount || 0) <= toConsume + 0.005) {
              toConsume = Math.max(0, toConsume - (p.amount || 0));
              continue;
            } else {
              adjusted.push({
                ...p,
                saleDate: p.saleDate || preservedSaleDate,
                amount: Number(((p.amount || 0) - toConsume).toFixed(2))
              });
              toConsume = 0;
              continue;
            }
          }
          adjusted.push(p);
        }
        updatedPayments = [...adjusted, payment];
        nextTotalValue = Math.max(currentTotal, nextReceivedAmount);
      } else {
        updatedPayments = [...updatedPayments, payment];
        nextTotalValue = Number((currentTotal + amt).toFixed(2));
      }
    } else {
      updatedPayments = [...updatedPayments, payment];
      nextTotalValue = Number((currentTotal + amt).toFixed(2));
    }

    setIsAddingPayment(false);
    setNewPaymentAmount('');
    setNewPaymentDesc('');
    setNewPaymentDate(getTodayISO());
    setNewPaymentStatus('pending');

    runBackgroundAction({
      title: 'A registar pagamento...',
      action: async () => {
        await updateClient(selectedProject.id, {
          payments: updatedPayments,
          totalValue: nextTotalValue,
          receivedAmount: nextReceivedAmount,
          lastInteraction: new Date().toISOString()
        });
      },
      errorMessage: 'Erro ao registar pagamento.'
    });
  };

  const handleSaveInfo = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditingInfo(false);

    const editingServiceOnSecondary = !isAllProjectsView && selectedProject.id !== client.id;
    const websitePayload = isWebsiteGoogleService(editFormData.serviceType)
      ? buildWebsiteLinksPayload(editWebsiteLinks)
      : undefined;
    const socialPayload = isSocialMediaService(editFormData.serviceType)
      ? normalizeSocialMediaPlatforms(editSocialPlatforms)
      : null;
    const paidPayload = isPaidTrafficService(editFormData.serviceType)
      ? normalizePaidTrafficPlatforms(editPaidPlatforms)
      : null;

    runBackgroundAction({
      title: 'A atualizar informações...',
      action: async () => {
        await updateClient(client.id, {
          name: editFormData.name,
          contactName: editFormData.contactName,
          email: editFormData.email,
          phone: editFormData.phone,
          dashboardEmail: editFormData.dashboardEmail,
          ...(!editingServiceOnSecondary ? {
            serviceType: editFormData.serviceType,
            ...(websitePayload ? { websiteLinks: websitePayload } : {}),
            socialMediaPlatforms: socialPayload as any,
            paidTrafficPlatforms: paidPayload as any
          } : {}),
          clientType: editFormData.clientType,
          nif: editFormData.nif,
          fiscalAddress: editFormData.fiscalAddress,
          lastInteraction: new Date().toISOString()
        });

        if (editingServiceOnSecondary) {
          await updateClient(selectedProject.id, {
            name: editFormData.name,
            serviceType: editFormData.serviceType,
            ...(websitePayload ? { websiteLinks: websitePayload } : {}),
            socialMediaPlatforms: socialPayload as any,
            paidTrafficPlatforms: paidPayload as any,
            lastInteraction: new Date().toISOString()
          });
        }
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

  const resolveActiveProjectFolderId = async (): Promise<string> => {
    const existingClientFolder = selectedProject.clientDriveFolderId || client.clientDriveFolderId || '';
    const existingProjFolder = selectedProject.driveFolderId || '';
    if (existingClientFolder && existingProjFolder && existingProjFolder !== existingClientFolder) {
      return existingProjFolder;
    }
    const ensured = await ensureProjectDriveFolders({
      clientId: selectedProject.id,
      clientName: selectedProject.name || client.name,
      projectName: selectedProject.serviceType || 'Projeto Geral',
      existingClientFolderId: existingClientFolder,
      existingProjectFolderId: existingProjFolder,
      parentClientId: selectedProject.parentClientId
    });
    return ensured.projectFolderId;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const targetFolderId = await resolveActiveProjectFolderId();
      if (!targetFolderId) {
        alert("Ligue o Google Workspace para enviar ficheiros para o Drive.");
        return;
      }
      for (const file of files) {
        await uploadFile(selectedProject.id, targetFolderId, file);
      }
      const updatedFiles = await getClientFiles(targetFolderId);
      setDriveFiles(updatedFiles);
    } catch (err) {
      console.error(err);
      alert("Erro ao carregar ficheiro.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteFile = async () => {
    const targetFolderId = selectedProject.driveFolderId;
    if (!fileToDelete || !targetFolderId) return;
    setIsLoadingFiles(true);
    try {
      await deleteFile(fileToDelete.id);
      setFileToDelete(null);
      const files = await getClientFiles(targetFolderId);
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

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const targetFolderId = await resolveActiveProjectFolderId();
      if (!targetFolderId) {
        alert("Ligue o Google Workspace para enviar ficheiros para o Drive.");
        return;
      }
      for (const file of files) {
        await uploadFile(selectedProject.id, targetFolderId, file);
      }
      const updatedFiles = await getClientFiles(targetFolderId);
      setDriveFiles(updatedFiles);
    } catch (err) {
      console.error(err);
      alert("Erro ao carregar ficheiro.");
    } finally {
      setIsUploading(false);
    }
  };

  const displayedNotes = React.useMemo(() => {
    if (isAllProjectsView) {
      return clientProjects.flatMap((proj) =>
        (proj.notes || []).map((note) => ({
          ...note,
          __projectId: proj.id,
          __serviceName: proj.serviceType || 'Projeto Geral'
        }))
      );
    }
    return (selectedProject.notes || []).map((note) => ({
      ...note,
      __projectId: selectedProject.id,
      __serviceName: selectedProject.serviceType || 'Projeto Geral'
    }));
  }, [isAllProjectsView, clientProjects, selectedProject.id, selectedProject.notes, selectedProject.serviceType]);

  const submitNote = () => {
    if (!newNoteContent.trim()) {
      setIsAddingNote(false);
      return;
    }

    const targetId = isAllProjectsView ? noteTargetProjectId : selectedProject.id;
    const targetProj = clients.find(c => c.id === targetId) || selectedProject;

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
        await updateClient(targetProj.id, {
          notes: [...(targetProj.notes || []), newNote]
        });
      },
      errorMessage: 'Erro ao guardar a nota.'
    });
  };

  const handleDeleteNote = (noteId: string, targetProjectId?: string) => {
    const targetProj = clients.find(c => c.id === (targetProjectId || selectedProject.id)) || selectedProject;
    const updatedNotes = (targetProj.notes || []).filter(n => n.id !== noteId);
    runBackgroundAction({
      title: 'A eliminar nota...',
      action: async () => {
        await updateClient(targetProj.id, {
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

  const handleSaveEditNote = (noteId: string, targetProjectId?: string) => {
    if (!editingNoteContent.trim()) return;
    const targetProj = clients.find(c => c.id === (targetProjectId || selectedProject.id)) || selectedProject;
    const updatedNotes = (targetProj.notes || []).map(n => {
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
        await updateClient(targetProj.id, {
          notes: updatedNotes
        });
      },
      errorMessage: 'Erro ao atualizar a nota.'
    });
  };

  return (
    <div className="space-y-8 pb-12">
      <ScheduleMeetingModal
        isOpen={showMeetModal}
        onClose={() => setShowMeetModal(false)}
        title="Agendar Reunião"
        subtitle={liveClient.name}
        confirmLabel="Confirmar e Sincronizar"
        initialEntity={initialMeetingEntity}
        initialProjectId={!isAllProjectsView ? selectedProject.id : undefined}
      />

      <EditMeetingModal
        meeting={editingMeeting}
        onClose={() => setEditingMeeting(null)}
      />

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
              {(() => {
                const headerStatus = isAllProjectsView
                  ? (clientProjects.some(p => p.status === 'Cliente') ? 'Cliente' : client.status)
                  : selectedProject.status;
                return (
                  <Badge
                    variant={
                      headerStatus === 'Terminado' || headerStatus === 'Falhado'
                        ? 'danger'
                        : headerStatus === 'Cliente' || headerStatus === 'Reunião Agendada'
                        ? 'success'
                        : 'warning'
                    }
                  >
                    {headerStatus}
                  </Badge>
                );
              })()}
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs text-zinc-400">
              <span>Conta Principal</span>
              <span className="text-zinc-600">·</span>
              <span>{client.dashboardEmail ? `Acesso: ${client.dashboardEmail}` : 'Gerida por Alex Sosa'}</span>
              {isAllProjectsView ? (
                <>
                  <span className="text-zinc-600">·</span>
                  <span className="text-zinc-300 font-medium tabular-nums">
                    {clientProjects.length} {clientProjects.length === 1 ? 'projeto / serviço' : 'projetos / serviços'}
                  </span>
                </>
              ) : (
                <>
                  {hasProjects && (
                    <>
                      <span className="text-zinc-600">·</span>
                      <span className="text-zinc-200 font-medium">
                        {selectedProject.serviceType || 'Projeto Geral'}
                      </span>
                    </>
                  )}
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
                </>
              )}
            </div>

            {client.projectRemoved && associatedProjects.length === 0 && (
              <p className="text-xs text-amber-400/90 font-medium pt-1">
                Sem projeto ativo associado
              </p>
            )}
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
            title={!isAllProjectsView && selectedProject.id !== client.id ? "Eliminar Projeto Atual" : `Eliminar ${client.status === 'Lead' ? 'Lead' : 'Cliente'}`}
            className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-red-500/30 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 hover:-translate-y-[1px] hover:scale-105 active:scale-95 flex items-center justify-center transition-all duration-150 shrink-0"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </header>

      {/* View Mode Switcher: Todos os Projetos vs Projetos Individuais */}
      {hasProjects && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-2.5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <button
            type="button"
            onClick={() => setViewMode('all')}
            className={cn(
              "inline-flex items-center gap-2 h-9 px-3.5 rounded-xl border text-xs font-semibold transition-all duration-150 cursor-pointer shrink-0 self-start md:self-auto",
              isAllProjectsView
                ? "bg-vela-red border-vela-red text-white shadow-sm"
                : "bg-[#0D0D0F] border-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.04] hover:border-white/[0.14]"
            )}
          >
            <Layers size={14} />
            <span>Todos os Projetos</span>
            <span
              className={cn(
                "px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums",
                isAllProjectsView ? "bg-black/25 text-white" : "bg-white/[0.06] text-zinc-400"
              )}
            >
              {clientProjects.length}
            </span>
          </button>

          <div className="flex items-center gap-2 flex-wrap md:justify-end">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 hidden sm:inline mr-1">
              Projetos:
            </span>
            {clientProjects.map((proj) => {
              const isSelectedService = !isAllProjectsView && proj.id === selectedProject.id;
              const dotColor =
                proj.status === 'Cliente'
                  ? 'bg-emerald-400'
                  : proj.status === 'Terminado' || proj.status === 'Falhado'
                  ? 'bg-red-400'
                  : 'bg-amber-400';

              return (
                <button
                  key={proj.id}
                  type="button"
                  onClick={() => {
                    setSelectedProject(proj);
                    setViewMode('individual');
                  }}
                  className={cn(
                    "inline-flex items-center gap-2 h-8 px-3 rounded-xl border text-xs font-medium transition-all duration-150 cursor-pointer",
                    isSelectedService
                      ? "bg-vela-red/15 border-vela-red/40 text-white"
                      : "bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.05] hover:border-white/[0.15]"
                  )}
                  title={`Ver serviço individualmente: ${proj.serviceType || 'Projeto Geral'} (${proj.status})`}
                >
                  <span className={cn("w-2 h-2 rounded-full shrink-0", dotColor)} />
                  <span className="truncate max-w-[190px]">{proj.serviceType || 'Projeto Geral'}</span>
                </button>
              );
            })}

            {!isAllProjectsView && !client.projectRemoved && selectedProject.status !== 'Por Agendar' && selectedProject.status !== 'Reunião Agendada' && (
              <button
                type="button"
                onClick={() => setShowDeleteProjectModal(true)}
                title="Eliminar apenas este projeto (mantém o cliente)"
                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-red-500/30 hover:bg-red-500/10 text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-red-400 transition-all duration-150 cursor-pointer"
              >
                <Trash2 size={12} />
                <span className="hidden lg:inline">Eliminar Projeto</span>
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details & Financials */}
        <div className="space-y-6">
          <GlassCard className="p-6 space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-white/[0.06]">
              <h4 className="text-[11px] uppercase tracking-wider text-zinc-400 font-bold">Informações</h4>
              <button
                type="button"
                onClick={() => {
                  const sourceForService = isAllProjectsView ? client : selectedProject;
                  setEditFormData({
                    name: client.name || '',
                    contactName: client.contactName || '',
                    email: client.email || '',
                    phone: client.phone || '',
                    dashboardEmail: client.dashboardEmail || '',
                    serviceType: sourceForService.serviceType || '',
                    clientType: client.clientType || 'individual',
                    nif: client.nif || '',
                    fiscalAddress: client.fiscalAddress || ''
                  });
                  setEditWebsiteLinks(buildWebsiteLinksPayload(sourceForService.websiteLinks));
                  setEditSocialPlatforms(normalizeSocialMediaPlatforms(sourceForService.socialMediaPlatforms));
                  setEditPaidPlatforms(normalizePaidTrafficPlatforms(sourceForService.paidTrafficPlatforms));
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
                  <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">
                    {isAllProjectsView ? `Serviços Adjudicados (${clientProjects.length})` : 'Serviço Adjudicado'}
                  </p>
                  {isAllProjectsView ? (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {clientProjects.map((proj) => (
                        <button
                          key={proj.id}
                          type="button"
                          onClick={() => {
                            setSelectedProject(proj);
                            setViewMode('individual');
                          }}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/[0.03] hover:bg-vela-red/10 border border-white/[0.06] hover:border-vela-red/30 text-xs font-medium text-zinc-200 hover:text-white transition-all duration-150 cursor-pointer"
                        >
                          <span>{proj.serviceType || 'Projeto Geral'}</span>
                          <ChevronRight size={11} className="text-zinc-500" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-white">{selectedProject.serviceType || 'Não especificado'}</p>
                      {hasServicePlatforms(selectedProject.serviceType) && (() => {
                        const included = getIncludedPlatformsForEntity(selectedProject);
                        return (
                          <p className="text-[11px] text-zinc-400">
                            {included.length > 0 ? included.join(' · ') : 'Nenhuma plataforma selecionada'}
                          </p>
                        );
                      })()}
                    </div>
                  )}
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

          {(isAllProjectsView
            ? clientProjects.some(p => p.status !== 'Lead' && p.status !== 'Reunião Agendada' && p.status !== 'Por Agendar')
            : (selectedProject.status !== 'Lead' && selectedProject.status !== 'Reunião Agendada' && selectedProject.status !== 'Por Agendar')
          ) && (() => {
            const displayTotal = isAllProjectsView ? aggregatedTotalValue : (selectedProject.totalValue || 0);
            const displayReceived = isAllProjectsView ? aggregatedReceivedAmount : (selectedProject.receivedAmount || 0);
            const ratio = displayTotal > 0 ? Math.min(100, Math.round((displayReceived / displayTotal) * 100)) : 0;
            const rb = !isAllProjectsView ? selectedProject.recurringBilling : undefined;
            const paymentsList: Array<Payment & { __projectId: string; __serviceName: string }> = isAllProjectsView
              ? clientProjects.flatMap((proj) =>
                  (proj.payments || []).map((p) => ({
                    ...p,
                    __projectId: proj.id,
                    __serviceName: proj.serviceType || 'Projeto Geral'
                  }))
                )
              : (selectedProject.payments || []).map((p) => ({
                  ...p,
                  __projectId: selectedProject.id,
                  __serviceName: selectedProject.serviceType || 'Projeto Geral'
                }));

            return (
              <GlassCard className="p-6 space-y-6">
                <div className="flex justify-between items-center pb-4 border-b border-white/[0.06]">
                  <div>
                    <h4 className="text-[11px] uppercase tracking-wider text-zinc-400 font-bold">
                      {isAllProjectsView ? 'Matriz Financeira · Todos' : 'Matriz Financeira'}
                    </h4>
                    {!isAllProjectsView && hasProjects && (
                      <p className="text-[10px] text-zinc-500 mt-0.5 truncate max-w-[160px]">
                        {selectedProject.serviceType || 'Projeto Geral'}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {!isAllProjectsView && (
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
                    )}
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

                  {/* Resumo por Serviço when in Todos os Projetos mode */}
                  {isAllProjectsView && clientProjects.length > 0 && (
                    <div className="pt-5 border-t border-white/[0.06] space-y-2.5">
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                        Resumo por Serviço
                      </p>
                      <div className="space-y-2">
                        {clientProjects.map((proj) => {
                          const pTotal = proj.totalValue || 0;
                          const pRec = proj.receivedAmount || 0;
                          return (
                            <button
                              key={proj.id}
                              type="button"
                              onClick={() => {
                                setSelectedProject(proj);
                                setViewMode('individual');
                              }}
                              className="w-full flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.14] text-left transition-all duration-150 cursor-pointer group"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-zinc-200 group-hover:text-white truncate">
                                  {proj.serviceType || 'Projeto Geral'}
                                </p>
                                <p className="text-[10px] text-zinc-500">{proj.status}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 tabular-nums text-xs">
                                <span className="font-bold text-emerald-400">{formatCurrency(pRec)}</span>
                                <span className="text-zinc-600">/</span>
                                <span className="text-zinc-400">{formatCurrency(pTotal)}</span>
                                <ChevronRight size={13} className="text-zinc-600 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Cobrança Recorrente Sub-panel (individual service) */}
                  {!isAllProjectsView && rb?.enabled && (
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
                      {!isAllProjectsView && (
                        <button
                          type="button"
                          onClick={() => setIsAddingPayment(!isAddingPayment)}
                          className="text-[10px] font-bold uppercase tracking-wider text-vela-red hover:text-vela-red/80 hover:-translate-y-[1px] transition-all duration-150 flex items-center gap-1"
                        >
                          <Plus size={12} /> {isAddingPayment ? 'Fechar' : 'Registar'}
                        </button>
                      )}
                    </div>

                    {!isAllProjectsView && isAddingPayment && (
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
                          <div key={`${p.__projectId}-${p.id}`} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold text-white truncate">
                                  {p.description || (p.type === 'adjudication' ? 'Adjudicação' : p.type === 'recurring' ? 'Recorrente' : 'Tranche Final')}
                                </p>
                                <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                                  <span className="tabular-nums">{p.date}</span>
                                  {isAllProjectsView && (
                                    <>
                                      <span>·</span>
                                      <span className="truncate text-zinc-400">{p.__serviceName}</span>
                                    </>
                                  )}
                                </div>
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
                                      setConfirmLiquidateAmount(String(p.amount));
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
                              <div className="pt-2 border-t border-white/[0.06] flex flex-wrap items-center gap-2">
                                <input
                                  type="number"
                                  min="0.01"
                                  max={p.amount}
                                  step="0.01"
                                  value={confirmLiquidateAmount}
                                  onChange={(e) => setConfirmLiquidateAmount(e.target.value)}
                                  title="Valor a liquidar (€)"
                                  placeholder="Valor (€)"
                                  className="w-24 h-8 bg-[#0D0D0F] border border-white/[0.08] rounded-lg px-2.5 text-[11px] text-white focus:outline-none focus:border-emerald-500/50 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  required
                                />
                                <input
                                  type="date"
                                  value={confirmLiquidateDate}
                                  onChange={(e) => setConfirmLiquidateDate(e.target.value)}
                                  className="flex-1 min-w-[120px] h-8 bg-[#0D0D0F] border border-white/[0.08] rounded-lg px-2.5 text-[11px] text-white focus:outline-none focus:border-emerald-500/50 tabular-nums"
                                  required
                                />
                                <button
                                  type="button"
                                  disabled={liquidatingId === p.id || (parseFloat(confirmLiquidateAmount) || 0) <= 0}
                                  onClick={() => handleLiquidate(parseFloat(confirmLiquidateAmount) || p.amount, p.id, confirmLiquidateDate, p.__projectId)}
                                  className="h-8 px-2.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold uppercase tracking-wider hover:-translate-y-[1px] transition-all duration-150 disabled:opacity-50"
                                >
                                  Confirmar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setConfirmLiquidateId(null);
                                    setConfirmLiquidateAmount('');
                                  }}
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

                  {!isAllProjectsView && selectedProject.proposalFileUrl && (
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

        {/* Center Column: Meetings, Projects/Documentation & Notes */}
        <div className="lg:col-span-2 space-y-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={isAllProjectsView ? 'all-projects-view' : `individual-${selectedProject.id}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.16 }}
              className="space-y-6"
            >
              {/* Todos os Projetos Overview Grid (only when viewMode === 'all') */}
              {isAllProjectsView && (() => {
                const activeClientFolderId =
                  client.clientDriveFolderId ||
                  associatedProjects.find(p => p.clientDriveFolderId)?.clientDriveFolderId ||
                  '';

                return (
                  <GlassCard className="p-6 space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
                      <div className="flex items-center gap-2.5">
                        <Layers size={15} className="text-vela-red" />
                        <h3 className="text-[11px] font-bold text-white uppercase tracking-wider">
                          Todos os Projetos &amp; Serviços ({clientProjects.length})
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {activeClientFolderId && (
                          <Button
                            variant="outline"
                            className="h-8 px-3 text-[11px]"
                            onClick={() => window.open(`https://drive.google.com/drive/folders/${activeClientFolderId}`, '_blank')}
                          >
                            <Folder size={13} />
                            <span>Pasta do Cliente</span>
                          </Button>
                        )}
                        <Button
                          variant="primary"
                          className="h-8 px-3 text-[11px] group"
                          onClick={() => onSeeInProjects(client.id)}
                        >
                          <span>Gestão de Projetos</span>
                          <ChevronRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {clientProjects.map((proj) => {
                        const pTotal = proj.totalValue || 0;
                        const pRec = proj.receivedAmount || 0;
                        const pRatio = pTotal > 0 ? Math.min(100, Math.round((pRec / pTotal) * 100)) : 0;

                        return (
                          <div
                            key={proj.id}
                            className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.15] hover:bg-white/[0.03] transition-all duration-150 flex flex-col justify-between gap-4"
                          >
                            <div className="space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-8 h-8 rounded-lg bg-vela-red/10 border border-vela-red/20 flex items-center justify-center text-vela-red shrink-0">
                                    <Briefcase size={15} />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-bold text-white truncate">
                                      {proj.serviceType || 'Projeto Geral'}
                                    </p>
                                    {(proj.projectStartDate || proj.projectEndDate) && (
                                      <p className="text-[11px] text-zinc-500 tabular-nums">
                                        {proj.projectStartDate ? `Início ${new Date(`${proj.projectStartDate}T00:00:00`).toLocaleDateString('pt-PT')}` : ''}
                                        {proj.projectStartDate && proj.projectEndDate ? ' · ' : ''}
                                        {proj.projectEndDate ? `Fim ${new Date(`${proj.projectEndDate}T00:00:00`).toLocaleDateString('pt-PT')}` : ''}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {proj.recurringBilling?.enabled && (
                                    <span
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-[10px] font-semibold text-zinc-300"
                                      title="Cobrança Recorrente"
                                    >
                                      <Repeat size={10} className="text-vela-red" />
                                    </span>
                                  )}
                                  <Badge
                                    variant={
                                      proj.status === 'Terminado' || proj.status === 'Falhado'
                                        ? 'danger'
                                        : proj.status === 'Cliente' || proj.status === 'Reunião Agendada'
                                        ? 'success'
                                        : 'warning'
                                    }
                                  >
                                    {proj.status}
                                  </Badge>
                                </div>
                              </div>

                              <div className="space-y-1.5 pt-1">
                                <div className="flex items-center justify-between text-xs tabular-nums">
                                  <span className="text-zinc-400">
                                    <span className="text-emerald-400 font-bold">{formatCurrency(pRec)}</span> / {formatCurrency(pTotal)}
                                  </span>
                                  <span className="text-[11px] font-semibold text-zinc-500">{pRatio}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-vela-red transition-all duration-300"
                                    style={{ width: `${pRatio}%` }}
                                  />
                                </div>
                              </div>

                              {isWebsiteGoogleService(proj.serviceType) && (
                                <div className="pt-1">
                                  <WebsiteLinkButtons
                                    variant="compact"
                                    links={proj.websiteLinks}
                                    onEdit={() => setEditingLinksProject(proj)}
                                  />
                                </div>
                              )}
                              {hasServicePlatforms(proj.serviceType) && (
                                <div className="pt-1">
                                  <ServicePlatformButtons
                                    variant="compact"
                                    serviceType={proj.serviceType}
                                    socialPlatforms={proj.socialMediaPlatforms}
                                    paidTrafficPlatforms={proj.paidTrafficPlatforms}
                                    onEdit={() => setEditingPlatformsProject(proj)}
                                  />
                                </div>
                              )}
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-3 border-t border-white/[0.06]">
                              {proj.driveFolderId ? (
                                <button
                                  type="button"
                                  onClick={() => window.open(`https://drive.google.com/drive/folders/${proj.driveFolderId}`, '_blank')}
                                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] text-[11px] font-medium text-zinc-300 hover:text-white transition-all duration-150 cursor-pointer"
                                >
                                  <FolderOpen size={13} className="text-amber-400" />
                                  <span>Pasta Drive</span>
                                </button>
                              ) : (
                                <span className="text-[11px] text-zinc-600">Sem pasta Drive</span>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedProject(proj);
                                  setViewMode('individual');
                                }}
                                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-vela-red/15 hover:bg-vela-red border border-vela-red/30 hover:border-vela-red text-white text-[11px] font-bold uppercase tracking-wider transition-all duration-150 cursor-pointer group"
                              >
                                <span>Ver Serviço</span>
                                <ChevronRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </GlassCard>
                );
              })()}

              {/* Show Project Documentation & Links FIRST in Individual view (and if NOT a Lead) */}
              {!isAllProjectsView && (client.status !== 'Lead' ? (() => {
                const activeProjectFolderId = selectedProject.driveFolderId || '';
                const sortedFiles = [...driveFiles].sort((a, b) => {
                  const aIsDir = a.mimeType === 'application/vnd.google-apps.folder' ? 0 : 1;
                  const bIsDir = b.mimeType === 'application/vnd.google-apps.folder' ? 0 : 1;
                  return aIsDir - bIsDir;
                });
                const selectedDotColor =
                  selectedProject.status === 'Cliente'
                    ? 'bg-emerald-400'
                    : selectedProject.status === 'Terminado' || selectedProject.status === 'Falhado'
                    ? 'bg-red-400'
                    : 'bg-amber-400';

                return (
                <>
                <GlassCard
                  className={cn(
                    "p-6 space-y-5 relative overflow-hidden transition-colors duration-150",
                    isDragging && "border-vela-red/60 bg-vela-red/[0.04]"
                  )}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".pdf,.doc,.docx,.png,.jpg,.xlsx,.zip"
                    multiple
                  />

                  {isDragging && (
                    <div className="absolute inset-0 z-20 bg-zinc-950/80 backdrop-blur-[2px] border-2 border-dashed border-vela-red rounded-2xl flex flex-col items-center justify-center gap-2 pointer-events-none">
                      <div className="w-11 h-11 rounded-xl bg-vela-red/15 border border-vela-red/30 flex items-center justify-center text-vela-red">
                        <Upload size={20} />
                      </div>
                      <p className="text-xs font-bold text-vela-red uppercase tracking-wider">
                        Solte os ficheiros para carregar
                      </p>
                      <p className="text-[11px] text-zinc-400">
                        Guarda diretamente na pasta "{selectedProject.serviceType || 'Projeto Geral'}"
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2.5">
                      <Briefcase size={15} className="text-vela-red" />
                      <h3 className="text-[11px] font-bold text-white uppercase tracking-wider">
                        Repositório de Documentação
                      </h3>
                    </div>
                    <button
                      type="button"
                      disabled={!activeProjectFolderId}
                      onClick={() => activeProjectFolderId && window.open(`https://drive.google.com/drive/folders/${activeProjectFolderId}`, '_blank')}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-vela-red/10 border border-vela-red/25 text-[11px] text-white font-semibold transition-all duration-150",
                        activeProjectFolderId ? "hover:bg-vela-red/20 cursor-pointer" : "opacity-75 cursor-default"
                      )}
                      title="Pasta deste serviço no Google Drive"
                    >
                      <FolderOpen size={12} className="text-vela-red" />
                      <span className="max-w-[200px] truncate">{selectedProject.serviceType || 'Projeto Geral'}</span>
                    </button>
                  </div>

                  {/* Selected Service Folder Card Only */}
                  <div className="flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl bg-vela-red/10 border border-vela-red/30 text-white">
                    <div className="flex items-center gap-3 min-w-0">
                      <FolderOpen size={17} className="text-vela-red shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">
                          {selectedProject.serviceType || 'Projeto Geral'}
                        </p>
                        <p className="text-[10px] text-zinc-400 truncate">
                          {activeProjectFolderId
                            ? `Pasta do serviço sincronizada (${sortedFiles.length} ${sortedFiles.length === 1 ? 'item' : 'itens'})`
                            : 'A pasta do serviço será criada ao carregar um ficheiro'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      {activeProjectFolderId && (
                        <button
                          type="button"
                          onClick={() => window.open(`https://drive.google.com/drive/folders/${activeProjectFolderId}`, '_blank')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-[10px] font-bold uppercase tracking-wider text-zinc-200 hover:text-white transition-all duration-150 cursor-pointer"
                        >
                          <span>Abrir Drive</span>
                          <ExternalLink size={11} />
                        </button>
                      )}
                      <span className={cn("w-2 h-2 rounded-full shrink-0", selectedDotColor)} title={selectedProject.status} />
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {isLoadingFiles ? (
                      <div className="flex items-center justify-center gap-2 text-xs text-zinc-500 py-6">
                        <Loader2 size={14} className="animate-spin" /> A sincronizar ficheiros...
                      </div>
                    ) : sortedFiles.length > 0 ? (
                      sortedFiles.map(file => {
                        const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
                        return (
                          <div key={file.id} className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.035] hover:border-white/15 hover:-translate-y-[1px] transition-all duration-150 cursor-pointer group">
                            <div
                              className="flex items-center gap-3 flex-1 min-w-0"
                              onClick={() => window.open(file.webViewLink || (isFolder ? `https://drive.google.com/drive/folders/${file.id}` : `https://drive.google.com/open?id=${file.id}`), '_blank')}
                            >
                              {isFolder ? (
                                <Folder size={16} className="text-amber-400 shrink-0" />
                              ) : (
                                <FileText size={16} className="text-zinc-500 group-hover:text-vela-red transition-colors duration-150 shrink-0" />
                              )}
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-semibold text-zinc-200 truncate">{file.name}</span>
                                <span className="text-[11px] text-zinc-500 tabular-nums">
                                  {isFolder ? 'Subpasta Drive · ' : ''}Modificado em {new Date(file.modifiedTime || Date.now()).toLocaleDateString('pt-PT')}
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
                        );
                      })
                    ) : (
                      <p className="text-xs text-zinc-500 text-center py-6 bg-white/[0.01] rounded-xl border border-dashed border-white/[0.06]">
                        Nenhum ficheiro na pasta deste serviço · Arraste ficheiros para esta área
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1 h-9 text-xs"
                      onClick={() => activeProjectFolderId && window.open(`https://drive.google.com/drive/folders/${activeProjectFolderId}`, '_blank')}
                      disabled={!activeProjectFolderId}
                    >
                      <FolderOpen size={13} />
                      <span>Pasta do Projeto</span>
                    </Button>
                    <Button
                      variant="primary"
                      className="flex-1 h-9 text-xs"
                      disabled={isUploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {isUploading ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Upload size={13} />
                      )}
                      <span>{isUploading ? 'A enviar...' : 'Adicionar Ficheiro'}</span>
                    </Button>
                  </div>
                </GlassCard>

                {isWebsiteGoogleService(selectedProject.serviceType) && (
                  <WebsiteLinkButtons
                    variant="panel"
                    links={selectedProject.websiteLinks}
                    onEdit={() => setEditingLinksProject(selectedProject)}
                  />
                )}
                {hasServicePlatforms(selectedProject.serviceType) && (
                  <ServicePlatformButtons
                    variant="panel"
                    serviceType={selectedProject.serviceType}
                    socialPlatforms={selectedProject.socialMediaPlatforms}
                    paidTrafficPlatforms={selectedProject.paidTrafficPlatforms}
                    onEdit={() => setEditingPlatformsProject(selectedProject)}
                  />
                )}
                </>
                );
              })() : (
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
              ))}

              {/* Reuniões (abaixo de Todos os Projetos & Serviços ou abaixo do Repositório e Links) */}
              <GlassCard className="p-0 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-3 bg-white/[0.01]">
                  <div className="flex items-center gap-2.5">
                    <Calendar size={15} className="text-vela-red" />
                    <h4 className="text-[11px] font-bold text-white uppercase tracking-wider">Reuniões</h4>
                    <span className="text-[11px] text-zinc-500 font-semibold tabular-nums">({displayedMeetings.length})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="primary"
                      className="h-8 px-3.5 text-[11px]"
                      onClick={() => setShowMeetModal(true)}
                    >
                      <Plus size={13} /> Agendar
                    </Button>
                    {!selectedProject.associatedMeetingId && (
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
                    {displayedMeetings.length > 0 ? displayedMeetings.map(({ meeting: m, services }) => (
                      <div key={m.id} className="flex items-center justify-between gap-4 p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl hover:bg-white/[0.03] hover:border-white/15 transition-all duration-150">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-vela-red/10 border border-vela-red/20 flex items-center justify-center text-vela-red shrink-0">
                            <Calendar size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate tabular-nums">
                              Sessão {m.type}: {m.date} às {m.time}
                            </p>
                            <p className="text-[11px] text-zinc-500 font-medium truncate">
                              Sincronizado via Workspace{isAllProjectsView && services.length > 0 ? ` · ${services.join(', ')}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <OpenHostingerLinksButton
                            links={m.hostingerLinks}
                            compact
                          />
                          <button
                            type="button"
                            onClick={() => setEditingMeeting(m)}
                            title="Editar reunião e links Hostinger"
                            className="w-9 h-9 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-zinc-400 hover:text-emerald-400 hover:bg-white/[0.08] hover:border-white/20 hover:-translate-y-[1px] active:scale-95 transition-all duration-150 shrink-0 cursor-pointer"
                          >
                            <Pencil size={14} />
                          </button>
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
            </motion.div>
          </AnimatePresence>

          {/* Notas */}
          <GlassCard className="p-6 space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
              <h4 className="text-[11px] uppercase tracking-wider text-zinc-400 font-bold">
                {isAllProjectsView ? `Notas · Todos os Projetos (${displayedNotes.length})` : 'Notas'}
              </h4>
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
                  {isAllProjectsView && clientProjects.length > 1 && (
                    <select
                      value={noteTargetProjectId}
                      onChange={(e) => setNoteTargetProjectId(e.target.value)}
                      className="w-full h-8 bg-[#0D0D0F] border border-white/[0.08] rounded-lg px-2.5 text-[11px] text-zinc-200 focus:outline-none focus:border-vela-red/40"
                    >
                      {clientProjects.map((proj) => (
                        <option key={proj.id} value={proj.id}>
                          Serviço: {proj.serviceType || 'Projeto Geral'}
                        </option>
                      ))}
                    </select>
                  )}
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

              {displayedNotes.map(note => (
                <div key={`${note.__projectId}-${note.id}`} className="bg-white/[0.02] p-4 rounded-xl border border-white/[0.06] hover:border-white/15 transition-colors duration-150 group relative flex flex-col justify-between">
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
                          onClick={() => handleDeleteNote(note.id, note.__projectId)}
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
                            onClick={() => handleSaveEditNote(note.id, note.__projectId)}
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

                      {isAllProjectsView && (
                        <span className="inline-block self-start mb-2 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-[10px] font-semibold text-zinc-400">
                          {note.__serviceName}
                        </span>
                      )}

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

              {!isAddingNote && displayedNotes.length === 0 && (
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
              <Select
                label="Serviço Adjudicado"
                value={editFormData.serviceType}
                onChange={e => setEditFormData({ ...editFormData, serviceType: e.target.value })}
              >
                <option value="" className="bg-zinc-950 text-zinc-500">Selecione um serviço</option>
                <option value="Website & Perfil Google" className="bg-zinc-950 text-white">Website &amp; Perfil Google</option>
                <option value="Gestão de Redes Sociais" className="bg-zinc-950 text-white">Gestão de Redes Sociais</option>
                <option value="Tráfego Pago" className="bg-zinc-950 text-white">Tráfego Pago</option>
                <option value="Automações" className="bg-zinc-950 text-white">Automações</option>
                <option value="Aplicações" className="bg-zinc-950 text-white">Aplicações</option>
                <option value="Outros" className="bg-zinc-950 text-white">Outros</option>
                {editFormData.serviceType &&
                  ![
                    'Website & Perfil Google',
                    'Gestão de Redes Sociais',
                    'Tráfego Pago',
                    'Automações',
                    'Aplicações',
                    'Outros',
                  ].includes(editFormData.serviceType) && (
                    <option value={editFormData.serviceType} className="bg-zinc-950 text-white">
                      {editFormData.serviceType}
                    </option>
                  )}
              </Select>
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
            {isWebsiteGoogleService(editFormData.serviceType) && (
              <WebsiteLinksFields
                value={editWebsiteLinks}
                onChange={setEditWebsiteLinks}
              />
            )}
            {hasServicePlatforms(editFormData.serviceType) && (
              <ServicePlatformsFields
                serviceType={editFormData.serviceType}
                socialPlatforms={editSocialPlatforms}
                onSocialPlatformsChange={setEditSocialPlatforms}
                paidTrafficPlatforms={editPaidPlatforms}
                onPaidTrafficPlatformsChange={setEditPaidPlatforms}
              />
            )}
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
                    const existingIds = Array.isArray(selectedProject.associatedMeetingIds)
                      ? selectedProject.associatedMeetingIds
                      : [];
                    const mergedIds = Array.from(
                      new Set([
                        ...existingIds,
                        ...(selectedProject.associatedMeetingId ? [selectedProject.associatedMeetingId] : []),
                        m.id,
                      ])
                    );
                    const payload = {
                      associatedMeetingId: m.id,
                      associatedMeetingIds: mergedIds,
                    };
                    if ((prospects || []).some(p => p.id === selectedProject.id)) {
                      await updateProspect(selectedProject.id, payload);
                    } else {
                      await updateClient(selectedProject.id, payload);
                    }
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

      {editingLinksProject && (
        <EditWebsiteLinksModal
          isOpen={!!editingLinksProject}
          onClose={() => setEditingLinksProject(null)}
          projectName={editingLinksProject.name || client.name || 'Projeto'}
          initialLinks={editingLinksProject.websiteLinks}
          onSave={(links) => {
            const targetId = editingLinksProject.id;
            const targetName = editingLinksProject.name || client.name || 'Projeto';
            setSelectedProject(prev =>
              prev && prev.id === targetId ? { ...prev, websiteLinks: links } : prev
            );
            runBackgroundAction({
              title: `A atualizar links de "${targetName}"...`,
              action: async () => {
                await updateClient(targetId, {
                  websiteLinks: links,
                  lastInteraction: new Date().toISOString()
                });
              },
              errorMessage: `Erro ao guardar links de "${targetName}".`
            });
          }}
        />
      )}
      {editingPlatformsProject && (
        <EditServicePlatformsModal
          isOpen={!!editingPlatformsProject}
          onClose={() => setEditingPlatformsProject(null)}
          projectName={editingPlatformsProject.name || client.name || 'Projeto'}
          serviceType={editingPlatformsProject.serviceType || ''}
          initialSocialPlatforms={editingPlatformsProject.socialMediaPlatforms}
          initialPaidTrafficPlatforms={editingPlatformsProject.paidTrafficPlatforms}
          onSave={(payload) => {
            const targetId = editingPlatformsProject.id;
            const targetName = editingPlatformsProject.name || client.name || 'Projeto';
            const isProspectRecord = (prospects || []).some(p => p.id === targetId);
            setSelectedProject(prev =>
              prev && prev.id === targetId ? { ...prev, ...payload } : prev
            );
            runBackgroundAction({
              title: `A atualizar plataformas de "${targetName}"...`,
              action: async () => {
                const updateData = {
                  ...payload,
                  lastInteraction: new Date().toISOString()
                };
                if (isProspectRecord) {
                  await updateProspect(targetId, updateData);
                } else {
                  await updateClient(targetId, updateData);
                }
              },
              errorMessage: `Erro ao guardar plataformas de "${targetName}".`
            });
          }}
        />
      )}
    </div>
  );
};
