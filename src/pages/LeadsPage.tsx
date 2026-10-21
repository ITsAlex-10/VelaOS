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
  RefreshCw,
  Edit3,
  FileText
} from 'lucide-react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useBackgroundAction } from '../contexts/BackgroundActionContext';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';

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
  const { leads, createLead, updateLead, deleteLead, moveLeadToProspects } = useWorkspace();
  const { runBackgroundAction } = useBackgroundAction();
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'alphabetical'>('recent');
  const [leadToDelete, setLeadToDelete] = useState<any | null>(null);
  const [editingLead, setEditingLead] = useState<any | null>(null);

  // Edit form multi-state
  const [editContactNames, setEditContactNames] = useState<string[]>(['']);
  const [editEmails, setEditEmails] = useState<string[]>(['']);
  const [editPhones, setEditPhones] = useState<string[]>(['']);
  const [editFormData, setEditFormData] = useState({ 
    companyName: '', 
    mapUri: '',
    note: '',
    serviceType: 'Website & Perfil Google'
  });

  const handleOpenEditLead = (lead: any) => {
    setEditingLead(lead);
    const latestNote = lead.notes?.[0]?.content || '';
    setEditContactNames(lead.contactName ? lead.contactName.split(',').map((s: string) => s.trim()) : ['']);
    setEditEmails(lead.email ? lead.email.split(',').map((s: string) => s.trim()) : ['']);
    setEditPhones(lead.phone && lead.phone !== 'Não listado' ? lead.phone.split(',').map((s: string) => s.trim()) : ['']);
    setEditFormData({
      companyName: lead.name || '',
      mapUri: lead.mapUri || '',
      note: latestNote,
      serviceType: lead.serviceType || 'Website & Perfil Google'
    });
  };

  const handleSaveEditLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLead || !editFormData.companyName) return;

    const existingNotes = editingLead.notes || [];
    let updatedNotes = [...existingNotes];
    if (editFormData.note) {
      if (updatedNotes.length > 0) {
        updatedNotes[0] = {
          ...updatedNotes[0],
          content: editFormData.note
        };
      } else {
        updatedNotes = [{
          id: Math.random().toString(36).substring(7),
          date: new Date().toLocaleDateString('pt-PT'),
          author: 'Alex Sosa',
          content: editFormData.note
        }];
      }
    }

    const payload = {
      name: editFormData.companyName,
      contactName: editContactNames.filter(Boolean).join(', ') || 'Responsável',
      email: editEmails.filter(Boolean).join(', '),
      phone: editPhones.filter(Boolean).join(', '),
      mapUri: editFormData.mapUri || '',
      serviceType: editFormData.serviceType || 'Website & Rebranding',
      notes: updatedNotes,
      lastInteraction: new Date().toISOString()
    };

    const leadId = editingLead.id;
    setEditingLead(null);

    runBackgroundAction({
      title: `A atualizar lead "${payload.name}"...`,
      action: async () => {
        await updateLead(leadId, payload);
      },
      errorMessage: 'Erro ao atualizar lead.'
    });
  };
  
  // 4 big interactive card filters
  const [activeFilter, setActiveFilter] = useState<'Por contactar' | 'Não atendeu' | 'Ligar mais tarde' | 'Não interessado'>('Por contactar');

  // Add form multi-state
  const [contactNames, setContactNames] = useState<string[]>(['']);
  const [emails, setEmails] = useState<string[]>(['']);
  const [phones, setPhones] = useState<string[]>(['']);
  const [formData, setFormData] = useState({ 
    companyName: '', 
    mapUri: '',
    note: '',
    serviceType: 'Website & Perfil Google'
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

  const sortedLeads = [...filteredLeads].sort((a, b) => {
    if (sortBy === 'alphabetical') {
      return (a.name || '').localeCompare(b.name || '');
    } else {
      const timeA = new Date(a.lastInteraction || 0).getTime();
      const timeB = new Date(b.lastInteraction || 0).getTime();
      return timeB - timeA;
    }
  });

  const handleAddManualLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName) return;

    const payload = {
      name: formData.companyName,
      contactName: contactNames.filter(Boolean).join(', ') || 'Responsável',
      email: emails.filter(Boolean).join(', '),
      phone: phones.filter(Boolean).join(', '),
      mapUri: formData.mapUri || '',
      serviceType: formData.serviceType || 'Website & Rebranding',
      status: 'Por contactar',
      lastInteraction: new Date().toISOString(),
      notes: formData.note ? [
        {
          id: Math.random().toString(36).substring(7),
          date: new Date().toLocaleDateString('pt-PT'),
          author: 'Alex Sosa',
          content: formData.note
        }
      ] : []
    };

    setShowModal(false);
    setFormData({ companyName: '', mapUri: '', note: '', serviceType: 'Website & Rebranding' });
    setContactNames(['']);
    setEmails(['']);
    setPhones(['']);

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
          Lista de Leads - {activeFilter} ({sortedLeads.length})
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
              placeholder="Pesquisar leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/5 rounded-xl py-2 pl-10 pr-3 text-xs text-white focus:outline-none focus:border-vela-red transition-all placeholder:text-zinc-700 font-sans"
            />
          </div>
        </div>
      </div>

      {/* Leads Cards Grid */}
      {sortedLeads.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sortedLeads.map((lead) => (
            <GlassCard key={lead.id} className="p-6 border border-white/5 bg-white/[0.01] hover:border-white/10 transition-all flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 
                      onClick={() => onLeadClick(lead)}
                      className="text-base font-display font-bold text-white hover:text-vela-red transition-colors cursor-pointer"
                    >
                      {lead.name}
                    </h4>
                    <span className="text-[10px] text-zinc-500 font-sans block mt-0.5">
                      Interesse: <strong className="text-zinc-300">{lead.serviceType || 'Website & Rebranding'}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditLead(lead)}
                      className="text-zinc-600 hover:text-white p-2 rounded-lg hover:bg-white/[0.03] transition-colors"
                      title="Editar Lead"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setLeadToDelete(lead)}
                      className="text-zinc-600 hover:text-red-400 p-2 rounded-lg hover:bg-white/[0.03] transition-colors"
                      title="Eliminar Lead"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
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
                      <span className="text-zinc-600 font-bold uppercase text-[9px] tracking-wider">Responsável:</span>
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
                      <span className="text-zinc-600 font-bold uppercase text-[9px] tracking-wider">Telemóvel:</span>
                      <a href={`tel:${lead.phone}`} className="text-zinc-300 hover:text-white hover:underline flex items-center gap-1">
                        {lead.phone}
                        <Phone size={10} className="text-emerald-400" />
                      </a>
                    </div>
                  )}
                </div>

                {lead.notes && lead.notes.length > 0 && (
                  <div className="bg-white/[0.02] p-3.5 rounded-xl border border-white/5 space-y-1">
                    <span className="text-[8px] font-black uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                      <FileText size={10} />
                      Nota / Observação ({lead.notes[0].date})
                    </span>
                    <p className="text-[11px] text-zinc-300 leading-relaxed italic">
                      "{lead.notes[0].content}"
                    </p>
                  </div>
                )}

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
                  <a
                    href={lead.mapUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.name + ' ' + (lead.address || ''))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 text-zinc-400 hover:text-white transition-all flex items-center justify-center gap-1.5 px-3 text-[10px] font-sans font-black uppercase tracking-wider"
                    title="Ver Ficha no Google Maps"
                  >
                    <ExternalLink size={13} />
                    <span>Google Maps</span>
                  </a>
                  <Button
                    onClick={() => handleMoveToProspects(lead.id, lead.name)}
                    className="text-[9px] font-black uppercase tracking-[0.15em] bg-vela-red hover:bg-vela-red/90 text-white px-4 py-2.5 rounded-xl flex items-center gap-1.5 w-full sm:w-auto justify-center shadow-lg shadow-vela-red/10 hover:shadow-vela-red/20 transition-all duration-300"
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

          {/* Contact Names */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 font-sans block ml-1">
              Nome do Responsável
            </label>
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
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 font-sans block ml-1">
              Telemóvel
            </label>
            {phones.map((phone, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input 
                  placeholder="Ex: +351 912 345 678" 
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
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 font-sans block ml-1">
              Email
            </label>
            {emails.map((email, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input 
                  placeholder="Ex: contacto@empresa.com" 
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
            placeholder="Ex: https://maps.app.goo.gl/... ou https://www.google.com/maps/..." 
            value={formData.mapUri}
            onChange={e => setFormData({ ...formData, mapUri: e.target.value })}
          />
          <Input 
            label="Nota Inicial" 
            placeholder="Ex: Observações importantes sobre a lead..." 
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

      {/* Edit Manual Lead Modal */}
      <Modal 
        isOpen={!!editingLead} 
        onClose={() => setEditingLead(null)} 
        title="Editar Lead"
      >
        <form onSubmit={handleSaveEditLead} className="space-y-4">
          <Input 
            label="Nome da Empresa / Negócio" 
            placeholder="Ex: Imobiliária Central" 
            value={editFormData.companyName}
            onChange={e => setEditFormData({ ...editFormData, companyName: e.target.value })}
            required
          />

          {/* Edit Contact Names */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 font-sans block ml-1">
              Nome do Responsável
            </label>
            {editContactNames.map((name, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input 
                  placeholder="Ex: João Silva" 
                  value={name}
                  onChange={e => {
                    const updated = [...editContactNames];
                    updated[idx] = e.target.value;
                    setEditContactNames(updated);
                  }}
                  className="w-full flex-1 bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-vela-red/30 transition-all font-sans"
                />
                {editContactNames.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setEditContactNames(editContactNames.filter((_, i) => i !== idx))}
                    className="p-3 rounded-xl bg-white/5 text-zinc-500 hover:text-red-400 transition-colors shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setEditContactNames([...editContactNames, ''])}
              className="text-[10px] font-black uppercase tracking-wider text-vela-red hover:underline flex items-center gap-1.5 ml-1 mt-1"
            >
              <Plus size={12} /> Adicionar outro responsável
            </button>
          </div>

          {/* Edit Phones */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 font-sans block ml-1">
              Telemóvel
            </label>
            {editPhones.map((phone, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input 
                  placeholder="Ex: +351 912 345 678" 
                  type="tel"
                  value={phone}
                  onChange={e => {
                    const updated = [...editPhones];
                    updated[idx] = e.target.value;
                    setEditPhones(updated);
                  }}
                  className="w-full flex-1 bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-vela-red/30 transition-all font-sans"
                />
                {editPhones.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setEditPhones(editPhones.filter((_, i) => i !== idx))}
                    className="p-3 rounded-xl bg-white/5 text-zinc-500 hover:text-red-400 transition-colors shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setEditPhones([...editPhones, ''])}
              className="text-[10px] font-black uppercase tracking-wider text-vela-red hover:underline flex items-center gap-1.5 ml-1 mt-1"
            >
              <Plus size={12} /> Adicionar outro telemóvel
            </button>
          </div>

          {/* Edit Emails */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 font-sans block ml-1">
              Email
            </label>
            {editEmails.map((email, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input 
                  placeholder="Ex: contacto@empresa.com" 
                  type="email"
                  value={email}
                  onChange={e => {
                    const updated = [...editEmails];
                    updated[idx] = e.target.value;
                    setEditEmails(updated);
                  }}
                  className="w-full flex-1 bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-vela-red/30 transition-all font-sans"
                />
                {editEmails.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setEditEmails(editEmails.filter((_, i) => i !== idx))}
                    className="p-3 rounded-xl bg-white/5 text-zinc-500 hover:text-red-400 transition-colors shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setEditEmails([...editEmails, ''])}
              className="text-[10px] font-black uppercase tracking-wider text-vela-red hover:underline flex items-center gap-1.5 ml-1 mt-1"
            >
              <Plus size={12} /> Adicionar outro email
            </button>
          </div>

          <Input 
            label="Link Direto para o Perfil do Google Maps" 
            placeholder="Ex: https://maps.app.goo.gl/... ou https://www.google.com/maps/..." 
            value={editFormData.mapUri}
            onChange={e => setEditFormData({ ...editFormData, mapUri: e.target.value })}
          />
          <Input 
            label="Nota / Observação" 
            placeholder="Ex: Observações importantes..." 
            value={editFormData.note}
            onChange={e => setEditFormData({ ...editFormData, note: e.target.value })}
          />
          
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 font-sans block ml-1">
              Serviço de Interesse
            </label>
            <select
              value={editFormData.serviceType}
              onChange={e => setEditFormData({ ...editFormData, serviceType: e.target.value })}
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

          <div className="pt-4 flex justify-end gap-3">
            <Button 
              type="button" 
              variant="secondary" 
              onClick={() => setEditingLead(null)}
              className="text-xs font-black uppercase tracking-wider py-2.5"
            >
              Cancelar
            </Button>
            <Button 
              type="submit"
              className="text-xs font-black uppercase tracking-wider py-2.5 bg-vela-red hover:bg-vela-red/90 text-white shadow-lg shadow-vela-red/10"
            >
              Guardar Alterações
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      {leadToDelete && (
        <ConfirmDeleteModal
          isOpen={!!leadToDelete}
          onClose={() => setLeadToDelete(null)}
          onConfirm={async () => {
            await deleteLead(leadToDelete.id);
          }}
          itemName={leadToDelete.name}
          itemType="Lead"
          subtitle={leadToDelete.contactName}
        />
      )}
    </div>
  );
};
