import React from 'react';
import { Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import { Modal, Select, Input, Button } from './UI';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useBackgroundAction } from '../contexts/BackgroundActionContext';
import { HostingerLinksSelector, useAvailableHostingerLinks } from './HostingerPrepSelector';

export type EntityCollection = 'clients' | 'prospects' | 'leads';

interface SchedulableProject {
  id: string;
  collection: EntityCollection;
  name: string;
  status: string;
  projectStartDate?: string;
  associatedMeetingId?: string;
  associatedMeetingIds?: string[];
}

interface SchedulableEntity {
  key: string;
  id: string;
  collection: EntityCollection;
  categoryLabel: 'Cliente' | 'Prospect' | 'Lead';
  name: string;
  projects: SchedulableProject[];
}

interface ScheduleMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  confirmLabel?: string;
  initialEntity?: { collection: EntityCollection; id: string };
  initialProjectId?: string;
}

const getDefaultMeetingDate = () => {
  const d = new Date(Date.now() + 3600000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatDateShort = (iso?: string) => {
  if (!iso) return '';
  const parts = iso.split('T')[0].split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

export const ScheduleMeetingModal: React.FC<ScheduleMeetingModalProps> = ({
  isOpen,
  onClose,
  title = 'Agendar Reunião',
  subtitle = 'Sincronização direta com Google Calendar & Meet',
  confirmLabel = 'Confirmar e Sincronizar',
  initialEntity,
  initialProjectId,
}) => {
  const { clients, prospects, leads, scheduleMeet, updateClient, updateProspect, updateLead } = useWorkspace();
  const { runBackgroundAction } = useBackgroundAction();

  const { clientEntities, prospectEntities, leadEntities, allEntities } = React.useMemo(() => {
    const allClients = clients || [];

    const clientList: SchedulableEntity[] = allClients
      .filter((c) => !c.parentClientId && c.status !== 'Lead')
      .map((c) => {
        const projects: SchedulableProject[] = [];
        if (!c.projectRemoved) {
          projects.push({
            id: c.id,
            collection: 'clients',
            name: c.serviceType || 'Projeto Geral',
            status: c.status,
            projectStartDate: c.projectStartDate,
            associatedMeetingId: c.associatedMeetingId,
            associatedMeetingIds: c.associatedMeetingIds,
          });
        }
        allClients
          .filter((sub) => sub.parentClientId === c.id && !sub.projectRemoved)
          .forEach((sub) => {
            projects.push({
              id: sub.id,
              collection: 'clients',
              name: sub.serviceType || 'Projeto Geral',
              status: sub.status,
              projectStartDate: sub.projectStartDate,
              associatedMeetingId: sub.associatedMeetingId,
              associatedMeetingIds: sub.associatedMeetingIds,
            });
          });
        return {
          key: `clients:${c.id}`,
          id: c.id,
          collection: 'clients' as const,
          categoryLabel: 'Cliente' as const,
          name: c.name || 'Cliente sem nome',
          projects,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt'));

    const prospectList: SchedulableEntity[] = (prospects || [])
      .map((p: any) => ({
        key: `prospects:${p.id}`,
        id: p.id,
        collection: 'prospects' as const,
        categoryLabel: 'Prospect' as const,
        name: p.name || 'Prospect sem nome',
        projects: [
          {
            id: p.id,
            collection: 'prospects' as const,
            name: p.serviceType || 'Projeto Geral',
            status: p.status || 'Por Agendar',
            projectStartDate: p.projectStartDate,
            associatedMeetingId: p.associatedMeetingId,
            associatedMeetingIds: p.associatedMeetingIds,
          },
        ],
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt'));

    const legacyLeadClients: SchedulableEntity[] = allClients
      .filter((c) => !c.parentClientId && c.status === 'Lead')
      .map((c) => {
        const projects: SchedulableProject[] = [];
        if (!c.projectRemoved) {
          projects.push({
            id: c.id,
            collection: 'clients',
            name: c.serviceType || 'Projeto Geral',
            status: c.status,
            projectStartDate: c.projectStartDate,
            associatedMeetingId: c.associatedMeetingId,
            associatedMeetingIds: c.associatedMeetingIds,
          });
        }
        allClients
          .filter((sub) => sub.parentClientId === c.id && !sub.projectRemoved)
          .forEach((sub) => {
            projects.push({
              id: sub.id,
              collection: 'clients',
              name: sub.serviceType || 'Projeto Geral',
              status: sub.status,
              projectStartDate: sub.projectStartDate,
              associatedMeetingId: sub.associatedMeetingId,
              associatedMeetingIds: sub.associatedMeetingIds,
            });
          });
        return {
          key: `clients:${c.id}`,
          id: c.id,
          collection: 'clients' as const,
          categoryLabel: 'Lead' as const,
          name: c.name || 'Lead sem nome',
          projects,
        };
      });

    const leadList: SchedulableEntity[] = [
      ...(leads || []).map((l: any) => ({
        key: `leads:${l.id}`,
        id: l.id,
        collection: 'leads' as const,
        categoryLabel: 'Lead' as const,
        name: l.name || 'Lead sem nome',
        projects: [
          {
            id: l.id,
            collection: 'leads' as const,
            name: l.serviceType || 'Projeto Geral',
            status: l.status || 'Nova Lead',
            associatedMeetingId: l.associatedMeetingId,
            associatedMeetingIds: l.associatedMeetingIds,
          },
        ],
      })),
      ...legacyLeadClients,
    ].sort((a, b) => a.name.localeCompare(b.name, 'pt'));

    return {
      clientEntities: clientList,
      prospectEntities: prospectList,
      leadEntities: leadList,
      allEntities: [...clientList, ...prospectList, ...leadList],
    };
  }, [clients, prospects, leads]);

  const [selectedEntityKey, setSelectedEntityKey] = React.useState('');
  const [selectedProjectId, setSelectedProjectId] = React.useState('');
  const [meetingDate, setMeetingDate] = React.useState(getDefaultMeetingDate);
  const [selectedHostingerIds, setSelectedHostingerIds] = React.useState<string[]>([]);
  const availableHostingerLinks = useAvailableHostingerLinks();

  React.useEffect(() => {
    if (!isOpen) return;

    setMeetingDate(getDefaultMeetingDate());
    setSelectedHostingerIds([]);

    if (initialEntity) {
      const targetKey = `${initialEntity.collection}:${initialEntity.id}`;
      const matchedEntity = allEntities.find((e) => e.key === targetKey);
      if (matchedEntity) {
        setSelectedEntityKey(matchedEntity.key);
        if (matchedEntity.projects.length === 1) {
          setSelectedProjectId(matchedEntity.projects[0].id);
        } else if (
          initialProjectId &&
          matchedEntity.projects.some((p) => p.id === initialProjectId)
        ) {
          setSelectedProjectId(initialProjectId);
        } else {
          setSelectedProjectId('');
        }
        return;
      }
    }

    setSelectedEntityKey('');
    setSelectedProjectId('');
  }, [isOpen, initialEntity?.collection, initialEntity?.id, initialProjectId]);

  const selectedEntity = React.useMemo(
    () => allEntities.find((e) => e.key === selectedEntityKey) || null,
    [allEntities, selectedEntityKey]
  );

  const entityProjects = selectedEntity?.projects || [];

  const selectedProject = React.useMemo(
    () => entityProjects.find((p) => p.id === selectedProjectId) || null,
    [entityProjects, selectedProjectId]
  );

  const handleEntityChange = (nextKey: string) => {
    setSelectedEntityKey(nextKey);
    const nextEntity = allEntities.find((e) => e.key === nextKey);
    if (nextEntity && nextEntity.projects.length === 1) {
      setSelectedProjectId(nextEntity.projects[0].id);
    } else {
      setSelectedProjectId('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntity || !selectedProject || !meetingDate) return;

    const summary = `Reunião: ${selectedEntity.name} (${selectedProject.name})`;
    const scheduledDate = meetingDate;
    const entityName = selectedEntity.name;
    const projectSnapshot = { ...selectedProject };
    const chosenHostingerLinks = availableHostingerLinks
      .filter((item) => selectedHostingerIds.includes(item.id))
      .map(({ id, entityName: eName, projectName: pName, url }) => ({
        id,
        entityName: eName,
        projectName: pName,
        url,
      }));

    onClose();

    runBackgroundAction({
      title: `A agendar reunião com "${entityName}" (${projectSnapshot.name})...`,
      action: async () => {
        const createdEvent = await scheduleMeet(
          summary,
          scheduledDate + ':00',
          chosenHostingerLinks
        );
        if (createdEvent && createdEvent.id) {
          const existingIds = Array.isArray(projectSnapshot.associatedMeetingIds)
            ? projectSnapshot.associatedMeetingIds
            : [];
          const mergedIds = Array.from(
            new Set([
              ...existingIds,
              ...(projectSnapshot.associatedMeetingId ? [projectSnapshot.associatedMeetingId] : []),
              createdEvent.id,
            ])
          );
          const linkPayload = {
            associatedMeetingId: createdEvent.id,
            associatedMeetingIds: mergedIds,
            lastInteraction: new Date().toISOString(),
          };

          if (projectSnapshot.collection === 'clients') {
            await updateClient(projectSnapshot.id, linkPayload);
          } else if (projectSnapshot.collection === 'prospects') {
            await updateProspect(projectSnapshot.id, {
              ...linkPayload,
              ...(projectSnapshot.status === 'Por Agendar' ? { status: 'Reunião Agendada' } : {}),
            });
          } else if (projectSnapshot.collection === 'leads') {
            await updateLead(projectSnapshot.id, linkPayload);
          }
        }
      },
      errorMessage: `Erro ao agendar reunião com "${entityName}".`,
    });
  };

  const canSubmit = Boolean(selectedEntity && selectedProject && meetingDate);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Select
          label="Selecionar Entidade (Lead, Prospect ou Cliente)"
          value={selectedEntityKey}
          onChange={(e) => handleEntityChange(e.target.value)}
          required
        >
          <option value="" className="bg-zinc-900">
            Selecione a entidade...
          </option>
          {clientEntities.length > 0 && (
            <optgroup label="Clientes" className="bg-zinc-900 text-zinc-400">
              {clientEntities.map((entity) => (
                <option key={entity.key} value={entity.key} className="bg-zinc-900 text-white">
                  {entity.name} ({entity.projects.length}{' '}
                  {entity.projects.length === 1 ? 'projeto' : 'projetos'})
                </option>
              ))}
            </optgroup>
          )}
          {prospectEntities.length > 0 && (
            <optgroup label="Prospects" className="bg-zinc-900 text-zinc-400">
              {prospectEntities.map((entity) => (
                <option key={entity.key} value={entity.key} className="bg-zinc-900 text-white">
                  {entity.name} ({entity.projects[0]?.status || 'Prospect'})
                </option>
              ))}
            </optgroup>
          )}
          {leadEntities.length > 0 && (
            <optgroup label="Leads" className="bg-zinc-900 text-zinc-400">
              {leadEntities.map((entity) => (
                <option key={entity.key} value={entity.key} className="bg-zinc-900 text-white">
                  {entity.name} (Lead)
                </option>
              ))}
            </optgroup>
          )}
        </Select>

        {!selectedEntity ? (
          <Select
            label="Selecionar Projeto"
            value=""
            onChange={() => {}}
            disabled
            required
          >
            <option value="" className="bg-zinc-900">
              Selecione primeiro a entidade...
            </option>
          </Select>
        ) : entityProjects.length === 0 ? (
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-0.5 block font-sans">
              Selecionar Projeto <span className="text-vela-red ml-1">*</span>
            </label>
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5 text-xs text-amber-300 leading-relaxed">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>
                Esta entidade não tem projetos ativos. Adicione um projeto antes de agendar uma reunião.
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Select
              label="Selecionar Projeto"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              required
            >
              {entityProjects.length > 1 && (
                <option value="" className="bg-zinc-900">
                  Selecione o projeto desta entidade...
                </option>
              )}
              {entityProjects.map((proj) => {
                const startText = proj.projectStartDate
                  ? ` · Início: ${formatDateShort(proj.projectStartDate)}`
                  : '';
                return (
                  <option key={proj.id} value={proj.id} className="bg-zinc-900 text-white">
                    {proj.name} ({proj.status}
                    {startText})
                  </option>
                );
              })}
            </Select>
            {entityProjects.length === 1 && (
              <p className="text-[11px] text-emerald-400 flex items-center gap-1.5 ml-0.5 pt-0.5">
                <CheckCircle2 size={12} className="shrink-0" />
                <span>Projeto selecionado automaticamente (único projeto desta entidade).</span>
              </p>
            )}
          </div>
        )}

        <Input
          label="Data e Hora"
          type="datetime-local"
          value={meetingDate}
          onChange={(e) => setMeetingDate(e.target.value)}
          icon={<Calendar size={15} />}
          required
        />

        <HostingerLinksSelector
          selectedIds={selectedHostingerIds}
          onChange={setSelectedHostingerIds}
          priorityProjectId={selectedProjectId || undefined}
        />

        <p className="text-xs text-zinc-400 leading-relaxed">
          Esta ação criará um evento no Google Calendar e gerará um link Google Meet automático.
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
          <Button type="submit" className="flex-1" disabled={!canSubmit}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
