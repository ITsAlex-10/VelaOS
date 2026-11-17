import React, { useState, useRef } from 'react';
import { GlassCard, Badge, Button, Modal, Input } from '../components/UI';
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
import { BillingFrequency, Client, CustomIntervalUnit, Payment, ProjectStage, RecurringBillingConfig } from '../types';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { useBackgroundAction } from '../contexts/BackgroundActionContext';
import { calculateNextBillingDate, formatFrequencyLabel, getTodayISO } from '../lib/billing';
import { RecurringBillingFields } from '../components/RecurringBillingFields';

interface ClientsPageProps {
  onClientClick: (client: Client) => void;
  onNavigateToLeads?: () => void;
}

export const ClientsPage: React.FC<ClientsPageProps> = ({ onClientClick, onNavigateToLeads }) => {
  const { clients, leads, prospects, createClient, deleteClient, getOrCreateDriveFolder, accessToken } = useWorkspace();
  const { runBackgroundAction } = useBackgroundAction();
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ 
    companyName: '', 
    mapUri: '', 
    note: '', 
    serviceType: '' 
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
  const [customIntervalValue, setCustomIntervalValue] = useState('1');
  const [customIntervalUnit, setCustomIntervalUnit] = useState<CustomIntervalUnit>('months');
  const [recurringStartDate, setRecurringStartDate] = useState(getTodayISO());
  const [firstCyclePaid, setFirstCyclePaid] = useState(true);

  const resetClientForm = () => {
    setFormData({ companyName: '', mapUri: '', note: '', serviceType: '' });
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
    setCustomIntervalValue('1');
    setCustomIntervalUnit('months');
    setRecurringStartDate(getTodayISO());
    setFirstCyclePaid(true);
    if (proposalFileInputRef.current) proposalFileInputRef.current.value = '';
  };

  // Search and Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'alphabetical'>('recent');

  // Delete Confirmation State
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

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

    let totalVal = effectiveTotal;
    let receivedAmt = 0;
    let initialPayments: Payment[] = [];
    let recurringConfig: RecurringBillingConfig | undefined = undefined;

    if (capturedBillingType === 'recurring') {
      const todayStr = getTodayISO();
      let nextDate = capturedStartDate;
      let cyclesPaid = 0;

      if (capturedFirstCyclePaid && effectiveTotal > 0) {
        initialPayments.push({
          id: 'p-' + Math.random().toString(36).substring(7),
          amount: effectiveTotal,
          date: capturedStartDate,
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
      status: 'Cliente' as const,
      totalValue: totalVal,
      receivedAmount: receivedAmt,
      lastInteraction: new Date().toISOString(),
      payments: initialPayments,
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

    setShowModal(false);
    resetClientForm();

    runBackgroundAction({
      title: fileToUpload
        ? `A registar cliente "${clientName}" e anexar proposta...`
        : `A registar cliente "${clientName}"...`,
      action: async () => {
        let folderId = '';
        if (accessToken) {
          try {
            folderId = await getOrCreateDriveFolder(clientName);
          } catch (driveErr) {
            console.warn("Could not create Drive folder for new client:", driveErr);
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
            if (uploadResp.ok) {
              const uploadData = await uploadResp.json();
              if (uploadData?.id) {
                proposalFileUrl = `https://drive.google.com/file/d/${uploadData.id}/view`;
              }
            }
          } catch (uploadErr) {
            console.error("Error uploading proposal file for new client:", uploadErr);
          }
        }

        const hasProposalInfo = baseVal > 0 || !!fileToUpload || capturedHasDiscount || capturedBillingType === 'recurring';
        const proposalObj: any = hasProposalInfo ? {
          id: Math.random().toString(36).substring(7),
          title: proposalFileName || `Proposta: ${clientName} (${serviceType})`,
          value: effectiveTotal,
          date: new Date().toISOString(),
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
    <div className="space-y-10 py-10 px-4 max-w-7xl mx-auto pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-vela-red shadow-[0_0_10px_rgba(255,34,28,0.5)] animate-pulse" />
            <h2 className="text-4xl font-display font-bold tracking-tight text-white leading-none">
              Diretório de Clientes
            </h2>
          </div>
          <p className="text-xs text-zinc-400 font-sans max-w-xl leading-relaxed">
            Consulte a ficha completa de cada cliente com informações e projetos. Acompanhe os valores já liquidados e pendentes de recebimento.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button 
            className="flex items-center gap-2 shadow-2xl shadow-vela-red/20 min-w-[170px] justify-center text-xs font-display font-black uppercase tracking-wider py-3 bg-vela-red hover:bg-vela-red/90 text-white" 
            onClick={() => setShowModal(true)}
          >
            <Plus size={16} strokeWidth={2.5} /> Novo Cliente
          </Button>
        </div>
      </header>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <GlassCard className="p-6 border-white/5 bg-white/[0.01]">
          <div className="space-y-1">
            <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-black font-sans">Total de Clientes</p>
            <p className="text-2xl font-display font-black text-white italic">{totalClients}</p>
          </div>
        </GlassCard>

        <GlassCard className="p-6 border-emerald-500/20 bg-emerald-500/[0.01]">
          <div className="space-y-1">
            <p className="text-[9px] uppercase tracking-[0.2em] text-emerald-400 font-black font-sans">Total Já Liquidado</p>
            <p className="text-2xl font-display font-black text-emerald-400 italic">{formatCurrency(totalReceived)}</p>
          </div>
        </GlassCard>

        <GlassCard className="p-6 border-amber-500/20 bg-amber-500/[0.01]">
          <div className="space-y-1">
            <p className="text-[9px] uppercase tracking-[0.2em] text-amber-400 font-black font-sans">Total Por Liquidar</p>
            <p className="text-2xl font-display font-black text-amber-400 italic">{formatCurrency(totalPending)}</p>
          </div>
        </GlassCard>
      </div>

      {/* Search and Sort Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/5">
        <h3 className="text-md font-display font-black text-white italic uppercase tracking-wider flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-vela-red" />
          Lista de Clientes ({sortedClients.length})
        </h3>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSortBy('recent')}
              className={cn(
                "px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                sortBy === 'recent' ? "bg-vela-red text-white" : "bg-white/5 text-zinc-400 hover:bg-white/10"
              )}
            >
              Recentes
            </button>
            <button
              type="button"
              onClick={() => setSortBy('alphabetical')}
              className={cn(
                "px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                sortBy === 'alphabetical' ? "bg-vela-red text-white" : "bg-white/5 text-zinc-400 hover:bg-white/10"
              )}
            >
              Alfabética
            </button>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
            <input 
              type="text"
              placeholder="Pesquisar clientes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/5 rounded-xl py-2 pl-10 pr-3 text-xs text-white focus:outline-none focus:border-vela-red transition-all placeholder:text-zinc-700 font-sans"
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
      >
        <form onSubmit={handleAddEntity} className="space-y-4">
          {formError && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 font-medium">
              {formError}
            </div>
          )}
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

          {/* Contact Names */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">Nome do(s) Responsável(eis)</label>
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
                  className="w-full flex-1 bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-vela-red/30 transition-all font-sans"
                />
                {contactNames.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setContactNames(contactNames.filter((_, i) => i !== idx))}
                    className="p-3 rounded-xl bg-white/5 text-zinc-500 hover:text-red-400 transition-colors shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setContactNames([...contactNames, ''])}
              className="text-[10px] font-black uppercase tracking-wider text-vela-red hover:underline flex items-center gap-1.5 ml-1 mt-1"
            >
              <Plus size={12} /> Adicionar outro responsável
            </button>
          </div>

          {/* Phones */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 font-sans block ml-1">Telemóvel(is)</label>
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
                  className="w-full flex-1 bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-vela-red/30 transition-all font-sans"
                />
                {phones.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setPhones(phones.filter((_, i) => i !== idx))}
                    className="p-3 rounded-xl bg-white/5 text-zinc-500 hover:text-red-400 transition-colors shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setPhones([...phones, ''])}
              className="text-[10px] font-black uppercase tracking-wider text-vela-red hover:underline flex items-center gap-1.5 ml-1 mt-1"
            >
              <Plus size={12} /> Adicionar outro telemóvel
            </button>
          </div>

          {/* Emails */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 font-sans block ml-1">Email(s)</label>
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
                  className="w-full flex-1 bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-vela-red/30 transition-all font-sans"
                />
                {emails.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setEmails(emails.filter((_, i) => i !== idx))}
                    className="p-3 rounded-xl bg-white/5 text-zinc-500 hover:text-red-400 transition-colors shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setEmails([...emails, ''])}
              className="text-[10px] font-black uppercase tracking-wider text-vela-red hover:underline flex items-center gap-1.5 ml-1 mt-1"
            >
              <Plus size={12} /> Adicionar outro email
            </button>
          </div>

          <Input 
            label="Link Direto para o Perfil do Google Maps" 
            placeholder="Ex: https://maps.app.goo.gl/..." 
            value={formData.mapUri}
            onChange={e => setFormData({ ...formData, mapUri: e.target.value })}
          />
          <Input 
            label="Nota Inicial" 
            placeholder="Ex: Observações importantes..." 
            value={formData.note}
            onChange={e => setFormData({ ...formData, note: e.target.value })}
          />
          
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 font-sans block ml-1">
              Serviço de Interesse
            </label>
            <select
              value={formData.serviceType}
              onChange={e => setFormData({ ...formData, serviceType: e.target.value })}
              required
              className={cn(
                "w-full bg-zinc-950/60 border border-white/10 focus:border-vela-red/40 focus:ring-0 rounded-xl py-3 px-4 text-xs transition-all font-sans",
                formData.serviceType ? "text-white" : "text-zinc-500"
              )}
            >
              <option value="" className="bg-zinc-950 text-zinc-500">Selecione um serviço</option>
              <option value="Website & Perfil Google" className="bg-zinc-950 text-white">Website & Perfil Google</option>
              <option value="Gestão de Redes Sociais" className="bg-zinc-950 text-white">Gestão de Redes Sociais</option>
              <option value="Tráfego Pago" className="bg-zinc-950 text-white">Tráfego Pago</option>
              <option value="Automações" className="bg-zinc-950 text-white">Automações</option>
              <option value="Aplicações" className="bg-zinc-950 text-white">Aplicações</option>
              <option value="Outros" className="bg-zinc-950 text-white">Outros</option>
            </select>
          </div>

          {/* Modelo de Cobrança */}
          <div className="space-y-2 pt-2">
            <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1 block">
              Modelo de Cobrança
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setBillingType('one_time')}
                className={cn(
                  "flex-1 py-2.5 px-3 rounded-xl text-xs font-bold border transition-all",
                  billingType === 'one_time'
                    ? "bg-vela-red border-vela-red text-white"
                    : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
                )}
              >
                Pagamento Único
              </button>
              <button
                type="button"
                onClick={() => setBillingType('recurring')}
                className={cn(
                  "flex-1 py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2",
                  billingType === 'recurring'
                    ? "bg-vela-red border-vela-red text-white"
                    : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
                )}
              >
                <Repeat size={13} />
                Pagamento Recorrente
              </button>
            </div>
          </div>

          {/* Valor da Proposta / Ciclo */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1 block">
              {billingType === 'recurring' ? 'Valor por Ciclo (€)' : 'Valor da Proposta (€)'}
            </label>
            <div className="relative">
              <Euro size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              <input
                type="number"
                min="0"
                step="any"
                value={proposalValue}
                onChange={e => setProposalValue(e.target.value)}
                placeholder={billingType === 'recurring' ? 'Ex: 450' : 'Ex: 8500'}
                required={billingType === 'recurring'}
                className="w-full bg-white/[0.03] border border-white/5 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-vela-red/30 transition-all font-sans"
              />
            </div>
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
              <div className="flex items-center gap-3 p-3.5 bg-white/[0.02] border border-white/5 rounded-xl">
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
            </div>
          )}

          {/* Desconto Comercial */}
          <div className="flex items-center gap-3 p-4 bg-white/[0.02] border border-white/5 rounded-xl">
            <input
              type="checkbox"
              id="newClientHasDiscount"
              checked={hasDiscount}
              onChange={(e) => setHasDiscount(e.target.checked)}
              className="w-4 h-4 rounded border-white/10 bg-white/5 text-vela-red focus:ring-vela-red cursor-pointer"
            />
            <label htmlFor="newClientHasDiscount" className="text-xs font-bold text-white uppercase tracking-wider cursor-pointer select-none">
              Tem desconto comercial aplicável?
            </label>
          </div>

          {hasDiscount && (
            <div className="space-y-4 p-4 bg-white/[0.01] border border-white/5 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 font-sans block ml-1">
                  Tipo de Desconto
                </label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setDiscountType('fixed')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                      discountType === 'fixed' ? 'bg-vela-red border-vela-red text-white' : 'bg-white/5 border-white/10 text-zinc-400'
                    }`}
                  >
                    Fixo (€)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('percentage')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                      discountType === 'percentage' ? 'bg-vela-red border-vela-red text-white' : 'bg-white/5 border-white/10 text-zinc-400'
                    }`}
                  >
                    Percentagem (%)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1 block">
                    {discountType === 'fixed' ? "Valor do Desconto (€)" : "Percentagem (%)"}
                  </label>
                  <div className="relative">
                    {discountType === 'fixed' ? (
                      <Euro size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                    ) : (
                      <Percent size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                    )}
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={discountValue}
                      onChange={e => setDiscountValue(e.target.value)}
                      placeholder={discountType === 'fixed' ? "500" : "10"}
                      required={hasDiscount}
                      className="w-full bg-white/[0.03] border border-white/5 rounded-xl pl-10 pr-3 py-3 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-vela-red/30 transition-all font-sans"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1 block">
                    Validade (Opcional)
                  </label>
                  <div className="relative">
                    <Calendar size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                    <input
                      type="date"
                      value={discountExpiry}
                      onChange={e => setDiscountExpiry(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/5 rounded-xl pl-10 pr-3 py-3 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-vela-red/30 transition-all font-sans"
                    />
                  </div>
                </div>
              </div>

              {parseFloat(proposalValue) > 0 && (
                <p className="text-[11px] text-zinc-400">
                  Valor Final com Desconto:{' '}
                  <strong className="text-white font-mono">
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
                </p>
              )}
            </div>
          )}

          {/* Anexar Ficheiro da Proposta */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 font-sans block ml-1">
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
                "border border-dashed rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer hover:bg-white/[0.02] transition-all duration-300 relative",
                attachedProposalFile ? "border-emerald-500/30 bg-emerald-500/[0.02]" : "border-white/10 bg-white/[0.01]"
              )}
            >
              <input
                type="file"
                className="hidden"
                ref={proposalFileInputRef}
                onChange={(e) => setAttachedProposalFile(e.target.files?.[0] || null)}
                accept=".pdf,.doc,.docx"
              />
              {attachedProposalFile && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAttachedProposalFile(null);
                    if (proposalFileInputRef.current) proposalFileInputRef.current.value = '';
                  }}
                  title="Remover ficheiro"
                  className="absolute top-3 right-3 p-1 text-zinc-500 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
              <Paperclip size={20} className={attachedProposalFile ? 'text-emerald-400 mb-2' : 'text-zinc-500 mb-2'} />
              <p className="text-xs font-bold text-zinc-300 text-center">
                {attachedProposalFile ? attachedProposalFile.name : "Arraste ou clique para anexar proposta comercial"}
              </p>
              <p className="text-[9px] text-zinc-600 uppercase font-sans mt-1 text-center">
                PDF ou Word (Guarda automaticamente na pasta Google Drive do cliente)
              </p>
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full py-4 mt-4 transition-all"
          >
            Confirmar Registo
          </Button>
        </form>

      </Modal>

      {/* Clients Table Layout */}
      <GlassCard className="p-0 overflow-hidden border-white/5 bg-white/[0.01]">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/8 bg-white/[0.02]">
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 font-sans">Nome da Entidade</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 font-sans">Domínio do Serviço</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 font-sans">Já Liquidado</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 font-sans">Falta Liquidar</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 font-sans text-right">Ops</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
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
                    className="group hover:bg-white/[0.04] transition-all cursor-pointer"
                    onClick={() => onClientClick(client)}
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl glass border-white/8 flex items-center justify-center text-sm font-bold text-white group-hover:border-vela-red/30 transition-all shadow-2xl shadow-black/40 font-display">
                          {client.name?.substring(0, 2).toUpperCase() || '??'}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-[#fafafa] mb-1 font-display group-hover:text-vela-red transition-colors">{client.name}</h4>
                          <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest font-sans">{client.contactName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] text-zinc-500 font-black uppercase tracking-[0.1em] font-sans">{client.serviceType || 'Sem projeto ativo'}</span>
                        {activeRecurring && (
                          <Badge variant="primary" className="inline-flex items-center gap-1 text-[8px]">
                            <Repeat size={9} />
                            {formatFrequencyLabel(activeRecurring)}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-[12px] text-emerald-400 font-bold font-sans">{formatCurrency(received)}</span>
                    </td>
                    <td className="px-8 py-6">
                      <span className={cn(
                        "text-[12px] font-bold font-sans",
                        pending > 0 ? "text-amber-400" : "text-zinc-500"
                      )}>
                        {formatCurrency(pending)}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center justify-end gap-2 text-[10px]">
                        <a
                          href={client.mapUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.name + ' ' + (client.address || ''))}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-3 rounded-xl bg-white/3 text-zinc-600 hover:text-white hover:bg-white/8 transition-all inline-flex items-center justify-center"
                          title="Ver no Google Maps"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink size={16} strokeWidth={1.5} />
                        </a>
                        <button 
                          className="p-3 rounded-xl bg-white/3 text-zinc-600 hover:text-white hover:bg-white/8 transition-all" 
                          title="Enviar Email"
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            window.location.href = `mailto:${client.email}`; 
                          }}
                        >
                          <Mail size={16} strokeWidth={1.5} />
                        </button>
                        <button 
                          className="p-3 rounded-xl bg-white/3 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all" 
                          title="Eliminar Entidade"
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setClientToDelete(client);
                          }}
                        >
                          <Trash2 size={16} strokeWidth={1.5} />
                        </button>
                        <button 
                          className="p-3 rounded-xl bg-white/3 text-zinc-600 hover:text-white hover:bg-white/8 transition-all" 
                          title="Ver Detalhes"
                          onClick={(e) => { e.stopPropagation(); onClientClick(client); }}
                        >
                          <ArrowUpRight size={16} strokeWidth={1.5} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center opacity-30">
                    <Users size={48} strokeWidth={1} className="mx-auto mb-4" />
                    <p className="text-[10px] uppercase font-black tracking-widest">Nenhum cliente registado</p>
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
