import React, { useState, useRef } from 'react';
import { GlassCard, Badge, Button, Modal, Input, Select } from '../components/UI';
import { 
  Folder, 
  FolderOpen,
  ExternalLink, 
  Plus,
  Search,
  Trash2,
  Euro,
  Percent,
  Calendar,
  Paperclip,
  X,
  Repeat
} from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useBackgroundAction } from '../contexts/BackgroundActionContext';
import { firestore } from '../lib/firebase';
import { notifyWorkspaceUnauthorized } from '../lib/workspace';
import { RecurringBillingFields } from '../components/RecurringBillingFields';
import { ProjectOriginFields } from '../components/ProjectOriginFields';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
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
  normalizePaidTrafficPlatforms
} from '../components/ServicePlatformsSection';
import { calculateNextBillingDate, formatFrequencyLabel, getTodayISO } from '../lib/billing';
import { BillingFrequency, CustomIntervalUnit, PaidTrafficPlatform, Payment, RecurringBillingConfig, SocialMediaPlatform, WebsiteProjectLinks } from '../types';

export const ProjectsPage: React.FC = () => {
  const { clients, prospects, updateClient, updateProspect, deleteProject, ensureProjectDriveFolders, accessToken } = useWorkspace();
  const { runBackgroundAction } = useBackgroundAction();

  const [showModal, setShowModal] = useState(false);
  const [newProjectData, setNewProjectData] = useState({ clientId: '', status: 'Pendente', serviceType: '' });
  const [proposalValue, setProposalValue] = useState('');
  const [hasDiscount, setHasDiscount] = useState(false);
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [discountValue, setDiscountValue] = useState('');
  const [discountExpiry, setDiscountExpiry] = useState('');
  const [attachedProposalFile, setAttachedProposalFile] = useState<File | null>(null);
  const proposalFileInputRef = useRef<HTMLInputElement>(null);

  const [billingType, setBillingType] = useState<'one_time' | 'recurring'>('one_time');
  const [recurringFrequency, setRecurringFrequency] = useState<BillingFrequency>('monthly');
  const [customIntervalValue, setCustomIntervalValue] = useState('');
  const [customIntervalUnit, setCustomIntervalUnit] = useState<CustomIntervalUnit>('months');
  const [recurringStartDate, setRecurringStartDate] = useState(getTodayISO());
  const [firstCyclePaid, setFirstCyclePaid] = useState(true);

  const [isNewProject, setIsNewProject] = useState(true);
  const [projectStartDate, setProjectStartDate] = useState('');
  const [projectEndDate, setProjectEndDate] = useState('');
  const [projectDateError, setProjectDateError] = useState<string | null>(null);
  const [liquidatedAmount, setLiquidatedAmount] = useState('');
  const [liquidatedDate, setLiquidatedDate] = useState(getTodayISO());

  const [projectToDelete, setProjectToDelete] = useState<any | null>(null);
  const [newProjectWebsiteLinks, setNewProjectWebsiteLinks] = useState<WebsiteProjectLinks>(EMPTY_WEBSITE_LINKS);
  const [newProjectSocialPlatforms, setNewProjectSocialPlatforms] = useState<SocialMediaPlatform[]>([]);
  const [newProjectPaidPlatforms, setNewProjectPaidPlatforms] = useState<PaidTrafficPlatform[]>([]);
  const [editingLinksProject, setEditingLinksProject] = useState<any | null>(null);
  const [editingPlatformsProject, setEditingPlatformsProject] = useState<any | null>(null);

  // Filter and search state like ClientsPage
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'alphabetical'>('recent');

  const pendingProspects = (prospects || []).filter(p => p.status === 'Pendente');
  const activeClients = (clients || []).filter(c => c.status === 'Cliente' && !c.projectRemoved);
  const finishedClients = (clients || []).filter(c => c.status === 'Terminado' && !c.projectRemoved);
  const pendingClients = (clients || []).filter(c => c.status === 'Pendente' && !c.projectRemoved);

  const activeProjects = [
    ...pendingProspects,
    ...pendingClients,
    ...activeClients,
    ...finishedClients
  ];
  
  const filteredProjects = activeProjects.filter(project => {
    const matchesSearch = 
      (project.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (project.contactName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (project.serviceType || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesStatus = true;
    if (statusFilter !== 'all') {
      matchesStatus = project.status === statusFilter;
    }
    
    return matchesSearch && matchesStatus;
  });

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    if (sortBy === 'alphabetical') {
      return (a.name || '').localeCompare(b.name || '');
    } else {
      const timeA = new Date(a.lastInteraction || 0).getTime();
      const timeB = new Date(b.lastInteraction || 0).getTime();
      return timeB - timeA;
    }
  });

  const groupedByClient = React.useMemo(() => {
    const groups = new Map<string, {
      key: string;
      clientName: string;
      clientDriveFolderId: string;
      projects: any[];
    }>();

    for (const proj of sortedProjects) {
      const nameNorm = (proj.name || 'Sem Nome').trim().toLowerCase();
      const parentDoc = proj.parentClientId
        ? clients.find(c => c.id === proj.parentClientId)
        : clients.find(c => !c.parentClientId && (c.name || '').trim().toLowerCase() === nameNorm);
      const groupKey = parentDoc?.id || `name:${nameNorm}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          key: groupKey,
          clientName: parentDoc?.name || proj.name || 'Cliente',
          clientDriveFolderId: parentDoc?.clientDriveFolderId || (proj as any).clientDriveFolderId || '',
          projects: []
        });
      }
      const g = groups.get(groupKey)!;
      if (!g.clientDriveFolderId && (proj as any).clientDriveFolderId) {
        g.clientDriveFolderId = (proj as any).clientDriveFolderId;
      }
      g.projects.push(proj);
    }

    return Array.from(groups.values());
  }, [sortedProjects, clients]);

  const resetNewProjectForm = () => {
    setNewProjectData({ clientId: '', status: 'Pendente', serviceType: '' });
    setProposalValue('');
    setHasDiscount(false);
    setDiscountType('fixed');
    setDiscountValue('');
    setDiscountExpiry('');
    setAttachedProposalFile(null);
    setBillingType('one_time');
    setRecurringFrequency('monthly');
    setCustomIntervalValue('');
    setCustomIntervalUnit('months');
    setRecurringStartDate(getTodayISO());
    setFirstCyclePaid(true);
    setIsNewProject(true);
    setProjectStartDate('');
    setProjectEndDate('');
    setProjectDateError(null);
    setLiquidatedAmount('');
    setLiquidatedDate(getTodayISO());
    setNewProjectWebsiteLinks(EMPTY_WEBSITE_LINKS);
    setNewProjectSocialPlatforms([]);
    setNewProjectPaidPlatforms([]);
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isNewProject && !projectStartDate) {
      setProjectDateError('Selecione a data de início do projeto.');
      return;
    }
    if (!isNewProject && projectEndDate && projectStartDate && projectEndDate < projectStartDate) {
      setProjectDateError('A data de fim não pode ser anterior à data de início.');
      return;
    }
    setProjectDateError(null);

    const entityId = newProjectData.clientId;
    const serviceType = newProjectData.serviceType;
    const capturedWebsiteLinks = isWebsiteGoogleService(serviceType)
      ? buildWebsiteLinksPayload(newProjectWebsiteLinks)
      : undefined;
    const capturedSocialPlatforms = isSocialMediaService(serviceType)
      ? normalizeSocialMediaPlatforms(newProjectSocialPlatforms)
      : undefined;
    const capturedPaidPlatforms = isPaidTrafficService(serviceType)
      ? normalizePaidTrafficPlatforms(newProjectPaidPlatforms)
      : undefined;

    const capturedIsNewProject = isNewProject;
    const capturedProjectStartDate = capturedIsNewProject ? getTodayISO() : projectStartDate;
    const capturedProjectEndDate = !capturedIsNewProject ? projectEndDate : '';
    const hasEndDate = Boolean(capturedProjectEndDate);
    const targetStatus = hasEndDate ? 'Terminado' : newProjectData.status;
    const capturedLiquidatedDate = liquidatedDate || (hasEndDate ? capturedProjectEndDate : getTodayISO());
    const parsedLiquidatedAmt = Math.max(0, parseFloat(liquidatedAmount) || 0);

    const prospect = (prospects || []).find(p => p.id === entityId);
    const client = (clients || []).find(c => c.id === entityId);
    const baseEntity = client || prospect;
    const entityName = baseEntity?.name || 'Projeto';

    const baseVal = parseFloat(proposalValue) || 0;
    const discRaw = hasDiscount ? (parseFloat(discountValue) || 0) : 0;
    const finalDiscount = hasDiscount
      ? (discountType === 'percentage' ? baseVal * (discRaw / 100) : discRaw)
      : 0;
    const effectiveTotal = Math.max(0, baseVal - finalDiscount);

    const capturedBillingType = billingType;
    const capturedFrequency = recurringFrequency;
    const capturedCustomVal = Math.max(1, parseInt(customIntervalValue, 10) || 1);
    const capturedCustomUnit = customIntervalUnit;
    const capturedStartDate = recurringStartDate || getTodayISO();
    const capturedFirstCyclePaid = firstCyclePaid;

    let totalVal = targetStatus === 'Pendente' ? baseVal : effectiveTotal;
    let receivedAmt = (hasEndDate || targetStatus === 'Terminado') ? effectiveTotal : 0;
    let initialPayments: Payment[] = [];
    let recurringConfig: RecurringBillingConfig | undefined = undefined;

    if (hasEndDate) {
      if (effectiveTotal > 0) {
        initialPayments.push({
          id: 'p-' + Math.random().toString(36).substring(7),
          amount: effectiveTotal,
          date: capturedLiquidatedDate,
          saleDate: capturedProjectStartDate,
          status: 'received',
          type: capturedBillingType === 'recurring' ? 'recurring' : 'final',
          description: 'Projeto concluído (liquidado integralmente)'
        });
      }
      if (capturedBillingType === 'recurring') {
        recurringConfig = {
          enabled: true,
          amount: effectiveTotal,
          frequency: capturedFrequency,
          ...(capturedFrequency === 'custom'
            ? { customIntervalValue: capturedCustomVal, customIntervalUnit: capturedCustomUnit }
            : {}),
          startDate: capturedProjectStartDate || capturedStartDate,
          nextBillingDate: capturedProjectEndDate,
          active: false,
          cyclesPaid: effectiveTotal > 0 ? 1 : 0
        };
      }
    } else if (capturedBillingType === 'recurring') {
      const cycleAmount = (targetStatus === 'Pendente' && !(!capturedIsNewProject && capturedFirstCyclePaid)) ? baseVal : effectiveTotal;
      const todayStr = getTodayISO();

      if (targetStatus === 'Pendente' && (capturedIsNewProject || !capturedFirstCyclePaid)) {
        totalVal = baseVal;
        receivedAmt = 0;
        recurringConfig = {
          enabled: true,
          amount: effectiveTotal > 0 ? effectiveTotal : baseVal,
          frequency: capturedFrequency,
          ...(capturedFrequency === 'custom'
            ? { customIntervalValue: capturedCustomVal, customIntervalUnit: capturedCustomUnit }
            : {}),
          startDate: capturedStartDate,
          nextBillingDate: capturedStartDate,
          active: false,
          cyclesPaid: 0
        };
      } else {
        const isFirstPaid = targetStatus === 'Terminado' ? true : capturedFirstCyclePaid;
        let nextDate = capturedStartDate;
        let cyclesPaid = 0;

        if (isFirstPaid && cycleAmount > 0) {
          initialPayments.push({
            id: 'p-' + Math.random().toString(36).substring(7),
            amount: cycleAmount,
            date: capturedLiquidatedDate,
            saleDate: capturedProjectStartDate,
            status: 'received',
            type: 'recurring',
            description: `1º Ciclo (${formatFrequencyLabel({ frequency: capturedFrequency, customIntervalValue: capturedCustomVal, customIntervalUnit: capturedCustomUnit })})`
          });
          totalVal = cycleAmount;
          receivedAmt = cycleAmount;
          cyclesPaid = 1;
          nextDate = calculateNextBillingDate(capturedStartDate, capturedFrequency, capturedCustomVal, capturedCustomUnit);
        } else if (cycleAmount > 0 && capturedStartDate <= todayStr) {
          initialPayments.push({
            id: 'p-' + Math.random().toString(36).substring(7),
            amount: cycleAmount,
            date: capturedStartDate,
            saleDate: capturedStartDate,
            status: 'pending',
            type: 'recurring',
            description: `1º Ciclo (${formatFrequencyLabel({ frequency: capturedFrequency, customIntervalValue: capturedCustomVal, customIntervalUnit: capturedCustomUnit })})`
          });
          totalVal = cycleAmount;
          receivedAmt = 0;
          nextDate = calculateNextBillingDate(capturedStartDate, capturedFrequency, capturedCustomVal, capturedCustomUnit);
        } else {
          totalVal = 0;
          receivedAmt = 0;
          nextDate = capturedStartDate;
        }

        recurringConfig = {
          enabled: true,
          amount: cycleAmount,
          frequency: capturedFrequency,
          ...(capturedFrequency === 'custom'
            ? { customIntervalValue: capturedCustomVal, customIntervalUnit: capturedCustomUnit }
            : {}),
          startDate: capturedStartDate,
          nextBillingDate: nextDate,
          active: targetStatus !== 'Terminado',
          cyclesPaid
        };
      }
    } else if (targetStatus === 'Terminado' && effectiveTotal > 0) {
      initialPayments.push({
        id: 'p-' + Math.random().toString(36).substring(7),
        amount: effectiveTotal,
        date: capturedLiquidatedDate,
        saleDate: capturedProjectStartDate,
        status: 'received',
        type: 'final',
        description: 'Projeto concluído (liquidado integralmente)'
      });
    } else if (targetStatus !== 'Pendente' || parsedLiquidatedAmt > 0) {
      totalVal = Math.max(effectiveTotal, parsedLiquidatedAmt);
      receivedAmt = parsedLiquidatedAmt;
      const remainingVal = Math.max(0, totalVal - receivedAmt);

      if (receivedAmt > 0) {
        initialPayments.push({
          id: 'p-' + Math.random().toString(36).substring(7),
          amount: receivedAmt,
          date: capturedLiquidatedDate,
          saleDate: capturedProjectStartDate,
          status: 'received',
          type: remainingVal === 0 ? 'final' : 'adjudication',
          description: remainingVal === 0 ? 'Liquidação integral' : 'Valor liquidado no registo'
        });
      }
      if (remainingVal > 0) {
        initialPayments.push({
          id: 'p-' + Math.random().toString(36).substring(7),
          amount: remainingVal,
          date: capturedProjectStartDate || getTodayISO(),
          saleDate: capturedProjectStartDate,
          status: 'pending',
          type: 'final',
          description: 'Valor por liquidar'
        });
      }
    }

    const fileToUpload = attachedProposalFile;
    const capturedHasDiscount = hasDiscount;
    const capturedDiscountType = discountType;
    const capturedDiscountExpiry = discountExpiry;

    setShowModal(false);
    resetNewProjectForm();

    runBackgroundAction({
      title: fileToUpload
        ? `A configurar projeto e anexar proposta para "${entityName}"...`
        : `A configurar projeto para "${entityName}"...`,
      action: async () => {
        let clientFolderId = baseEntity?.clientDriveFolderId || '';
        let folderId = '';
        if (accessToken) {
          try {
            const ensured = await ensureProjectDriveFolders({
              clientId: client && client.projectRemoved && !client.parentClientId ? client.id : undefined,
              clientName: entityName,
              projectName: serviceType || 'Projeto Geral',
              existingClientFolderId: clientFolderId,
              parentClientId: client && !client.parentClientId ? client.id : client?.parentClientId
            });
            clientFolderId = ensured.clientFolderId;
            folderId = ensured.projectFolderId;
          } catch (driveErr) {
            console.warn("Could not create Drive folders for new project:", driveErr);
          }
        }

        let proposalFileUrl = '';
        let proposalFileName = fileToUpload ? fileToUpload.name : '';

        if (fileToUpload && accessToken && folderId) {
          try {
            const boundary = 'foo_bar_baz';
            const metadata = { name: fileToUpload.name, parents: [folderId] };
            const body = new Blob([
              `--${boundary}\r\n`,
              'Content-Type: application/json; charset=UTF-8\r\n\r\n',
              JSON.stringify(metadata),
              `\r\n--${boundary}\r\n`,
              `Content-Type: ${fileToUpload.type || 'application/octet-stream'}\r\n\r\n`,
              fileToUpload,
              `\r\n--${boundary}--`
            ], { type: `multipart/related; boundary=${boundary}` });

            const uploadResp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
              method: 'POST',
              headers: { Authorization: `Bearer ${accessToken}` },
              body
            });
            if (uploadResp.status === 401) {
              notifyWorkspaceUnauthorized();
            } else if (uploadResp.ok) {
              const uploadData = await uploadResp.json();
              if (uploadData?.id) {
                proposalFileUrl = `https://drive.google.com/file/d/${uploadData.id}/view`;
              }
            }
          } catch (uploadErr) {
            console.warn("Could not upload proposal file for new project:", uploadErr);
          }
        }

        const hasProposalInfo = baseVal > 0 || !!fileToUpload || capturedHasDiscount || capturedBillingType === 'recurring';
        const proposalObj: any = hasProposalInfo ? {
          id: Math.random().toString(36).substring(7),
          title: proposalFileName || `Proposta: ${entityName} (${serviceType})`,
          value: targetStatus === 'Pendente' ? baseVal : effectiveTotal,
          date: new Date().toISOString(),
          ...(targetStatus !== 'Pendente' ? { acceptedAt: capturedProjectStartDate } : {}),
          status: targetStatus === 'Pendente' ? 'pendente' : 'aceite',
          discountAmount: capturedHasDiscount ? finalDiscount : 0,
          discountType: capturedHasDiscount ? capturedDiscountType : 'fixed',
          discountRawValue: capturedHasDiscount ? discRaw : 0,
          hasDiscountApplied: targetStatus !== 'Pendente' && capturedHasDiscount,
          billingType: capturedBillingType,
          ...(capturedBillingType === 'recurring' ? {
            recurringFrequency: capturedFrequency,
            ...(capturedFrequency === 'custom' ? { customIntervalValue: capturedCustomVal, customIntervalUnit: capturedCustomUnit } : {})
          } : {}),
          ...(capturedHasDiscount && capturedDiscountExpiry ? { discountExpiry: capturedDiscountExpiry } : {}),
          ...(proposalFileUrl ? { fileUrl: proposalFileUrl } : {})
        } : undefined;

        if (client && client.projectRemoved && !client.parentClientId) {
          await firestore.update('clients', client.id, {
            status: targetStatus,
            serviceType,
            totalValue: totalVal,
            receivedAmount: receivedAmt,
            ...(targetStatus !== 'Pendente' ? { saleDate: capturedProjectStartDate } : {}),
            lastInteraction: new Date().toISOString(),
            clientDriveFolderId: clientFolderId,
            driveFolderId: folderId,
            proposalFileUrl,
            proposalFileName,
            proposal: proposalObj ?? null,
            recurringBilling: recurringConfig ?? null,
            payments: initialPayments,
            isNewProject: capturedIsNewProject,
            projectStartDate: capturedProjectStartDate,
            projectEndDate: hasEndDate ? capturedProjectEndDate : null,
            websiteLinks: capturedWebsiteLinks ?? null,
            socialMediaPlatforms: capturedSocialPlatforms ?? null,
            paidTrafficPlatforms: capturedPaidPlatforms ?? null,
            projectRemoved: false
          });
        } else {
          const newProject: any = {
            id: Math.random().toString(36).substring(7),
            name: entityName,
            contactName: baseEntity?.contactName || '',
            email: baseEntity?.email || '',
            phone: baseEntity?.phone || '',
            dashboardEmail: baseEntity?.dashboardEmail || '',
            hasDashboardAccess: baseEntity?.hasDashboardAccess || false,
            clientUsers: baseEntity?.clientUsers || [],
            clientEmails: baseEntity?.clientEmails || [],
            clientType: baseEntity?.clientType || 'individual',
            nif: baseEntity?.nif || '',
            fiscalAddress: baseEntity?.fiscalAddress || '',
            parentClientId: entityId,
            status: targetStatus,
            serviceType,
            totalValue: totalVal,
            receivedAmount: receivedAmt,
            ...(targetStatus !== 'Pendente' ? { saleDate: capturedProjectStartDate } : {}),
            lastInteraction: new Date().toISOString(),
            clientDriveFolderId: clientFolderId,
            driveFolderId: folderId,
            proposalFileUrl,
            proposalFileName,
            isNewProject: capturedIsNewProject,
            projectStartDate: capturedProjectStartDate,
            ...(hasEndDate ? { projectEndDate: capturedProjectEndDate } : {}),
            ...(proposalObj ? { proposal: proposalObj } : {}),
            ...(recurringConfig ? { recurringBilling: recurringConfig } : {}),
            ...(capturedWebsiteLinks ? { websiteLinks: capturedWebsiteLinks } : {}),
            ...(capturedSocialPlatforms ? { socialMediaPlatforms: capturedSocialPlatforms } : {}),
            ...(capturedPaidPlatforms ? { paidTrafficPlatforms: capturedPaidPlatforms } : {}),
            notes: [],
            files: [],
            payments: initialPayments
          };
          await firestore.set('clients', newProject.id, newProject);

          // Ensure parent client doc also remembers clientDriveFolderId
          if (clientFolderId && client && !client.clientDriveFolderId) {
            firestore.update('clients', client.id, { clientDriveFolderId: clientFolderId }).catch(() => {});
          }
        }
      },
      errorMessage: `Erro ao configurar projeto para "${entityName}".`
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Cliente': 
        return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case 'Terminado': 
        return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'Pendente': 
        return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'Lead': 
        return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      default: return 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20';
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="space-y-8">
            {/* Page Header */}
            <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="space-y-1.5">
                <h2 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-white">
                  Gestão de Projetos
                </h2>
                <p className="text-sm text-zinc-400 max-w-xl leading-relaxed">
                  Acompanhe entregas em curso, propostas vinculadas, pastas Google Drive e valores liquidados por projeto.
                </p>
              </div>
              <Button
                variant="primary"
                onClick={() => setShowModal(true)}
                className="shrink-0"
              >
                <Plus size={15} />
                <span>Novo Projeto</span>
              </Button>
            </header>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3 pt-5 border-t border-white/[0.06]">
              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Pesquisar projetos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9 bg-white/[0.03] border border-white/[0.08] hover:border-white/20 rounded-xl pl-9 pr-3 text-xs text-white focus:outline-none focus:border-vela-red/50 transition-colors duration-150 placeholder:text-zinc-600"
                />
              </div>

              <div className="flex items-center gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/[0.07]">
                <button
                  type="button"
                  onClick={() => setSortBy('recent')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150",
                    sortBy === 'recent' ? "bg-vela-red text-white" : "text-zinc-400 hover:text-white hover:bg-white/[0.05]"
                  )}
                >
                  Recentes
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy('alphabetical')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150",
                    sortBy === 'alphabetical' ? "bg-vela-red text-white" : "text-zinc-400 hover:text-white hover:bg-white/[0.05]"
                  )}
                >
                  Alfabética
                </button>
              </div>

              <div className="flex items-center gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/[0.07] overflow-x-auto max-w-full scrollbar-none">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150 shrink-0 tabular-nums",
                    statusFilter === 'all' ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                  )}
                >
                  Todos ({activeProjects.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('Pendente')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150 shrink-0 border border-transparent tabular-nums",
                    statusFilter === 'Pendente' ? "bg-yellow-500/15 text-yellow-300 border-yellow-500/25" : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                  )}
                >
                  Pendentes ({activeProjects.filter(p => p.status === 'Pendente').length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('Cliente')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150 shrink-0 border border-transparent tabular-nums",
                    statusFilter === 'Cliente' ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                  )}
                >
                  Ativos ({activeProjects.filter(p => p.status === 'Cliente').length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('Terminado')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150 shrink-0 border border-transparent tabular-nums",
                    statusFilter === 'Terminado' ? "bg-red-500/15 text-red-300 border-red-500/25" : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                  )}
                >
                  Terminados ({activeProjects.filter(p => p.status === 'Terminado').length})
                </button>
              </div>
            </div>

            <Modal 
              isOpen={showModal} 
              onClose={() => {
                setShowModal(false);
                resetNewProjectForm();
              }} 
              title="Iniciar Novo Projeto"
              subtitle="Associe o projeto a uma entidade e configure datas, cobrança e liquidação"
              size="lg"
            >
              <form onSubmit={handleCreateProject} className="space-y-6">
                {/* 1. Entidade & Âmbito */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 font-sans">
                    01 · Entidade &amp; Âmbito
                  </h4>

                  <Select
                    label="Selecionar Entidade"
                    value={newProjectData.clientId}
                    onChange={e => setNewProjectData({ ...newProjectData, clientId: e.target.value })}
                    required
                  >
                    <option value="" className="bg-zinc-900 text-zinc-500">Selecione um prospect pendente, cliente ativo ou terminado</option>
                    
                    <optgroup label="Prospects Pendentes" className="bg-zinc-900 text-yellow-400">
                      {(prospects || []).filter(p => p.status === 'Pendente').map(p => (
                        <option key={p.id} value={p.id} className="bg-zinc-900 text-white">
                          {p.name} (Prospect Pendente)
                        </option>
                      ))}
                    </optgroup>

                    <optgroup label="Clientes Ativos" className="bg-zinc-900 text-emerald-400">
                      {(Array.from(new Map((clients as any[] || []).filter(c => c.status === 'Cliente' && !c.parentClientId).map(c => [(c.name || '').toLowerCase().trim(), c])).values()) as any[]).map(c => (
                        <option key={c.id} value={c.id} className="bg-zinc-900 text-white">
                          {c.name} (Cliente Ativo)
                        </option>
                      ))}
                    </optgroup>

                    <optgroup label="Clientes Terminados" className="bg-zinc-900 text-red-400">
                      {(Array.from(new Map((clients as any[] || []).filter(c => c.status === 'Terminado' && !c.parentClientId).map(c => [(c.name || '').toLowerCase().trim(), c])).values()) as any[]).map(c => (
                        <option key={c.id} value={c.id} className="bg-zinc-900 text-white">
                          {c.name} (Cliente Terminado)
                        </option>
                      ))}
                    </optgroup>
                  </Select>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Select 
                      label="Estado do Projeto"
                      value={!isNewProject && projectEndDate ? 'Terminado' : newProjectData.status}
                      disabled={!isNewProject && Boolean(projectEndDate)}
                      onChange={e => setNewProjectData({ ...newProjectData, status: e.target.value })}
                    >
                      <option value="Pendente" className="bg-zinc-900">Pendente</option>
                      <option value="Cliente" className="bg-zinc-900">Ativo</option>
                      <option value="Terminado" className="bg-zinc-900">Terminado</option>
                    </Select>

                    <Select 
                      label="Serviço de Interesse"
                      value={newProjectData.serviceType}
                      onChange={e => setNewProjectData({ ...newProjectData, serviceType: e.target.value })}
                      required
                    >
                      <option value="" className="bg-zinc-900 text-zinc-500">Selecione um serviço</option>
                      <option value="Website & Perfil Google" className="bg-zinc-900">Website &amp; Perfil Google</option>
                      <option value="Gestão de Redes Sociais" className="bg-zinc-900">Gestão de Redes Sociais</option>
                      <option value="Tráfego Pago" className="bg-zinc-900">Tráfego Pago</option>
                      <option value="Automações" className="bg-zinc-900">Automações</option>
                      <option value="Aplicações" className="bg-zinc-900">Aplicações</option>
                      <option value="Outros" className="bg-zinc-900">Outros</option>
                    </Select>
                  </div>

                  {isWebsiteGoogleService(newProjectData.serviceType) && (
                    <WebsiteLinksFields
                      value={newProjectWebsiteLinks}
                      onChange={setNewProjectWebsiteLinks}
                    />
                  )}
                  {hasServicePlatforms(newProjectData.serviceType) && (
                    <ServicePlatformsFields
                      serviceType={newProjectData.serviceType}
                      socialPlatforms={newProjectSocialPlatforms}
                      onSocialPlatformsChange={setNewProjectSocialPlatforms}
                      paidTrafficPlatforms={newProjectPaidPlatforms}
                      onPaidTrafficPlatformsChange={setNewProjectPaidPlatforms}
                    />
                  )}
                </div>

                {/* 2. Origem & Cronograma */}
                <div className="space-y-4 pt-5 border-t border-white/[0.06]">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 font-sans">
                    02 · Origem &amp; Cronograma
                  </h4>
                  <ProjectOriginFields
                    isNewProject={isNewProject}
                    onIsNewProjectChange={(val) => {
                      setIsNewProject(val);
                      setProjectDateError(null);
                    }}
                    startDate={projectStartDate}
                    onStartDateChange={(val) => {
                      setProjectStartDate(val);
                      setProjectDateError(null);
                    }}
                    endDate={projectEndDate}
                    onEndDateChange={(val) => {
                      setProjectEndDate(val);
                      if (val) setLiquidatedDate(val);
                      setProjectDateError(null);
                    }}
                    dateError={projectDateError}
                  />
                </div>

                {/* 3. Cobrança, Valores & Liquidação */}
                <div className="space-y-4 pt-5 border-t border-white/[0.06]">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 font-sans">
                    03 · Cobrança &amp; Liquidação
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-0.5 block">
                        Modelo de Cobrança
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setBillingType('one_time')}
                          className={cn(
                            "py-2.5 px-3 rounded-xl text-xs font-bold border transition-all",
                            billingType === 'one_time'
                              ? "bg-vela-red border-vela-red text-white shadow-lg shadow-vela-red/15"
                              : "bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white"
                          )}
                        >
                          Único
                        </button>
                        <button
                          type="button"
                          onClick={() => setBillingType('recurring')}
                          className={cn(
                            "py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5",
                            billingType === 'recurring'
                              ? "bg-vela-red border-vela-red text-white shadow-lg shadow-vela-red/15"
                              : "bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white"
                          )}
                        >
                          <Repeat size={13} />
                          Recorrente
                        </button>
                      </div>
                    </div>

                    <Input
                      label={billingType === 'recurring' ? 'Valor por Ciclo (€)' : 'Valor da Proposta (€)'}
                      type="number"
                      min="0"
                      step="any"
                      value={proposalValue}
                      onChange={e => setProposalValue(e.target.value)}
                      icon={<Euro size={15} />}
                      placeholder={billingType === 'recurring' ? 'Ex: 450' : 'Ex: 8500'}
                      required={billingType === 'recurring'}
                    />
                  </div>

                  {billingType === 'recurring' && (
                    <div className="space-y-3">
                      <RecurringBillingFields
                        frequency={recurringFrequency}
                        onFrequencyChange={setRecurringFrequency}
                        customIntervalValue={customIntervalValue}
                        onCustomIntervalValueChange={setCustomIntervalValue}
                        customIntervalUnit={customIntervalUnit}
                        onCustomIntervalUnitChange={setCustomIntervalUnit}
                        startDate={recurringStartDate}
                        onStartDateChange={setRecurringStartDate}
                      />
                      {(!isNewProject || newProjectData.status === 'Cliente') && !(!isNewProject && projectEndDate) && newProjectData.status !== 'Terminado' && (
                        <div className="space-y-3 p-3.5 bg-white/[0.02] border border-white/[0.08] rounded-xl">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              id="newProjectFirstCyclePaid"
                              checked={firstCyclePaid}
                              onChange={(e) => setFirstCyclePaid(e.target.checked)}
                              className="w-4 h-4 rounded border-white/10 bg-white/5 text-vela-red focus:ring-vela-red cursor-pointer"
                            />
                            <label htmlFor="newProjectFirstCyclePaid" className="text-xs font-bold text-zinc-200 cursor-pointer select-none">
                              1º ciclo já liquidado no arranque
                            </label>
                          </div>
                          {firstCyclePaid && (
                            <Input
                              label="Data da Liquidação"
                              type="date"
                              value={liquidatedDate}
                              onChange={(e) => setLiquidatedDate(e.target.value)}
                              icon={<Calendar size={14} />}
                              required
                            />
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Desconto Comercial */}
                  <div className="space-y-3">
                    <label
                      htmlFor="newProjectHasDiscount"
                      className="flex items-center gap-3 p-3.5 bg-white/[0.02] border border-white/[0.08] rounded-xl cursor-pointer hover:border-white/15 transition-colors"
                    >
                      <input
                        type="checkbox"
                        id="newProjectHasDiscount"
                        checked={hasDiscount}
                        onChange={(e) => setHasDiscount(e.target.checked)}
                        className="w-4 h-4 rounded border-white/10 bg-white/5 text-vela-red focus:ring-vela-red cursor-pointer"
                      />
                      <span className="text-xs font-bold text-white uppercase tracking-wider select-none">
                        Tem desconto comercial aplicável?
                      </span>
                    </label>

                    {hasDiscount && (
                      <div className="space-y-3.5 p-4 bg-white/[0.02] border border-white/[0.08] rounded-2xl animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() => setDiscountType('fixed')}
                            className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                              discountType === 'fixed' ? 'bg-vela-red border-vela-red text-white' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'
                            }`}
                          >
                            Fixo (€)
                          </button>
                          <button
                            type="button"
                            onClick={() => setDiscountType('percentage')}
                            className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                              discountType === 'percentage' ? 'bg-vela-red border-vela-red text-white' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'
                            }`}
                          >
                            Percentagem (%)
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <Input
                            label={discountType === 'fixed' ? "Valor do Desconto (€)" : "Percentagem (%)"}
                            type="number"
                            min="0"
                            step="any"
                            value={discountValue}
                            onChange={e => setDiscountValue(e.target.value)}
                            icon={discountType === 'fixed' ? <Euro size={14} /> : <Percent size={14} />}
                            placeholder={discountType === 'fixed' ? "500" : "10"}
                            required={hasDiscount}
                          />
                          <Input
                            label="Validade (Opcional)"
                            type="date"
                            value={discountExpiry}
                            onChange={e => setDiscountExpiry(e.target.value)}
                            icon={<Calendar size={14} />}
                          />
                        </div>

                        {parseFloat(proposalValue) > 0 && (
                          <div className="flex items-center justify-between text-xs text-zinc-400 pt-1 border-t border-white/5">
                            <span>Valor Final com Desconto</span>
                            <strong className="text-white font-mono tabular-nums">
                              {formatCurrency(
                                Math.max(
                                  0,
                                  (parseFloat(proposalValue) || 0) -
                                    (discountType === 'percentage'
                                      ? (parseFloat(proposalValue) || 0) * ((parseFloat(discountValue) || 0) / 100)
                                      : (parseFloat(discountValue) || 0))
                                )
                              )}
                            </strong>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Valor Já Liquidado & Data da Liquidação */}
                  {((!isNewProject && projectEndDate) || newProjectData.status === 'Terminado') ? (
                    <div className="space-y-3 p-4 bg-emerald-500/[0.04] border border-emerald-500/20 rounded-2xl">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                          Valor Liquidado (100% Automático)
                        </span>
                        <strong className="text-emerald-400 font-mono tabular-nums text-sm">
                          {formatCurrency(
                            Math.max(
                              0,
                              (parseFloat(proposalValue) || 0) -
                                (hasDiscount
                                  ? (discountType === 'percentage'
                                      ? (parseFloat(proposalValue) || 0) * ((parseFloat(discountValue) || 0) / 100)
                                      : (parseFloat(discountValue) || 0))
                                  : 0)
                            )
                          )}
                        </strong>
                      </div>
                      <Input
                        label="Data da Liquidação"
                        type="date"
                        value={liquidatedDate}
                        onChange={(e) => setLiquidatedDate(e.target.value)}
                        icon={<Calendar size={14} />}
                        required
                      />
                    </div>
                  ) : billingType === 'one_time' && (!isNewProject || newProjectData.status !== 'Pendente') && (
                    <div className="space-y-3 p-4 bg-white/[0.02] border border-white/[0.08] rounded-2xl">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <Input
                          label="Valor Já Liquidado (€)"
                          type="number"
                          min="0"
                          step="any"
                          value={liquidatedAmount}
                          onChange={e => setLiquidatedAmount(e.target.value)}
                          icon={<Euro size={14} />}
                          placeholder="Ex: 1500"
                        />
                        <Input
                          label="Data da Liquidação"
                          type="date"
                          value={liquidatedDate}
                          onChange={e => setLiquidatedDate(e.target.value)}
                          icon={<Calendar size={14} />}
                          required={(parseFloat(liquidatedAmount) || 0) > 0}
                        />
                      </div>
                      {parseFloat(liquidatedAmount) > 0 && parseFloat(proposalValue) > 0 && (
                        <div className="flex items-center justify-between text-xs text-zinc-400 pt-2 border-t border-white/5">
                          <span>Por liquidar</span>
                          <strong className="text-amber-400 font-mono tabular-nums">
                            {formatCurrency(
                              Math.max(
                                0,
                                Math.max(
                                  0,
                                  (parseFloat(proposalValue) || 0) -
                                    (hasDiscount
                                      ? (discountType === 'percentage'
                                          ? (parseFloat(proposalValue) || 0) * ((parseFloat(discountValue) || 0) / 100)
                                          : (parseFloat(discountValue) || 0))
                                      : 0)
                                ) - (parseFloat(liquidatedAmount) || 0)
                              )
                            )}
                          </strong>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 4. Proposta Comercial */}
                <div className="space-y-2 pt-5 border-t border-white/[0.06]">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 font-sans mb-2">
                    04 · Proposta Comercial
                  </h4>
                  <div
                    onClick={() => proposalFileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const droppedFile = e.dataTransfer.files?.[0];
                      if (droppedFile) setAttachedProposalFile(droppedFile);
                    }}
                    className={cn(
                      "border border-dashed rounded-xl px-4 py-4 flex items-center gap-3.5 cursor-pointer hover:bg-white/[0.03] transition-all duration-200 relative",
                      attachedProposalFile ? "border-emerald-500/35 bg-emerald-500/[0.03]" : "border-white/15 bg-white/[0.015]"
                    )}
                  >
                    <input
                      type="file"
                      className="hidden"
                      ref={proposalFileInputRef}
                      onChange={(e) => setAttachedProposalFile(e.target.files?.[0] || null)}
                      accept=".pdf,.doc,.docx"
                    />
                    <div className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border",
                      attachedProposalFile ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400" : "bg-white/[0.04] border-white/10 text-zinc-400"
                    )}>
                      <Paperclip size={16} />
                    </div>
                    <div className="min-w-0 flex-1 pr-6">
                      <p className="text-xs font-bold text-zinc-200 truncate">
                        {attachedProposalFile ? attachedProposalFile.name : "Arraste ou clique para anexar proposta comercial"}
                      </p>
                      <p className="text-[10px] text-zinc-500 font-sans mt-0.5">
                        PDF ou Word (Guarda automaticamente na pasta Google Drive do projeto)
                      </p>
                    </div>
                    {attachedProposalFile && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAttachedProposalFile(null);
                          if (proposalFileInputRef.current) proposalFileInputRef.current.value = '';
                        }}
                        title="Remover ficheiro"
                        className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-5 border-t border-white/[0.06] flex items-center justify-end gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowModal(false);
                      resetNewProjectForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={!newProjectData.clientId || !newProjectData.serviceType} 
                  >
                    Confirmar Alteração
                  </Button>
                </div>
              </form>
            </Modal>

            {/* Projects Display */}
            {groupedByClient.length > 0 ? (
              <div className="space-y-6">
                {groupedByClient.map((group) => (
                  <GlassCard key={group.key} className="p-0 overflow-hidden">
                    {/* Client Folder Header */}
                    <div className="px-6 py-4 bg-white/[0.02] border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-vela-red/10 border border-vela-red/25 flex items-center justify-center text-vela-red shrink-0">
                          <Folder size={17} strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <h3 className="text-base font-display font-bold text-white tracking-tight truncate">
                              {group.clientName}
                            </h3>
                            <Badge variant="default" className="tabular-nums">
                              {group.projects.length} {group.projects.length === 1 ? 'Projeto' : 'Projetos'}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-zinc-500">
                            Pasta do Cliente · Subpastas organizadas por projeto
                          </p>
                        </div>
                      </div>

                      {group.clientDriveFolderId && (
                        <button
                          type="button"
                          onClick={() => window.open(`https://drive.google.com/drive/folders/${group.clientDriveFolderId}`, '_blank')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.07] hover:border-white/[0.2] text-xs font-semibold text-zinc-300 hover:text-white hover:-translate-y-[1px] transition-all duration-150"
                        >
                          <Folder size={13} className="text-vela-red" />
                          <span>Pasta do Cliente</span>
                          <ExternalLink size={12} className="text-zinc-500" />
                        </button>
                      )}
                    </div>

                    {/* Client's Project Subfolders */}
                    <div className="divide-y divide-white/[0.05]">
                      {group.projects.map((client) => (
                        <div
                          key={client.id}
                          className="px-6 py-4 flex flex-wrap items-center justify-between gap-4 hover:bg-white/[0.025] transition-colors duration-150 group"
                        >
                          <div className="flex items-start gap-3.5 min-w-0 flex-1">
                            <div className="w-9 h-9 mt-0.5 rounded-xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-center text-zinc-400 group-hover:text-vela-red transition-colors duration-150 shrink-0">
                              <FolderOpen size={15} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-white truncate">
                                {client.serviceType || 'Projeto Geral'}
                              </p>
                              <p className="text-xs text-zinc-500 mt-0.5 tabular-nums truncate">
                                {(client as any).projectStartDate ? `Início: ${new Date(`${(client as any).projectStartDate}T00:00:00`).toLocaleDateString('pt-PT')}` : 'Subpasta de Projeto'}
                                {(client as any).projectEndDate ? ` · Fim: ${new Date(`${(client as any).projectEndDate}T00:00:00`).toLocaleDateString('pt-PT')}` : ''}
                              </p>
                              {isWebsiteGoogleService(client.serviceType) && (
                                <div className="mt-2.5">
                                  <WebsiteLinkButtons
                                    variant="compact"
                                    links={(client as any).websiteLinks}
                                    onEdit={() => setEditingLinksProject(client)}
                                  />
                                </div>
                              )}
                              {hasServicePlatforms(client.serviceType) && (
                                <div className="mt-2.5">
                                  <ServicePlatformButtons
                                    variant="compact"
                                    serviceType={client.serviceType}
                                    socialPlatforms={(client as any).socialMediaPlatforms}
                                    paidTrafficPlatforms={(client as any).paidTrafficPlatforms}
                                    onEdit={() => setEditingPlatformsProject(client)}
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 flex-wrap">
                            <Badge className={getStatusColor(client.status)}>
                              {client.status}
                            </Badge>
                            {(client as any).recurringBilling?.enabled && (
                              <Badge variant="primary" className="inline-flex items-center gap-1">
                                <Repeat size={10} />
                                {formatFrequencyLabel((client as any).recurringBilling)}
                              </Badge>
                            )}
                            <div className="text-xs tabular-nums min-w-[130px] text-right">
                              <span className="font-semibold text-emerald-400">{formatCurrency(client.receivedAmount || 0)}</span>
                              <span className="text-zinc-600 mx-1">/</span>
                              <span className="text-zinc-300 font-medium">{formatCurrency(client.totalValue || 0)}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {client.driveFolderId && (
                                <button
                                  type="button"
                                  onClick={() => window.open(`https://drive.google.com/drive/folders/${client.driveFolderId}`, '_blank')}
                                  title="Abrir pasta deste projeto no Google Drive"
                                  className="text-zinc-400 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.15] hover:-translate-y-[1px] transition-all duration-150 p-2 rounded-lg bg-white/[0.02] border border-white/[0.06]"
                                >
                                  <ExternalLink size={14} />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setProjectToDelete(client)}
                                title="Eliminar Projeto (mantém o cliente)"
                                className="text-zinc-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 hover:-translate-y-[1px] active:translate-y-0 transition-all duration-150 p-2 rounded-lg bg-white/[0.02] border border-white/[0.06]"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                ))}
              </div>
            ) : (
              <div className="py-16 flex flex-col items-center justify-center text-center border border-dashed border-white/[0.08] rounded-2xl bg-white/[0.01]">
                <Folder size={36} strokeWidth={1.25} className="text-zinc-600 mb-3" />
                <p className="text-xs font-semibold text-zinc-400">Sem projetos ativos correspondentes</p>
              </div>
            )}
          </div>
            {projectToDelete && (
              <ConfirmDeleteModal
                isOpen={!!projectToDelete}
                onClose={() => setProjectToDelete(null)}
                itemName={`${projectToDelete.name}${projectToDelete.serviceType ? ` (${projectToDelete.serviceType})` : ''}`}
                itemType="Projeto"
                subtitle={projectToDelete.status ? `Estado: ${projectToDelete.status}` : undefined}
                warningNote="Esta ação elimina apenas este projeto. A ficha do cliente e os restantes projetos continuarão ativos no CRM."
                onConfirm={async () => {
                  const deletedId = projectToDelete.id;
                  await deleteProject(deletedId);
                }}
              />
            )}
            {editingLinksProject && (
              <EditWebsiteLinksModal
                isOpen={!!editingLinksProject}
                onClose={() => setEditingLinksProject(null)}
                projectName={editingLinksProject.name || 'Projeto'}
                initialLinks={editingLinksProject.websiteLinks}
                onSave={(links) => {
                  const targetId = editingLinksProject.id;
                  const targetName = editingLinksProject.name || 'Projeto';
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
                projectName={editingPlatformsProject.name || 'Projeto'}
                serviceType={editingPlatformsProject.serviceType || ''}
                initialSocialPlatforms={editingPlatformsProject.socialMediaPlatforms}
                initialPaidTrafficPlatforms={editingPlatformsProject.paidTrafficPlatforms}
                onSave={(payload) => {
                  const targetId = editingPlatformsProject.id;
                  const targetName = editingPlatformsProject.name || 'Projeto';
                  const isProspect = (prospects || []).some((p) => p.id === targetId);
                  runBackgroundAction({
                    title: `A atualizar plataformas de "${targetName}"...`,
                    action: async () => {
                      const updateData = {
                        ...payload,
                        lastInteraction: new Date().toISOString()
                      };
                      if (isProspect) {
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
