import React, { useState } from 'react';
import { GlassCard, Badge, Button, Modal, Input } from '../components/UI';
import { formatCurrency, cn } from '../lib/utils';
import { 
  Users, 
  Search, 
  Filter, 
  Mail, 
  Trash2,
  MoreHorizontal, 
  ExternalLink,
  Plus,
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  Euro
} from 'lucide-react';
import { motion } from 'motion/react';
import { Client, ProjectStage } from '../types';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { StatusTransitionModal } from '../components/StatusTransitionModal';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { useBackgroundAction } from '../contexts/BackgroundActionContext';

interface ClientsPageProps {
  onClientClick: (client: Client) => void;
  onNavigateToLeads?: () => void;
}

export const ClientsPage: React.FC<ClientsPageProps> = ({ onClientClick, onNavigateToLeads }) => {
  const { createClientProject, clients, createClient, deleteClient, updateClient } = useWorkspace();
  const { runBackgroundAction } = useBackgroundAction();
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ contactName: '', companyName: '', email: '', phone: '' });

  // Search and Filter State: Default to showing all clients
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Transition Modal State
  const [transitionTarget, setTransitionTarget] = useState<{ client: Client, status: ProjectStage } | null>(null);

  // Delete Confirmation State
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

  const handleAddEntity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.contactName || !formData.companyName || !formData.email) return;

    const newClientPayload = {
      name: formData.companyName,
      email: formData.email,
      phone: formData.phone,
      contactName: formData.contactName, 
      serviceType: 'Design & Dev',
      status: 'Cliente' as const,
      totalValue: 0,
      receivedAmount: 0,
      lastInteraction: new Date().toISOString()
    };

    // 1. Close modal IMMEDIATELY upon clicking confirm
    setShowModal(false);
    setFormData({ contactName: '', companyName: '', email: '', phone: '' });

    // 2. Process action in background with subtle progress indicator
    runBackgroundAction({
      title: `A registar cliente "${newClientPayload.name}"...`,
      action: async () => {
        await createClient(newClientPayload);
      },
      errorMessage: `Erro ao registar o cliente "${newClientPayload.name}".`
    });
  };

  const filteredClients = (clients || []).filter(client => {
    const matchesSearch = 
      (client.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (client.contactName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.email || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesStatus = true;
    if (statusFilter === 'converted') {
      matchesStatus = client.status === 'Cliente' || client.status === 'Terminado';
    } else if (statusFilter !== 'all') {
      matchesStatus = client.status === statusFilter;
    }
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-12 py-10 px-4">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-3">
          <h2 className="text-4xl font-display font-bold tracking-tight text-white mb-2 leading-none">Diretório</h2>
          <div className="flex items-center gap-4 mt-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
              <input 
                type="text"
                placeholder="Pesquisar por nome, contacto ou email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-vela-red transition-all placeholder:text-zinc-700 font-sans"
              />
            </div>
            <div className="flex items-center gap-1 bg-white/[0.02] p-1 rounded-2xl border border-white/5 overflow-x-auto max-w-full scrollbar-none">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={cn(
                  "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0",
                  statusFilter === 'all' ? "bg-white/10 text-white" : "text-zinc-500 hover:text-white"
                )}
              >
                Todos ({clients.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('Cliente')}
                className={cn(
                  "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0",
                  statusFilter === 'Cliente' ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "text-zinc-500 hover:text-white"
                )}
              >
                Ativos ({clients.filter(c => c.status === 'Cliente').length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('Terminado')}
                className={cn(
                  "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0",
                  statusFilter === 'Terminado' ? "bg-red-500/20 text-red-300 border border-red-500/30" : "text-zinc-500 hover:text-white"
                )}
              >
                Terminados ({clients.filter(c => c.status === 'Terminado').length})
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 pt-4 md:pt-0">
          {onNavigateToLeads && (
            <Button 
              variant="secondary"
              className="flex items-center gap-2 text-xs font-display font-black uppercase tracking-wider py-3"
              onClick={onNavigateToLeads}
            >
              <span>Ver Pipeline de Leads</span>
            </Button>
          )}
          <Button 
            className="flex items-center gap-3 shadow-2xl shadow-vela-red/20 min-w-[180px] justify-center" 
            onClick={() => setShowModal(true)}
          >
            <Plus size={18} strokeWidth={2.5} stroke="currentColor" /> Novo Cliente
          </Button>
        </div>
      </header>

      {transitionTarget && (
        <StatusTransitionModal
          isOpen={!!transitionTarget}
          onClose={() => setTransitionTarget(null)}
          client={transitionTarget.client}
          targetStatus={transitionTarget.status}
          onConfirm={async (data) => {
            await updateClient(transitionTarget.client.id, data);
          }}
        />
      )}

      {clientToDelete && (
        <ConfirmDeleteModal
          isOpen={!!clientToDelete}
          onClose={() => setClientToDelete(null)}
          itemName={clientToDelete.name}
          itemType={clientToDelete.status === 'Lead' ? 'Lead' : 'Cliente'}
          subtitle={clientToDelete.contactName ? `Contacto: ${clientToDelete.contactName}` : (clientToDelete.email ? `Email: ${clientToDelete.email}` : undefined)}
          onConfirm={async () => {
            await deleteClient(clientToDelete.id);
          }}
        />
      )}

      <Modal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
        title="Registar Nova Entidade"
      >
        <form onSubmit={handleAddEntity} className="space-y-4">
          <Input 
            label="Nome do Cliente" 
            placeholder="Ex: João Silva" 
            value={formData.contactName}
            onChange={e => setFormData({ ...formData, contactName: e.target.value })}
            required
          />
          <Input 
            label="Nome da Empresa / Entidade" 
            placeholder="Ex: Velocity Studio" 
            value={formData.companyName}
            onChange={e => setFormData({ ...formData, companyName: e.target.value })}
            required
          />
          <Input 
            label="Email de Contacto" 
            type="email"
            placeholder="cliente@exemplo.com" 
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
            required
          />
          <Input 
            label="Número de Telefone" 
            type="tel"
            placeholder="+351 912 345 678" 
            value={formData.phone}
            onChange={e => setFormData({ ...formData, phone: e.target.value })}
          />
          <Button 
            type="submit" 
            className="w-full py-4 mt-4 transition-all"
          >
            Confirmar Registo
          </Button>
        </form>
      </Modal>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total de Entidades', value: clients.length.toString(), color: 'text-white' },
          { label: 'Operações Ativas', value: clients.filter(c => c.status === 'Cliente').length.toString(), color: 'text-emerald-500' },
          { label: 'Leads Recebidas', value: clients.filter(c => c.status === 'Lead' || c.status === 'Pendente').length.toString(), color: 'text-orange-500' },
          { label: 'Ativos Retidos', value: clients.filter(c => c.status === 'Terminado').length.toString(), color: 'text-red-500' },
        ].map((stat, i) => (
          <GlassCard key={i} className="py-6 px-8 border-white/5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/1 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-500" />
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 font-black mb-3 font-sans">{stat.label}</p>
            <p className={cn('text-3xl font-display font-bold', stat.color)}>{stat.value}</p>
          </GlassCard>
        ))}
      </div>

      {/* Clients Table Layout */}
      <GlassCard className="p-0 overflow-hidden border-white/5 bg-white/[0.01]">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/8 bg-white/[0.02]">
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 font-sans">Nome da Entidade</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 font-sans">Ciclo de Estado</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 font-sans">Domínio do Serviço</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 font-sans">Liquidez</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 font-sans text-right">Ops</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredClients.length > 0 ? filteredClients.map((client) => (
                <tr 
                  key={client.id} 
                  className="group hover:bg-white/[0.04] transition-all cursor-pointer"
                  onClick={() => onClientClick(client)}
                >
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl glass border-white/8 flex items-center justify-center text-sm font-bold text-white group-hover:border-vela-red/30 transition-all shadow-2xl shadow-black/40 font-display">
                        {client.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[#fafafa] mb-1 font-display group-hover:text-vela-red transition-colors">{client.name}</h4>
                        <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest font-sans">{client.contactName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <select
                      value={client.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const newStatus = e.target.value as ProjectStage;
                        // Special handling for the required transitions
                        if (newStatus === 'Pendente' && client.status === 'Lead') {
                          setTransitionTarget({ client, status: 'Pendente' });
                        } else if (newStatus === 'Cliente' && client.status === 'Pendente') {
                          setTransitionTarget({ client, status: 'Cliente' });
                        } else if (newStatus === 'Terminado' && client.status === 'Cliente') {
                          setTransitionTarget({ client, status: 'Terminado' });
                        } else {
                          runBackgroundAction({
                            title: `A alterar estado de "${client.name}" para ${newStatus}...`,
                            action: () => updateClient(client.id, { status: newStatus }),
                            errorMessage: `Erro ao alterar estado de "${client.name}".`
                          });
                        }
                      }}
                      className={cn(
                        "appearance-none bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-white/10 transition-all outline-none",
                        client.status === 'Terminado' ? "text-red-500 border-red-500/30 bg-red-500/5" : 
                        client.status === 'Cliente' ? "text-emerald-400 border-emerald-400/30 bg-emerald-500/5" : 
                        client.status === 'Pendente' ? "text-yellow-400 border-yellow-400/30 bg-yellow-400/5" : 
                        "text-orange-500 border-orange-500/30 bg-orange-500/5"
                      )}
                    >
                      <option value="Lead" className="bg-zinc-900 text-orange-400">Lead</option>
                      <option value="Pendente" className="bg-zinc-900 text-yellow-400">Pendente</option>
                      <option value="Cliente" className="bg-zinc-900 text-emerald-400">Cliente</option>
                      <option value="Terminado" className="bg-zinc-900 text-red-500">Terminado</option>
                    </select>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-[11px] text-zinc-500 font-black uppercase tracking-[0.1em] font-sans">{client.serviceType}</span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="space-y-2.5">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[12px] text-white font-bold font-sans">{formatCurrency(client.receivedAmount)}</span>
                        <span className="text-[9px] text-zinc-700 font-black font-sans">/ {formatCurrency(client.totalValue)}</span>
                      </div>
                      <div className="h-1 w-32 bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${client.totalValue > 0 ? (client.receivedAmount / client.totalValue) * 100 : 0}%` }}
                          className="h-full bg-vela-red" 
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center justify-end gap-2 text-[10px]">
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
              )) : (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center opacity-30">
                    <Users size={48} strokeWidth={1} className="mx-auto mb-4" />
                    <p className="text-[10px] uppercase font-black tracking-widest">Nenhuma entidade registada</p>
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
