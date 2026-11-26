import React from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Modal, Input, Button } from './UI';
import { Meeting } from '../types';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useBackgroundAction } from '../contexts/BackgroundActionContext';
import { HostingerLinksSelector, useAvailableHostingerLinks } from './HostingerPrepSelector';
import { normalizeWebsiteLinkUrl } from './WebsiteLinksSection';

interface EditMeetingModalProps {
  meeting: Meeting | null;
  onClose: () => void;
}

const toLocalDateTimeInput = (rawDate?: string) => {
  const d = rawDate ? new Date(rawDate) : new Date(Date.now() + 3600000);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const EditMeetingModal: React.FC<EditMeetingModalProps> = ({
  meeting,
  onClose,
}) => {
  const { updateMeeting } = useWorkspace();
  const { runBackgroundAction } = useBackgroundAction();
  const availableHostingerLinks = useAvailableHostingerLinks();

  const [date, setDate] = React.useState('');
  const [selectedHostingerIds, setSelectedHostingerIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!meeting) return;

    setDate(toLocalDateTimeInput(meeting.rawDate));

    const matchedIds = Array.from(
      new Set(
        (meeting.hostingerLinks || [])
          .map((hl) => {
            if (availableHostingerLinks.some((opt) => opt.id === hl.id)) {
              return hl.id;
            }
            const byUrl = availableHostingerLinks.find(
              (opt) => normalizeWebsiteLinkUrl(opt.url) === normalizeWebsiteLinkUrl(hl.url)
            );
            return byUrl?.id || '';
          })
          .filter(Boolean)
      )
    );
    setSelectedHostingerIds(matchedIds);
  }, [meeting?.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!meeting || !date) return;

    const { id, clientName } = meeting;
    const targetDate = date;
    const chosenHostingerLinks = availableHostingerLinks
      .filter((item) => selectedHostingerIds.includes(item.id))
      .map(({ id: itemId, entityName, projectName, url }) => ({
        id: itemId,
        entityName,
        projectName,
        url,
      }));

    onClose();

    runBackgroundAction({
      title: `A atualizar agendamento com "${clientName}"...`,
      action: async () => {
        await updateMeeting(id, targetDate + ':00', chosenHostingerLinks);
      },
      errorMessage: `Erro ao atualizar agendamento com "${clientName}".`,
    });
  };

  return (
    <Modal
      isOpen={!!meeting}
      onClose={onClose}
      title="Editar Agendamento Workspace"
      subtitle={meeting?.clientName}
      size="md"
    >
      {meeting && (
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Reunião com"
            type="text"
            value={meeting.clientName}
            disabled
          />
          <Input
            label="Nova Data e Hora"
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            icon={<CalendarIcon size={15} />}
            required
          />

          <HostingerLinksSelector
            selectedIds={selectedHostingerIds}
            onChange={setSelectedHostingerIds}
          />

          <p className="text-xs text-zinc-400 leading-relaxed">
            Esta ação atualizará a data, hora e os links Hostinger diretamente no seu Google Calendar.
          </p>

          <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1">
              Atualizar e Sincronizar
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
