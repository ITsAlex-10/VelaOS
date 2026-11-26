import React, { useEffect, useState } from 'react';
import { ExternalLink, Github, Pencil, Server, Sparkles } from 'lucide-react';
import { Button, GlassCard, Input, Modal } from './UI';
import { WebsiteProjectLinks } from '../types';
import { cn } from '../lib/utils';

export const EMPTY_WEBSITE_LINKS: Required<WebsiteProjectLinks> = {
  hostinger: '',
  googleAiStudio: '',
  github: '',
};

export function isWebsiteGoogleService(serviceType?: string): boolean {
  const normalized = (serviceType || '').trim().toLowerCase();
  return (
    normalized === 'website & perfil google' ||
    normalized === 'website e perfil google'
  );
}

export function normalizeWebsiteLinkUrl(raw?: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function buildWebsiteLinksPayload(
  links?: WebsiteProjectLinks
): Required<WebsiteProjectLinks> {
  return {
    hostinger: (links?.hostinger || '').trim(),
    googleAiStudio: (links?.googleAiStudio || '').trim(),
    github: (links?.github || '').trim(),
  };
}

interface WebsiteLinksFieldsProps {
  value: WebsiteProjectLinks;
  onChange: (next: WebsiteProjectLinks) => void;
}

export const WebsiteLinksFields: React.FC<WebsiteLinksFieldsProps> = ({
  value,
  onChange,
}) => {
  return (
    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-3.5 animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400 font-sans">
          Links do Projeto · Website &amp; Perfil Google
        </span>
        <span className="text-[10px] text-zinc-500">Opcional</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Input
          label="Hostinger"
          type="text"
          placeholder="https://hpanel.hostinger.com/..."
          value={value.hostinger || ''}
          onChange={(e) => onChange({ ...value, hostinger: e.target.value })}
          icon={<Server size={14} />}
        />
        <Input
          label="Google AI Studio"
          type="text"
          placeholder="https://aistudio.google.com/..."
          value={value.googleAiStudio || ''}
          onChange={(e) => onChange({ ...value, googleAiStudio: e.target.value })}
          icon={<Sparkles size={14} />}
        />
        <Input
          label="GitHub"
          type="text"
          placeholder="https://github.com/..."
          value={value.github || ''}
          onChange={(e) => onChange({ ...value, github: e.target.value })}
          icon={<Github size={14} />}
        />
      </div>
    </div>
  );
};

interface WebsiteLinkButtonsProps {
  links?: WebsiteProjectLinks;
  onEdit: () => void;
  variant?: 'compact' | 'panel';
}

const LINK_CONFIGS = [
  {
    key: 'hostinger' as const,
    label: 'Hostinger',
    icon: Server,
    activeAccent: 'text-violet-400',
    activeBorder: 'border-violet-500/25 hover:border-violet-400/50 hover:bg-violet-500/10',
  },
  {
    key: 'googleAiStudio' as const,
    label: 'Google AI Studio',
    icon: Sparkles,
    activeAccent: 'text-sky-400',
    activeBorder: 'border-sky-500/25 hover:border-sky-400/50 hover:bg-sky-500/10',
  },
  {
    key: 'github' as const,
    label: 'GitHub',
    icon: Github,
    activeAccent: 'text-emerald-400',
    activeBorder: 'border-emerald-500/25 hover:border-emerald-400/50 hover:bg-emerald-500/10',
  },
];

export const WebsiteLinkButtons: React.FC<WebsiteLinkButtonsProps> = ({
  links,
  onEdit,
  variant = 'compact',
}) => {
  const handleButtonClick = (e: React.MouseEvent, rawUrl?: string) => {
    e.stopPropagation();
    const url = normalizeWebsiteLinkUrl(rawUrl);
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      onEdit();
    }
  };

  if (variant === 'panel') {
    return (
      <GlassCard className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="space-y-0.5">
            <h4 className="text-[11px] uppercase tracking-[0.14em] text-vela-red font-semibold">
              Links &amp; Infraestrutura
            </h4>
            <p className="text-xs text-zinc-400">
              Acesso rápido às plataformas do website (clique num botão cinzento ou em editar para configurar)
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="text-xs py-2 px-3"
          >
            <Pencil size={13} />
            <span>Editar Links</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {LINK_CONFIGS.map((item) => {
            const Icon = item.icon;
            const rawUrl = links?.[item.key];
            const url = normalizeWebsiteLinkUrl(rawUrl);
            const isConfigured = Boolean(url);

            return (
              <button
                key={item.key}
                type="button"
                onClick={(e) => handleButtonClick(e, rawUrl)}
                title={
                  isConfigured
                    ? `Abrir ${item.label}: ${url}`
                    : `${item.label} não configurado — clique para adicionar link`
                }
                className={cn(
                  'flex items-center justify-between gap-3 p-3.5 rounded-xl border text-left transition-all duration-150 group/link',
                  isConfigured
                    ? cn(
                        'bg-white/[0.03] text-white hover:-translate-y-[1px] cursor-pointer',
                        item.activeBorder
                      )
                    : 'bg-white/[0.015] border-white/[0.06] text-zinc-500 hover:text-zinc-300 hover:border-white/15 hover:bg-white/[0.03] cursor-pointer'
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      'w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 transition-colors',
                      isConfigured
                        ? cn('bg-white/[0.04] border-white/10', item.activeAccent)
                        : 'bg-white/[0.02] border-white/[0.05] text-zinc-600'
                    )}
                  >
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <p
                      className={cn(
                        'text-xs font-bold truncate',
                        isConfigured ? 'text-white' : 'text-zinc-500 group-hover/link:text-zinc-300'
                      )}
                    >
                      {item.label}
                    </p>
                    <p
                      className={cn(
                        'text-[11px] truncate mt-0.5',
                        isConfigured ? 'text-zinc-400' : 'text-zinc-600'
                      )}
                    >
                      {isConfigured ? rawUrl : 'Não configurado'}
                    </p>
                  </div>
                </div>

                {isConfigured ? (
                  <ExternalLink
                    size={14}
                    className="text-zinc-400 group-hover/link:text-white shrink-0 transition-colors"
                  />
                ) : (
                  <Pencil
                    size={13}
                    className="text-zinc-600 group-hover/link:text-zinc-300 shrink-0 transition-colors"
                  />
                )}
              </button>
            );
          })}
        </div>
      </GlassCard>
    );
  }

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      {LINK_CONFIGS.map((item) => {
        const Icon = item.icon;
        const rawUrl = links?.[item.key];
        const url = normalizeWebsiteLinkUrl(rawUrl);
        const isConfigured = Boolean(url);

        return (
          <button
            key={item.key}
            type="button"
            onClick={(e) => handleButtonClick(e, rawUrl)}
            title={
              isConfigured
                ? `Abrir ${item.label} (${url})`
                : `${item.label} não configurado — clique para configurar`
            }
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all duration-150',
              isConfigured
                ? cn(
                    'bg-white/[0.04] text-zinc-100 hover:-translate-y-[1px]',
                    item.activeBorder
                  )
                : 'bg-white/[0.015] border-white/[0.05] text-zinc-500 hover:text-zinc-300 hover:border-white/15 hover:bg-white/[0.03]'
            )}
          >
            <Icon
              size={12}
              className={cn(
                'shrink-0',
                isConfigured ? item.activeAccent : 'text-zinc-600'
              )}
            />
            <span>{item.label}</span>
            {isConfigured && (
              <ExternalLink size={10} className="text-zinc-400 shrink-0" />
            )}
          </button>
        );
      })}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        title="Editar links (Hostinger, Google AI Studio, GitHub)"
        className="inline-flex items-center justify-center p-1.5 rounded-lg bg-white/[0.02] border border-white/[0.06] text-zinc-500 hover:text-white hover:bg-white/[0.07] hover:border-white/15 transition-all duration-150"
      >
        <Pencil size={11} />
      </button>
    </div>
  );
};

interface EditWebsiteLinksModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  initialLinks?: WebsiteProjectLinks;
  onSave: (links: Required<WebsiteProjectLinks>) => Promise<void> | void;
}

export const EditWebsiteLinksModal: React.FC<EditWebsiteLinksModalProps> = ({
  isOpen,
  onClose,
  projectName,
  initialLinks,
  onSave,
}) => {
  const [links, setLinks] = useState<WebsiteProjectLinks>(
    buildWebsiteLinksPayload(initialLinks)
  );

  useEffect(() => {
    if (isOpen) {
      setLinks(buildWebsiteLinksPayload(initialLinks));
    }
  }, [isOpen, initialLinks]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = buildWebsiteLinksPayload(links);
    onClose();
    onSave(payload);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Links do Projeto"
      subtitle={`${projectName} · Website & Perfil Google`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-4">
          <Input
            label="Hostinger"
            type="text"
            placeholder="https://hpanel.hostinger.com/..."
            value={links.hostinger || ''}
            onChange={(e) => setLinks({ ...links, hostinger: e.target.value })}
            icon={<Server size={15} />}
          />
          <Input
            label="Google AI Studio"
            type="text"
            placeholder="https://aistudio.google.com/..."
            value={links.googleAiStudio || ''}
            onChange={(e) =>
              setLinks({ ...links, googleAiStudio: e.target.value })
            }
            icon={<Sparkles size={15} />}
          />
          <Input
            label="GitHub"
            type="text"
            placeholder="https://github.com/..."
            value={links.github || ''}
            onChange={(e) => setLinks({ ...links, github: e.target.value })}
            icon={<Github size={15} />}
          />
        </div>

        <p className="text-[11px] text-zinc-500 leading-relaxed">
          Os campos deixados em branco continuarão a mostrar o respetivo botão a cinzento como não configurado até serem preenchidos.
        </p>

        <div className="pt-4 border-t border-white/[0.06] flex items-center justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit">Guardar Links</Button>
        </div>
      </form>
    </Modal>
  );
};
