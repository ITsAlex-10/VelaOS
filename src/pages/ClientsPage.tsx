import React, { useState } from 'react';
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
  Loader2
} from 'lucide-react';
import { motion } from 'motion/react';
import { Client, ProjectStage } from '../types';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { useBackgroundAction } from '../contexts/BackgroundActionContext';

interface ClientsPageProps {
  onClientClick: (client: Client) => void;
  onNavigateToLeads?: () => void;
}

export const ClientsPage: React.FC<ClientsPageProps> = ({ onClientClick, onNavigateToLeads }) => {
  const { clients, leads, prospects, createClient, deleteClient } = useWorkspace();
  const { runBackgroundAction } = useBackgroundAction();
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ 
    companyName: '', 
    mapUri: '', 
    note: '', 
    serviceType: 'Website & Perfil Google' 
  });
  const [contactNames, setContactNames] = useState<string[]>(['']);
  const [emails, setEmails] = useState<string[]>(['']);
  const [phones, setPhones] = useState<string[]>(['']);

  // Search and Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'alphabetical'>('recent');

  // Delete Confirmation State
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

  const handleAddEntity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName) return;

    const companyNameNorm = formData.companyName.toLowerCase().trim();
    const isDuplicate = 
      (leads || []).some(l => l.name && l.name.toLowerCase().trim() === companyNameNorm) ||
      (prospects || []).some(p => p.name && p.name.toLowerCase().trim() === companyNameNorm) ||
      (clients || []).some(c => c.name && c.name.toLowerCase().trim() === companyNameNorm);

    if (isDuplicate) {
      alert(`O negócio "${formData.companyName}" já está registado no CRM (Leads, Prospects ou Clientes) e não pode ser duplicado.`);
      return;
    }

    const newClientPayload = {
      name: formData.companyName,
      contactName: contactNames.filter(Boolean).join(', ') || 'Responsável',
      email: emails.filter(Boolean).join(', '),
      phone: phones.filter(Boolean).join(', '),
      serviceType: formData.serviceType || 'Website & Perfil Google',
      status: 'Cliente' as const,
      totalValue: 0,
      receivedAmount: 0,
      lastInteraction: new Date().toISOString(),
      mapUri: formData.mapUri || '',
      notes: formData.note ? [
        {
          id: Math.random().toString(36).substring(7),
          date: new Date().toLocaleDateString('pt-PT'),
          author: 'Sistema',
          content: formData.note
        }
      ] : []
    };

    setShowModal(false);
    setFormData({ companyName: '', mapUri: '', note: '', serviceType: 'Website & Perfil Google' });
    setContactNames(['']);
    setEmails(['']);
    setPhones(['']);

    runBackgroundAction({
      title: `A registar cliente "${newClientPayload.name}"...`,
      action: async () => {
        await createClient(newClientPayload);
      },
      errorMessage: `Erro ao registar o cliente "${newClientPayload.name}".`
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
        onClose={() => setShowModal(false)} 
        title="Registar Novo Cliente"
      >
        <form onSubmit={handleAddEntity} className="space-y-4">
          <Input 
            label="Nome da Empresa / Entidade" 
            placeholder="Ex: Velocity Studio" 
            value={formData.companyName}
            onChange={e => setFormData({ ...formData, companyName: e.target.value })}
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
              className="w-full bg-zinc-950/60 border border-white/10 focus:border-vela-red/40 focus:ring-0 rounded-xl py-3 px-4 text-xs text-white transition-all font-sans"
            >
              <option value="Website & Perfil Google" className="bg-zinc-950 text-white">Website & Perfil Google</option>
              <option value="Gestão de Redes Sociais" className="bg-zinc-950 text-white">Gestão de Redes Sociais</option>
              <option value="Tráfego Pago" className="bg-zinc-950 text-white">Tráfego Pago</option>
              <option value="Automações" className="bg-zinc-950 text-white">Automações</option>
              <option value="Aplicações" className="bg-zinc-950 text-white">Aplicações</option>
              <option value="Outros" className="bg-zinc-950 text-white">Outros</option>
            </select>
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
                      <span className="text-[11px] text-zinc-500 font-black uppercase tracking-[0.1em] font-sans">{client.serviceType}</span>
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
