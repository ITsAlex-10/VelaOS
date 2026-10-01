import React, { useState } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { GlassCard, Badge, Button, Modal, Input, Select } from '../components/UI';
import { formatCurrency, cn } from '../lib/utils';
import { motion } from 'motion/react';
import { 
  Users, 
  Calendar, 
  Folder,
  FileText,
  MessageSquare,
  Activity,
  Plus,
  Mail,
  Phone,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  Video,
  CheckCircle2,
  Loader2
} from 'lucide-react';

import { useWorkspace } from '../contexts/WorkspaceContext';
import { useBackgroundAction } from '../contexts/BackgroundActionContext';

interface DashboardProps {
  onClientClick?: (client: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onClientClick }) => {
  const { runBackgroundAction } = useBackgroundAction();
  const [selectedChatClientId, setSelectedChatClientId] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [spaceId, setSpaceId] = useState<string | null>(null);

  const { 
    syncStatus, 
    syncError,
    refreshStatus, 
    isLoading, 
    clients, 
    meetings, 
    proposals,
    createClient,
    createClientProject,
    scheduleMeet,
    getOrCreateChatSpace,
    getChatMessages,
    sendChatMessage,
    accessToken,
    login
  } = useWorkspace();
  const [formData, setFormData] = useState({ contactName: '', companyName: '', email: '', phone: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showPreviousMeetings, setShowPreviousMeetings] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [showMeetSuccess, setShowMeetSuccess] = useState(false);
  const [newMeeting, setNewMeeting] = useState({
    clientId: '',
    date: new Date(Date.now() + 3600000).toISOString().slice(0, 16)
  });
  
  // Calculate dashboard stats
  const activeClientsCount = (clients || []).filter(c => c.status !== 'Terminado').length;
  const activeProjectsCount = (clients || []).filter(c => c.status === 'Cliente').length;
  const upcomingMeetingsCount = (meetings || []).filter(
    m => new Date(m.rawDate).getTime() >= Date.now()
  ).length;

  const stats = [
    { label: 'Clientes Ativos', value: activeClientsCount.toString(), icon: Users, color: 'text-blue-400' },
    { label: 'Projetos em Curso', value: activeProjectsCount.toString(), icon: Folder, color: 'text-vela-red' },
    { label: 'Próximas Reuniões', value: upcomingMeetingsCount.toString(), icon: Calendar, color: 'text-amber-400' },
    { label: 'Propostas Ativas', value: (proposals || []).length.toString(), icon: FileText, color: 'text-emerald-400' },
  ];

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.contactName || !formData.companyName || !formData.email) return;

    const leadPayload = {
      name: formData.companyName,
      contactName: formData.contactName,
      email: formData.email,
      phone: formData.phone,
      status: 'Lead' as const,
      totalValue: 0,
      receivedAmount: 0,
      serviceType: 'Design & Dev',
      lastInteraction: new Date().toISOString()
    };

    setFormData({ contactName: '', companyName: '', email: '', phone: '' });

    runBackgroundAction({
      title: `A registar lead "${leadPayload.name}"...`,
      action: async () => {
        await createClient(leadPayload);
      },
      errorMessage: `Erro ao registar a lead "${leadPayload.name}".`
    });
  };

  const handleScheduleMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    const client = clients.find(c => c.id === newMeeting.clientId);
    if (!client || !newMeeting.date) return;

    const summary = `Reunião: ${client.name}`;
    const dateStr = newMeeting.date;

    // 1. Close modal IMMEDIATELY
    setShowMeetingModal(false);
    setNewMeeting({ clientId: '', date: new Date(Date.now() + 3600000).toISOString().slice(0, 16) });

    // 2. Process in background
    runBackgroundAction({
      title: `A agendar reunião com "${client.name}"...`,
      action: async () => {
        await scheduleMeet(summary, dateStr + ":00");
      },
      errorMessage: `Erro ao agendar reunião com "${client.name}".`
    });
  };

  React.useEffect(() => {
    if (!selectedChatClientId) {
      setChatMessages([]);
      return;
    }

    setIsChatLoading(true);
    const messagesRef = collection(db, 'clients', selectedChatClientId, 'whatsapp_messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => {
        const data = doc.data();
        let formattedTime = data.time || 'Agora';
        if (data.createdAt && typeof data.createdAt.toDate === 'function') {
          formattedTime = data.createdAt.toDate().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
        }
        return {
          id: doc.id,
          ...data,
          time: formattedTime,
          createTime: data.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString()
        };
      });
      setChatMessages(msgs);
      setIsChatLoading(false);
    }, (error) => {
      console.warn("Firestore messages subscription error:", error);
      setIsChatLoading(false);
    });

    return () => unsubscribe();
  }, [selectedChatClientId]);

  const handleSendChat = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim() || !selectedChatClientId || isSendingChat) return;

    setIsSendingChat(true);
    try {
      const messagesRef = collection(db, 'clients', selectedChatClientId, 'whatsapp_messages');
      await addDoc(messagesRef, {
        sender: 'user',
        text: chatInput,
        time: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
        createdAt: serverTimestamp(),
        isAutomatic: false,
        instanceId: 'comercial'
      });
      setChatInput('');
    } catch (err) {
      console.error("Error sending WhatsApp message from Dashboard:", err);
    } finally {
      setIsSendingChat(false);
    }
  };

  return (
    <div className="space-y-12 px-8 py-4 relative min-h-screen">
      {/* Header Stat Indicators */}
      <div className="flex items-center justify-between pb-4 border-b border-white/5">
        <div className="flex items-center gap-6">
           <div className="flex -space-x-2">
             {[1, 2, 3].map(i => (
               <div key={i} className="w-8 h-8 rounded-full border-2 border-[#0D0D0F] bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-500">U{i}</div>
             ))}
             <div className="w-8 h-8 rounded-full border-2 border-[#0D0D0F] bg-vela-red flex items-center justify-center text-[10px] font-black text-white">AS</div>
           </div>
           <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Workspace Cloud: Ativo</p>
        </div>
        <div className="flex items-center gap-4">
           {!syncStatus.calendar && !syncStatus.drive ? (
             <Button 
               variant="primary" 
               className="h-8 px-4 text-[8px] flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/10"
               onClick={login}
             >
               <ShieldCheck size={12} /> Ligar Google Workspace
             </Button>
           ) : (
             <>
               {syncStatus.sheets && <Badge variant="success" className="text-[8px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Sheets Sincronizado</Badge>}
               {syncStatus.drive && <Badge variant="success" className="text-[8px] bg-blue-500/10 text-blue-500 border-blue-500/20">Drive Ativo</Badge>}
             </>
           )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {stats.map((stat, i) => (
          <GlassCard 
            key={i} 
            hoverable 
            className="border-white/5 relative group p-8"
          >
            <p className="text-[10px] text-zinc-600 uppercase font-black tracking-[0.3em] mb-6 font-sans">{stat.label}</p>
            <div className="flex items-end justify-between">
              <h3 className="text-3xl font-display font-black text-white tracking-tighter leading-none italic">{stat.value}</h3>
            </div>
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <stat.icon size={48} strokeWidth={1} />
            </div>
          </GlassCard>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Next Meetings with Automation Label */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          <GlassCard hoverable className="p-8 border-white/5 h-fit min-h-[300px]">
            <div className="flex justify-between items-start mb-10">
              <div className="space-y-2">
                <h3 className="text-2xl font-display font-black text-white tracking-tight uppercase italic">Próximas Reuniões</h3>
                <p className="text-[10px] text-zinc-700 font-bold uppercase tracking-[0.3em] font-sans">Sincronização Auto-Meet Ativa</p>
              </div>
              <Button 
                variant="primary" 
                className="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2"
                onClick={() => setShowMeetingModal(true)}
              >
                <Plus size={14} /> Agendar
              </Button>
            </div>

            {(() => {
              const now = Date.now();
              const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
              const currentAndFutureMeetings = (meetings || []).filter(
                m => new Date(m.rawDate).getTime() >= twentyFourHoursAgo
              );
              // Sort future/current chronologically ascending (closest upcoming first)
              currentAndFutureMeetings.sort((a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime());

              const olderMeetings = (meetings || []).filter(
                m => new Date(m.rawDate).getTime() < twentyFourHoursAgo
              );
              // Sort older/past chronologically descending (most recent past first)
              olderMeetings.sort((a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime());

              const displayedMeetings = showPreviousMeetings 
                ? [...currentAndFutureMeetings, ...olderMeetings] 
                : currentAndFutureMeetings;

              return (meetings || []).length > 0 ? (
                <div className="space-y-6">
                  {displayedMeetings.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {displayedMeetings.map((meeting) => (
                        <div 
                          key={meeting.id}
                          className="p-5 rounded-xl bg-white/[0.01] border border-white/5 hover:border-white/20 transition-all flex items-center gap-4 group cursor-pointer"
                          onClick={() => meeting.link && window.open(meeting.link, '_blank')}
                        >
                          <div className="w-12 h-12 glass rounded-lg flex items-center justify-center group-hover:bg-vela-red/20 transition-colors">
                            <Video size={18} className="text-vela-red" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-black text-white uppercase tracking-wider truncate">{meeting.clientName}</p>
                            <p className="text-[9px] text-zinc-600 mt-1 uppercase font-sans tracking-widest">{meeting.date} // {meeting.time}</p>
                          </div>
                          <Badge variant="primary" className="text-[8px] opacity-60">G-Cal</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 opacity-40">
                      <p className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Nenhuma reunião futura ou recente</p>
                    </div>
                  )}

                  {olderMeetings.length > 0 && (
                    <div className="flex justify-center pt-4">
                      <Button
                        variant="secondary"
                        onClick={() => setShowPreviousMeetings(!showPreviousMeetings)}
                        className="text-[10px] font-black uppercase tracking-[0.2em] py-2.5 px-6 border border-white/5 hover:bg-white/10"
                      >
                        {showPreviousMeetings ? 'Ocultar anteriores' : 'Ver anteriores'}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 opacity-30">
                  <Calendar size={48} strokeWidth={1} className="mb-4" />
                  <p className="text-[10px] uppercase font-black tracking-widest">Nenhuma reunião agendada</p>
                </div>
              );
            })()}
          </GlassCard>

          {/* Pending Proposals with Deadlines */}
          <GlassCard hoverable className="p-8 border-white/5 flex-1 min-h-[300px]">
            <div className="flex justify-between items-start mb-10">
              <div className="space-y-2">
                <h3 className="text-2xl font-display font-black text-white tracking-tight uppercase italic">Propostas Pendentes / Ativas</h3>
                <p className="text-[10px] text-zinc-700 font-bold uppercase tracking-[0.3em] font-sans">Acompanhamento por Entidade Ativa</p>
              </div>
            </div>
            {(() => {
              const activeClientsWithProposals = (clients || []).filter(
                c => c.status === 'Cliente' || c.status === 'Pendente'
              );

              return activeClientsWithProposals.length > 0 ? (
                <div className="space-y-6">
                  {activeClientsWithProposals.map((client) => {
                    const proposalVal = client.proposal?.value || client.totalValue || 0;
                    const hasProposalFile = !!client.proposal?.fileUrl;

                    return (
                      <div 
                        key={client.id} 
                        className="p-6 rounded-2xl bg-white/[0.01] border border-white/5 hover:bg-white/[0.03] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-6 group"
                      >
                        <div className="flex items-start gap-5 flex-1 min-w-0">
                          <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                            client.status === 'Cliente' ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                          )}>
                            <FileText size={20} strokeWidth={1.5} />
                          </div>
                          
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-3">
                              <h4 className="text-sm font-black text-white font-display uppercase tracking-tight truncate">{client.name}</h4>
                              <Badge 
                                variant={client.status === 'Cliente' ? 'success' : 'warning'} 
                                className="text-[8px] font-black tracking-widest uppercase py-0.5 px-2"
                              >
                                {client.status === 'Cliente' ? 'Cliente Ativo' : 'Pendente'}
                              </Badge>
                            </div>

                            <div className="text-[11px] font-sans">
                              <span className="text-zinc-400 font-bold">Valor Global:</span>{' '}
                              <span className="text-white font-extrabold">{formatCurrency(proposalVal)}</span>
                              
                              {client.status === 'Cliente' && (
                                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] font-sans">
                                  <span className="text-emerald-500 font-bold uppercase tracking-wider">
                                    ✓ Liquidado: {formatCurrency(client.receivedAmount)}
                                  </span>
                                  <span className="text-zinc-600">//</span>
                                  <span className="text-zinc-500 font-medium">
                                    Em Falta: {formatCurrency(Math.max(0, proposalVal - client.receivedAmount))}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Identified Proposal File Alert */}
                            {hasProposalFile && (
                              <div 
                                onClick={() => window.open(client.proposal?.fileUrl, '_blank')}
                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/[0.02] border border-white/5 hover:border-vela-red/30 rounded-lg text-[9px] text-zinc-400 hover:text-white cursor-pointer transition-all mt-1"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-vela-red animate-pulse" />
                                <span className="font-sans font-bold truncate max-w-[200px]">
                                  📄 {client.proposal?.title || 'Ficheiro da Proposta'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0 sm:self-center self-end">
                          <Button
                            variant="secondary"
                            onClick={() => onClientClick?.(client)}
                            className="text-[9px] font-black uppercase tracking-[0.2em] py-3 px-6 hover:bg-white/10"
                          >
                            Ver Ficha
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 opacity-30">
                  <FileText size={48} strokeWidth={1} className="mb-4" />
                  <p className="text-[10px] uppercase font-black tracking-widest">Sem propostas pendentes ou ativas</p>
                </div>
              );
            })()}
          </GlassCard>
        </div>

        {/* Sidebar: New Project Form & Workspace Status */}
        <div className="lg:col-span-4 space-y-8 flex flex-col">
          {/* New Project Form */}
          <GlassCard className="p-8 border-white/5 bg-white/[0.01]">
            <div className="mb-8">
              <h3 className="text-xl font-display font-black text-white tracking-tight uppercase italic mb-2">Novo Registo</h3>
              <p className="text-[9px] text-zinc-700 font-bold uppercase tracking-[0.3em] font-sans">Entrada de Lead</p>
            </div>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[9px] text-zinc-600 font-black uppercase tracking-widest font-sans ml-1">Nome do Cliente</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700">
                    <Users size={14} />
                  </div>
                  <input 
                    required
                    type="text" 
                    placeholder="Ex: João Silva"
                    value={formData.contactName}
                    onChange={(e) => setFormData({...formData, contactName: e.target.value})}
                    className="w-full bg-white/[0.02] border border-white/5 rounded-xl py-3.5 pl-12 pr-4 text-xs text-white focus:outline-none focus:border-vela-red/30 transition-all font-sans"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] text-zinc-600 font-black uppercase tracking-widest font-sans ml-1">Nome da Empresa</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700">
                    <ShieldCheck size={14} />
                  </div>
                  <input 
                    required
                    type="text" 
                    placeholder="Ex: Velocity Studio"
                    value={formData.companyName}
                    onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                    className="w-full bg-white/[0.02] border border-white/5 rounded-xl py-3.5 pl-12 pr-4 text-xs text-white focus:outline-none focus:border-vela-red/30 transition-all font-sans"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] text-zinc-600 font-black uppercase tracking-widest font-sans ml-1">E-mail Seguro</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700">
                    <Mail size={14} />
                  </div>
                  <input 
                    required
                    type="email" 
                    placeholder="email@dominio.com"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full bg-white/[0.02] border border-white/5 rounded-xl py-3.5 pl-12 pr-4 text-xs text-white focus:outline-none focus:border-vela-red/30 transition-all font-sans"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] text-zinc-600 font-black uppercase tracking-widest font-sans ml-1">Ligação Telefónica</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700">
                    <Phone size={14} />
                  </div>
                  <input 
                    type="tel" 
                    placeholder="+351 9XX XXX XXX"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full bg-white/[0.02] border border-white/5 rounded-xl py-3.5 pl-12 pr-4 text-xs text-white focus:outline-none focus:border-vela-red/30 transition-all font-sans"
                  />
                </div>
              </div>
              <Button 
                type="submit" 
                variant="primary" 
                className="w-full py-4 mt-4 text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-vela-red/10 flex items-center justify-center gap-2 transition-all"
              >
                Registar Lead
              </Button>
            </form>
          </GlassCard>

          {/* Workspace Status Tracker */}
          <GlassCard className="p-8 border-white/5 flex-1">
             <div className="flex items-center justify-between mb-8">
               <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] font-sans">Workspace</h3>
               <div className={cn("w-2 h-2 rounded-full", syncStatus.calendar ? "bg-emerald-500 animate-pulse" : "bg-zinc-700")} />
             </div>
             <div className="space-y-4">
                {[
                  { label: 'Sincronização Drive', status: syncStatus.drive ? 'Ligado' : 'Off', icon: Folder, active: syncStatus.drive },
                  { label: 'Meet Automático', status: syncStatus.calendar ? 'Ativo' : 'Off', icon: Video, active: syncStatus.calendar },
                  { label: 'Relé de Chat', status: syncStatus.chat ? 'Sinc' : 'Off', icon: MessageSquare, active: syncStatus.chat },
                ].map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-white/[0.01] border border-white/5">
                    <div className="flex items-center gap-3">
                      <s.icon size={14} className={s.active ? "text-vela-red" : "text-zinc-700"} />
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">{s.label}</span>
                    </div>
                    <span className={cn("text-[9px] font-black uppercase", s.active ? "text-emerald-500" : "text-zinc-700")}>{s.status}</span>
                  </div>
                ))}
             </div>
             
             {syncError && (
               <div className="mt-6 p-4 rounded-xl bg-vela-red/10 border border-vela-red/20 text-vela-red text-[10px] font-sans leading-relaxed text-center">
                 <p className="font-bold uppercase tracking-wider mb-2">Aviso de Sincronização</p>
                 <p className="text-zinc-400 font-medium">{syncError}</p>
               </div>
             )}

             <Button 
               variant="secondary" 
               disabled={isLoading}
               onClick={refreshStatus}
               className="w-full mt-8 py-3 text-[9px] font-black tracking-widest border-white/5 flex items-center justify-center gap-2"
             >
               {isLoading ? <Loader2 size={12} className="animate-spin" /> : 'ATUALIZAR SINCRONIZAÇÃO'}
             </Button>
          </GlassCard>

          {/* WhatsApp Integration: Live Chat Panel */}
          <GlassCard className="p-8 border-white/5 bg-[#0D0D0F]/40 flex flex-col h-[550px]">
             <div className="flex items-center justify-between mb-6">
               <div className="flex items-center gap-3">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                 <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] font-sans">WhatsApp Comercial (Live)</h3>
               </div>
               <Badge className="text-[8px] bg-white/5 border-white/10 uppercase tracking-widest text-zinc-500">Live WhatsApp</Badge>
             </div>

             <div className="mb-6">
                <Select
                  value={selectedChatClientId}
                  onChange={(e) => setSelectedChatClientId(e.target.value)}
                  className="bg-[#0D0D0F]/80 border-white/5 text-[10px] font-bold h-10"
                >
                  <option value="" className="bg-zinc-900">Selecionar Canal de Cliente</option>
                  {(clients || []).map(c => (
                    <option key={c.id} value={c.id} className="bg-zinc-900">{c.name}</option>
                  ))}
                </Select>
             </div>

             <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pr-2 mb-6 min-h-0">
               {isChatLoading ? (
                 <div className="flex flex-col items-center justify-center h-full gap-3 opacity-40">
                   <Loader2 size={24} className="animate-spin text-vela-red" />
                   <p className="text-[9px] font-black uppercase tracking-widest">A carregar...</p>
                 </div>
               ) : !selectedChatClientId ? (
                 <div className="flex flex-col items-center justify-center h-full opacity-20 text-center px-4">
                   <MessageSquare size={32} strokeWidth={1} className="mb-4" />
                   <p className="text-[9px] font-black uppercase tracking-[0.3em] font-sans">Selecione um cliente para carregar a conversa</p>
                 </div>
               ) : chatMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full opacity-20">
                    <p className="text-[9px] font-black uppercase tracking-[0.3em] font-sans">Sem histórico de WhatsApp</p>
                  </div>
               ) : (
                chatMessages.map((msg, i) => {
                  const isMe = msg.sender === 'user';
                  return (
                    <div key={i} className={cn("flex gap-3", isMe ? "flex-row-reverse" : "flex-row")}>
                      <div className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-black",
                        isMe ? "bg-emerald-600 text-white" : "glass text-zinc-500"
                      )}>
                        {isMe ? 'AS' : (clients.find(c => c.id === selectedChatClientId)?.name[0] || 'C')}
                      </div>
                      <div className={cn(
                        "p-3 rounded-2xl border max-w-[85%]",
                        isMe 
                          ? "bg-emerald-600/10 border-emerald-500/20 rounded-tr-none" 
                          : "glass border-white/5 rounded-tl-none"
                      )}>
                        <p className={cn(
                          "text-[10px] leading-relaxed",
                          isMe ? "text-white italic font-black" : "text-zinc-300 font-bold"
                        )}>
                          {msg.text}
                        </p>
                        <span className="text-[7px] text-zinc-600 font-sans mt-2 block lowercase">
                           {msg.time}
                        </span>
                      </div>
                    </div>
                  );
                })
               )}
             </div>

             <form onSubmit={handleSendChat} className="relative mt-auto">
               <textarea 
                 value={chatInput}
                 onChange={(e) => setChatInput(e.target.value)}
                 onKeyDown={(e) => {
                   if (e.key === 'Enter' && !e.shiftKey) {
                     e.preventDefault();
                     handleSendChat();
                   }
                 }}
                 placeholder={selectedChatClientId ? "Escrever resposta WhatsApp..." : "Selecione um cliente primeiro"}
                 disabled={!selectedChatClientId || isSendingChat}
                 className="w-full bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3 text-[11px] font-bold text-white placeholder:text-zinc-700 focus:outline-none focus:border-vela-red/30 transition-all resize-none min-h-[100px] font-sans disabled:opacity-30"
               />
               <button 
                type="submit"
                disabled={!selectedChatClientId || isSendingChat || !chatInput.trim()}
                className="absolute bottom-3 right-3 bg-emerald-600 text-white p-2 rounded-lg hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/20 disabled:grayscale"
               >
                 {isSendingChat ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
               </button>
             </form>
          </GlassCard>
        </div>
      </div>

      <Modal 
        isOpen={showMeetingModal} 
        onClose={() => setShowMeetingModal(false)} 
        title="Novo Agendamento Dashboard" 
      >
        <form onSubmit={handleScheduleMeeting} className="space-y-4">
          <Select 
            label="Selecionar Entidade"
            value={newMeeting.clientId}
            onChange={e => setNewMeeting({ ...newMeeting, clientId: e.target.value })}
            required
          >
            <option value="" className="bg-zinc-900">Selecione o Cliente / Lead</option>
            {(clients || []).map(c => (
              <option key={c.id} value={c.id} className="bg-zinc-900">{c.name} ({c.status})</option>
            ))}
          </Select>
          <Input 
            label="Data e Hora" 
            type="datetime-local"
            value={newMeeting.date}
            onChange={e => setNewMeeting({ ...newMeeting, date: e.target.value })}
            required
          />
          <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-2 mb-6">
            Sincronização imediata com Google Calendar & Meet.
          </p>
          <Button 
            type="submit" 
            className="w-full py-4 mt-4 transition-all"
          >
            Confirmar Reunião
          </Button>
        </form>
      </Modal>
    </div>
  );
};

