import React from 'react';
import { Check, ExternalLink, Search, Server } from 'lucide-react';
import { MeetingHostingerLink } from '../types';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { normalizeWebsiteLinkUrl } from './WebsiteLinksSection';
import { openAllHostingerLinks } from '../lib/meetingHostingerLinks';
import { cn } from '../lib/utils';

export interface HostingerLinkOption extends MeetingHostingerLink {
  categoryLabel: 'Cliente' | 'Prospect' | 'Lead';
  projectId: string;
}

export function useAvailableHostingerLinks(): HostingerLinkOption[] {
  const { clients, prospects, leads } = useWorkspace();

  return React.useMemo(() => {
    const allClients = clients || [];
    const list: HostingerLinkOption[] = [];

    // Clients + sub-projects
    allClients
      .filter((c) => !c.parentClientId && !c.projectRemoved)
      .forEach((c) => {
        const url = normalizeWebsiteLinkUrl(c.websiteLinks?.hostinger);
        if (url) {
          list.push({
            id: `clients:${c.id}`,
            projectId: c.id,
            entityName: c.name || 'Cliente',
            projectName: c.serviceType || 'Projeto Geral',
            categoryLabel: c.status === 'Lead' ? 'Lead' : 'Cliente',
            url,
          });
        }
      });

    allClients
      .filter((sub) => Boolean(sub.parentClientId) && !sub.projectRemoved)
      .forEach((sub) => {
        const url = normalizeWebsiteLinkUrl(sub.websiteLinks?.hostinger);
        if (url) {
          const parent = allClients.find((p) => p.id === sub.parentClientId);
          list.push({
            id: `clients:${sub.id}`,
            projectId: sub.id,
            entityName: parent?.name || sub.name || 'Cliente',
            projectName: sub.serviceType || 'Projeto Geral',
            categoryLabel: 'Cliente',
            url,
          });
        }
      });

    // Prospects
    (prospects || []).forEach((p: any) => {
      const url = normalizeWebsiteLinkUrl(p.websiteLinks?.hostinger);
      if (url) {
        list.push({
          id: `prospects:${p.id}`,
          projectId: p.id,
          entityName: p.name || 'Prospect',
          projectName: p.serviceType || 'Projeto Geral',
          categoryLabel: 'Prospect',
          url,
        });
      }
    });

    // Leads
    (leads || []).forEach((l: any) => {
      const url = normalizeWebsiteLinkUrl(l.websiteLinks?.hostinger);
      if (url) {
        list.push({
          id: `leads:${l.id}`,
          projectId: l.id,
          entityName: l.name || 'Lead',
          projectName: l.serviceType || 'Projeto Geral',
          categoryLabel: 'Lead',
          url,
        });
      }
    });

    return list.sort((a, b) =>
      `${a.entityName} ${a.projectName}`.localeCompare(`${b.entityName} ${b.projectName}`, 'pt')
    );
  }, [clients, prospects, leads]);
}

interface HostingerLinksSelectorProps {
  selectedIds: string[];
  onChange: (nextIds: string[]) => void;
  priorityProjectId?: string;
}

export const HostingerLinksSelector: React.FC<HostingerLinksSelectorProps> = ({
  selectedIds,
  onChange,
  priorityProjectId,
}) => {
  const available = useAvailableHostingerLinks();
  const [search, setSearch] = React.useState('');

  const ordered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? available.filter(
          (item) =>
            item.entityName.toLowerCase().includes(q) ||
            item.projectName.toLowerCase().includes(q) ||
            item.url.toLowerCase().includes(q)
        )
      : available;

    if (!priorityProjectId) return filtered;

    return [...filtered].sort((a, b) => {
      const aMatch = a.projectId === priorityProjectId ? 0 : 1;
      const bMatch = b.projectId === priorityProjectId ? 0 : 1;
      return aMatch - bMatch;
    });
  }, [available, search, priorityProjectId]);

  const toggleId = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const selectAll = () => {
    onChange(available.map((item) => item.id));
  };

  const clearAll = () => {
    onChange([]);
  };

  return (
    <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Server size={13} className="text-violet-400 shrink-0" />
          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300 font-sans">
            Links Hostinger (Preparação)
          </span>
          {selectedIds.length > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-violet-500/15 border border-violet-500/30 text-[10px] font-bold text-violet-300 tabular-nums">
              {selectedIds.length} {selectedIds.length === 1 ? 'selecionado' : 'selecionados'}
            </span>
          )}
        </div>

        {available.length > 0 && (
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
            {selectedIds.length < available.length && (
              <button
                type="button"
                onClick={selectAll}
                className="text-violet-400 hover:text-violet-300 transition-colors cursor-pointer"
              >
                Selecionar todos
              </button>
            )}
            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
              >
                Limpar
              </button>
            )}
          </div>
        )}
      </div>

      {available.length === 0 ? (
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          Nenhum cliente ou projeto tem um link Hostinger configurado ainda.
        </p>
      ) : (
        <>
          {available.length > 4 && (
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filtrar por cliente ou projeto..."
                className="w-full h-8 bg-[#0D0D0F] border border-white/[0.08] rounded-lg pl-8 pr-3 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-400/50"
              />
            </div>
          )}

          <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
            {ordered.length > 0 ? (
              ordered.map((item) => {
                const isChecked = selectedIds.includes(item.id);
                const isPriority = priorityProjectId && item.projectId === priorityProjectId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleId(item.id)}
                    aria-pressed={isChecked}
                    className={cn(
                      'w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl border text-left transition-all duration-150 cursor-pointer',
                      isChecked
                        ? 'bg-violet-500/10 border-violet-500/35 text-white'
                        : 'bg-white/[0.015] border-white/[0.06] text-zinc-300 hover:bg-white/[0.04] hover:border-white/15'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={cn(
                          'w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors',
                          isChecked
                            ? 'bg-violet-500 border-violet-400 text-white'
                            : 'bg-white/[0.03] border-white/15 text-transparent'
                        )}
                      >
                        <Check size={10} strokeWidth={3} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs font-semibold truncate">{item.entityName}</span>
                          <span className="text-zinc-600 text-[10px] shrink-0">·</span>
                          <span className="text-[11px] text-zinc-400 truncate">{item.projectName}</span>
                          {isPriority && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/25 text-[9px] font-bold uppercase tracking-wider text-emerald-400 shrink-0">
                              Atual
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-500 truncate mt-0.5">{item.url}</p>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <p className="text-[11px] text-zinc-500 py-3 text-center">
                Nenhum link Hostinger corresponde à pesquisa.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

interface OpenHostingerLinksButtonProps {
  links?: MeetingHostingerLink[];
  compact?: boolean;
  className?: string;
}

export const OpenHostingerLinksButton: React.FC<OpenHostingerLinksButtonProps> = ({
  links,
  compact = false,
  className,
}) => {
  const [popupWarning, setPopupWarning] = React.useState(false);
  const validLinks = (links || []).filter((l) => Boolean(normalizeWebsiteLinkUrl(l.url)));

  if (validLinks.length === 0) return null;

  const tooltipText = validLinks
    .map((l) => `${l.entityName} (${l.projectName}): ${l.url}`)
    .join('\n');

  const handleOpenAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    const result = openAllHostingerLinks(validLinks);
    if (result.blocked > 0) {
      setPopupWarning(true);
      setTimeout(() => setPopupWarning(false), 5000);
    }
  };

  return (
    <div className="inline-flex flex-col items-start gap-1" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={handleOpenAll}
        title={`Abrir ${validLinks.length === 1 ? 'site Hostinger' : `todos os ${validLinks.length} sites Hostinger`}:\n${tooltipText}`}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 rounded-xl border font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer hover:-translate-y-[1px] active:translate-y-0',
          'bg-violet-500/15 border-violet-500/30 text-violet-300 hover:bg-violet-500/25 hover:border-violet-400/50 hover:text-white',
          compact ? 'px-2.5 py-1.5 text-[11px]' : 'px-3.5 py-2 text-[11px]',
          className
        )}
      >
        <Server size={compact ? 12 : 13} className="text-violet-400 shrink-0" />
        <span>
          {validLinks.length === 1
            ? 'Abrir Hostinger'
            : `Abrir Hostinger (${validLinks.length})`}
        </span>
        <ExternalLink size={compact ? 10 : 11} className="shrink-0 opacity-80" />
      </button>
      {popupWarning && (
        <span className="text-[10px] text-amber-400 leading-tight max-w-[230px]">
          Permita pop-ups no navegador para abrir todos os sites de uma vez.
        </span>
      )}
    </div>
  );
};
