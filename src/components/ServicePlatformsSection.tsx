import React, { useEffect, useState } from 'react';
import { Check, Pencil } from 'lucide-react';
import { Button, GlassCard, Modal } from './UI';
import { PaidTrafficPlatform, SocialMediaPlatform } from '../types';
import { cn } from '../lib/utils';

export const SOCIAL_MEDIA_PLATFORMS: readonly SocialMediaPlatform[] = [
  'Instagram',
  'Facebook',
  'TikTok',
  'YouTube',
];

export const PAID_TRAFFIC_PLATFORMS: readonly PaidTrafficPlatform[] = [
  'Google Ads',
  'Meta Ads',
];

export function isSocialMediaService(serviceType?: string): boolean {
  const normalized = (serviceType || '').trim().toLowerCase();
  return (
    normalized === 'gestão de redes sociais' ||
    normalized === 'gestao de redes sociais'
  );
}

export function isPaidTrafficService(serviceType?: string): boolean {
  const normalized = (serviceType || '').trim().toLowerCase();
  return (
    normalized === 'tráfego pago' ||
    normalized === 'trafego pago'
  );
}

export function hasServicePlatforms(serviceType?: string): boolean {
  return isSocialMediaService(serviceType) || isPaidTrafficService(serviceType);
}

export function normalizeSocialMediaPlatforms(
  platforms?: unknown
): SocialMediaPlatform[] {
  if (!Array.isArray(platforms)) return [];
  const validSet = new Set<string>(SOCIAL_MEDIA_PLATFORMS);
  return SOCIAL_MEDIA_PLATFORMS.filter((item) =>
    platforms.some((p) => typeof p === 'string' && validSet.has(p) && p === item)
  );
}

export function normalizePaidTrafficPlatforms(
  platforms?: unknown
): PaidTrafficPlatform[] {
  if (!Array.isArray(platforms)) return [];
  const validSet = new Set<string>(PAID_TRAFFIC_PLATFORMS);
  return PAID_TRAFFIC_PLATFORMS.filter((item) =>
    platforms.some((p) => typeof p === 'string' && validSet.has(p) && p === item)
  );
}

export function getIncludedPlatformsForEntity(entity?: {
  serviceType?: string;
  socialMediaPlatforms?: unknown;
  paidTrafficPlatforms?: unknown;
}): string[] {
  if (!entity) return [];
  if (isSocialMediaService(entity.serviceType)) {
    return normalizeSocialMediaPlatforms(entity.socialMediaPlatforms);
  }
  if (isPaidTrafficService(entity.serviceType)) {
    return normalizePaidTrafficPlatforms(entity.paidTrafficPlatforms);
  }
  return [];
}

const PlatformGlyph: React.FC<{
  platform: string;
  className?: string;
  muted?: boolean;
}> = ({
  platform,
  className,
  muted = false,
}) => {
  switch (platform) {
    case 'Instagram':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
        </svg>
      );
    case 'Facebook':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
        </svg>
      );
    case 'TikTok':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
        </svg>
      );
    case 'YouTube':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
          <path d="m10 15 5-3-5-3v6Z" />
        </svg>
      );
    case 'Google Ads':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className={cn(className, muted && 'grayscale opacity-55')}
        >
          <line
            x1="6.2"
            y1="16.8"
            x2="12"
            y2="6"
            stroke="#FBBC04"
            strokeWidth="6.2"
            strokeLinecap="round"
          />
          <line
            x1="12"
            y1="6"
            x2="17.8"
            y2="16.8"
            stroke="#4285F4"
            strokeWidth="6.2"
            strokeLinecap="round"
          />
          <circle cx="6.2" cy="16.8" r="3.1" fill="#34A853" />
        </svg>
      );
    case 'Meta Ads':
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z" />
        </svg>
      );
  }
};

const PLATFORM_STYLES: Record<
  string,
  { activeAccent: string; activeBorder: string }
> = {
  Instagram: {
    activeAccent: 'text-pink-400',
    activeBorder: 'border-pink-500/30 bg-pink-500/[0.08] hover:border-pink-400/50',
  },
  Facebook: {
    activeAccent: 'text-blue-400',
    activeBorder: 'border-blue-500/30 bg-blue-500/[0.08] hover:border-blue-400/50',
  },
  TikTok: {
    activeAccent: 'text-cyan-400',
    activeBorder: 'border-cyan-500/30 bg-cyan-500/[0.08] hover:border-cyan-400/50',
  },
  YouTube: {
    activeAccent: 'text-red-400',
    activeBorder: 'border-red-500/30 bg-red-500/[0.08] hover:border-red-400/50',
  },
  'Google Ads': {
    activeAccent: 'text-amber-400',
    activeBorder: 'border-amber-500/30 bg-amber-500/[0.08] hover:border-amber-400/50',
  },
  'Meta Ads': {
    activeAccent: 'text-sky-400',
    activeBorder: 'border-sky-500/30 bg-sky-500/[0.08] hover:border-sky-400/50',
  },
};

interface ServicePlatformsFieldsProps {
  serviceType: string;
  socialPlatforms: SocialMediaPlatform[];
  onSocialPlatformsChange: (next: SocialMediaPlatform[]) => void;
  paidTrafficPlatforms: PaidTrafficPlatform[];
  onPaidTrafficPlatformsChange: (next: PaidTrafficPlatform[]) => void;
}

export const ServicePlatformsFields: React.FC<ServicePlatformsFieldsProps> = ({
  serviceType,
  socialPlatforms,
  onSocialPlatformsChange,
  paidTrafficPlatforms,
  onPaidTrafficPlatformsChange,
}) => {
  const isSocial = isSocialMediaService(serviceType);
  const isPaid = isPaidTrafficService(serviceType);

  if (!isSocial && !isPaid) return null;

  const options = isSocial ? SOCIAL_MEDIA_PLATFORMS : PAID_TRAFFIC_PLATFORMS;
  const selected = isSocial ? socialPlatforms : paidTrafficPlatforms;

  const toggleOption = (option: string) => {
    if (isSocial) {
      const target = option as SocialMediaPlatform;
      const exists = socialPlatforms.includes(target);
      const next = exists
        ? socialPlatforms.filter((p) => p !== target)
        : normalizeSocialMediaPlatforms([...socialPlatforms, target]);
      onSocialPlatformsChange(next);
    } else {
      const target = option as PaidTrafficPlatform;
      const exists = paidTrafficPlatforms.includes(target);
      const next = exists
        ? paidTrafficPlatforms.filter((p) => p !== target)
        : normalizePaidTrafficPlatforms([...paidTrafficPlatforms, target]);
      onPaidTrafficPlatformsChange(next);
    }
  };

  return (
    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-3.5 animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400 font-sans">
          Plataformas Incluídas · {isSocial ? 'Gestão de Redes Sociais' : 'Tráfego Pago'}
        </span>
        <span className="text-[10px] text-zinc-500 tabular-nums">
          {selected.length} de {options.length} {selected.length === 1 ? 'selecionada' : 'selecionadas'}
        </span>
      </div>

      <div
        className={cn(
          'grid gap-2.5',
          isSocial ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2'
        )}
      >
        {options.map((option) => {
          const isSelected = (selected as string[]).includes(option);
          const styles = PLATFORM_STYLES[option] || {
            activeAccent: 'text-vela-red',
            activeBorder: 'border-vela-red/35 bg-vela-red/10',
          };

          return (
            <button
              key={option}
              type="button"
              onClick={() => toggleOption(option)}
              aria-pressed={isSelected}
              className={cn(
                'flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl border text-left transition-all duration-150 cursor-pointer',
                isSelected
                  ? cn('text-white', styles.activeBorder)
                  : 'bg-white/[0.02] border-white/[0.07] text-zinc-400 hover:text-white hover:border-white/20 hover:bg-white/[0.04]'
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <PlatformGlyph
                  platform={option}
                  muted={!isSelected}
                  className={cn(
                    'w-4 h-4 shrink-0',
                    isSelected ? styles.activeAccent : 'text-zinc-500'
                  )}
                />
                <span className="text-xs font-semibold truncate">{option}</span>
              </div>
              <span
                className={cn(
                  'w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors',
                  isSelected
                    ? 'bg-vela-red border-vela-red text-white'
                    : 'bg-white/[0.03] border-white/15 text-transparent'
                )}
              >
                <Check size={10} strokeWidth={3} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

interface ServicePlatformButtonsProps {
  serviceType?: string;
  socialPlatforms?: SocialMediaPlatform[];
  paidTrafficPlatforms?: PaidTrafficPlatform[];
  onEdit: () => void;
  variant?: 'compact' | 'panel';
}

export const ServicePlatformButtons: React.FC<ServicePlatformButtonsProps> = ({
  serviceType,
  socialPlatforms,
  paidTrafficPlatforms,
  onEdit,
  variant = 'compact',
}) => {
  const isSocial = isSocialMediaService(serviceType);
  const isPaid = isPaidTrafficService(serviceType);

  if (!isSocial && !isPaid) return null;

  const options = isSocial ? SOCIAL_MEDIA_PLATFORMS : PAID_TRAFFIC_PLATFORMS;
  const selected: string[] = isSocial
    ? normalizeSocialMediaPlatforms(socialPlatforms)
    : normalizePaidTrafficPlatforms(paidTrafficPlatforms);

  if (variant === 'panel') {
    return (
      <GlassCard className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="space-y-0.5">
            <h4 className="text-[11px] uppercase tracking-[0.14em] text-vela-red font-semibold">
              Plataformas Incluídas · {isSocial ? 'Gestão de Redes Sociais' : 'Tráfego Pago'}
            </h4>
            <p className="text-xs text-zinc-400">
              Canais incluídos neste projeto ({selected.length} de {options.length} ativos)
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
            <span>Editar Plataformas</span>
          </Button>
        </div>

        <div
          className={cn(
            'grid gap-3',
            isSocial ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2'
          )}
        >
          {options.map((option) => {
            const isIncluded = selected.includes(option);
            const styles = PLATFORM_STYLES[option] || {
              activeAccent: 'text-emerald-400',
              activeBorder: 'border-emerald-500/25 bg-emerald-500/[0.05]',
            };

            return (
              <button
                key={option}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                title={
                  isIncluded
                    ? `${option} incluída — clique para editar`
                    : `${option} não incluída — clique para configurar`
                }
                className={cn(
                  'flex items-center justify-between gap-3 p-3.5 rounded-xl border text-left transition-all duration-150 cursor-pointer group/plat',
                  isIncluded
                    ? cn('text-white hover:-translate-y-[1px]', styles.activeBorder)
                    : 'bg-white/[0.015] border-white/[0.06] text-zinc-500 hover:text-zinc-300 hover:border-white/15 hover:bg-white/[0.03]'
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      'w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 transition-colors',
                      isIncluded
                        ? cn('bg-white/[0.05] border-white/10', styles.activeAccent)
                        : 'bg-white/[0.02] border-white/[0.05] text-zinc-600'
                    )}
                  >
                    <PlatformGlyph platform={option} muted={!isIncluded} className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p
                      className={cn(
                        'text-xs font-bold truncate',
                        isIncluded ? 'text-white' : 'text-zinc-500 group-hover/plat:text-zinc-300'
                      )}
                    >
                      {option}
                    </p>
                    <p
                      className={cn(
                        'text-[11px] truncate mt-0.5',
                        isIncluded ? 'text-emerald-400 font-medium' : 'text-zinc-600'
                      )}
                    >
                      {isIncluded ? 'Incluída' : 'Não incluída'}
                    </p>
                  </div>
                </div>

                <span
                  className={cn(
                    'w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors',
                    isIncluded
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                      : 'bg-white/[0.02] border-white/[0.08] text-zinc-600 group-hover/plat:text-zinc-300'
                  )}
                >
                  {isIncluded ? <Check size={11} strokeWidth={2.5} /> : <Pencil size={10} />}
                </span>
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
      {options.map((option) => {
        const isIncluded = selected.includes(option);
        const styles = PLATFORM_STYLES[option] || {
          activeAccent: 'text-emerald-400',
          activeBorder: 'border-emerald-500/25 bg-emerald-500/[0.06]',
        };

        return (
          <button
            key={option}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            title={
              isIncluded
                ? `${option} incluída — clique para editar`
                : `${option} não incluída — clique para editar`
            }
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all duration-150 cursor-pointer',
              isIncluded
                ? cn('text-zinc-100 hover:-translate-y-[1px]', styles.activeBorder)
                : 'bg-white/[0.015] border-white/[0.05] text-zinc-500 hover:text-zinc-300 hover:border-white/15 hover:bg-white/[0.03]'
            )}
          >
            <PlatformGlyph
              platform={option}
              muted={!isIncluded}
              className={cn(
                'w-3 h-3 shrink-0',
                isIncluded ? styles.activeAccent : 'text-zinc-600'
              )}
            />
            <span>{option}</span>
            {isIncluded && (
              <Check size={10} strokeWidth={2.5} className="text-emerald-400 shrink-0" />
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
        title="Editar plataformas incluídas"
        className="inline-flex items-center justify-center p-1.5 rounded-lg bg-white/[0.02] border border-white/[0.06] text-zinc-500 hover:text-white hover:bg-white/[0.07] hover:border-white/15 transition-all duration-150 cursor-pointer"
      >
        <Pencil size={11} />
      </button>
    </div>
  );
};

interface EditServicePlatformsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  serviceType: string;
  initialSocialPlatforms?: SocialMediaPlatform[];
  initialPaidTrafficPlatforms?: PaidTrafficPlatform[];
  onSave: (payload: {
    socialMediaPlatforms?: SocialMediaPlatform[];
    paidTrafficPlatforms?: PaidTrafficPlatform[];
  }) => Promise<void> | void;
}

export const EditServicePlatformsModal: React.FC<EditServicePlatformsModalProps> = ({
  isOpen,
  onClose,
  projectName,
  serviceType,
  initialSocialPlatforms,
  initialPaidTrafficPlatforms,
  onSave,
}) => {
  const [social, setSocial] = useState<SocialMediaPlatform[]>(
    normalizeSocialMediaPlatforms(initialSocialPlatforms)
  );
  const [paid, setPaid] = useState<PaidTrafficPlatform[]>(
    normalizePaidTrafficPlatforms(initialPaidTrafficPlatforms)
  );

  useEffect(() => {
    if (isOpen) {
      setSocial(normalizeSocialMediaPlatforms(initialSocialPlatforms));
      setPaid(normalizePaidTrafficPlatforms(initialPaidTrafficPlatforms));
    }
  }, [isOpen, initialSocialPlatforms, initialPaidTrafficPlatforms]);

  const isSocial = isSocialMediaService(serviceType);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onClose();
    if (isSocial) {
      onSave({ socialMediaPlatforms: normalizeSocialMediaPlatforms(social) });
    } else {
      onSave({ paidTrafficPlatforms: normalizePaidTrafficPlatforms(paid) });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Plataformas Incluídas"
      subtitle={`${projectName} · ${serviceType}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <ServicePlatformsFields
          serviceType={serviceType}
          socialPlatforms={social}
          onSocialPlatformsChange={setSocial}
          paidTrafficPlatforms={paid}
          onPaidTrafficPlatformsChange={setPaid}
        />

        <p className="text-[11px] text-zinc-500 leading-relaxed">
          As opções não selecionadas continuarão visíveis a cinzento para indicar que não estão incluídas neste serviço.
        </p>

        <div className="pt-4 border-t border-white/[0.06] flex items-center justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit">Guardar Plataformas</Button>
        </div>
      </form>
    </Modal>
  );
};
