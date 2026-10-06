import React from 'react';
import { GlassCard, Badge, Button, Modal, Input, Select } from '../components/UI';
import { 
  Calendar as CalendarIcon, 
  Video, 
  Clock, 
  MapPin, 
  MessageSquare, 
  Plus,
  ExternalLink,
  Users,
  MoreHorizontal,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useBackgroundAction } from '../contexts/BackgroundActionContext';

export const MeetingsPage: React.FC = () => {
  const { scheduleMeet, updateMeeting, deleteMeeting, isLoading, meetings, clients } = useWorkspace();
  const { runBackgroundAction } = useBackgroundAction();
  const [showModal, setShowModal] = React.useState(false);
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [editingMeeting, setEditingMeeting] = React.useState<any>(null);
  const [meetingToDelete, setMeetingToDelete] = React.useState<{ id: string; clientName: string } | null>(null);
  const [showPreviousMeetings, setShowPreviousMeetings] = React.useState(false);

  const now = Date.now();
  const twoHoursAgo = now - 2 * 60 * 60 * 1000;
  const currentAndFutureMeetings = (meetings || []).filter(
    m => new Date(m.rawDate).getTime() >= twoHoursAgo
  );
  // Sort future/current chronologically ascending (closest upcoming first)
  currentAndFutureMeetings.sort((a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime());

  const olderMeetings = (meetings || []).filter(
    m => new Date(m.rawDate).getTime() < twoHoursAgo
  );
  // Sort older/past chronologically descending (most recent past first)
  olderMeetings.sort((a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime());

  const displayedMeetings = showPreviousMeetings 
    ? [...currentAndFutureMeetings, ...olderMeetings] 
    : currentAndFutureMeetings;
  const [newMeeting, setNewMeeting] = React.useState({
    clientId: '',
    date: new Date(Date.now() + 3600000).toISOString().slice(0, 16) // Default to 1 hour from now
  });

  const handleSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    const client = clients.find(c => c.id === newMeeting.clientId);
    if (!client || !newMeeting.date) return;

    const summary = `Reunião: ${client.name}`;
    const dateStr = newMeeting.date;

    // 1. Close modal IMMEDIATELY
    setShowModal(false);
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

  const executeDeleteMeeting = (id: string, clientName: string) => {
    runBackgroundAction({
      title: `A eliminar agendamento com "${clientName}"...`,
      action: async () => {
        await deleteMeeting(id);
      },
      errorMessage: `Erro ao eliminar agendamento com "${clientName}".`
    });
  };

  const handleEditMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMeeting || !editingMeeting.date) return;
    
    const { id, clientName, date } = editingMeeting;
    setShowEditModal(false);
    
    runBackgroundAction({
      title: `A atualizar agendamento com "${clientName}"...`,
      action: async () => {
        await updateMeeting(id, date + ":00");
      },
      errorMessage: `Erro ao atualizar agendamento com "${clientName}".`
    });
  };

  return (
    <div className="pb-12">
      {/* Schedule Column */}
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-white uppercase tracking-[0.3em] font-sans flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-vela-red shadow-[0_0_8px_rgba(255,34,28,0.4)]" />
            Agenda Próxima
          </h2>
          <Button 
            variant="primary" 
            className="px-6 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2"
            onClick={() => setShowModal(true)}
          >
            <Plus size={14} /> Agendar Reunião
          </Button>
        </div>

        <Modal 
          isOpen={showModal} 
          onClose={() => setShowModal(false)} 
          title="Novo Agendamento workspace"
        >
          <form onSubmit={handleSchedule} className="space-y-4">
            <Select 
              label="Selecionar Entidade"
              value={newMeeting.clientId}
              onChange={e => setNewMeeting({ ...newMeeting, clientId: e.target.value })}
              required
            >
              <option value="" className="bg-zinc-900">Selecione o Cliente / Lead</option>
              {clients.map(c => (
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
              Esta ação criará um evento no Google Calendar e gerará um link Meet automático.
            </p>
            <Button 
              type="submit" 
              className="w-full py-4 mt-4 transition-all"
            >
              Confirmar e Sincronizar
            </Button>
          </form>
        </Modal>

        <Modal 
          isOpen={showEditModal} 
          onClose={() => setShowEditModal(false)} 
          title="Editar Agendamento Workspace"
        >
          {editingMeeting && (
            <form onSubmit={handleEditMeeting} className="space-y-4">
              <Input 
                label="Reunião com" 
                type="text"
                value={editingMeeting.clientName}
                disabled
              />
              <Input 
                label="Nova Data e Hora" 
                type="datetime-local"
                value={editingMeeting.date}
                onChange={e => setEditingMeeting({ ...editingMeeting, date: e.target.value })}
                required
              />
              <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-2 mb-6">
                Esta ação atualizará a hora da reunião no seu Google Calendar.
              </p>
              <Button 
                type="submit" 
                className="w-full py-4 mt-4 transition-all"
              >
                Atualizar e Sincronizar
              </Button>
            </form>
          )}
        </Modal>

        <Modal 
          isOpen={!!meetingToDelete} 
          onClose={() => setMeetingToDelete(null)} 
          title="Eliminar Agendamento"
        >
          {meetingToDelete && (
            <div className="space-y-6 pt-2">
              <p className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider leading-relaxed">
                Tem a certeza de que deseja eliminar o agendamento de reunião com <span className="text-white">"{meetingToDelete.clientName}"</span>?
              </p>
              <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest leading-relaxed">
                Esta ação apagará definitivamente o evento correspondente na sua "Agenda Vela" do Google Calendar e não pode ser desfeita.
              </p>
              <div className="flex gap-4 pt-4">
                <Button 
                  variant="secondary"
                  className="flex-1 py-3 text-[9px] font-black tracking-widest border-white/5"
                  onClick={() => setMeetingToDelete(null)}
                >
                  Cancelar
                </Button>
                <Button 
                  variant="primary"
                  className="flex-1 py-3 text-[9px] font-black tracking-widest bg-vela-red hover:bg-vela-red/80 text-white"
                  onClick={() => {
                    executeDeleteMeeting(meetingToDelete.id, meetingToDelete.clientName);
                    setMeetingToDelete(null);
                  }}
                >
                  Confirmar e Eliminar
                </Button>
              </div>
            </div>
          )}
        </Modal>

        <div className="space-y-6">
          {meetings.length > 0 ? (
            <div className="space-y-6">
              {displayedMeetings.length > 0 ? (
                displayedMeetings.map((meeting, i) => (
                  <motion.div
                    key={meeting.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <GlassCard hoverable className="p-8 border-white/5 group relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal size={16} className="text-zinc-600" />
                      </div>

                      <div className="flex flex-col md:flex-row md:items-center gap-8">
                        {/* Date/Time Block */}
                        <div className="w-24 text-center md:border-r md:border-white/5 md:pr-8">
                          <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest font-sans mb-2">Data</p>
                          <p className="text-2xl font-display font-black text-white italic tracking-tighter leading-none mb-1">
                            {meeting.date.split(' ')[0]}
                          </p>
                          <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest font-sans">{meeting.date.split(' ').slice(1).join(' ')}</p>
                        </div>

                        {/* Info Block */}
                        <div className="flex-1 space-y-4">
                          <div className="flex items-center gap-3">
                            <Badge className="bg-white/5 text-white/60 border-white/10 text-[8px] uppercase tracking-widest">
                              {meeting.type === 'Discovery' ? 'Descoberta' : 
                               meeting.type === 'Proposal' ? 'Proposta' : 
                               meeting.type === 'Delivery' ? 'Entrega' : meeting.type}
                            </Badge>
                            <div className="flex items-center gap-2 text-zinc-400 font-sans text-[10px] font-bold uppercase tracking-widest">
                              <Clock size={12} className="text-vela-red/60" />
                              {meeting.time}
                            </div>
                          </div>
                          
                          <div>
                            <h3 className="text-xl font-display font-black text-white tracking-tight uppercase italic group-hover:text-vela-red transition-colors">
                              {meeting.clientName}
                            </h3>
                          </div>

                          <div className="flex flex-wrap gap-6">
                            <div 
                              className="flex items-center gap-2 text-zinc-500 group/link hover:text-white transition-colors cursor-pointer"
                              onClick={() => meeting.link && window.open(meeting.link, '_blank')}
                            >
                              <Video size={14} className="group-hover/link:text-vela-red" />
                              <span className="text-[10px] font-bold uppercase tracking-widest font-sans">{meeting.link ? 'Entrar no Google Meet' : 'Sem link de vídeo'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-zinc-500 group/link hover:text-white transition-colors cursor-pointer" onClick={() => window.open('https://calendar.google.com', '_blank')}>
                              <Users size={14} className="group-hover/link:text-vela-red" />
                              <span className="text-[10px] font-bold uppercase tracking-widest font-sans">Sinc G-Cal</span>
                            </div>
                          </div>
                        </div>

                        {/* Action Block */}
                        <div className="md:pl-8 flex flex-col gap-3">
                          <Button 
                            variant="secondary" 
                            disabled={!meeting.link}
                            className="px-6 py-3 border-white/5 flex items-center gap-2 group-hover:bg-white/[0.05]"
                            onClick={() => meeting.link && window.open(meeting.link, '_blank')}
                          >
                            <span className="text-[9px]">Entrar Agora</span>
                            <ExternalLink size={12} />
                          </Button>
                          <button 
                            className="text-[9px] text-zinc-600 font-black uppercase tracking-[0.2em] hover:text-white transition-all text-center font-sans"
                            onClick={() => window.open('https://calendar.google.com', '_blank')}
                          >
                            Ver no Calendário
                          </button>
                          {new Date(meeting.rawDate).getTime() >= twoHoursAgo && (
                            <div className="flex gap-2 justify-center mt-1 border-t border-white/5 pt-2">
                              <button 
                                className="text-[8px] text-zinc-500 font-black uppercase tracking-[0.15em] hover:text-emerald-400 transition-all font-sans"
                                onClick={() => {
                                  setEditingMeeting({
                                    id: meeting.id,
                                    clientName: meeting.clientName,
                                    date: new Date(meeting.rawDate).toISOString().slice(0, 16)
                                  });
                                  setShowEditModal(true);
                                }}
                              >
                                Editar
                              </button>
                              <span className="text-zinc-800 text-[8px]">•</span>
                              <button 
                                className="text-[8px] text-zinc-500 font-black uppercase tracking-[0.15em] hover:text-vela-red transition-all font-sans"
                                onClick={() => setMeetingToDelete({ id: meeting.id, clientName: meeting.clientName })}
                              >
                                Eliminar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 opacity-40">
                  <p className="text-[11px] uppercase font-black tracking-widest text-zinc-500 text-center leading-relaxed">Nenhuma reunião recente ou futura agendada</p>
                </div>
              )}

              {olderMeetings.length > 0 && (
                <div className="flex justify-center pt-4">
                  <Button
                    variant="secondary"
                    onClick={() => setShowPreviousMeetings(!showPreviousMeetings)}
                    className="text-[10px] font-black uppercase tracking-[0.2em] py-2.5 px-6 border-white/5 hover:bg-white/10"
                  >
                    {showPreviousMeetings ? 'Ocultar anteriores' : 'Ver anteriores'}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 opacity-30 px-8 text-center italic">
              <CalendarIcon size={48} strokeWidth={1} className="mb-4" />
              <p className="text-[11px] uppercase font-black tracking-widest leading-relaxed">O seu calendário está limpo.<br />Agende uma reunião para começar.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
