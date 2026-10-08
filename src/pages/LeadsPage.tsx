import React, { useState } from 'react';
import { GlassCard, Badge, Button, Modal, Input } from '../components/UI';
import { cn } from '../lib/utils';
import { 
  Search, 
  Phone, 
  PhoneOff,
  Clock, 
  XCircle,
  Plus, 
  Loader2, 
  Trash2,
  ExternalLink,
  Target,
  PlusCircle,
  MapPin,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useBackgroundAction } from '../contexts/BackgroundActionContext';

interface LeadsPageProps {
  onLeadClick: (lead: any) => void;
  onNavigateToClients?: () => void;
  onNavigateToProspecting?: () => void;
}

export const LeadsPage: React.FC<LeadsPageProps> = ({ 
  onLeadClick, 
  onNavigateToClients,
  onNavigateToProspecting 
}) => {
  const { leads, prospects, clients, createLead, updateLead, deleteLead, moveLeadToProspects } = useWorkspace();
  const { runBackgroundAction } = useBackgroundAction();
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // 4 big interactive card filters
  const [activeFilter, setActiveFilter] = useState<'Por contactar' | 'Não atendeu' | 'Ligar mais tarde' | 'Não interessado'>('Por contactar');

  const [formData, setFormData] = useState({ 
    contactName: '', 
    companyName: '', 
    email: '', 
    phone: '',
    serviceType: 'Website & Rebranding'
  });

  // Count leads for each status
  const getCount = (status: string) => (leads || []).filter(l => l.status === status).length;

  const filteredLeads = (leads || []).filter(l => {
    const matchesFilter = l.status === activeFilter;
    const matchesSearch = !searchQuery ? true : (
      (l.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.contactName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.phone || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
    return matchesFilter && matchesSearch;
  });

  const handleAddManualLead = async (e: React.FormEvent) => {
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

    const payload = {
      name: formData.companyName,
      contactName: formData.contactName || 'Responsável',
      email: formData.email || '',
      phone: formData.phone || '',
      serviceType: formData.serviceType || 'Website & Rebranding',
      status: 'Por contactar',
      lastInteraction: new Date().toISOString(),
      notes: [
        {
          id: Math.random().toString(36).substring(7),
          date: new Date().toLocaleDateString('pt-PT'),
          author: 'Alex Sosa',
          content: 'Lead registada manualmente na central de Leads.'
        }
      ]
    };

    setShowModal(false);
    setFormData({ contactName: '', companyName: '', email: '', phone: '', serviceType: 'Website & Rebranding' });

    runBackgroundAction({
      title: `A registar lead "${payload.name}"...`,
      action: async () => {
        await createLead(payload);
      },
      errorMessage: 'Erro ao registar lead manualmente.'
    });
  };

  const handleMoveStatus = (leadId: string, newStatus: string) => {
    runBackgroundAction({
      title: `A mover para "${newStatus}"...`,
      action: async () => {
        await updateLead(leadId, { status: newStatus, lastInteraction: new Date().toISOString() });
      },
      errorMessage: 'Erro ao atualizar estado da lead.'
    });
  };

  const handleDelete = (leadId: string, leadName: string) => {
    if (!confirm(`Tem a certeza que deseja eliminar permanentemente a lead "${leadName}"?`)) return;
    runBackgroundAction({
      title: `A eliminar lead "${leadName}"...`,
      action: async () => {
        await deleteLead(leadId);
      },
      errorMessage: 'Erro ao eliminar a lead.'
    });
  };

  const handleMoveToProspects = (leadId: string, leadName: string) => {
    runBackgroundAction({
      title: `A mover "${leadName}" para Prospects...`,
      action: async () => {
        await moveLeadToProspects(leadId);
      },
      errorMessage: 'Erro ao qualificar lead para Prospects.'
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
            Central de leads angariadas para contacto comercial. Mova as leads entre os filtros ou qualifique-as como <strong className="text-vela-red">Prospect</strong> caso tenham demonstrado interesse numa reunião.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {onNavigateToProspecting && (
            <Button 
              variant="secondary"
              className="flex items-center gap-2 text-xs font-display font-black uppercase tracking-wider py-3 border-white/5 hover:border-white/20"
              onClick={onNavigateToProspecting}
            >
              <PlusCircle size={15} className="text-vela-red" /> Nova Prospeção
            </Button>
          )}

          <Button 
            className="flex items-center gap-2 shadow-2xl shadow-vela-red/20 min-w-[170px] justify-center text-xs font-display font-black uppercase tracking-wider py-3 bg-vela-red hover:bg-vela-red/90 text-white" 
            onClick={() => setShowModal(true)}
          >
            <Plus size={16} strokeWidth={2.5} /> Nova Lead Manual
          </Button>
        </div>
      </header>

      {/* 4 Big Filter Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Por Contactar */}
        <button
          type="button"
          onClick={() => setActiveFilter('Por contactar')}
          className="w-full text-left focus:outline-none"
        >
          <GlassCard className={cn(
            "p-6 border transition-all duration-300 relative overflow-hidden group h-32 flex flex-col justify-between",
            activeFilter === 'Por contactar' 
              ? "border-amber-500/30 bg-amber-500/[0.03] shadow-lg shadow-amber-500/5 scale-[1.02]" 
              : "border-white/5 bg-white/[0.01] hover:border-white/10 hover:bg-white/[0.02]"
          )}>
            <div className="flex items-center justify-between">
              <span className={cn(
                "p-2 rounded-xl transition-colors",
                activeFilter === 'Por contactar' ? "bg-amber-500/10 text-amber-400" : "bg-white/5 text-zinc-500"
              )}>
                <Phone size={18} />
              </span>
              <Badge variant={activeFilter === 'Por contactar' ? "warning" : "secondary"}>Entrada</Badge>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-black font-sans">Por Contactar</p>
              <p className={cn(
                "text-2xl font-display font-black italic mt-0.5",
                activeFilter === 'Por contactar' ? "text-amber-400" : "text-white"
              )}>
                {getCount('Por contactar')} <span className="text-xs font-sans font-normal text-zinc-600">leads</span>
              </p>
            </div>
          </GlassCard>
        </button>

        {/* 2. Não Atendeu */}
        <button
          type="button"
          onClick={() => setActiveFilter('Não atendeu')}
          className="w-full text-left focus:outline-none"
        >
          <GlassCard className={cn(
            "p-6 border transition-all duration-300 relative overflow-hidden group h-32 flex flex-col justify-between",
            activeFilter === 'Não atendeu' 
              ? "border-red-500/30 bg-red-500/[0.03] shadow-lg shadow-red-500/5 scale-[1.02]" 
              : "border-white/5 bg-white/[0.01] hover:border-white/10 hover:bg-white/[0.02]"
          )}>
            <div className="flex items-center justify-between">
              <span className={cn(
                "p-2 rounded-xl transition-colors",
                activeFilter === 'Não atendeu' ? "bg-red-500/10 text-red-400" : "bg-white/5 text-zinc-500"
              )}>
                <PhoneOff size={18} />
              </span>
              <Badge variant={activeFilter === 'Não atendeu' ? "danger" : "secondary"}>Pendente</Badge>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-black font-sans">Não Atendeu</p>
              <p className={cn(
                "text-2xl font-display font-black italic mt-0.5",
                activeFilter === 'Não atendeu' ? "text-red-400" : "text-white"
              )}>
                {getCount('Não atendeu')} <span className="text-xs font-sans font-normal text-zinc-600">leads</span>
              </p>
            </div>
          </GlassCard>
        </button>

        {/* 3. Ligar mais tarde */}
        <button
          type="button"
          onClick={() => setActiveFilter('Ligar mais tarde')}
          className="w-full text-left focus:outline-none"
        >
          <GlassCard className={cn(
            "p-6 border transition-all duration-300 relative overflow-hidden group h-32 flex flex-col justify-between",
            activeFilter === 'Ligar mais tarde' 
              ? "border-sky-500/30 bg-sky-500/[0.03] shadow-lg shadow-sky-500/5 scale-[1.02]" 
              : "border-white/5 bg-white/[0.01] hover:border-white/10 hover:bg-white/[0.02]"
          )}>
            <div className="flex items-center justify-between">
              <span className={cn(
                "p-2 rounded-xl transition-colors",
                activeFilter === 'Ligar mais tarde' ? "bg-sky-500/10 text-sky-400" : "bg-white/5 text-zinc-500"
              )}>
                <Clock size={18} />
              </span>
              <Badge variant={activeFilter === 'Ligar mais tarde' ? "blue" : "secondary"}>Agendado</Badge>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-black font-sans">Ligar Mais Tarde</p>
              <p className={cn(
                "text-2xl font-display font-black italic mt-0.5",
                activeFilter === 'Ligar mais tarde' ? "text-sky-400" : "text-white"
              )}>
                {getCount('Ligar mais tarde')} <span className="text-xs font-sans font-normal text-zinc-600">leads</span>
              </p>
            </div>
          </GlassCard>
        </button>

        {/* 4. Não interessado */}
        <button
          type="button"
          onClick={() => setActiveFilter('Não interessado')}
          className="w-full text-left focus:outline-none"
        >
          <GlassCard className={cn(
            "p-6 border transition-all duration-300 relative overflow-hidden group h-32 flex flex-col justify-between",
            activeFilter === 'Não interessado' 
              ? "border-zinc-500/30 bg-zinc-500/[0.03] shadow-lg shadow-zinc-500/5 scale-[1.02]" 
              : "border-white/5 bg-white/[0.01] hover:border-white/10 hover:bg-white/[0.02]"
          )}>
            <div className="flex items-center justify-between">
              <span className={cn(
                "p-2 rounded-xl transition-colors",
                activeFilter === 'Não interessado' ? "bg-zinc-500/20 text-zinc-400" : "bg-white/5 text-zinc-600"
              )}>
                <XCircle size={18} />
              </span>
              <Badge variant="secondary">Arquivado</Badge>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-black font-sans">Não Interessado</p>
              <p className={cn(
                "text-2xl font-display font-black italic mt-0.5",
                activeFilter === 'Não interessado' ? "text-zinc-400" : "text-white"
              )}>
                {getCount('Não interessado')} <span className="text-xs font-sans font-normal text-zinc-600">leads</span>
              </p>
            </div>
          </GlassCard>
        </button>
      </div>

      {/* Search and List Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/5">
        <h3 className="text-md font-display font-black text-white italic uppercase tracking-wider flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-vela-red" />
          Lista de Leads - {activeFilter} ({filteredLeads.length})
        </h3>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
          <input 
            type="text"
            placeholder="Procurar nesta secção..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/[0.02] border border-white/5 rounded-xl py-2 pl-10 pr-4 text-xs text-white focus:outline-none focus:border-white/20 transition-all placeholder:text-zinc-700 font-sans"
          />
        </div>
      </div>

      {/* Leads Grid */}
      {filteredLeads.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredLeads.map((lead) => (
            <GlassCard key={lead.id} className="p-6 border-white/5 bg-white/[0.01] hover:border-white/10 transition-all flex flex-col justify-between space-y-6 group relative">
              
              {/* Header Info */}
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-[0.15em] text-vela-red bg-vela-red/5 px-2 py-0.5 rounded border border-vela-red/10">
                      {lead.serviceType || 'Website & Rebranding'}
                    </span>
                    <h4 className="text-lg font-display font-black text-white italic uppercase mt-2 group-hover:text-vela-red transition-colors">
                      {lead.name}
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(lead.id, lead.name)}
                    className="text-zinc-600 hover:text-red-400 p-2 rounded-lg hover:bg-white/[0.03] transition-colors"
                    title="Eliminar Lead"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="space-y-2 text-xs text-zinc-400 font-sans">
                  {lead.address && (
                    <div className="flex items-start gap-2">
                      <MapPin size={12} className="text-zinc-600 shrink-0 mt-0.5" />
                      <span>{lead.address}</span>
                    </div>
                  )}
                  {lead.contactName && (
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-600 font-bold uppercase text-[9px] tracking-wider">Contacto:</span>
                      <span className="text-zinc-300">{lead.contactName}</span>
                    </div>
                  )}
                  {lead.email && (
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-600 font-bold uppercase text-[9px] tracking-wider">Email:</span>
                      <span className="text-zinc-300">{lead.email}</span>
                    </div>
                  )}
                  {lead.phone && lead.phone !== 'Não listado' && (
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-600 font-bold uppercase text-[9px] tracking-wider">Tlf:</span>
                      <a href={`tel:${lead.phone}`} className="text-zinc-300 hover:text-white hover:underline flex items-center gap-1">
                        {lead.phone}
                        <Phone size={10} className="text-emerald-400" />
                      </a>
                    </div>
                  )}
                </div>

                {lead.opportunity && (
                  <div className="bg-white/[0.02] p-3.5 rounded-xl border border-white/5 space-y-1">
                    <span className="text-[8px] font-black uppercase tracking-wider text-amber-500/70 flex items-center gap-1">
                      <Sparkles size={10} />
                      Diagnóstico de Oportunidade
                    </span>
                    <p className="text-[11px] text-zinc-400 leading-relaxed italic">
                      "{lead.opportunity}"
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons Row */}
              <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                {/* Change Status select */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-[9px] font-black uppercase tracking-wider text-zinc-500 font-sans">Mover:</span>
                  <select
                    value={lead.status}
                    onChange={(e) => handleMoveStatus(lead.id, e.target.value)}
                    className="bg-zinc-950/60 border border-white/5 focus:border-white/20 focus:ring-0 rounded-xl py-1.5 px-3 text-[10px] text-zinc-400 font-black uppercase tracking-wider transition-all"
                  >
                    <option value="Por contactar">Por Contactar</option>
                    <option value="Não atendeu">Não Atendeu</option>
                    <option value="Ligar mais tarde">Ligar mais tarde</option>
                    <option value="Não interessado">Não interessado</option>
                  </select>
                </div>

                {/* Qualify / Move to Prospect Button */}
                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                  {lead.mapUri && (
                    <a
                      href={lead.mapUri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 text-zinc-400 hover:text-white transition-all flex items-center justify-center"
                      title="Ver no Google Maps"
                    >
                      <ExternalLink size={13} />
                    </a>
                  )}
                  <Button
                    onClick={() => handleMoveToProspects(lead.id, lead.name)}
                    className="text-[9px] font-black uppercase tracking-[0.15em] bg-vela-red hover:bg-vela-red/90 text-white px-4 py-2 rounded-xl flex items-center gap-1.5 w-full sm:w-auto justify-center shadow-lg shadow-vela-red/10 hover:shadow-vela-red/20 transition-all duration-300"
                  >
                    <Target size={12} />
                    <span>Qualificar p/ Prospect</span>
                  </Button>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      ) : (
        <div className="py-20 flex flex-col items-center justify-center text-center space-y-4 border border-dashed border-white/5 rounded-3xl bg-white/[0.01]">
          <div className="w-12 h-12 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center text-zinc-600">
            <Search size={20} />
          </div>
          <div className="max-w-xs space-y-1">
            <h4 className="text-sm font-display font-black text-white uppercase italic tracking-tight">Sem Leads Aqui</h4>
            <p className="text-xs text-zinc-500 leading-normal">
              Nenhuma lead com o estado "{activeFilter}" encontrada nesta secção.
            </p>
          </div>
        </div>
      )}

      {/* Add Manual Lead Modal */}
      <Modal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
        title="Adicionar Lead Manual"
      >
        <form onSubmit={handleAddManualLead} className="space-y-4">
          <Input 
            label="Nome da Empresa / Negócio" 
            placeholder="Ex: Imobiliária Central" 
            value={formData.companyName}
            onChange={e => setFormData({ ...formData, companyName: e.target.value })}
            required
          />
          <Input 
            label="Contacto Responsável" 
            placeholder="Ex: João Silva" 
            value={formData.contactName}
            onChange={e => setFormData({ ...formData, contactName: e.target.value })}
          />
          <Input 
            label="Email" 
            placeholder="Ex: contacto@empresa.com" 
            type="email"
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
          />
          <Input 
            label="Contacto Telefónico" 
            placeholder="Ex: +351 912 345 678" 
            value={formData.phone}
            onChange={e => setFormData({ ...formData, phone: e.target.value })}
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
              <option value="Website & Rebranding" className="bg-zinc-950 text-white">Website & Rebranding</option>
              <option value="SEO Local & Tráfego" className="bg-zinc-950 text-white">SEO Local & Tráfego</option>
              <option value="Gestão de Redes Sociais" className="bg-zinc-950 text-white">Gestão de Redes Sociais</option>
              <option value="Identidade Visual Completa" className="bg-zinc-950 text-white">Identidade Visual Completa</option>
            </select>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Button 
              type="button" 
              variant="secondary" 
              onClick={() => setShowModal(false)}
              className="text-xs font-black uppercase tracking-wider py-2.5"
            >
              Cancelar
            </Button>
            <Button 
              type="submit"
              className="text-xs font-black uppercase tracking-wider py-2.5 bg-vela-red hover:bg-vela-red/90 text-white shadow-lg shadow-vela-red/10"
            >
              Registrar Lead
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
