import React, { useState, useRef } from 'react';
import { GlassCard, Badge, Button, Modal, Input, Select } from '../components/UI';
import { formatCurrency, cn } from '../lib/utils';
import { 
  Users, 
  Search, 
  Mail, 
  Trash2, 
  ExternalLink,
  Plus,
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  Repeat,
  Euro,
  Percent,
  Calendar,
  Paperclip,
  X
} from 'lucide-react';
import { motion } from 'motion/react';
import { BillingFrequency, Client, CustomIntervalUnit, PaidTrafficPlatform, Payment, ProjectStage, RecurringBillingConfig, SocialMediaPlatform, WebsiteProjectLinks } from '../types';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { useBackgroundAction } from '../contexts/BackgroundActionContext';
import { calculateNextBillingDate, formatFrequencyLabel, getTodayISO } from '../lib/billing';
import { RecurringBillingFields } from '../components/RecurringBillingFields';
import { ProjectOriginFields } from '../components/ProjectOriginFields';
import { GoogleMapsLinkAutofill, ResolvedGoogleMapsPlace } from '../components/GoogleMapsLinkAutofill';
import { WebsiteLinksFields, EMPTY_WEBSITE_LINKS, isWebsiteGoogleService, buildWebsiteLinksPayload } from '../components/WebsiteLinksSection';
import {
  ServicePlatformsFields,
  isSocialMediaService,
  isPaidTrafficService,
  hasServicePlatforms,
  normalizeSocialMediaPlatforms,
  normalizePaidTrafficPlatforms
} from '../components/ServicePlatformsSection';
import { notifyWorkspaceUnauthorized } from '../lib/workspace';

interface ClientsPageProps {
  onClientClick: (client: Client) => void;
  onNavigateToLeads?: () => void;
}

export const ClientsPage: React.FC<ClientsPageProps> = ({ onClientClick, onNavigateToLeads }) => {
  const { clients, leads, prospects, createClient, deleteClient, ensureProjectDriveFolders, accessToken } = useWorkspace();
  const { runBackgroundAction } = useBackgroundAction();
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ 
    companyName: '', 
    address: '',
    website: '',
    mapUri: '', 
    note: '', 
    serviceType: '',
    rating: '',
    placeId: ''
  });
  const [contactNames, setContactNames] = useState<string[]>(['']);
  const [emails, setEmails] = useState<string[]>(['']);
  const [phones, setPhones] = useState<string[]>(['']);
  const [formError, setFormError] = useState<string | null>(null);

  // Proposal, Discount, Recurring & File states
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
  const [websiteLinks, setWebsiteLinks] = useState<WebsiteProjectLinks>(EMPTY_WEBSITE_LINKS);
  const [socialPlatforms, setSocialPlatforms] = useState<SocialMediaPlatform[]>([]);
  const [paidPlatforms, setPaidPlatforms] = useState<PaidTrafficPlatform[]>([]);

  const resetClientForm = () => {
    setFormData({ companyName: '', address: '', website: '', mapUri: '', note: '', serviceType: '', rating: '', placeId: '' });
    setContactNames(['']);
    setEmails(['']);
    setPhones(['']);
    setFormError(null);
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
    setWebsiteLinks(EMPTY_WEBSITE_LINKS);
    setSocialPlatforms([]);
    setPaidPlatforms([]);
    if (proposalFileInputRef.current) proposalFileInputRef.current.value = '';
  };

  // Search and Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'alphabetical'>('recent');

  // Delete Confirmation State
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

  const handleApplyGoogleMapsPlace = (place: ResolvedGoogleMapsPlace) => {
    const ratingStr = typeof place.rating === 'number'
      ? `${place.rating.toFixed(1)}${place.userRatingCount ? ` (${place.userRatingCount})` : ''}`
      : '';

    setFormData(prev => ({
      ...prev,
      companyName: place.name || prev.companyName,
      address: place.address || prev.address,
      website: place.website || prev.website,
      mapUri: place.mapUri || prev.mapUri,
      rating: ratingStr || prev.rating,
      placeId: place.placeId || prev.placeId
    }));
    if (formError) setFormError(null);

    if (place.phone) {
      setPhones(prev => {
        const nonEmpty = prev.filter(p => p.trim() !== '');
        if (nonEmpty.length === 0) return [place.phone];
        if (nonEmpty.includes(place.phone)) return prev;
        return [place.phone, ...nonEmpty];
      });
    }
    if (place.email) {
      setEmails(prev => {
        const nonEmpty = prev.filter(e => e.trim() !== '');
        if (nonEmpty.length === 0) return [place.email!];
        if (nonEmpty.includes(place.email!)) return prev;
        return [place.email!, ...nonEmpty];
      });
    }
  };

  const handleAddEntity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName || !formData.serviceType) return;

    const companyNameNorm = formData.companyName.toLowerCase().trim();
    const isDuplicate = 
      (leads || []).some(l => l.name && l.name.toLowerCase().trim() === companyNameNorm) ||
      (prospects || []).some(p => p.name && p.name.toLowerCase().trim() === companyNameNorm) ||
      (clients || []).some(c => c.name && c.name.toLowerCase().trim() === companyNameNorm);

    if (isDuplicate) {
      setFormError(`O negócio "${formData.companyName}" já está registado no CRM (Leads, Prospects ou Clientes) e não pode ser duplicado.`);
      return;
    }

    if (!isNewProject && !projectStartDate) {
      setProjectDateError('Selecione a data de início do projeto.');
      return;
    }
    if (!isNewProject && projectEndDate && projectStartDate && projectEndDate < projectStartDate) {
      setProjectDateError('A data de fim não pode ser anterior à data de início.');
      return;
    }
    setProjectDateError(null);

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

    const capturedIsNewProject = isNewProject;
    const capturedProjectStartDate = capturedIsNewProject ? getTodayISO() : projectStartDate;
    const capturedProjectEndDate = !capturedIsNewProject ? projectEndDate : '';
    const hasEndDate = Boolean(capturedProjectEndDate);
    const capturedLiquidatedDate = liquidatedDate || (hasEndDate ? capturedProjectEndDate : getTodayISO());
    const parsedLiquidatedAmt = Math.max(0, parseFloat(liquidatedAmount) || 0);

    let totalVal = effectiveTotal;
    let receivedAmt = hasEndDate ? effectiveTotal : 0;
    let initialPayments: Payment[] = [];
    let recurringConfig: RecurringBillingConfig | undefined = undefined;
    const targetStatus: ProjectStage = hasEndDate ? 'Terminado' : 'Cliente';

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
      const todayStr = getTodayISO();
      let nextDate = capturedStartDate;
      let cyclesPaid = 0;

      if (capturedFirstCyclePaid && effectiveTotal > 0) {
        initialPayments.push({
          id: 'p-' + Math.random().toString(36).substring(7),
          amount: effectiveTotal,
          date: capturedLiquidatedDate,
          saleDate: capturedProjectStartDate,
          status: 'received',
          type: 'recurring',
          description: `1º Ciclo (${formatFrequencyLabel({ frequency: capturedFrequency, customIntervalValue: capturedCustomVal, customIntervalUnit: capturedCustomUnit })})`
        });
        totalVal = effectiveTotal;
        receivedAmt = effectiveTotal;
        cyclesPaid = 1;
        nextDate = calculateNextBillingDate(capturedStartDate, capturedFrequency, capturedCustomVal, capturedCustomUnit);
      } else if (effectiveTotal > 0 && capturedStartDate <= todayStr) {
        initialPayments.push({
          id: 'p-' + Math.random().toString(36).substring(7),
          amount: effectiveTotal,
          date: capturedStartDate,
          saleDate: capturedStartDate,
          status: 'pending',
          type: 'recurring',
          description: `1º Ciclo (${formatFrequencyLabel({ frequency: capturedFrequency, customIntervalValue: capturedCustomVal, customIntervalUnit: capturedCustomUnit })})`
        });
        totalVal = effectiveTotal;
        receivedAmt = 0;
        nextDate = calculateNextBillingDate(capturedStartDate, capturedFrequency, capturedCustomVal, capturedCustomUnit);
      } else {
        totalVal = 0;
        receivedAmt = 0;
        nextDate = capturedStartDate;
      }

      recurringConfig = {
        enabled: true,
        amount: effectiveTotal,
        frequency: capturedFrequency,
        ...(capturedFrequency === 'custom'
          ? { customIntervalValue: capturedCustomVal, customIntervalUnit: capturedCustomUnit }
          : {}),
        startDate: capturedStartDate,
        nextBillingDate: nextDate,
        active: true,
        cyclesPaid
      };
    } else {
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
    const clientName = formData.companyName;
    const serviceType = formData.serviceType;

    const basePayload: Partial<Client> = {
      name: clientName,
      contactName: contactNames.filter(Boolean).join(', ') || 'Responsável',
      email: emails.filter(Boolean).join(', '),
      phone: phones.filter(Boolean).join(', '),
      serviceType,
      ...(isWebsiteGoogleService(serviceType) ? { websiteLinks: buildWebsiteLinksPayload(websiteLinks) } : {}),
      ...(isSocialMediaService(serviceType) ? { socialMediaPlatforms: normalizeSocialMediaPlatforms(socialPlatforms) } : {}),
      ...(isPaidTrafficService(serviceType) ? { paidTrafficPlatforms: normalizePaidTrafficPlatforms(paidPlatforms) } : {}),
      status: targetStatus,
      totalValue: totalVal,
      receivedAmount: receivedAmt,
      saleDate: capturedProjectStartDate,
      lastInteraction: new Date().toISOString(),
      payments: initialPayments,
      isNewProject: capturedIsNewProject,
      projectStartDate: capturedProjectStartDate,
      ...(hasEndDate ? { projectEndDate: capturedProjectEndDate } : {}),
      ...(recurringConfig ? { recurringBilling: recurringConfig } : {}),
      notes: formData.note ? [
        {
          id: Math.random().toString(36).substring(7),
          date: new Date().toLocaleDateString('pt-PT'),
          author: 'Sistema',
          content: formData.note
        }
      ] : []
    };
    const mapUriVal = formData.mapUri || '';
    const addressVal = formData.address || '';
    const websiteVal = formData.website || '';
    const ratingVal = formData.rating || '';
    const placeIdVal = formData.placeId || '';

    setShowModal(false);
    resetClientForm();

    runBackgroundAction({
      title: fileToUpload
        ? `A registar cliente "${clientName}" e anexar proposta...`
        : `A registar cliente "${clientName}"...`,
      action: async () => {
        let clientFolderId = '';
        let folderId = '';
        if (accessToken) {
          try {
            const ensured = await ensureProjectDriveFolders({
              clientName,
              projectName: serviceType || 'Projeto Geral'
            });
            clientFolderId = ensured.clientFolderId;
            folderId = ensured.projectFolderId;
          } catch (driveErr) {
            console.warn("Could not create Drive folders for new client:", driveErr);
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
            console.warn("Could not upload proposal file for new client:", uploadErr);
          }
        }

        const hasProposalInfo = baseVal > 0 || !!fileToUpload || capturedHasDiscount || capturedBillingType === 'recurring';
        const proposalObj: any = hasProposalInfo ? {
          id: Math.random().toString(36).substring(7),
          title: proposalFileName || `Proposta: ${clientName} (${serviceType})`,
          value: effectiveTotal,
          date: new Date().toISOString(),
          acceptedAt: capturedProjectStartDate,
          status: 'aceite',
          discountAmount: capturedHasDiscount ? finalDiscount : 0,
          discountType: capturedHasDiscount ? capturedDiscountType : 'fixed',
          discountRawValue: capturedHasDiscount ? discRaw : 0,
          hasDiscountApplied: capturedHasDiscount,
          billingType: capturedBillingType,
          ...(capturedBillingType === 'recurring' ? {
            recurringFrequency: capturedFrequency,
            ...(capturedFrequency === 'custom' ? { customIntervalValue: capturedCustomVal, customIntervalUnit: capturedCustomUnit } : {})
          } : {}),
          ...(capturedHasDiscount && capturedDiscountExpiry ? { discountExpiry: capturedDiscountExpiry } : {}),
          ...(proposalFileUrl ? { fileUrl: proposalFileUrl } : {})
        } : undefined;

        await createClient({
          ...basePayload,
          ...(mapUriVal ? { mapUri: mapUriVal } as any : {}),
          ...(addressVal ? { address: addressVal } as any : {}),
          ...(websiteVal ? { website: websiteVal, hasWebsite: true } as any : {}),
          ...(ratingVal ? { rating: ratingVal } as any : {}),
          ...(placeIdVal ? { placeId: placeIdVal } as any : {}),
          clientDriveFolderId: clientFolderId,
          driveFolderId: folderId,
          proposalFileUrl,
          proposalFileName,
          ...(proposalObj ? { proposal: proposalObj } : {})
        });
      },
      errorMessage: `Erro ao registar o cliente "${clientName}".`
    });
  };

  // Filter clients and projects
  const mainClients = (clients || []).filter(c => !c.parentClientId);
  const allProjects = (clients || []).filter(c => !!c.parentClientId);

  const pageClients = mainClients.map(client => {
    const clientProjects = allProjects.filter(p => p.parentClientId === client.id);
    const totalValue = clientProjects.reduce((acc, p) => acc + (p.totalValue || 0), client.totalValue || 0);
    const receivedAmount = clientProjects.reduce((acc, p) => acc + (p.receivedAmount || 0), client.receivedAmount || 0);
    
    return { ...client, totalValue, receivedAmount, projects: clientProjects };
  });

  // Include clients that might only have projects (no main entry)
  const clientsWithNoMainEntry = Array.from(new Set(allProjects.filter(p => !mainClients.find(c => c.id === p.parentClientId)).map(p => p.name)));
  
  clientsWithNoMainEntry.forEach(name => {
      if (!pageClients.find(c => c.name === name)) {
          const clientProjects = allProjects.filter(p => p.name === name);
          const totalValue = clientProjects.reduce((acc, p) => acc + (p.totalValue || 0), 0);
          const receivedAmount = clientProjects.reduce((acc, p) => acc + (p.receivedAmount || 0), 0);
          pageClients.push({ name, totalValue, receivedAmount, projects: clientProjects, id: name, status: 'Cliente' } as unknown as Client);
      }
  });

  
  const filteredClients = pageClients.filter(client => {
    return (
      (client.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (client.contactName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.email || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const sortedClients = [...filteredClients].sort((a, b) => {
    if (sortBy === 'alphabetical') {
      return (a.name || '').localeCompare(b.name || '');
    } else {
      const timeA = new Date(a.lastInteraction || 0).getTime();
      const timeB = new Date(b.lastInteraction || 0).getTime();
      return timeB - timeA;
    }
  });

  const totalClients = pageClients.length;
  const totalReceived = pageClients.reduce((acc, c) => acc + (c.receivedAmount || 0), 0);
  const totalContracted = pageClients.reduce((acc, c) => acc + (c.totalValue || 0), 0);
  const totalPending = Math.max(0, totalContracted - totalReceived);

  return (
    <div className="space-y-8 pb-12">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h2 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-white">
            Diretório de Clientes
          </h2>
          <p className="text-sm text-zinc-400 max-w-xl leading-relaxed">
            Consulte a ficha completa de cada cliente, acompanhe os valores liquidados e gira os projetos adjudicados.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowModal(true)}
          className="shrink-0"
        >
          <Plus size={15} />
          <span>Novo Cliente</span>
        </Button>
      </header>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GlassCard hoverable className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-400 font-semibold">Total de Clientes</p>
              <p className="text-3xl font-display font-bold text-white leading-none tabular-nums">{totalClients}</p>
            </div>
            <span className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-center text-zinc-400">
              <Users size={18} strokeWidth={1.75} />
            </span>
          </div>
        </GlassCard>

        <GlassCard hoverable className="p-5 border-emerald-500/20 bg-emerald-500/[0.02]">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-400 font-semibold">Total Já Liquidado</p>
              <p className="text-3xl font-display font-bold text-emerald-400 leading-none tabular-nums">{formatCurrency(totalReceived)}</p>
            </div>
            <span className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
              <CheckCircle2 size={18} strokeWidth={1.75} />
            </span>
          </div>
        </GlassCard>

        <GlassCard hoverable className="p-5 border-amber-500/20 bg-amber-500/[0.02]">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-[0.14em] text-amber-400 font-semibold">Total Por Liquidar</p>
              <p className="text-3xl font-display font-bold text-amber-400 leading-none tabular-nums">{formatCurrency(totalPending)}</p>
            </div>
            <span className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-400">
              <Euro size={18} strokeWidth={1.75} />
            </span>
          </div>
        </GlassCard>
      </div>

      {/* Search and Sort Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-5 border-t border-white/[0.06]">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-display font-bold text-white tracking-tight">
            Lista de Clientes
          </h3>
          <span className="text-xs font-semibold text-zinc-500 tabular-nums">
            ({sortedClients.length})
          </span>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/[0.07]">
            <button
              type="button"
              onClick={() => setSortBy('recent')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors",
                sortBy === 'recent' ? "bg-vela-red text-white" : "text-zinc-400 hover:text-white"
              )}
            >
              Recentes
            </button>
            <button
              type="button"
              onClick={() => setSortBy('alphabetical')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors",
                sortBy === 'alphabetical' ? "bg-vela-red text-white" : "text-zinc-400 hover:text-white"
              )}
            >
              Alfabética
            </button>
          </div>
          <div className="relative flex-1 sm:w-64 sm:flex-initial">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
            <input
              type="text"
              placeholder="Pesquisar clientes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 bg-white/[0.03] border border-white/[0.08] rounded-xl pl-9 pr-3 text-xs text-white focus:outline-none focus:border-vela-red/50 transition-colors placeholder:text-zinc-600"
            />
          </div>
        </div>
      </div>

      {clientToDelete && (
        <ConfirmDeleteModal
          isOpen={!!clientToDelete}
          onClose={() => setClientToDelete(null)}
          itemName={clientToDelete.name}
          itemType="Cliente"
          subtitle={clientToDelete.contactName ? `Contacto: ${clientToDelete.contactName}` : (clientToDelete.email ? `Email: ${clientToDelete.email}` : undefined)}
          onConfirm={async () => {
            await deleteClient(clientToDelete.id);
          }}
        />
      )}

      <Modal 
        isOpen={showModal} 
        onClose={() => {
          setShowModal(false);
          resetClientForm();
        }} 
        title="Registar Novo Cliente"
        subtitle="Configure a ficha do cliente, origem do projeto e condições de liquidação"
        size="lg"
      >
        <form onSubmit={handleAddEntity} className="space-y-6">
          {formError && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 font-medium">
              {formError}
            </div>
          )}

          <GoogleMapsLinkAutofill
            value={formData.mapUri}
            onChange={(val) => setFormData(prev => ({ ...prev, mapUri: val }))}
            onResolved={handleApplyGoogleMapsPlace}
          />

          {/* 1. Identificação & Serviço */}
          <div className="space-y-4 pt-5 border-t border-white/[0.06]">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 font-sans">
              01 · Identificação &amp; Serviço
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input 
                label="Nome da Empresa / Entidade" 
                placeholder="Ex: Velocity Studio" 
                value={formData.companyName}
                onChange={e => {
                  setFormData({ ...formData, companyName: e.target.value });
                  if (formError) setFormError(null);
                }}
                required
              />
              <Select
                label="Serviço de Interesse"
                value={formData.serviceType}
                onChange={e => setFormData({ ...formData, serviceType: e.target.value })}
                required
                className={cn(formData.serviceType ? "text-white" : "text-zinc-500")}
              >
                <option value="" className="bg-zinc-950 text-zinc-500">Selecione um serviço</option>
                <option value="Website & Perfil Google" className="bg-zinc-950 text-white">Website &amp; Perfil Google</option>
                <option value="Gestão de Redes Sociais" className="bg-zinc-950 text-white">Gestão de Redes Sociais</option>
                <option value="Tráfego Pago" className="bg-zinc-950 text-white">Tráfego Pago</option>
                <option value="Automações" className="bg-zinc-950 text-white">Automações</option>
                <option value="Aplicações" className="bg-zinc-950 text-white">Aplicações</option>
                <option value="Outros" className="bg-zinc-950 text-white">Outros</option>
              </Select>
            </div>
            {isWebsiteGoogleService(formData.serviceType) && (
              <WebsiteLinksFields
                value={websiteLinks}
                onChange={setWebsiteLinks}
              />
            )}
            {hasServicePlatforms(formData.serviceType) && (
              <ServicePlatformsFields
                serviceType={formData.serviceType}
                socialPlatforms={socialPlatforms}
                onSocialPlatformsChange={setSocialPlatforms}
                paidTrafficPlatforms={paidPlatforms}
                onPaidTrafficPlatformsChange={setPaidPlatforms}
              />
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input 
                label="Morada" 
                placeholder="Ex: Avenida da Liberdade 120, Lisboa" 
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
              />
              <Input 
                label="Website" 
                placeholder="Ex: https://www.empresa.pt" 
                value={formData.website}
                onChange={e => setFormData({ ...formData, website: e.target.value })}
              />
            </div>
          </div>

          {/* 2. Contactos */}
          <div className="space-y-4 pt-5 border-t border-white/[0.06]">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 font-sans">
              02 · Contactos
            </h4>

            {/* Contact Names */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-0.5 block">
                Nome do(s) Responsável(eis)
              </label>
              <div className="space-y-2">
                {contactNames.map((name, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input 
                      placeholder="Ex: João Silva" 
                      value={name}
                      onChange={e => {
                        const updated = [...contactNames];
                        updated[idx] = e.target.value;
                        setContactNames(updated);
                      }}
                      className="w-full flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-vela-red/40 transition-all font-sans"
                    />
                    {contactNames.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setContactNames(contactNames.filter((_, i) => i !== idx))}
                        className="p-2.5 rounded-xl bg-white/[0.04] border border-white/5 text-zinc-500 hover:text-red-400 transition-colors shrink-0"
                        aria-label="Remover responsável"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setContactNames([...contactNames, ''])}
                className="text-[10px] font-bold uppercase tracking-wider text-vela-red hover:text-vela-red/80 flex items-center gap-1.5 ml-0.5 pt-0.5"
              >
                <Plus size={12} /> Adicionar outro responsável
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Phones */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 font-sans block ml-0.5">
                  Telemóvel(is)
                </label>
                <div className="space-y-2">
                  {phones.map((phone, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input 
                        placeholder="+351 912 345 678" 
                        type="tel"
                        value={phone}
                        onChange={e => {
                          const updated = [...phones];
                          updated[idx] = e.target.value;
                          setPhones(updated);
                        }}
                        className="w-full flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-vela-red/40 transition-all font-sans"
                      />
                      {phones.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setPhones(phones.filter((_, i) => i !== idx))}
                          className="p-2.5 rounded-xl bg-white/[0.04] border border-white/5 text-zinc-500 hover:text-red-400 transition-colors shrink-0"
                          aria-label="Remover telemóvel"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setPhones([...phones, ''])}
                  className="text-[10px] font-bold uppercase tracking-wider text-vela-red hover:text-vela-red/80 flex items-center gap-1.5 ml-0.5 pt-0.5"
                >
                  <Plus size={12} /> Adicionar outro telemóvel
                </button>
              </div>

              {/* Emails */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 font-sans block ml-0.5">
                  Email(s)
                </label>
                <div className="space-y-2">
                  {emails.map((email, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input 
                        placeholder="cliente@exemplo.com" 
                        type="email"
                        value={email}
                        onChange={e => {
                          const updated = [...emails];
                          updated[idx] = e.target.value;
                          setEmails(updated);
                        }}
                        className="w-full flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-vela-red/40 transition-all font-sans"
                      />
                      {emails.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setEmails(emails.filter((_, i) => i !== idx))}
                          className="p-2.5 rounded-xl bg-white/[0.04] border border-white/5 text-zinc-500 hover:text-red-400 transition-colors shrink-0"
                          aria-label="Remover email"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setEmails([...emails, ''])}
                  className="text-[10px] font-bold uppercase tracking-wider text-vela-red hover:text-vela-red/80 flex items-center gap-1.5 ml-0.5 pt-0.5"
                >
                  <Plus size={12} /> Adicionar outro email
                </button>
              </div>
            </div>
          </div>

          {/* 3. Origem & Cronograma */}
          <div className="space-y-4 pt-5 border-t border-white/[0.06]">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 font-sans">
              03 · Origem &amp; Cronograma
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

          {/* 4. Cobrança, Valores & Liquidação */}
          <div className="space-y-4 pt-5 border-t border-white/[0.06]">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 font-sans">
              04 · Cobrança &amp; Liquidação
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
                {!(!isNewProject && projectEndDate) && (
                  <div className="space-y-3 p-3.5 bg-white/[0.02] border border-white/[0.08] rounded-xl">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="newClientFirstCyclePaid"
                        checked={firstCyclePaid}
                        onChange={(e) => setFirstCyclePaid(e.target.checked)}
                        className="w-4 h-4 rounded border-white/10 bg-white/5 text-vela-red focus:ring-vela-red cursor-pointer"
                      />
                      <label htmlFor="newClientFirstCyclePaid" className="text-xs font-bold text-zinc-200 cursor-pointer select-none">
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
                htmlFor="newClientHasDiscount"
                className="flex items-center gap-3 p-3.5 bg-white/[0.02] border border-white/[0.08] rounded-xl cursor-pointer hover:border-white/15 transition-colors"
              >
                <input
                  type="checkbox"
                  id="newClientHasDiscount"
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
            {(!isNewProject && projectEndDate) ? (
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
            ) : billingType === 'one_time' && (
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

          {/* 5. Proposta & Nota */}
          <div className="space-y-4 pt-5 border-t border-white/[0.06]">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 font-sans">
              05 · Proposta &amp; Observações
            </h4>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 font-sans block ml-0.5">
                Anexar Ficheiro da Proposta
              </label>
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
                    PDF ou Word (Guarda na pasta do projeto dentro da pasta do cliente no Drive)
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

            <Input 
              label="Nota Inicial" 
              placeholder="Ex: Observações importantes..." 
              value={formData.note}
              onChange={e => setFormData({ ...formData, note: e.target.value })}
            />
          </div>

          {/* Footer */}
          <div className="pt-5 border-t border-white/[0.06] flex items-center justify-end gap-3">
            <Button 
              type="button" 
              variant="secondary" 
              onClick={() => {
                setShowModal(false);
                resetClientForm();
              }}
            >
              Cancelar
            </Button>
            <Button type="submit">
              Registar Novo Cliente
            </Button>
          </div>
        </form>
      </Modal>

      {/* Clients Table Layout */}
      <GlassCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="border-b border-white/[0.07] bg-white/[0.02]">
                <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Entidade</th>
                <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Serviço / Recorrência</th>
                <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Liquidado</th>
                <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Em Falta</th>
                <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {sortedClients.length > 0 ? sortedClients.map((client) => {
                const received = client.receivedAmount || 0;
                const total = client.totalValue || 0;
                const pending = Math.max(0, total - received);
                const clientProjects = ((client as any).projects as Client[] | undefined) || [];
                const activeRecurring =
                  (client.recurringBilling?.enabled && client.recurringBilling.active ? client.recurringBilling : null) ||
                  clientProjects.find(p => p.recurringBilling?.enabled && p.recurringBilling.active)?.recurringBilling ||
                  null;

                return (
                  <tr
                    key={client.id}
                    className="group hover:bg-white/[0.03] transition-colors cursor-pointer"
                    onClick={() => onClientClick(client)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-center text-xs font-display font-bold text-zinc-200 group-hover:border-vela-red/35 transition-colors shrink-0">
                          {client.name?.substring(0, 2).toUpperCase() || '??'}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-white group-hover:text-vela-red transition-colors truncate">
                            {client.name}
                          </h4>
                          <p className="text-xs text-zinc-500 truncate mt-0.5">
                            {client.contactName || 'Sem contacto'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-zinc-300 font-medium">
                          {client.serviceType || 'Sem projeto ativo'}
                        </span>
                        {activeRecurring && (
                          <Badge variant="primary" className="inline-flex items-center gap-1">
                            <Repeat size={10} />
                            {formatFrequencyLabel(activeRecurring)}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-emerald-400 font-semibold tabular-nums">
                        {formatCurrency(received)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "text-sm font-semibold tabular-nums",
                        pending > 0 ? "text-amber-400" : "text-zinc-500"
                      )}>
                        {formatCurrency(pending)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <a
                          href={client.mapUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.name + ' ' + (client.address || ''))}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.07] hover:border-white/[0.15] hover:-translate-y-[1px] active:translate-y-0 transition-all duration-150 inline-flex items-center justify-center"
                          title="Ver no Google Maps"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink size={15} />
                        </a>
                        <button
                          type="button"
                          className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.07] hover:border-white/[0.15] hover:-translate-y-[1px] active:translate-y-0 transition-all duration-150"
                          title="Enviar Email"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.location.href = `mailto:${client.email}`;
                          }}
                        >
                          <Mail size={15} />
                        </button>
                        <button
                          type="button"
                          className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06] text-zinc-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/25 hover:-translate-y-[1px] active:translate-y-0 transition-all duration-150"
                          title="Eliminar Entidade"
                          onClick={(e) => {
                            e.stopPropagation();
                            setClientToDelete(client);
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                        <button
                          type="button"
                          className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.07] hover:border-white/[0.15] hover:-translate-y-[1px] active:translate-y-0 transition-all duration-150"
                          title="Ver Detalhes"
                          onClick={(e) => { e.stopPropagation(); onClientClick(client); }}
                        >
                          <ArrowUpRight size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2 text-zinc-500">
                      <Users size={36} strokeWidth={1.25} className="text-zinc-600" />
                      <p className="text-xs font-semibold text-zinc-400">Nenhum cliente registado</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
};
