import React from 'react';
import { GlassCard, Badge, Button, Modal } from '../components/UI';
import { 
  Calendar as CalendarIcon, 
  Video, 
  Clock, 
  Plus,
  ExternalLink,
  Users,
  Edit3,
  Trash2
} from 'lucide-react';
import { motion } from 'motion/react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useBackgroundAction } from '../contexts/BackgroundActionContext';
import { ScheduleMeetingModal } from '../components/ScheduleMeetingModal';
import { EditMeetingModal } from '../components/EditMeetingModal';
import { OpenHostingerLinksButton } from '../components/HostingerPrepSelector';
import { Meeting } from '../types';

export const MeetingsPage: React.FC = () => {
  const { deleteMeeting, meetings } = useWorkspace();
  const { runBackgroundAction } = useBackgroundAction();
  const [showModal, setShowModal] = React.useState(false);
  const [editingMeeting, setEditingMeeting] = React.useState<Meeting | null>(null);
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

  const executeDeleteMeeting = (id: string, clientName: string) => {
    runBackgroundAction({
      title: `A eliminar agendamento com "${clientName}"...`,
      action: async () => {
        await deleteMeeting(id);
      },
      errorMessage: `Erro ao eliminar agendamento com "${clientName}".`
    });
  };

  const withMeetLinkCount = currentAndFutureMeetings.filter(m => !!m.link).length;

  return (
    <div className="space-y-8 pb-12">
      {/* Header & Summary Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-white tracking-tight">
            Agenda de Reuniões
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Gestão de sessões agendadas com sincronização automática no Google Calendar &amp; Meet.
          </p>
        </div>
        <Button
          variant="primary"
          className="px-5 py-2.5 text-xs shrink-0"
          onClick={() => setShowModal(true)}
        >
          <Plus size={15} /> Agendar Reunião
        </Button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <GlassCard hoverable className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-400">Próximas Reuniões</p>
              <p className="text-3xl font-display font-bold text-white mt-1 tabular-nums">{currentAndFutureMeetings.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-vela-red/10 border border-vela-red/20 flex items-center justify-center text-vela-red">
              <CalendarIcon size={18} />
            </div>
          </div>
        </GlassCard>

        <GlassCard hoverable className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-400">Com Link Meet</p>
              <p className="text-3xl font-display font-bold text-emerald-400 mt-1 tabular-nums">{withMeetLinkCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Video size={18} />
            </div>
          </div>
        </GlassCard>

        <GlassCard hoverable className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-400">Realizadas / Anteriores</p>
              <p className="text-3xl font-display font-bold text-zinc-300 mt-1 tabular-nums">{olderMeetings.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-zinc-400">
              <Clock size={18} />
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="space-y-4">

        <ScheduleMeetingModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title="Novo Agendamento Workspace"
          subtitle="Sincronização direta com Google Calendar & Meet"
          confirmLabel="Confirmar e Sincronizar"
        />

        <EditMeetingModal
          meeting={editingMeeting}
          onClose={() => setEditingMeeting(null)}
        />

        <Modal 
          isOpen={!!meetingToDelete} 
          onClose={() => setMeetingToDelete(null)} 
          title="Eliminar Agendamento"
          subtitle={meetingToDelete?.clientName}
          size="sm"
        >
          {meetingToDelete && (
            <div className="space-y-5">
              <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl space-y-2">
                <p className="text-sm text-zinc-200 leading-relaxed">
                  Tem a certeza que deseja eliminar a reunião com <span className="text-white font-semibold">"{meetingToDelete.clientName}"</span>?
                </p>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  O evento correspondente na "Agenda Vela" do Google Calendar será apagado definitivamente e esta ação não pode ser desfeita.
                </p>
              </div>
              <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
                <Button 
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setMeetingToDelete(null)}
                >
                  Cancelar
                </Button>
                <Button 
                  variant="primary"
                  className="flex-1 bg-red-600 hover:bg-red-500 border-red-600 text-white"
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

        <div className="space-y-4">
          {meetings.length > 0 ? (
            <div className="space-y-4">
              {displayedMeetings.length > 0 ? (
                displayedMeetings.map((meeting, i) => {
                  const isUpcoming = new Date(meeting.rawDate).getTime() >= twoHoursAgo;
                  return (
                    <motion.div
                      key={meeting.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <GlassCard hoverable className="p-5 sm:p-6">
                        <div className="flex flex-col md:flex-row md:items-center gap-5 md:gap-6">
                          {/* Date/Time Block */}
                          <div className="md:w-32 shrink-0 md:border-r md:border-white/[0.06] md:pr-6 flex md:flex-col items-baseline md:items-start justify-between gap-2">
                            <div>
                              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Data</p>
                              <p className="text-xl font-display font-bold text-white tracking-tight tabular-nums leading-tight mt-0.5">
                                {meeting.date.split(' ')[0]}
                              </p>
                              <p className="text-xs text-zinc-400 font-medium">
                                {meeting.date.split(' ').slice(1).join(' ')}
                              </p>
                            </div>
                            <div className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-300 tabular-nums md:mt-2">
                              <Clock size={12} className="text-vela-red" />
                              <span>{meeting.time}</span>
                            </div>
                          </div>

                          {/* Info Block */}
                          <div className="flex-1 min-w-0 space-y-2.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={isUpcoming ? 'primary' : 'default'}>
                                {meeting.type === 'Discovery' ? 'Descoberta' :
                                 meeting.type === 'Proposal' ? 'Proposta' :
                                 meeting.type === 'Delivery' ? 'Entrega' : meeting.type}
                              </Badge>
                              {!isUpcoming && (
                                <Badge variant="default">Anterior</Badge>
                              )}
                            </div>

                            <h3 className="text-lg font-bold text-white tracking-tight truncate">
                              {meeting.clientName}
                            </h3>

                            <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400">
                              <button
                                type="button"
                                disabled={!meeting.link}
                                onClick={() => meeting.link && window.open(meeting.link, '_blank')}
                                className="inline-flex items-center gap-1.5 hover:text-white hover:-translate-y-[1px] disabled:hover:translate-y-0 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Video size={14} className="text-vela-red" />
                                <span>{meeting.link ? 'Entrar no Google Meet' : 'Sem link de vídeo'}</span>
                              </button>
                              <span className="text-zinc-700">·</span>
                              <button
                                type="button"
                                onClick={() => window.open('https://calendar.google.com', '_blank')}
                                className="inline-flex items-center gap-1.5 hover:text-white hover:-translate-y-[1px] transition-all duration-150"
                              >
                                <Users size={14} className="text-zinc-500" />
                                <span>Google Calendar</span>
                              </button>
                            </div>
                            {meeting.hostingerLinks && meeting.hostingerLinks.length > 0 && (
                              <p className="text-[11px] text-violet-300/80 truncate">
                                Sites Hostinger: {meeting.hostingerLinks.map(l => `${l.entityName} (${l.projectName})`).join(' · ')}
                              </p>
                            )}
                          </div>

                          {/* Action Block */}
                          <div className="flex flex-wrap sm:flex-nowrap md:flex-col items-center md:items-end gap-2 shrink-0 md:pl-4 md:border-l md:border-white/[0.06]">
                            <Button
                              variant={meeting.link ? 'primary' : 'secondary'}
                              disabled={!meeting.link}
                              className="px-4 py-2 text-[11px] w-full sm:w-auto"
                              onClick={() => meeting.link && window.open(meeting.link, '_blank')}
                            >
                              <span>Entrar Agora</span>
                              <ExternalLink size={12} />
                            </Button>

                            <OpenHostingerLinksButton
                              links={meeting.hostingerLinks}
                              className="w-full sm:w-auto"
                            />

                            {isUpcoming && (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setEditingMeeting(meeting)}
                                  className="px-2.5 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.15] text-zinc-400 hover:text-emerald-400 text-[11px] font-semibold hover:-translate-y-[1px] active:translate-y-0 transition-all duration-150 inline-flex items-center gap-1"
                                  title="Editar Reunião e Links Hostinger"
                                >
                                  <Edit3 size={12} />
                                  <span>Editar</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setMeetingToDelete({ id: meeting.id, clientName: meeting.clientName })}
                                  className="px-2.5 py-1.5 rounded-lg bg-white/[0.03] hover:bg-red-500/15 border border-white/[0.06] hover:border-red-500/25 text-zinc-400 hover:text-red-400 text-[11px] font-semibold hover:-translate-y-[1px] active:translate-y-0 transition-all duration-150 inline-flex items-center gap-1"
                                  title="Eliminar Reunião"
                                >
                                  <Trash2 size={12} />
                                  <span>Eliminar</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </GlassCard>
                    </motion.div>
                  );
                })
              ) : (
                <div className="py-12 text-center border border-dashed border-white/[0.08] rounded-2xl">
                  <p className="text-xs font-medium text-zinc-400">Nenhuma reunião futura ou recente agendada.</p>
                </div>
              )}

              {olderMeetings.length > 0 && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="secondary"
                    onClick={() => setShowPreviousMeetings(!showPreviousMeetings)}
                    className="text-xs py-2 px-5"
                  >
                    {showPreviousMeetings ? 'Ocultar anteriores' : `Ver anteriores (${olderMeetings.length})`}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 border border-dashed border-white/[0.08] rounded-2xl text-center px-6">
              <CalendarIcon size={40} strokeWidth={1.25} className="mb-3 text-zinc-600" />
              <p className="text-sm font-semibold text-white">O seu calendário está vazio</p>
              <p className="text-xs text-zinc-500 mt-1">Agende uma reunião para sincronizar automaticamente com o Google Meet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
