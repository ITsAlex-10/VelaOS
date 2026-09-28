import React, { useState } from 'react';
import { GlassCard, Badge, Button, Modal, Input } from '../components/UI';
import { formatCurrency, cn } from '../lib/utils';
import { 
  UserCheck, 
  Search, 
  Filter, 
  Mail, 
  Plus, 
  CheckCircle2, 
  Loader2, 
  Phone,
  ArrowRight,
  TrendingUp,
  FileText,
  Clock,
  ExternalLink,
  ChevronRight,
  UserPlus,
  Trash2
} from 'lucide-react';
import { motion } from 'motion/react';
import { Client, ProjectStage } from '../types';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { StatusTransitionModal } from '../components/StatusTransitionModal';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { useBackgroundAction } from '../contexts/BackgroundActionContext';

interface LeadsPageProps {
  onLeadClick: (client: Client) => void;
  onNavigateToClients?: () => void;
  onNavigateToProspecting?: () => void;
}

export const LeadsPage: React.FC<LeadsPageProps> = ({ 
  onLeadClick, 
  onNavigateToClients,
  onNavigateToProspecting 
}) => {
  const { clients, createClient, updateClient, deleteClient } = useWorkspace();
  const { runBackgroundAction } = useBackgroundAction();
  const [showModal, setShowModal] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<Client | null>(null);
  const [formData, setFormData] = useState({ 
    contactName: '', 
    companyName: '', 
    email: '', 
    phone: '',
    serviceType: 'Website & Rebranding'
  });

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | 'Lead' | 'Pendente'>('all');

  // Transition Modal State
  const [transitionTarget, setTransitionTarget] = useState<{ client: Client, status: ProjectStage } | null>(null);

  // Filter only Leads & Pendentes
  const pipelineLeads = (clients || []).filter(c => c.status === 'Lead' || c.status === 'Pendente');

  const filteredLeads = pipelineLeads.filter(client => {
    const matchesSearch = 
      (client.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (client.contactName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.phone || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStage = stageFilter === 'all' || client.status === stageFilter;
    
    return matchesSearch && matchesStage;
  });

  const totalLeadsCount = (clients || []).filter(c => c.status === 'Lead').length;
  const totalPendentesCount = (clients || []).filter(c => c.status === 'Pendente').length;
  const totalConvertedCount = (clients || []).filter(c => c.status === 'Cliente' || c.status === 'Terminado').length;

  const handleAddLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.contactName || !formData.companyName) return;

    const newLeadPayload = {
      name: formData.companyName,
      contactName: formData.contactName,
      email: formData.email || '',
      phone: formData.phone || '',
      serviceType: formData.serviceType || 'Website & Rebranding',
      status: 'Lead' as const,
      totalValue: 0,
      receivedAmount: 0,
      lastInteraction: new Date().toISOString(),
      notes: [
        {
          id: Math.random().toString(36).substring(7),
          date: new Date().toLocaleDateString('pt-PT'),
          author: 'Alex Sosa',
          content: 'Lead registada manualmente no pipeline de oportunidades.'
        }
      ]
    };

    // 1. Close modal IMMEDIATELY upon clicking confirm
    setShowModal(false);
    setFormData({ contactName: '', companyName: '', email: '', phone: '', serviceType: 'Website & Rebranding' });

    // 2. Process action in background with subtle progress indicator
    runBackgroundAction({
      title: `A registar oportunidade "${newLeadPayload.name}"...`,
      action: async () => {
        await createClient(newLeadPayload);
      },
      errorMessage: `Erro ao registar a oportunidade "${newLeadPayload.name}".`
    });
  };

  return (
    <div className="space-y-10 py-10 px-4 max-w-7xl mx-auto pb-20">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-vela-red shadow-[0_0_10px_rgba(255,34,28,0.5)] animate-pulse" />
            <h2 className="text-4xl font-display font-bold tracking-tight text-white leading-none">
              Pipeline de Leads
            </h2>
          </div>
          <p className="text-xs text-zinc-400 font-sans max-w-xl leading-relaxed">
            Central de prospeção, qualificação e propostas pendentes. Quando uma oportunidade é convertida em 
            <strong className="text-emerald-400"> Cliente</strong> ou <strong className="text-red-500">Terminado</strong>, é transferida automaticamente para a página de 
            <strong className="text-emerald-400"> Clientes</strong> mantendo todo o histórico intacto.
          </p>
          
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <div className="relative flex-1 min-w-[260px] max-w-sm">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
              <input 
                type="text"
                placeholder="Filtrar por lead, empresa, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-xs text-white focus:outline-none focus:border-vela-red/50 transition-all placeholder:text-zinc-700 font-sans"
              />
            </div>

            <div className="flex items-center gap-1 bg-white/[0.02] p-1 rounded-2xl border border-white/5">
              <button
                type="button"
                onClick={() => setStageFilter('all')}
                className={cn(
                  "px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  stageFilter === 'all' ? "bg-white/10 text-white" : "text-zinc-500 hover:text-white"
                )}
              >
                Todas ({pipelineLeads.length})
              </button>
              <button
                type="button"
                onClick={() => setStageFilter('Lead')}
                className={cn(
                  "px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  stageFilter === 'Lead' ? "bg-orange-500/20 text-orange-300 border border-orange-500/30" : "text-zinc-500 hover:text-white"
                )}
              >
                Leads ({totalLeadsCount})
              </button>
              <button
                type="button"
                onClick={() => setStageFilter('Pendente')}
                className={cn(
                  "px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  stageFilter === 'Pendente' ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30" : "text-zinc-500 hover:text-white"
                )}
              >
                Pendentes ({totalPendentesCount})
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {onNavigateToProspecting && (
            <Button 
              variant="secondary"
              className="flex items-center gap-2 text-xs font-display font-black uppercase tracking-wider py-3"
              onClick={onNavigateToProspecting}
            >
              <ExternalLink size={15} /> Prospeção Maps
            </Button>
          )}

          <Button 
            className="flex items-center gap-2 shadow-2xl shadow-vela-red/20 min-w-[170px] justify-center text-xs font-display font-black uppercase tracking-wider py-3 bg-vela-red hover:bg-vela-red/90 text-white" 
            onClick={() => setShowModal(true)}
          >
            <UserPlus size={16} strokeWidth={2.5} /> Nova Lead
          </Button>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard className="py-6 px-7 border-white/5 relative overflow-hidden group">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-black mb-2 font-sans">Leads em Qualificação</p>
          <div className="flex items-baseline justify-between">
            <p className="text-3xl font-display font-black text-orange-400 italic">{totalLeadsCount}</p>
            <Badge variant="orange" className="text-[9px]">Pipeline Inicial</Badge>
          </div>
        </GlassCard>

        <GlassCard className="py-6 px-7 border-white/5 relative overflow-hidden group">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-black mb-2 font-sans">Propostas Pendentes</p>
          <div className="flex items-baseline justify-between">
            <p className="text-3xl font-display font-black text-yellow-400 italic">{totalPendentesCount}</p>
            <Badge variant="yellow" className="text-[9px]">Aguardam Aceitação</Badge>
          </div>
        </GlassCard>

        <GlassCard className="py-6 px-7 border-white/5 relative overflow-hidden group">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-black mb-2 font-sans">Volume Potencial em Jogo</p>
          <p className="text-3xl font-display font-black text-white italic">
            {formatCurrency(pipelineLeads.reduce((acc, c) => acc + (c.totalValue || c.proposal?.value || 0), 0))}
          </p>
        </GlassCard>

        <GlassCard className="py-6 px-7 border-white/5 relative overflow-hidden group cursor-pointer" onClick={onNavigateToClients}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-black font-sans">Convertidos p/ Clientes</p>
            <ChevronRight size={14} className="text-zinc-500 group-hover:text-emerald-400 transition-colors" />
          </div>
          <div className="flex items-baseline justify-between">
            <p className="text-3xl font-display font-black text-emerald-400 italic">{totalConvertedCount}</p>
            <span className="text-[10px] text-zinc-400 font-sans group-hover:text-white transition-colors">Ver Clientes →</span>
          </div>
        </GlassCard>
      </div>

      {/* Leads Table */}
      <GlassCard className="p-0 overflow-hidden border-white/5 bg-white/[0.01]">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/8 bg-white/[0.02]">
                <th className="px-7 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 font-sans">Empresa / Lead</th>
                <th className="px-7 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 font-sans">Contacto Direto</th>
                <th className="px-7 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 font-sans">Fase do Funil</th>
                <th className="px-7 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 font-sans">Proposta / Valor</th>
                <th className="px-7 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 font-sans text-right">Ação de Avanço</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredLeads.length > 0 ? (
                filteredLeads.map((client) => {
                  const isLead = client.status === 'Lead';
                  const isPendente = client.status === 'Pendente';

                  return (
                    <tr 
                      key={client.id} 
                      className="group hover:bg-white/[0.03] transition-all cursor-pointer"
                      onClick={() => onLeadClick(client)}
                    >
                      {/* Empresa */}
                      <td className="px-7 py-5">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-11 h-11 rounded-xl glass border-white/10 flex items-center justify-center text-xs font-bold text-white transition-all shadow-lg font-display",
                            isLead ? "group-hover:border-orange-500/40 text-orange-300" : "group-hover:border-yellow-400/40 text-yellow-300"
                          )}>
                            {client.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-white mb-0.5 font-display group-hover:text-orange-400 transition-colors">
                              {client.name}
                            </h4>
                            <p className="text-[10px] text-zinc-500 font-medium font-sans">
                              {client.serviceType || 'Website & Rebranding'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Contacto */}
                      <td className="px-7 py-5">
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-zinc-200 font-sans">
                            {client.contactName || 'Responsável'}
                          </p>
                          <div className="flex items-center gap-3 text-[11px] text-zinc-500 font-sans">
                            {client.email ? (
                              <span className="truncate max-w-[180px]" title={client.email}>{client.email}</span>
                            ) : null}
                            {client.phone ? (
                              <span>• {client.phone}</span>
                            ) : null}
                            {!client.email && !client.phone && (
                              <span className="text-zinc-600 italic">Sem contactos diretos</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Estado Dropdown */}
                      <td className="px-7 py-5">
                        <select
                          value={client.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const newStatus = e.target.value as ProjectStage;
                            if (newStatus === 'Pendente' && client.status === 'Lead') {
                              setTransitionTarget({ client, status: 'Pendente' });
                            } else if (newStatus === 'Cliente') {
                              setTransitionTarget({ client, status: 'Cliente' });
                            } else if (newStatus === 'Terminado') {
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
                            "appearance-none bg-white/5 border rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-white/10 transition-all outline-none",
                            client.status === 'Pendente' 
                              ? "text-yellow-400 border-yellow-400/40 bg-yellow-500/5" 
                              : "text-orange-500 border-orange-500/40 bg-orange-500/5"
                          )}
                        >
                          <option value="Lead" className="bg-zinc-900 text-orange-400">Lead</option>
                          <option value="Pendente" className="bg-zinc-900 text-yellow-400">Pendente (Proposta Enviada)</option>
                          <option value="Cliente" className="bg-zinc-900 text-emerald-400">→ Promover a Cliente</option>
                          <option value="Terminado" className="bg-zinc-900 text-red-500">→ Marcar como Terminado</option>
                        </select>
                      </td>

                      {/* Proposta / Valor */}
                      <td className="px-7 py-5">
                        {client.status === 'Pendente' ? (
                          <div className="space-y-1">
                            <span className="text-xs font-bold text-white font-sans">
                              {formatCurrency(client.totalValue || client.proposal?.value || 0)}
                            </span>
                            <p className="text-[10px] text-blue-400/80 font-mono">
                              {client.proposal ? 'Proposta Gerada' : 'Em Negociação'}
                            </p>
                          </div>
                        ) : (
                          <span className="text-[11px] text-zinc-500 italic font-sans">
                            A definir em proposta
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="px-7 py-5 text-right">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          {client.status === 'Lead' ? (
                            <Button
                              variant="secondary"
                              onClick={() => setTransitionTarget({ client, status: 'Pendente' })}
                              className="text-[10px] font-black uppercase tracking-wider py-1.5 px-3 flex items-center gap-1.5 border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/10"
                              title="Enviar Proposta Comercial e passar a Pendente"
                            >
                              <span>Apresentar Proposta</span>
                              <ArrowRight size={12} />
                            </Button>
                          ) : (
                            <Button
                              variant="primary"
                              onClick={() => setTransitionTarget({ client, status: 'Cliente' })}
                              className="text-[10px] font-black uppercase tracking-wider py-1.5 px-3 flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-display italic"
                              title="Cliente aceitou proposta: adjudicar 50% e passar a Cliente"
                            >
                              <CheckCircle2 size={13} />
                              <span>Converter em Cliente</span>
                            </Button>
                          )}

                          {client.email && (
                            <button 
                              className="p-2.5 rounded-xl bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-all" 
                              title="Enviar Email"
                              onClick={() => { window.location.href = `mailto:${client.email}`; }}
                            >
                              <Mail size={14} />
                            </button>
                          )}

                          <button 
                            className="p-2.5 rounded-xl bg-white/5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all" 
                            title="Eliminar Lead"
                            onClick={() => setLeadToDelete(client)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-8 py-16 text-center text-zinc-500 font-sans">
                    <div className="max-w-xs mx-auto space-y-3">
                      <p className="text-sm font-bold text-white">Nenhuma lead encontrada no filtro selecionado</p>
                      <p className="text-xs text-zinc-500">
                        Pode pesquisar empresas diretamente na secção de <strong>Prospeção Google Maps</strong> ou registar uma oportunidade manual.
                      </p>
                      {onNavigateToProspecting && (
                        <Button
                          variant="secondary"
                          onClick={onNavigateToProspecting}
                          className="mt-3 text-xs font-black uppercase tracking-wider"
                        >
                          Ir para Prospeção
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Delete Confirmation Modal */}
      {leadToDelete && (
        <ConfirmDeleteModal
          isOpen={!!leadToDelete}
          onClose={() => setLeadToDelete(null)}
          itemName={leadToDelete.name}
          itemType={leadToDelete.status === 'Pendente' ? 'Proposta Pendente' : 'Lead'}
          subtitle={leadToDelete.contactName ? `Contacto: ${leadToDelete.contactName}` : (leadToDelete.email ? `Email: ${leadToDelete.email}` : undefined)}
          warningNote={`Tem a certeza de que deseja eliminar a oportunidade "${leadToDelete.name}"? Todos os registos associados a este lead serão removidos permanentemente.`}
          onConfirm={async () => {
            await deleteClient(leadToDelete.id);
          }}
        />
      )}

      {/* Transition Modal (Seamless conversion preserving all steps and calculations) */}
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

      {/* Add Lead Modal */}
      <Modal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
        title="Registar Nova Lead / Oportunidade"
      >
        <form onSubmit={handleAddLead} className="space-y-4">
          <Input 
            label="Nome da Empresa / Negócio" 
            placeholder="Ex: Pastelaria Moderna de Lisboa" 
            value={formData.companyName}
            onChange={e => setFormData({ ...formData, companyName: e.target.value })}
            required
          />
          <Input 
            label="Nome do Contacto / Decisor" 
            placeholder="Ex: João Pereira" 
            value={formData.contactName}
            onChange={e => setFormData({ ...formData, contactName: e.target.value })}
            required
          />
          <Input 
            label="Email de Contacto" 
            type="email"
            placeholder="contacto@empresa.pt" 
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
          />
          <Input 
            label="Telefone / WhatsApp" 
            type="tel"
            placeholder="+351 912 345 678" 
            value={formData.phone}
            onChange={e => setFormData({ ...formData, phone: e.target.value })}
          />
          <Input 
            label="Serviço Alvo" 
            placeholder="Ex: Website & Branding, Rebranding, Agendamento Online" 
            value={formData.serviceType}
            onChange={e => setFormData({ ...formData, serviceType: e.target.value })}
          />

          <Button 
            type="submit" 
            className="w-full py-4 mt-4 transition-all bg-vela-red hover:bg-vela-red/90 text-white shadow-xl shadow-vela-red/20 font-display font-black uppercase italic tracking-wider"
          >
            Guardar no Pipeline
          </Button>
        </form>
      </Modal>
    </div>
  );
};
