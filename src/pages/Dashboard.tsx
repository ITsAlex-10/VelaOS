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
  Loader2,
  Edit3
} from 'lucide-react';

import { useWorkspace } from '../contexts/WorkspaceContext';
import { useBackgroundAction } from '../contexts/BackgroundActionContext';
import { ScheduleMeetingModal } from '../components/ScheduleMeetingModal';
import { EditMeetingModal } from '../components/EditMeetingModal';
import { OpenHostingerLinksButton } from '../components/HostingerPrepSelector';
import { Meeting } from '../types';

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
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  
  // Calculate dashboard stats
  const activeClientsCount = (clients || []).filter(c => c.status !== 'Terminado').length;
  const activeProjectsCount = (clients || []).filter(c => c.status === 'Cliente').length;
  const nowMs = Date.now();
  const sevenDaysLaterMs = nowMs + 7 * 24 * 60 * 60 * 1000;
  const nextSevenDaysMeetings = (meetings || [])
    .filter((m) => {
      const t = new Date(m.rawDate).getTime();
      return t >= nowMs && t <= sevenDaysLaterMs;
    })
    .sort((a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime());
  const upcomingMeetingsCount = nextSevenDaysMeetings.length;

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

  const activeClientsList = (clients || []).filter(c => c.status === 'Cliente' || c.status === 'Pendente');
  const activeCount = activeClientsList.filter(c => c.status === 'Cliente').length;
  const pendingCount = activeClientsList.filter(c => c.status === 'Pendente').length;

  return (
    <div className="space-y-8 pb-8">
      {/* Workspace Sync Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-white/[0.06]">
        <div className="flex flex-wrap items-center gap-3">
          <div className={cn(
            "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium",
            accessToken
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
              : "bg-white/[0.03] border-white/[0.08] text-zinc-400"
          )}>
            <span className={cn("w-1.5 h-1.5 rounded-full", accessToken ? "bg-emerald-400" : "bg-zinc-600")} />
            <span>{accessToken ? 'Google Workspace ligado' : 'Google Workspace desligado'}</span>
          </div>
          {syncStatus.sheets && (
            <Badge variant="success">Sheets Ativo</Badge>
          )}
          {syncStatus.drive && (
            <Badge variant="info">Drive Ativo</Badge>
          )}
          {syncStatus.calendar && (
            <Badge variant="default">Calendar Ativo</Badge>
          )}
        </div>

        <div className="flex items-center gap-3">
          {!syncStatus.calendar && !syncStatus.drive && (
            <Button
              variant="secondary"
              className="text-[11px] py-2 px-3.5"
              onClick={login}
            >
              <ShieldCheck size={14} className="text-emerald-400" />
              Ligar Google Workspace
            </Button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, i) => (
          <GlassCard key={i} hoverable className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-[11px] text-zinc-400 uppercase font-bold tracking-[0.14em] font-sans">
                  {stat.label}
                </p>
                <h3 className="text-3xl font-display font-bold text-white tracking-tight tabular-nums leading-none">
                  {stat.value}
                </h3>
              </div>
              <div className={cn("w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0", stat.color)}>
                <stat.icon size={18} strokeWidth={1.75} />
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Main 12-Col Asymmetric Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Primary Column (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Próximas Reuniões */}
          <GlassCard className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-5 border-b border-white/[0.06]">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight font-sans">
                  Próximas Reuniões
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Próximos 7 dias · Sincronização direta com Google Calendar e Meet
                </p>
              </div>
              <Button
                variant="primary"
                className="px-4 py-2 text-[11px]"
                onClick={() => setShowMeetingModal(true)}
              >
                <Plus size={14} /> Agendar
              </Button>
            </div>

            {nextSevenDaysMeetings.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {nextSevenDaysMeetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    onClick={() => meeting.link && window.open(meeting.link, '_blank')}
                    className={cn(
                      "p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] transition-[transform,background-color,border-color] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col gap-3 group",
                      meeting.link && "hover:-translate-y-[1px] hover:bg-white/[0.045] hover:border-white/[0.15] cursor-pointer"
                    )}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-lg bg-vela-red/10 border border-vela-red/20 flex items-center justify-center shrink-0">
                        <Video size={17} className="text-vela-red" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate group-hover:text-vela-red transition-colors duration-150">
                          {meeting.clientName}
                        </p>
                        <p className="text-xs text-zinc-400 mt-0.5 tabular-nums flex items-center gap-1.5">
                          <span>{meeting.date}</span>
                          <span className="text-zinc-600">·</span>
                          <span>{meeting.time}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingMeeting(meeting);
                          }}
                          title="Editar reunião e links Hostinger"
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-emerald-400 hover:bg-white/[0.06] transition-colors cursor-pointer"
                        >
                          <Edit3 size={13} />
                        </button>
                        {meeting.link && (
                          <ArrowUpRight size={15} className="text-zinc-500 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shrink-0 transition-[transform,color] duration-150" />
                        )}
                      </div>
                    </div>
                    {meeting.hostingerLinks && meeting.hostingerLinks.length > 0 && (
                      <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between gap-2">
                        <OpenHostingerLinksButton
                          links={meeting.hostingerLinks}
                          compact
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-500">
                <Calendar size={32} strokeWidth={1.25} className="mb-3 opacity-50" />
                <p className="text-xs font-medium">Sem reuniões agendadas para os próximos 7 dias.</p>
              </div>
            )}
          </GlassCard>

          {/* Propostas & Clientes Ativos */}
          <GlassCard className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-5 border-b border-white/[0.06]">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight font-sans">
                  Propostas &amp; Clientes Ativos
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5 tabular-nums">
                  {activeCount} ativos · {pendingCount} pendentes de adjudicação
                </p>
              </div>
            </div>

            {activeClientsList.length > 0 ? (
              <div className="divide-y divide-white/[0.06]">
                {activeClientsList.map((client) => {
                  const proposalVal = client.totalValue || client.proposal?.value || 0;
                  const received = client.receivedAmount || 0;
                  const remaining = Math.max(0, proposalVal - received);
                  const hasProposalFile = !!client.proposal?.fileUrl;

                  return (
                    <div
                      key={client.id}
                      className="py-4 first:pt-2 last:pb-2 px-2.5 -mx-2.5 rounded-xl hover:bg-white/[0.025] transition-colors duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3.5 flex-1 min-w-0">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border",
                          client.status === 'Cliente'
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                            : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                        )}>
                          <FileText size={17} strokeWidth={1.75} />
                        </div>

                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <h4 className="text-sm font-semibold text-white truncate">{client.name}</h4>
                            <Badge variant={client.status === 'Cliente' ? 'success' : 'warning'}>
                              {client.status === 'Cliente' ? 'Cliente Ativo' : 'Pendente'}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums">
                            <span className="text-zinc-400">
                              Global: <strong className="text-white font-semibold">{formatCurrency(proposalVal)}</strong>
                            </span>
                            {client.status === 'Cliente' && (
                              <>
                                <span className="text-zinc-700">·</span>
                                <span className="text-emerald-400 font-medium">
                                  Liquidado: {formatCurrency(received)}
                                </span>
                                <span className="text-zinc-700">·</span>
                                <span className={remaining > 0 ? "text-amber-400 font-medium" : "text-zinc-500"}>
                                  Em falta: {formatCurrency(remaining)}
                                </span>
                              </>
                            )}
                          </div>

                          {hasProposalFile && (
                            <button
                              type="button"
                              onClick={() => window.open(client.proposal?.fileUrl, '_blank')}
                              className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-vela-red hover:translate-x-0.5 transition-all duration-150 pt-0.5"
                            >
                              <FileText size={12} />
                              <span className="truncate max-w-[260px] underline decoration-white/20 underline-offset-2">
                                {client.proposal?.title || 'Abrir ficheiro da proposta'}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>

                      <Button
                        variant="secondary"
                        onClick={() => onClientClick?.(client)}
                        className="text-[11px] py-2 px-3.5 shrink-0 self-end sm:self-center"
                      >
                        Ver Ficha
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-500">
                <FileText size={32} strokeWidth={1.25} className="mb-3 opacity-50" />
                <p className="text-xs font-medium">Sem propostas pendentes ou clientes ativos.</p>
              </div>
            )}
          </GlassCard>
        </div>

        {/* Secondary Column (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Registo Rápido de Lead */}
          <GlassCard className="p-6">
            <div className="pb-4 mb-5 border-b border-white/[0.06]">
              <h3 className="text-base font-bold text-white tracking-tight font-sans">Registo Rápido</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Adicionar nova lead comercial</p>
            </div>
            <form onSubmit={handleCreateProject} className="space-y-3.5">
              <Input
                label="Nome do Responsável"
                placeholder="Ex: João Silva"
                icon={<Users size={14} />}
                value={formData.contactName}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                required
              />
              <Input
                label="Nome da Empresa"
                placeholder="Ex: Velocity Studio"
                icon={<ShieldCheck size={14} />}
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                required
              />
              <Input
                label="E-mail"
                type="email"
                placeholder="email@dominio.com"
                icon={<Mail size={14} />}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
              <Input
                label="Telefone"
                type="tel"
                placeholder="+351 9XX XXX XXX"
                icon={<Phone size={14} />}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
              <Button type="submit" variant="primary" className="w-full py-3 mt-1">
                <Plus size={14} /> Registar Lead
              </Button>
            </form>
          </GlassCard>

          {/* Estado do Workspace */}
          <GlassCard className="p-6">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/[0.06]">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-sans">Workspace</h3>
                <p className="text-[11px] text-zinc-500">Serviços Google ligados</p>
              </div>
              <Activity size={16} className={syncStatus.calendar ? "text-emerald-400" : "text-zinc-600"} />
            </div>

            <div className="divide-y divide-white/[0.06]">
              {[
                { label: 'Google Drive', status: syncStatus.drive ? 'Ligado' : 'Inativo', icon: Folder, active: syncStatus.drive },
                { label: 'Calendar & Meet', status: syncStatus.calendar ? 'Ativo' : 'Inativo', icon: Video, active: syncStatus.calendar },
                { label: 'Google Sheets', status: syncStatus.sheets ? 'Sincronizado' : 'Inativo', icon: FileText, active: syncStatus.sheets },
              ].map((s, i) => (
                <div key={i} className="flex items-center justify-between py-3 first:pt-1 last:pb-1">
                  <div className="flex items-center gap-2.5">
                    <s.icon size={15} className={s.active ? "text-vela-red" : "text-zinc-600"} />
                    <span className="text-xs font-medium text-zinc-300">{s.label}</span>
                  </div>
                  <span className={cn("text-[11px] font-semibold", s.active ? "text-emerald-400" : "text-zinc-600")}>
                    {s.status}
                  </span>
                </div>
              ))}
            </div>

            {syncError && (
              <div className="mt-4 p-3 rounded-xl bg-vela-red/10 border border-vela-red/20 text-vela-red text-xs leading-relaxed">
                <p className="font-semibold mb-1">Aviso de Sincronização</p>
                <p className="text-zinc-300 text-[11px]">{syncError}</p>
              </div>
            )}

            <Button
              variant="secondary"
              disabled={isLoading}
              onClick={refreshStatus}
              className="w-full mt-5 py-2.5 text-[11px]"
            >
              {isLoading ? <Loader2 size={13} className="animate-spin" /> : 'Atualizar Sincronização'}
            </Button>
          </GlassCard>

          {/* WhatsApp Comercial */}
          <GlassCard className="p-6 flex flex-col h-[480px]">
            <div className="flex items-center justify-between gap-2 pb-4 mb-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <MessageSquare size={15} className="text-emerald-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-sans">WhatsApp Comercial</h3>
              </div>
              <Badge variant="success">Live</Badge>
            </div>

            <div className="mb-4">
              <Select
                value={selectedChatClientId}
                onChange={(e) => setSelectedChatClientId(e.target.value)}
                className="text-xs py-2"
              >
                <option value="" className="bg-zinc-900">Selecionar canal de cliente...</option>
                {(clients || []).map(c => (
                  <option key={c.id} value={c.id} className="bg-zinc-900">{c.name}</option>
                ))}
              </Select>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3.5 custom-scrollbar pr-1 mb-4 min-h-0">
              {isChatLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-zinc-500">
                  <Loader2 size={20} className="animate-spin text-vela-red" />
                  <p className="text-xs">A carregar mensagens...</p>
                </div>
              ) : !selectedChatClientId ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-500 text-center px-4">
                  <MessageSquare size={28} strokeWidth={1.25} className="mb-3 opacity-40" />
                  <p className="text-xs">Selecione um cliente para visualizar a conversa.</p>
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                  <p className="text-xs">Sem histórico de mensagens.</p>
                </div>
              ) : (
                chatMessages.map((msg, i) => {
                  const isMe = msg.sender === 'user';
                  return (
                    <div key={i} className={cn("flex gap-2.5", isMe ? "flex-row-reverse" : "flex-row")}>
                      <div className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold",
                        isMe ? "bg-emerald-600 text-white" : "bg-white/[0.06] border border-white/10 text-zinc-300"
                      )}>
                        {isMe ? 'EU' : (clients.find(c => c.id === selectedChatClientId)?.name[0] || 'C')}
                      </div>
                      <div className={cn(
                        "px-3.5 py-2.5 rounded-2xl border max-w-[82%]",
                        isMe
                          ? "bg-emerald-500/10 border-emerald-500/20 rounded-tr-none"
                          : "bg-white/[0.03] border-white/[0.07] rounded-tl-none"
                      )}>
                        <p className="text-xs text-zinc-100 leading-relaxed">
                          {msg.text}
                        </p>
                        <span className="text-[10px] text-zinc-500 font-mono tabular-nums mt-1.5 block">
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
                placeholder={selectedChatClientId ? "Escrever resposta..." : "Selecione um cliente primeiro"}
                disabled={!selectedChatClientId || isSendingChat}
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3.5 py-2.5 pr-12 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-vela-red/40 transition-all resize-none min-h-[76px] font-sans disabled:opacity-40"
              />
              <button
                type="submit"
                disabled={!selectedChatClientId || isSendingChat || !chatInput.trim()}
                className="absolute bottom-3 right-3 bg-emerald-600 text-white p-2 rounded-lg hover:bg-emerald-500 transition-colors disabled:opacity-30"
                title="Enviar mensagem"
              >
                {isSendingChat ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              </button>
            </form>
          </GlassCard>
        </div>
      </div>

      <ScheduleMeetingModal
        isOpen={showMeetingModal}
        onClose={() => setShowMeetingModal(false)}
        title="Novo Agendamento"
        subtitle="Sincronização imediata com Google Calendar & Meet"
        confirmLabel="Confirmar Reunião"
      />

      <EditMeetingModal
        meeting={editingMeeting}
        onClose={() => setEditingMeeting(null)}
      />
    </div>
  );
};

