import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Loader2, 
  Bot, 
  RefreshCw, 
  MessageSquare, 
  Search,
  User,
  MoreVertical,
  Phone,
  Video,
  Info,
  ChevronLeft,
  QrCode,
  Layers,
  Settings,
  HelpCircle,
  Clock,
  Sparkles,
  Zap,
  CheckCheck,
  Plus,
  AlertCircle,
  HelpCircle as HelpIcon,
  ShieldCheck,
  DollarSign
} from 'lucide-react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { workspaceAPI } from '../lib/workspace';
import { Client } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Button } from '../components/UI';

interface ChatPageProps {
  preSelectedClientId?: string;
  onClearSelection?: () => void;
}

export const ChatPage: React.FC<ChatPageProps> = ({ preSelectedClientId, onClearSelection }) => {
  const { clients, getOrCreateChatSpace, getChatMessages, sendChatMessage, accessToken } = useWorkspace();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  
  // Tabs: google (the original integration) or whatsapp (the new requested integration)
  const [activeTab, setActiveTab] = useState<'google' | 'whatsapp'>('whatsapp');
  
  // WhatsApp States
  const [activeInstance, setActiveInstance] = useState<string>('comercial');
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrStep, setQrStep] = useState<'idle' | 'generating' | 'scanned'>('idle');
  const [showConfigGuide, setShowConfigGuide] = useState(false);
  const [whatsappSearch, setWhatsappSearch] = useState('');
  
  // Simulated WhatsApp conversation db
  const [simulatedChats, setSimulatedChats] = useState<Record<string, any[]>>({
    'comercial': [
      { id: 1, sender: 'client', text: 'Olá! Gostaria de saber mais informações sobre os vossos serviços de consultoria.', time: '09:30', isAutomatic: false },
      { id: 2, sender: 'user', text: 'Olá! Com certeza. Temos soluções de otimização de processos e CRM. Qual é o seu setor de atividade?', time: '09:35', isAutomatic: false },
      { id: 3, sender: 'client', text: 'Trabalho no setor imobiliário. Gostava de agendar um check-in para perceber se conseguem ajudar a organizar a nossa pipeline.', time: '09:42', isAutomatic: false }
    ],
    'suporte': [
      { id: 1, sender: 'client', text: 'Boa tarde, o link do Google Meet que recebi para a reunião de hoje diz que está inválido. Podem ajudar?', time: '14:15', isAutomatic: false },
      { id: 2, sender: 'user', text: 'Olá! Peço desculpa pelo incómodo. Deixe-me gerar um novo link de reuniões de imediato.', time: '14:18', isAutomatic: false }
    ]
  });

  const [whatsappInstances, setWhatsappInstances] = useState([
    { id: 'comercial', name: 'WhatsApp Comercial', phone: '+351 912 345 678', operator: 'PC 1 (Lisboa)', status: 'connected' },
    { id: 'suporte', name: 'WhatsApp Apoio Cliente', phone: '+351 912 987 654', operator: 'PC 2 (Porto)', status: 'connected' }
  ]);

  const [whatsappInput, setWhatsappInput] = useState('');
  const [isSimulatingBot, setIsSimulatingBot] = useState(false);

  useEffect(() => {
    if (preSelectedClientId && clients.length > 0) {
      const client = clients.find(c => c.id === preSelectedClientId);
      if (client) {
        setSelectedClient(client);
        onClearSelection?.();
      }
    }
  }, [preSelectedClientId, clients]);

  const [messages, setMessages] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [inputText, setInputText] = useState('');
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'CONFIG' | 'OTHER' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSpaceDetails, setShowSpaceDetails] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fetchMessages = async (sid: string) => {
    try {
      const msgs = await getChatMessages(sid);
      setMessages(msgs);
      
      // Fetch members as well for administrative view
      const res = await workspaceAPI.chat.listMembers(accessToken!, sid);
      setMembers(res.memberships || []);
    } catch (e) {
      console.error("Chat info fetch error:", e);
    }
  };

  useEffect(() => {
    if (selectedClient && accessToken && activeTab === 'google') {
      const initChat = async () => {
        setIsLoading(true);
        setErrorType(null);
        setSpaceId(null);
        setMessages([]);
        try {
          const sid = await getOrCreateChatSpace(selectedClient);
          setSpaceId(sid);
          await fetchMessages(sid);
        } catch (e: any) {
          if (e.message === 'CHAT_APP_NOT_CONFIGURED') {
            console.warn("Google Chat API is not configured as a 'Chat App' in Cloud Console.");
            setErrorType('CONFIG');
          } else {
            console.error("Init chat error:", e.message);
            setErrorType('OTHER');
          }
        } finally {
          setIsLoading(false);
        }
      };
      initChat();
    }
  }, [selectedClient, accessToken, activeTab]);

  // Polling for Google messages
  useEffect(() => {
    if (!spaceId || activeTab !== 'google') return;
    const interval = setInterval(() => fetchMessages(spaceId), 10000);
    return () => clearInterval(interval);
  }, [spaceId, activeTab]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, simulatedChats, activeInstance, activeTab, selectedClient]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || !spaceId || isSending) return;

    setIsSending(true);
    try {
      await sendChatMessage(spaceId, inputText);
      setInputText('');
      await fetchMessages(spaceId);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSending(false);
    }
  };

  // WhatsApp simulation send
  const handleWhatsappSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!whatsappInput.trim()) return;

    const newMsg = {
      id: Date.now(),
      sender: 'user',
      text: whatsappInput,
      time: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
      isAutomatic: false
    };

    setSimulatedChats(prev => ({
      ...prev,
      [activeInstance]: [...(prev[activeInstance] || []), newMsg]
    }));
    
    const queryText = whatsappInput;
    setWhatsappInput('');

    // Trigger an AI response or client response simulated
    setIsSimulatingBot(true);
    setTimeout(() => {
      const answers = [
        "Perfeito! Vou verificar a minha agenda e confirmo de seguida.",
        "Ótimo, obrigado pela resposta rápida! Fico a aguardar o link oficial.",
        "Entendido! Faz todo o sentido. Podem enviar a proposta para o meu email para eu analisar com os meus sócios?",
        "Muito obrigado pela vossa atenção. O Vela OS simplificou imenso o nosso contacto!"
      ];
      const botAnswer = answers[Math.floor(Math.random() * answers.length)];
      
      const botMsg = {
        id: Date.now() + 1,
        sender: 'client',
        text: botAnswer,
        time: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
        isAutomatic: false
      };

      setSimulatedChats(prev => ({
        ...prev,
        [activeInstance]: [...(prev[activeInstance] || []), botMsg]
      }));
      setIsSimulatingBot(false);
    }, 2000);
  };

  // Simulate Triggering an Automated 24h Meeting Alert
  const triggerAutomatedMeetingAlert = () => {
    const meetLink = "https://meet.google.com/abc-defg-hij";
    const clientFirstName = selectedClient ? selectedClient.name.split(' ')[0] : 'Cliente';
    
    const autoMsg = {
      id: Date.now(),
      sender: 'user',
      text: `🔔 *LEMBRETE AUTOMÁTICO (24h antes)*\n\nOlá ${clientFirstName}! Passamos para lembrar que amanhã temos a nossa reunião de consultoria agendada. \n\n🕒 *Horário*: 15:00\n🔗 *Link de Participação*: ${meetLink}\n\nSe tiver qualquer dúvida, pode responder a esta mensagem. Até amanhã!`,
      time: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
      isAutomatic: true
    };

    setSimulatedChats(prev => ({
      ...prev,
      [activeInstance]: [...(prev[activeInstance] || []), autoMsg]
    }));
  };

  const handleStartQrScan = () => {
    setShowQrModal(true);
    setQrStep('generating');
    setTimeout(() => {
      setQrStep('scanned');
    }, 3000);
  };

  const handleFinishQrConnect = () => {
    const newId = `new_${Date.now()}`;
    const newInstance = {
      id: newId,
      name: `WhatsApp Canal Adicional`,
      phone: `+351 915 222 ${Math.floor(Math.random() * 900) + 100}`,
      operator: 'PC Extra (Nuvem)',
      status: 'connected'
    };
    
    setWhatsappInstances(prev => [...prev, newInstance]);
    setSimulatedChats(prev => ({
      ...prev,
      [newId]: [
        { id: 1, sender: 'client', text: 'Olá! Conectei-me com sucesso a este novo canal do Vela CRM.', time: 'Agora', isAutomatic: false }
      ]
    }));
    setActiveInstance(newId);
    setShowQrModal(false);
    setQrStep('idle');
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col bg-white rounded-3xl border border-zinc-100 overflow-hidden shadow-2xl relative">
      
      {/* Top Header Selector Bar - Google Chat vs WhatsApp */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-zinc-50/50">
        <div className="flex items-center gap-3">
          <div className="flex bg-zinc-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('whatsapp')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                activeTab === 'whatsapp' 
                  ? "bg-white text-zinc-900 shadow-md" 
                  : "text-zinc-500 hover:text-zinc-900"
              )}
            >
              <Zap size={13} className={cn(activeTab === 'whatsapp' ? "text-emerald-500" : "text-zinc-400")} />
              WhatsApp Multi-Canal
              <span className="bg-emerald-50 text-[9px] text-emerald-600 px-1.5 py-0.5 rounded-full font-sans font-bold">PROTÓTIPO</span>
            </button>
            <button
              onClick={() => setActiveTab('google')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                activeTab === 'google' 
                  ? "bg-white text-zinc-900 shadow-md" 
                  : "text-zinc-500 hover:text-zinc-900"
              )}
            >
              <MessageSquare size={13} className="text-blue-500" />
              Google Chat (Workspace)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowConfigGuide(!showConfigGuide)}
            className={cn(
              "text-xs font-black uppercase tracking-wider px-4 py-2 rounded-xl flex items-center gap-2 transition-all",
              showConfigGuide 
                ? "bg-vela-red/10 text-vela-red" 
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            )}
          >
            <HelpIcon size={14} />
            Guia de Integração & Custos
          </button>
        </div>
      </div>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* SIDEBAR: Channels/Instances or Google Contacts */}
        <div className="w-80 border-r border-zinc-100 flex flex-col bg-zinc-50/20">
          
          {activeTab === 'whatsapp' ? (
            <>
              {/* WhatsApp Instances header & connector */}
              <div className="p-6 border-b border-zinc-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">Telemóveis Ligados</h3>
                  <button 
                    onClick={handleStartQrScan}
                    className="p-1.5 bg-zinc-900 hover:bg-vela-red text-white rounded-lg transition-all"
                    title="Ligar novo telemóvel"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                
                <div className="space-y-2">
                  {whatsappInstances.map(inst => (
                    <button
                      key={inst.id}
                      onClick={() => setActiveInstance(inst.id)}
                      className={cn(
                        "w-full p-3 rounded-xl border text-left transition-all",
                        activeInstance === inst.id
                          ? "bg-zinc-900 text-white border-zinc-900 shadow-lg shadow-zinc-900/10"
                          : "bg-white border-zinc-100 hover:bg-zinc-50 text-zinc-600"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold truncate">{inst.name}</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                      </div>
                      <p className="text-[10px] font-mono opacity-60 mt-1">{inst.phone}</p>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-100/10">
                        <span className="text-[9px] opacity-40 font-bold uppercase tracking-wider">Ativo em:</span>
                        <span className="text-[9px] font-bold opacity-85 uppercase">{inst.operator}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* CRM Clients filter */}
              <div className="p-4 border-b border-zinc-100 bg-zinc-50/50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                  <input 
                    type="text" 
                    placeholder="Filtrar clientes WhatsApp..."
                    value={whatsappSearch}
                    onChange={(e) => setWhatsappSearch(e.target.value)}
                    className="w-full bg-white border border-zinc-100 rounded-lg py-1.5 pl-9 pr-4 text-xs focus:ring-2 focus:ring-emerald-500/10 outline-none transition-all"
                  />
                </div>
              </div>

              {/* List of Clients for WhatsApp */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {clients
                  .filter(c => c.name.toLowerCase().includes(whatsappSearch.toLowerCase()))
                  .map(client => (
                    <button
                      key={client.id}
                      onClick={() => setSelectedClient(client)}
                      className={cn(
                        "w-full p-4 rounded-xl flex items-center gap-3 transition-all",
                        selectedClient?.id === client.id 
                          ? "bg-zinc-100 text-zinc-900" 
                          : "hover:bg-white text-zinc-600"
                      )}
                    >
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-xs">
                        {client.name[0]}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-xs font-bold text-zinc-900 truncate">{client.name}</p>
                        <p className="text-[10px] text-zinc-400 truncate">{client.phone || 'Sem Telemóvel'}</p>
                      </div>
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.4)]" />
                    </button>
                  ))}
              </div>
            </>
          ) : (
            <>
              {/* Google Chat Contacts Sidebar */}
              <div className="p-6 border-b border-zinc-100">
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-4">Contactos Google Chat</h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="Procurar cliente..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white border border-zinc-100 rounded-xl py-2 pl-10 pr-4 text-xs focus:ring-2 focus:ring-vela-red/10 outline-none transition-all"
                  />
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2">
                {filteredClients.map(client => (
                  <button
                    key={client.id}
                    onClick={() => setSelectedClient(client)}
                    className={cn(
                      "w-full p-4 rounded-2xl flex items-center gap-3 transition-all mb-1",
                      selectedClient?.id === client.id 
                        ? "bg-zinc-950 text-white shadow-xl shadow-zinc-950/10" 
                        : "hover:bg-white text-zinc-600 hover:shadow-md"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm",
                      selectedClient?.id === client.id ? "bg-white/10" : "bg-zinc-100 text-zinc-400"
                    )}>
                      {client.name[0]}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-xs font-bold truncate">{client.name}</p>
                      <p className="text-[10px] truncate opacity-60">{client.email}</p>
                    </div>
                    {client.status === 'Ativo' && (
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}

        </div>

        {/* CHAT VIEWPORT */}
        <div className="flex-1 flex flex-col relative bg-zinc-50/10">
          
          {selectedClient ? (
            <>
              {/* Active Conversation Header */}
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-white z-10 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-base",
                    activeTab === 'whatsapp' 
                      ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                      : "bg-blue-50 text-blue-600 border border-blue-100"
                  )}>
                    {selectedClient.name[0]}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900">{selectedClient.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest font-sans">
                        {activeTab === 'whatsapp' 
                          ? `Atendimento WhatsApp ativo via: ${whatsappInstances.find(i => i.id === activeInstance)?.name}`
                          : "Google Chat Ativo"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Automation trigger tools if on WhatsApp */}
                {activeTab === 'whatsapp' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={triggerAutomatedMeetingAlert}
                      className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all"
                      title="Disparar lembrete automático"
                    >
                      <Clock size={12} />
                      Simular Alerta de Reunião (24h antes)
                    </button>
                  </div>
                )}
              </div>

              {/* Conversation Area */}
              <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-8 space-y-6"
              >
                
                {activeTab === 'whatsapp' ? (
                  /* WhatsApp Messages Render */
                  <>
                    <div className="flex justify-center my-2">
                      <span className="bg-zinc-100 text-[9px] font-sans text-zinc-400 px-3 py-1 rounded-full uppercase tracking-widest font-bold">
                        Canal de Comunicação Seguro Encriptado
                      </span>
                    </div>

                    {(simulatedChats[activeInstance] || []).map((msg) => {
                      const isMe = msg.sender === 'user';
                      return (
                        <div 
                          key={msg.id}
                          className={cn(
                            "flex gap-4 group",
                            isMe ? "flex-row-reverse" : "flex-row"
                          )}
                        >
                          <div className={cn(
                            "w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-[10px] font-black uppercase border shadow-sm transition-all",
                            isMe ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-900 border-zinc-100"
                          )}>
                            {isMe ? 'Eu' : selectedClient.name[0]}
                          </div>
                          
                          <div className={cn(
                            "flex flex-col max-w-[70%]",
                            isMe ? "items-end" : "items-start"
                          )}>
                            <div className={cn(
                              "px-5 py-3 rounded-2xl text-xs leading-[1.6] shadow-sm font-sans whitespace-pre-wrap",
                              msg.isAutomatic
                                ? "bg-amber-50 text-amber-900 border border-amber-200 rounded-2xl"
                                : isMe 
                                  ? "bg-emerald-600 text-white rounded-tr-none" 
                                  : "bg-white border border-zinc-100 text-zinc-700 rounded-tl-none"
                            )}>
                              {msg.text}
                            </div>
                            <div className="flex items-center gap-1 mt-1.5 px-1">
                              <span className="text-[9px] text-zinc-400 font-bold uppercase">
                                {msg.time}
                              </span>
                              {isMe && (
                                <CheckCheck size={13} className="text-blue-500" />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {isSimulatingBot && (
                      <div className="flex gap-4">
                        <div className="w-9 h-9 rounded-xl bg-white border border-zinc-100 flex items-center justify-center text-[10px] font-black text-zinc-400">
                          {selectedClient.name[0]}
                        </div>
                        <div className="bg-white border border-zinc-100 p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                          <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                          <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" />
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  /* Original Google Chat Messages Render */
                  <>
                    {isLoading ? (
                      <div className="flex flex-col items-center justify-center h-full gap-4">
                        <Loader2 size={32} className="animate-spin text-vela-red/40" />
                        <p className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.3em] font-sans">A ligar ao servidor...</p>
                      </div>
                    ) : errorType === 'CONFIG' ? (
                      <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center p-8">
                        <div className="w-20 h-20 rounded-3xl bg-white shadow-xl flex items-center justify-center mb-8 border border-zinc-100">
                          <RefreshCw size={32} className="text-zinc-300" />
                        </div>
                        <h4 className="text-sm font-black text-zinc-950 uppercase tracking-[0.2em] mb-4 font-sans">Google Chat não Configurado</h4>
                        <p className="text-xs text-zinc-500 leading-relaxed mb-8 font-sans">
                          A API do Google Chat está ativa, mas o seu projeto Google Cloud não está registado como um "Chat App". Pode abrir a conversa externa ou pedir ao administrador para configurar.
                        </p>
                        
                        <Button 
                          variant="primary"
                          className="w-full flex items-center justify-center gap-2 py-4 shadow-xl shadow-vela-red/20"
                          onClick={() => window.open(`https://chat.google.com/dm/${selectedClient.email}`, '_blank')}
                        >
                          Abrir Chat Externo <MessageSquare size={16} />
                        </Button>
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full opacity-20">
                        <MessageSquare size={64} className="text-zinc-300 mb-4" />
                        <p className="text-xs font-black text-zinc-400 uppercase tracking-[0.4em] font-sans">Sem conversas anteriores</p>
                      </div>
                    ) : (
                      messages.map((msg: any, idx: number) => {
                        const isMe = msg.sender?.type === 'HUMAN';
                        return (
                          <div 
                            key={msg.name || idx}
                            className={cn(
                              "flex gap-4 group",
                              isMe ? "flex-row-reverse" : "flex-row"
                            )}
                          >
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-[10px] font-black uppercase border shadow-sm transition-all group-hover:scale-105",
                              isMe ? "bg-zinc-950 text-white border-zinc-950" : "bg-white text-zinc-950 border-zinc-100"
                            )}>
                              {isMe ? 'EU' : selectedClient.name[0]}
                            </div>
                            
                            <div className={cn(
                              "flex flex-col max-w-[70%]",
                              isMe ? "items-end" : "items-start"
                            )}>
                              <div className={cn(
                                "px-5 py-4 rounded-2xl text-[13px] leading-[1.6] shadow-sm font-sans",
                                isMe 
                                  ? "bg-zinc-900 text-white rounded-tr-none" 
                                  : "bg-white border border-zinc-100 text-zinc-700 rounded-tl-none"
                              )}>
                                {msg.text}
                              </div>
                              <div className="flex items-center gap-2 mt-2 px-1">
                                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-tighter">
                                  {new Date(msg.createTime).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </>
                )}

              </div>

              {/* Chat Input Area */}
              <div className="p-6 border-t border-zinc-100 bg-white shadow-2xl">
                {activeTab === 'whatsapp' ? (
                  <form 
                    onSubmit={handleWhatsappSend}
                    className="flex items-center gap-3 bg-zinc-50 p-2 rounded-xl border border-zinc-100 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all"
                  >
                    <input 
                      type="text"
                      value={whatsappInput}
                      onChange={(e) => setWhatsappInput(e.target.value)}
                      placeholder={`Escreva uma resposta direta para ${selectedClient.name.split(' ')[0]} via WhatsApp...`}
                      className="flex-1 bg-transparent border-none py-2 px-3 text-xs text-zinc-900 placeholder:text-zinc-400 outline-none font-sans"
                    />
                    <button 
                      type="submit"
                      disabled={!whatsappInput.trim()}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-wider rounded-lg transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      <Send size={13} />
                      Enviar via WA
                    </button>
                  </form>
                ) : (
                  <form 
                    onSubmit={handleSend}
                    className="flex items-center gap-4 bg-zinc-50 p-2 rounded-2xl border border-zinc-100 focus-within:ring-2 focus-within:ring-vela-red/5 focus-within:border-vela-red/20 transition-all duration-300"
                  >
                    <input 
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder={`Escreva para ${selectedClient.name.split(' ')[0]} via Google Chat...`}
                      disabled={isLoading || isSending || errorType === 'CONFIG'}
                      className="flex-1 bg-transparent border-none py-3 px-3 text-xs text-zinc-900 placeholder:text-zinc-400 outline-none disabled:opacity-50 font-sans"
                    />
                    <button 
                      type="submit"
                      disabled={isLoading || isSending || !inputText.trim() || errorType === 'CONFIG'}
                      className="px-6 py-3 bg-zinc-900 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl hover:bg-vela-red shadow-lg transition-all flex items-center gap-3 disabled:opacity-50"
                    >
                      {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      Enviar
                    </button>
                  </form>
                )}
              </div>
            </>
          ) : (
            /* Selected Client Placeholder */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-zinc-50/20">
              <div className="w-16 h-16 rounded-2xl bg-white shadow-xl flex items-center justify-center mb-6 border border-zinc-100">
                <MessageSquare size={32} className="text-zinc-300" />
              </div>
              <h3 className="text-sm font-bold text-zinc-900 mb-1">Selecione um Cliente</h3>
              <p className="text-zinc-400 text-[11px] max-w-xs leading-relaxed font-sans">
                Selecione um cliente da lista à esquerda para conversar e testar as automatizações integradas de WhatsApp e Google Chat.
              </p>
            </div>
          )}

        </div>

      </div>

      {/* QR CODE CONNECTION MODAL SIMULATOR */}
      <AnimatePresence>
        {showQrModal && (
          <div className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full p-8 border border-zinc-100 shadow-2xl relative"
            >
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                  <QrCode size={24} />
                </div>
                <h3 className="text-base font-bold text-zinc-950">Ligar Novo Canal de WhatsApp</h3>
                <p className="text-[11px] text-zinc-500 font-sans mt-1">Conecte o seu telemóvel ao CRM do Vela OS lendo o QR Code abaixo</p>
              </div>

              <div className="bg-zinc-50 p-6 rounded-2xl border border-zinc-100 flex flex-col items-center justify-center min-h-[220px]">
                {qrStep === 'generating' ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 size={40} className="text-emerald-500 animate-spin" />
                    <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Gerando QR Code Único...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 text-center">
                    {/* Simulated QR Code using CSS Blocks */}
                    <div className="p-4 bg-white rounded-xl border-4 border-zinc-950 shadow-md flex items-center justify-center w-40 h-40 relative">
                      <div className="absolute inset-0 bg-[radial-gradient(#000_15%,transparent_16%)] bg-[length:12px_12px] opacity-40" />
                      <div className="w-8 h-8 bg-zinc-950 absolute top-3 left-3 rounded-sm border-2 border-white" />
                      <div className="w-8 h-8 bg-zinc-950 absolute top-3 right-3 rounded-sm border-2 border-white" />
                      <div className="w-8 h-8 bg-zinc-950 absolute bottom-3 left-3 rounded-sm border-2 border-white" />
                      <span className="bg-emerald-500 text-white text-[10px] font-black tracking-widest px-2 py-1 rounded absolute shadow-md uppercase font-sans">
                        LEIA-ME
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-[10px] uppercase font-sans animate-pulse">
                      <Zap size={12} />
                      Scan pendente a partir do seu telemóvel
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <Button 
                  variant="secondary" 
                  className="flex-1 py-3 text-[10px]" 
                  onClick={() => setShowQrModal(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  variant="primary" 
                  className="flex-1 py-3 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg"
                  disabled={qrStep === 'generating'}
                  onClick={handleFinishQrConnect}
                >
                  Confirmar Leitura (Simular)
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DETAILED INTEGRATION & COST GUIDE PANEL (OVERLAY PANEL) */}
      <AnimatePresence>
        {showConfigGuide && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute inset-y-0 right-0 w-[550px] bg-white border-l border-zinc-200 shadow-2xl z-40 flex flex-col overflow-hidden"
          >
            {/* Header of Guide */}
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-950 text-white">
              <div className="flex items-center gap-2.5">
                <Settings size={20} className="text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider">Como Ligar o seu WhatsApp</h3>
                  <p className="text-[10px] text-zinc-400 font-sans">Guia Técnico Prático & Custos da Integração</p>
                </div>
              </div>
              <button 
                onClick={() => setShowConfigGuide(false)}
                className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all text-xs font-bold"
              >
                Fechar
              </button>
            </div>

            {/* Guide Content Scrollable */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8 font-sans">
              
              {/* SECTION: PRÓXIMOS PASSOS */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-[0.15em] text-zinc-400 mb-4 flex items-center gap-2">
                  <Zap size={14} className="text-emerald-500" />
                  Próximos Passos Para Ativar
                </h4>
                
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
                    <p className="text-xs font-bold text-zinc-900 mb-1">Passo 1: Escolher a API/Gateway de Ligação</p>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      Para ter o WhatsApp no site, deve escolher se prefere a <b>API Oficial da Meta</b> (ideal para mensagens em massa com templates pré-aprovados) ou um <b>Gateway QR Code Independente</b> como a <i>Evolution API</i> ou <i>Z-API</i> (permite ligar qualquer número como no computador normal).
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
                    <p className="text-xs font-bold text-zinc-900 mb-1">Passo 2: Configurar o Servidor de Receção (Webhooks)</p>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      Iremos configurar uma rota no backend deste site (ex: <code className="bg-zinc-200 text-zinc-800 px-1 py-0.5 rounded font-mono text-[10px]">/api/whatsapp/webhook</code>) para que, no instante em que o cliente envie mensagem, o gateway avise o site e grave no Firestore.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
                    <p className="text-xs font-bold text-zinc-900 mb-1">Passo 3: Ativar o Agendador de Tarefas (Cron Job)</p>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      Para fazer o envio automático das reuniões do Google Meet exatamente 24 horas antes do agendamento, configuramos uma tarefa automática recorrente no nosso servidor Express em <code className="bg-zinc-200 text-zinc-800 px-1 py-0.5 rounded font-mono text-[10px]">server.ts</code> que corre de hora a hora.
                    </p>
                  </div>
                </div>
              </div>

              {/* SECTION: TABELA DE CUSTOS TRANSPARENTE */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-[0.15em] text-zinc-400 mb-4 flex items-center gap-2">
                  <DollarSign size={14} className="text-emerald-500" />
                  Estrutura de Custos
                </h4>
                
                <div className="border border-zinc-150 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 text-[10px] font-black uppercase tracking-wider border-b border-zinc-150 text-zinc-500">
                        <th className="p-3 pl-4">Opção de Ligação</th>
                        <th className="p-3">Custo Mensal Fixo</th>
                        <th className="p-3 pr-4">Custo por Mensagem</th>
                      </tr>
                    </thead>
                    <tbody className="text-[11px] text-zinc-600">
                      <tr className="border-b border-zinc-100 hover:bg-zinc-50/50">
                        <td className="p-3 pl-4 font-bold text-zinc-950">Evolution API<br/><span className="text-[9px] font-normal text-zinc-400">VPS Própria (Código Aberto)</span></td>
                        <td className="p-3 text-emerald-600 font-bold">€4 a €10 / mês<br/><span className="text-[9px] font-normal text-zinc-400">Apenas custo da VPS</span></td>
                        <td className="p-3 text-zinc-500 font-bold">€0.00 / grátis<br/><span className="text-[9px] font-normal text-zinc-400">Mensagens ilimitadas</span></td>
                      </tr>
                      <tr className="border-b border-zinc-100 hover:bg-zinc-50/50">
                        <td className="p-3 pl-4 font-bold text-zinc-950">Z-API / Outros<br/><span className="text-[9px] font-normal text-zinc-400">Gateway Pronto a Usar</span></td>
                        <td className="p-3 text-amber-600 font-bold">~€15 a €20 / mês<br/><span className="text-[9px] font-normal text-zinc-400">Por número conectado</span></td>
                        <td className="p-3 text-zinc-500 font-bold">€0.00 / grátis<br/><span className="text-[9px] font-normal text-zinc-400">Sem limite por envio</span></td>
                      </tr>
                      <tr className="hover:bg-zinc-50/50">
                        <td className="p-3 pl-4 font-bold text-zinc-950">API Oficial Meta<br/><span className="text-[9px] font-normal text-zinc-400">Cloud API Direta da Meta</span></td>
                        <td className="p-3 text-emerald-600 font-bold">€0.00<br/><span className="text-[9px] font-normal text-zinc-400">Sem taxa mensal</span></td>
                        <td className="p-3 text-amber-700 font-bold">€0.02 a €0.06 / conversa<br/><span className="text-[9px] font-normal text-zinc-400">Primeiras 1000/mês GRÁTIS</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECURITY WARNING & RECOMMENDATION */}
              <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800">
                <div className="flex gap-3">
                  <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold mb-1">Recomendação Vela OS</p>
                    <p className="text-[11px] leading-relaxed">
                      Se já tem um telemóvel comercial e quer começar a testar <b>sem gastar dinheiro</b>, a melhor opção é instalar a <b>Evolution API</b> (código aberto) num servidor privado. Desta forma, pode conectar múltiplos computadores de forma 100% livre e autónoma!
                    </p>
                  </div>
                </div>
              </div>

            </div>

            {/* Footer of Guide */}
            <div className="p-6 border-t border-zinc-100 bg-zinc-50 flex gap-3">
              <Button 
                variant="primary" 
                className="flex-1 py-3 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => setShowConfigGuide(false)}
              >
                Compreendido, prosseguir testes!
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
