import React, { useState } from 'react';
import { GlassCard, Badge, Button, Modal, Input, Select } from '../components/UI';
import { cn } from '../lib/utils';
import { 
  Search, 
  Calendar, 
  CheckCircle, 
  HelpCircle, 
  XOctagon, 
  UserCheck, 
  Trash2, 
  ExternalLink,
  Plus,
  RefreshCw,
  FolderOpen,
  MapPin,
  Sparkles,
  Phone,
  Edit3,
  FileText,
  Globe,
  AlertCircle
} from 'lucide-react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useBackgroundAction } from '../contexts/BackgroundActionContext';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { StatusTransitionModal } from '../components/StatusTransitionModal';
import { GoogleMapsLinkAutofill, ResolvedGoogleMapsPlace } from '../components/GoogleMapsLinkAutofill';
import { WebsiteLinksFields, EMPTY_WEBSITE_LINKS, isWebsiteGoogleService, buildWebsiteLinksPayload } from '../components/WebsiteLinksSection';
import {
  ServicePlatformsFields,
  isSocialMediaService,
  isPaidTrafficService,
  hasServicePlatforms,
  normalizeSocialMediaPlatforms,
  normalizePaidTrafficPlatforms,
  getIncludedPlatformsForEntity
} from '../components/ServicePlatformsSection';
import { PaidTrafficPlatform, SocialMediaPlatform, WebsiteProjectLinks } from '../types';
import { HostingerLinksSelector, useAvailableHostingerLinks } from '../components/HostingerPrepSelector';

type ProspectStageFilter = 'Por Agendar' | 'Reunião Agendada' | 'Pendente' | 'Falhado';

interface ProspectsPageProps {
  onProspectClick: (prospect: any) => void;
  activeFilter?: ProspectStageFilter;
  onFilterChange?: (filter: ProspectStageFilter) => void;
}

export const ProspectsPage: React.FC<ProspectsPageProps> = ({
  onProspectClick,
  activeFilter: controlledFilter,
  onFilterChange
}) => {
  const { prospects, createProspect, updateProspect, deleteProspect, moveProspectToClients, scheduleMeet, accessToken } = useWorkspace();
  const { runBackgroundAction } = useBackgroundAction();
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'alphabetical'>('recent');
  const [prospectToDelete, setProspectToDelete] = useState<any | null>(null);
  const [editingProspect, setEditingProspect] = useState<any | null>(null);

  // Edit form multi-state
  const [editContactNames, setEditContactNames] = useState<string[]>(['']);
  const [editEmails, setEditEmails] = useState<string[]>(['']);
  const [editPhones, setEditPhones] = useState<string[]>(['']);
  const [editFormData, setEditFormData] = useState({ 
    companyName: '', 
    address: '',
    website: '',
    mapUri: '',
    note: '',
    serviceType: '',
    rating: '',
    placeId: ''
  });
  const [editWebsiteLinks, setEditWebsiteLinks] = useState<WebsiteProjectLinks>(EMPTY_WEBSITE_LINKS);
  const [editSocialPlatforms, setEditSocialPlatforms] = useState<SocialMediaPlatform[]>([]);
  const [editPaidPlatforms, setEditPaidPlatforms] = useState<PaidTrafficPlatform[]>([]);

  const handleOpenEditProspect = (prospect: any) => {
    setEditingProspect(prospect);
    const latestNote = prospect.notes?.[0]?.content || '';
    setEditContactNames(prospect.contactName ? prospect.contactName.split(',').map((s: string) => s.trim()) : ['']);
    setEditEmails(prospect.email ? prospect.email.split(',').map((s: string) => s.trim()) : ['']);
    setEditPhones(prospect.phone && prospect.phone !== 'Não listado' ? prospect.phone.split(',').map((s: string) => s.trim()) : ['']);
    setEditFormData({
      companyName: prospect.name || '',
      address: prospect.address || '',
      website: prospect.website && prospect.website !== 'Não' ? prospect.website : '',
      mapUri: prospect.mapUri || '',
      note: latestNote,
      serviceType: prospect.serviceType || '',
      rating: prospect.rating || '',
      placeId: prospect.placeId || ''
    });
    setEditWebsiteLinks(buildWebsiteLinksPayload(prospect.websiteLinks));
    setEditSocialPlatforms(normalizeSocialMediaPlatforms(prospect.socialMediaPlatforms));
    setEditPaidPlatforms(normalizePaidTrafficPlatforms(prospect.paidTrafficPlatforms));
  };

  const handleSaveEditProspect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProspect || !editFormData.companyName || !editFormData.serviceType) return;

    const existingNotes = editingProspect.notes || [];
    let updatedNotes = [...existingNotes];
    if (editFormData.note) {
      if (updatedNotes.length > 0) {
        updatedNotes[0] = {
          ...updatedNotes[0],
          content: editFormData.note
        };
      } else {
        updatedNotes = [{
          id: Math.random().toString(36).substring(7),
          date: new Date().toLocaleDateString('pt-PT'),
          author: 'Alex Sosa',
          content: editFormData.note
        }];
      }
    }

    const payload = {
      name: editFormData.companyName,
      contactName: editContactNames.filter(Boolean).join(', ') || 'Responsável',
      email: editEmails.filter(Boolean).join(', '),
      phone: editPhones.filter(Boolean).join(', '),
      address: editFormData.address || '',
      website: editFormData.website || 'Não',
      hasWebsite: Boolean(editFormData.website && editFormData.website !== 'Não'),
      ...(editFormData.rating ? { rating: editFormData.rating } : {}),
      ...(editFormData.placeId ? { placeId: editFormData.placeId } : {}),
      mapUri: editFormData.mapUri || '',
      serviceType: editFormData.serviceType,
      ...(isWebsiteGoogleService(editFormData.serviceType) ? { websiteLinks: buildWebsiteLinksPayload(editWebsiteLinks) } : {}),
      socialMediaPlatforms: isSocialMediaService(editFormData.serviceType)
        ? normalizeSocialMediaPlatforms(editSocialPlatforms)
        : null,
      paidTrafficPlatforms: isPaidTrafficService(editFormData.serviceType)
        ? normalizePaidTrafficPlatforms(editPaidPlatforms)
        : null,
      notes: updatedNotes,
      lastInteraction: new Date().toISOString()
    };

    const prospectId = editingProspect.id;
    setEditingProspect(null);

    runBackgroundAction({
      title: `A atualizar prospect "${payload.name}"...`,
      action: async () => {
        await updateProspect(prospectId, payload);
      },
      errorMessage: 'Erro ao atualizar prospect.'
    });
  };

  const [transitionTarget, setTransitionTarget] = useState<any | null>(null);
  
  // 4 big interactive card filters
  const [internalFilter, setInternalFilter] = useState<ProspectStageFilter>('Por Agendar');
  const activeFilter = controlledFilter ?? internalFilter;
  const setActiveFilter = (filter: ProspectStageFilter) => {
    setInternalFilter(filter);
    onFilterChange?.(filter);
  };

  // Add form multi-state
  const [contactNames, setContactNames] = useState<string[]>(['']);
  const [emails, setEmails] = useState<string[]>(['']);
  const [phones, setPhones] = useState<string[]>(['']);
  const [formData, setFormData] = useState({ 
    companyName: '', 
    address: '',
    website: '',
    mapUri: '',
    note: '',
    serviceType: '',
    rating: '',
    placeId: ''
  });
  const [websiteLinks, setWebsiteLinks] = useState<WebsiteProjectLinks>(EMPTY_WEBSITE_LINKS);
  const [socialPlatforms, setSocialPlatforms] = useState<SocialMediaPlatform[]>([]);
  const [paidPlatforms, setPaidPlatforms] = useState<PaidTrafficPlatform[]>([]);
  const [manualMeetingDate, setManualMeetingDate] = useState('');
  const [manualHostingerIds, setManualHostingerIds] = useState<string[]>([]);
  const availableHostingerLinks = useAvailableHostingerLinks();

  const handleApplyGoogleMapsPlace = (place: ResolvedGoogleMapsPlace, mode: 'add' | 'edit') => {
    const ratingStr = typeof place.rating === 'number'
      ? `${place.rating.toFixed(1)}${place.userRatingCount ? ` (${place.userRatingCount})` : ''}`
      : '';

    if (mode === 'add') {
      setFormData(prev => ({
        ...prev,
        companyName: place.name || prev.companyName,
        address: place.address || prev.address,
        website: place.website || prev.website,
        mapUri: place.mapUri || prev.mapUri,
        rating: ratingStr || prev.rating,
        placeId: place.placeId || prev.placeId
      }));
      if (place.phone) {
        setPhones(prev => {
          const nonEmpty = prev.filter(p => p.trim() !== '');
          if (nonEmpty.length === 0) return [place.phone];
          if (nonEmpty.includes(place.phone)) return prev;
          return [place.phone, ...nonEmpty];
        });
      }
      if (place.email) {
        setEmails(prev => {
          const nonEmpty = prev.filter(e => e.trim() !== '');
          if (nonEmpty.length === 0) return [place.email!];
          if (nonEmpty.includes(place.email!)) return prev;
          return [place.email!, ...nonEmpty];
        });
      }
    } else {
      setEditFormData(prev => ({
        ...prev,
        companyName: place.name || prev.companyName,
        address: place.address || prev.address,
        website: place.website || prev.website,
        mapUri: place.mapUri || prev.mapUri,
        rating: ratingStr || prev.rating,
        placeId: place.placeId || prev.placeId
      }));
      if (place.phone) {
        setEditPhones(prev => {
          const nonEmpty = prev.filter(p => p.trim() !== '');
          if (nonEmpty.length === 0) return [place.phone];
          if (nonEmpty.includes(place.phone)) return prev;
          return [place.phone, ...nonEmpty];
        });
      }
      if (place.email) {
        setEditEmails(prev => {
          const nonEmpty = prev.filter(e => e.trim() !== '');
          if (nonEmpty.length === 0) return [place.email!];
          if (nonEmpty.includes(place.email!)) return prev;
          return [place.email!, ...nonEmpty];
        });
      }
    }
  };

  const getCount = (status: string) => (prospects || []).filter(p => p.status === status).length;

  const filteredProspects = (prospects || []).filter(p => {
    const matchesFilter = p.status === activeFilter;
    const matchesSearch = !searchQuery ? true : (
      (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.contactName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.phone || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
    return matchesFilter && matchesSearch;
  });

  const sortedProspects = [...filteredProspects].sort((a, b) => {
    if (sortBy === 'alphabetical') {
      return (a.name || '').localeCompare(b.name || '');
    } else {
      const timeA = new Date(a.lastInteraction || 0).getTime();
      const timeB = new Date(b.lastInteraction || 0).getTime();
      return timeB - timeA;
    }
  });

  const handleAddManualProspect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName || !formData.serviceType) return;

    const scheduledMeetingDate = manualMeetingDate.trim();
    if (scheduledMeetingDate && !accessToken) return;

    const chosenHostingerLinks = scheduledMeetingDate
      ? availableHostingerLinks
          .filter((item) => manualHostingerIds.includes(item.id))
          .map(({ id, entityName, projectName, url }) => ({
            id,
            entityName,
            projectName,
            url,
          }))
      : [];

    const payload: any = {
      name: formData.companyName,
      contactName: contactNames.filter(Boolean).join(', ') || 'Responsável',
      email: emails.filter(Boolean).join(', '),
      phone: phones.filter(Boolean).join(', '),
      address: formData.address || '',
      website: formData.website || 'Não',
      hasWebsite: Boolean(formData.website && formData.website !== 'Não'),
      ...(formData.rating ? { rating: formData.rating } : {}),
      ...(formData.placeId ? { placeId: formData.placeId } : {}),
      mapUri: formData.mapUri || '',
      serviceType: formData.serviceType,
      ...(isWebsiteGoogleService(formData.serviceType) ? { websiteLinks: buildWebsiteLinksPayload(websiteLinks) } : {}),
      ...(isSocialMediaService(formData.serviceType) ? { socialMediaPlatforms: normalizeSocialMediaPlatforms(socialPlatforms) } : {}),
      ...(isPaidTrafficService(formData.serviceType) ? { paidTrafficPlatforms: normalizePaidTrafficPlatforms(paidPlatforms) } : {}),
      status: scheduledMeetingDate ? 'Reunião Agendada' : 'Por Agendar',
      lastInteraction: new Date().toISOString(),
      notes: formData.note ? [
        {
          id: Math.random().toString(36).substring(7),
          date: new Date().toLocaleDateString('pt-PT'),
          author: 'Alex Sosa',
          content: formData.note
        }
      ] : []
    };

    setShowModal(false);
    setFormData({ companyName: '', address: '', website: '', mapUri: '', note: '', serviceType: '', rating: '', placeId: '' });
    setWebsiteLinks(EMPTY_WEBSITE_LINKS);
    setSocialPlatforms([]);
    setPaidPlatforms([]);
    setContactNames(['']);
    setEmails(['']);
    setPhones(['']);
    setManualMeetingDate('');
    setManualHostingerIds([]);

    runBackgroundAction({
      title: scheduledMeetingDate
        ? `A agendar reunião e registar prospect "${payload.name}"...`
        : `A registar prospect "${payload.name}"...`,
      action: async () => {
        if (scheduledMeetingDate) {
          const summary = `Reunião: ${payload.name} (${payload.serviceType})`;
          const createdEvent = await scheduleMeet(
            summary,
            scheduledMeetingDate + ':00',
            chosenHostingerLinks
          );
          if (createdEvent && createdEvent.id) {
            payload.associatedMeetingId = createdEvent.id;
            payload.associatedMeetingIds = [createdEvent.id];
          }
        }
        await createProspect(payload);
      },
      errorMessage: 'Erro ao registar prospect manualmente.'
    });
  };

  const handleMoveStatus = (prospectId: string, newStatus: string) => {
    const prospect = prospects.find(p => p.id === prospectId);
    if (newStatus === 'Pendente' && prospect) {
      setTransitionTarget({ client: prospect, status: 'Pendente' });
    } else if (newStatus === 'Cliente' && prospect) {
      setTransitionTarget({ client: prospect, status: 'Cliente' });
    } else {
      runBackgroundAction({
        title: `A mover para "${newStatus}"...`,
        action: async () => {
          await updateProspect(prospectId, { status: newStatus, lastInteraction: new Date().toISOString() });
        },
        errorMessage: 'Erro ao atualizar estado do prospect.'
      });
    }
  };

  const handleMoveToClients = (prospect: any) => {
    setTransitionTarget({ client: prospect, status: 'Cliente' });
  };

  const isProfileUnlocked = (status: string) => {
    return status === 'Reunião Agendada' || status === 'Pendente' || status === 'Cliente';
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h2 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-white">
            Pipeline de Prospects
          </h2>
          <p className="text-sm text-zinc-400 max-w-xl leading-relaxed">
            Leads qualificadas com reuniões por agendar, marcadas ou em negociação. Prospects em <strong className="text-emerald-400 font-semibold">Reunião Agendada</strong> desbloqueiam a ficha comercial completa.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => setShowModal(true)}
          className="shrink-0"
        >
          <Plus size={15} />
          <span>Novo Prospect Manual</span>
        </Button>
      </header>

      {/* 4 Stage Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {([
          {
            id: 'Por Agendar' as const,
            label: 'Por Agendar',
            subtext: 'Requer agendamento',
            icon: Calendar,
            activeCard: 'border-amber-500/40 bg-amber-500/[0.04]',
            activeLabel: 'text-amber-400',
            activeCount: 'text-amber-400',
            activeIcon: 'bg-amber-500/15 border-amber-500/30 text-amber-400'
          },
          {
            id: 'Reunião Agendada' as const,
            label: 'Reunião Agendada',
            subtext: 'Ficha desbloqueada',
            icon: CheckCircle,
            activeCard: 'border-emerald-500/40 bg-emerald-500/[0.04]',
            activeLabel: 'text-emerald-400',
            activeCount: 'text-emerald-400',
            activeIcon: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
          },
          {
            id: 'Pendente' as const,
            label: 'Pendente',
            subtext: 'Proposta em análise',
            icon: HelpCircle,
            activeCard: 'border-sky-500/40 bg-sky-500/[0.04]',
            activeLabel: 'text-sky-400',
            activeCount: 'text-sky-400',
            activeIcon: 'bg-sky-500/15 border-sky-500/30 text-sky-400'
          },
          {
            id: 'Falhado' as const,
            label: 'Falhado',
            subtext: 'Oportunidade arquivada',
            icon: XOctagon,
            activeCard: 'border-red-500/40 bg-red-500/[0.04]',
            activeLabel: 'text-red-400',
            activeCount: 'text-red-400',
            activeIcon: 'bg-red-500/15 border-red-500/30 text-red-400'
          }
        ]).map((card) => {
          const isActive = activeFilter === card.id;
          const count = getCount(card.id);
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => setActiveFilter(card.id)}
              className="w-full text-left focus:outline-none group/stage transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-0"
            >
              <GlassCard
                className={cn(
                  "p-5 transition-colors duration-150",
                  isActive
                    ? card.activeCard
                    : "hover:border-white/[0.15] hover:bg-[#18181D]"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <p
                      className={cn(
                        "text-[11px] uppercase tracking-[0.14em] font-semibold truncate transition-colors duration-150",
                        isActive ? card.activeLabel : "text-zinc-400 group-hover/stage:text-zinc-200"
                      )}
                    >
                      {card.label}
                    </p>
                    <p
                      className={cn(
                        "text-3xl font-display font-bold leading-none tracking-tight tabular-nums",
                        isActive ? card.activeCount : "text-white"
                      )}
                    >
                      {count}{' '}
                      <span className="text-xs font-sans font-medium text-zinc-500">
                        {count === 1 ? 'prospect' : 'prospects'}
                      </span>
                    </p>
                    <p className="text-[11px] text-zinc-500 truncate pt-0.5">{card.subtext}</p>
                  </div>
                  <span
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-[transform,color,border-color] duration-150 border group-hover/stage:scale-105",
                      isActive
                        ? card.activeIcon
                        : "bg-white/[0.03] border-white/[0.07] text-zinc-500 group-hover/stage:text-zinc-200"
                    )}
                  >
                    <Icon size={18} strokeWidth={1.75} />
                  </span>
                </div>
              </GlassCard>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-5 border-t border-white/[0.06]">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-display font-bold text-white tracking-tight">
            {activeFilter}
          </h3>
          <span className="text-xs font-semibold text-zinc-500 tabular-nums">
            ({sortedProspects.length})
          </span>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/[0.07]">
            <button
              type="button"
              onClick={() => setSortBy('recent')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors",
                sortBy === 'recent' ? "bg-vela-red text-white" : "text-zinc-400 hover:text-white"
              )}
            >
              Recentes
            </button>
            <button
              type="button"
              onClick={() => setSortBy('alphabetical')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors",
                sortBy === 'alphabetical' ? "bg-vela-red text-white" : "text-zinc-400 hover:text-white"
              )}
            >
              Alfabética
            </button>
          </div>
          <div className="relative flex-1 sm:w-64 sm:flex-initial">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
            <input
              type="text"
              placeholder="Pesquisar prospects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 bg-white/[0.03] border border-white/[0.08] rounded-xl pl-9 pr-3 text-xs text-white focus:outline-none focus:border-vela-red/50 transition-colors placeholder:text-zinc-600"
            />
          </div>
        </div>
      </div>

      {/* Prospects Cards Grid */}
      {sortedProspects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {sortedProspects.map((prospect) => (
            <GlassCard
              key={prospect.id}
              className="p-6 hover:border-white/[0.14] transition-colors flex flex-col justify-between gap-5"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <h4
                      onClick={() => onProspectClick(prospect)}
                      className="text-base font-display font-bold text-white hover:text-vela-red transition-colors cursor-pointer truncate"
                    >
                      {prospect.name}
                    </h4>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                      <span>{prospect.serviceType || 'Website & Rebranding'}</span>
                      {(() => {
                        const included = getIncludedPlatformsForEntity(prospect);
                        if (included.length === 0) return null;
                        return (
                          <>
                            <span className="text-zinc-700">·</span>
                            <span className="text-zinc-300 font-medium">{included.join(' · ')}</span>
                          </>
                        );
                      })()}
                      {isProfileUnlocked(prospect.status) && (
                        <>
                          <span className="text-zinc-700">·</span>
                          <button
                            type="button"
                            onClick={() => onProspectClick(prospect)}
                            className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                          >
                            <CheckCircle size={11} />
                            <span>Abrir ficha comercial</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {prospect.status === 'Por Agendar' && (
                      <button
                        type="button"
                        onClick={() => handleOpenEditProspect(prospect)}
                        className="text-zinc-500 hover:text-white p-2 rounded-lg hover:bg-white/[0.06] hover:-translate-y-[1px] active:translate-y-0 transition-all duration-150"
                        title="Editar Prospect"
                      >
                        <Edit3 size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setProspectToDelete(prospect)}
                      className="text-zinc-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 hover:-translate-y-[1px] active:translate-y-0 transition-all duration-150"
                      title="Eliminar Prospect"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-zinc-400">
                  {prospect.address && (
                    <div className="flex items-start gap-2">
                      <MapPin size={13} className="text-zinc-500 shrink-0 mt-0.5" />
                      <span className="text-zinc-300 leading-snug">{prospect.address}</span>
                    </div>
                  )}
                  {prospect.contactName && (
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 text-[11px] font-medium">Responsável:</span>
                      <span className="text-zinc-200">{prospect.contactName}</span>
                    </div>
                  )}
                  {prospect.email && (
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 text-[11px] font-medium">Email:</span>
                      <span className="text-zinc-200 truncate">{prospect.email}</span>
                    </div>
                  )}
                  {prospect.phone && prospect.phone !== 'Não listado' && (
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 text-[11px] font-medium">Telemóvel:</span>
                      <a href={`tel:${prospect.phone}`} className="text-zinc-200 hover:text-white hover:underline inline-flex items-center gap-1.5 tabular-nums">
                        {prospect.phone}
                        <Phone size={11} className="text-emerald-400" />
                      </a>
                    </div>
                  )}
                  {prospect.website && prospect.website !== 'Não' && (
                    <div className="flex items-center gap-2">
                      <Globe size={13} className="text-zinc-500 shrink-0" />
                      <a
                        href={prospect.website.startsWith('http') ? prospect.website : `https://${prospect.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-zinc-200 hover:text-white hover:underline truncate"
                      >
                        {prospect.website}
                      </a>
                    </div>
                  )}
                </div>

                {prospect.notes && prospect.notes.length > 0 && (
                  <div className="bg-white/[0.025] p-3.5 rounded-xl border border-white/[0.06] space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                      <FileText size={11} />
                      Observação · <span className="tabular-nums">{prospect.notes[0].date}</span>
                    </span>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {prospect.notes[0].content}
                    </p>
                  </div>
                )}

                {prospect.opportunity && (
                  <div className="bg-white/[0.025] p-3.5 rounded-xl border border-white/[0.06] space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/90 flex items-center gap-1.5">
                      <Sparkles size={11} />
                      Diagnóstico Comercial
                    </span>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {prospect.opportunity}
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons Row */}
              <div className="pt-4 border-t border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-zinc-500">Mover:</span>
                  <select
                    value={prospect.status}
                    onChange={(e) => handleMoveStatus(prospect.id, e.target.value)}
                    className="bg-[#0D0D0F] border border-white/[0.08] focus:border-white/25 focus:outline-none rounded-lg py-1.5 px-2.5 text-xs text-zinc-300 font-medium transition-colors"
                  >
                    <option value="Por Agendar">Por Agendar</option>
                    <option value="Reunião Agendada">Reunião Agendada</option>
                    <option value="Pendente">Pendente</option>
                    <option value="Falhado">Falhado</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 justify-end">
                  <a
                    href={prospect.mapUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(prospect.name + ' ' + (prospect.address || ''))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2 px-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.07] hover:border-white/[0.16] text-zinc-300 hover:text-white hover:-translate-y-[1px] active:translate-y-0 transition-all duration-150 inline-flex items-center gap-1.5 text-xs font-medium"
                    title="Ver Ficha no Google Maps"
                  >
                    <ExternalLink size={13} />
                    <span>Maps</span>
                  </a>
                  <Button
                    variant="success"
                    onClick={() => handleMoveToClients(prospect)}
                    className="py-2 px-3.5 text-xs"
                  >
                    <UserCheck size={13} />
                    <span>Fechar Negócio</span>
                  </Button>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      ) : (
        <div className="py-16 flex flex-col items-center justify-center text-center space-y-3 border border-dashed border-white/[0.08] rounded-2xl bg-white/[0.01]">
          <div className="w-11 h-11 rounded-xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-center text-zinc-500">
            <Search size={18} />
          </div>
          <div className="max-w-xs space-y-1">
            <h4 className="text-sm font-display font-bold text-white">Sem Prospects Aqui</h4>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Nenhum prospect com o estado "{activeFilter}" encontrado nesta secção.
            </p>
          </div>
        </div>
      )}

      {transitionTarget && (
        <StatusTransitionModal
          isOpen={!!transitionTarget}
          onClose={() => setTransitionTarget(null)}
          client={transitionTarget.client}
          targetStatus={transitionTarget.status}
          onConfirm={async (data) => {
            if (transitionTarget.status === 'Cliente') {
              await moveProspectToClients(transitionTarget.client.id, data);
            } else {
              await updateProspect(transitionTarget.client.id, {
                ...data,
                status: transitionTarget.status
              });
            }
            setTransitionTarget(null);
          }}
        />
      )}

      {/* Add Manual Prospect Modal */}
      <Modal 
        isOpen={showModal} 
        onClose={() => {
          setShowModal(false);
          setFormData({ companyName: '', address: '', website: '', mapUri: '', note: '', serviceType: '', rating: '', placeId: '' });
          setWebsiteLinks(EMPTY_WEBSITE_LINKS);
          setSocialPlatforms([]);
          setPaidPlatforms([]);
          setContactNames(['']);
          setEmails(['']);
          setPhones(['']);
          setManualMeetingDate('');
          setManualHostingerIds([]);
        }} 
        title="Adicionar Prospect Manual"
        subtitle="Preencha via Google Maps ou introduza os dados do prospect"
        size="lg"
      >
        <form onSubmit={handleAddManualProspect} className="space-y-6">
          <GoogleMapsLinkAutofill
            value={formData.mapUri}
            onChange={(val) => setFormData(prev => ({ ...prev, mapUri: val }))}
            onResolved={(place) => handleApplyGoogleMapsPlace(place, 'add')}
          />

          {/* 1. Identificação & Serviço */}
          <div className="space-y-4 pt-5 border-t border-white/[0.06]">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 font-sans">
              Identificação &amp; Serviço
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input 
                label="Nome da Empresa / Negócio" 
                placeholder="Ex: Agência Criativa" 
                value={formData.companyName}
                onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                required
              />
              <Select
                label="Serviço de Interesse"
                value={formData.serviceType}
                onChange={e => setFormData({ ...formData, serviceType: e.target.value })}
                required
                className={cn(formData.serviceType ? "text-white" : "text-zinc-500")}
              >
                <option value="" className="bg-zinc-950 text-zinc-500">Selecione um serviço</option>
                <option value="Website & Perfil Google" className="bg-zinc-950 text-white">Website &amp; Perfil Google</option>
                <option value="Gestão de Redes Sociais" className="bg-zinc-950 text-white">Gestão de Redes Sociais</option>
                <option value="Tráfego Pago" className="bg-zinc-950 text-white">Tráfego Pago</option>
                <option value="Automações" className="bg-zinc-950 text-white">Automações</option>
                <option value="Aplicações" className="bg-zinc-950 text-white">Aplicações</option>
                <option value="Outros" className="bg-zinc-950 text-white">Outros</option>
              </Select>
            </div>
            {isWebsiteGoogleService(formData.serviceType) && (
              <WebsiteLinksFields
                value={websiteLinks}
                onChange={setWebsiteLinks}
              />
            )}
            {hasServicePlatforms(formData.serviceType) && (
              <ServicePlatformsFields
                serviceType={formData.serviceType}
                socialPlatforms={socialPlatforms}
                onSocialPlatformsChange={setSocialPlatforms}
                paidTrafficPlatforms={paidPlatforms}
                onPaidTrafficPlatformsChange={setPaidPlatforms}
              />
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input 
                label="Morada" 
                placeholder="Ex: Avenida da Liberdade 120, Lisboa" 
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
              />
              <Input 
                label="Website" 
                placeholder="Ex: https://www.empresa.pt" 
                value={formData.website}
                onChange={e => setFormData({ ...formData, website: e.target.value })}
              />
            </div>
          </div>

          {/* 2. Contactos */}
          <div className="space-y-4 pt-5 border-t border-white/[0.06]">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 font-sans">
              Contactos
            </h4>

            {/* Contact Names */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 font-sans block ml-0.5">
                Nome do Responsável
              </label>
              <div className="space-y-2">
                {contactNames.map((name, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input 
                      placeholder="Ex: João Silva" 
                      value={name}
                      onChange={e => {
                        const updated = [...contactNames];
                        updated[idx] = e.target.value;
                        setContactNames(updated);
                      }}
                      className="w-full flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-vela-red/40 transition-all font-sans"
                    />
                    {contactNames.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setContactNames(contactNames.filter((_, i) => i !== idx))}
                        className="p-2.5 rounded-xl bg-white/[0.04] border border-white/5 text-zinc-500 hover:text-red-400 transition-colors shrink-0"
                        aria-label="Remover responsável"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setContactNames([...contactNames, ''])}
                className="text-[10px] font-bold uppercase tracking-wider text-vela-red hover:text-vela-red/80 flex items-center gap-1.5 ml-0.5 pt-0.5"
              >
                <Plus size={12} /> Adicionar outro responsável
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Phones */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 font-sans block ml-0.5">
                  Telemóvel
                </label>
                <div className="space-y-2">
                  {phones.map((phone, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input 
                        placeholder="Ex: +351 912 345 678" 
                        type="tel"
                        value={phone}
                        onChange={e => {
                          const updated = [...phones];
                          updated[idx] = e.target.value;
                          setPhones(updated);
                        }}
                        className="w-full flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-vela-red/40 transition-all font-sans"
                      />
                      {phones.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setPhones(phones.filter((_, i) => i !== idx))}
                          className="p-2.5 rounded-xl bg-white/[0.04] border border-white/5 text-zinc-500 hover:text-red-400 transition-colors shrink-0"
                          aria-label="Remover telemóvel"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setPhones([...phones, ''])}
                  className="text-[10px] font-bold uppercase tracking-wider text-vela-red hover:text-vela-red/80 flex items-center gap-1.5 ml-0.5 pt-0.5"
                >
                  <Plus size={12} /> Adicionar outro telemóvel
                </button>
              </div>

              {/* Emails */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 font-sans block ml-0.5">
                  Email
                </label>
                <div className="space-y-2">
                  {emails.map((email, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input 
                        placeholder="Ex: contacto@empresa.com" 
                        type="email"
                        value={email}
                        onChange={e => {
                          const updated = [...emails];
                          updated[idx] = e.target.value;
                          setEmails(updated);
                        }}
                        className="w-full flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-vela-red/40 transition-all font-sans"
                      />
                      {emails.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setEmails(emails.filter((_, i) => i !== idx))}
                          className="p-2.5 rounded-xl bg-white/[0.04] border border-white/5 text-zinc-500 hover:text-red-400 transition-colors shrink-0"
                          aria-label="Remover email"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setEmails([...emails, ''])}
                  className="text-[10px] font-bold uppercase tracking-wider text-vela-red hover:text-vela-red/80 flex items-center gap-1.5 ml-0.5 pt-0.5"
                >
                  <Plus size={12} /> Adicionar outro email
                </button>
              </div>
            </div>
          </div>

          {/* 3. Marcar Reunião */}
          <div className="space-y-3 pt-5 border-t border-white/[0.06]">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 font-sans">
                Marcar Reunião (Opcional)
              </h4>
              {manualMeetingDate && (
                <button
                  type="button"
                  onClick={() => {
                    setManualMeetingDate('');
                    setManualHostingerIds([]);
                  }}
                  className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-white transition-colors cursor-pointer"
                >
                  Limpar data
                </button>
              )}
            </div>
            <Input
              label="Data e Hora da Reunião"
              type="datetime-local"
              value={manualMeetingDate}
              onChange={(e) => setManualMeetingDate(e.target.value)}
              icon={<Calendar size={15} />}
            />
            {manualMeetingDate && (
              <div className="space-y-3">
                <HostingerLinksSelector
                  selectedIds={manualHostingerIds}
                  onChange={setManualHostingerIds}
                />
                {!accessToken ? (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5 text-xs text-amber-300 leading-relaxed">
                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                    <span>
                      Google Workspace não está ligado. Ligue o calendário para criar a reunião ou limpe a data para registar como &ldquo;Por Agendar&rdquo;.
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Ao registar, será criada a reunião no Google Calendar com link Google Meet e o prospect entrará em <strong className="text-emerald-400 font-semibold">Reunião Agendada</strong>.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 4. Observações */}
          <div className="space-y-2 pt-5 border-t border-white/[0.06]">
            <Input 
              label="Nota Inicial" 
              placeholder="Ex: Observações importantes sobre o prospect..." 
              value={formData.note}
              onChange={e => setFormData({ ...formData, note: e.target.value })}
            />
          </div>

          {/* Footer */}
          <div className="pt-5 border-t border-white/[0.06] flex items-center justify-end gap-3">
            <Button 
              type="button" 
              variant="secondary" 
              onClick={() => setShowModal(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={Boolean(manualMeetingDate.trim()) && !accessToken}
            >
              {manualMeetingDate.trim() ? 'Agendar e Registrar Prospect' : 'Registrar Prospect'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Manual Prospect Modal */}
      <Modal 
        isOpen={!!editingProspect} 
        onClose={() => setEditingProspect(null)} 
        title="Editar Prospect"
        subtitle={editingProspect?.name}
        size="lg"
      >
        <form onSubmit={handleSaveEditProspect} className="space-y-6">
          <GoogleMapsLinkAutofill
            value={editFormData.mapUri}
            onChange={(val) => setEditFormData(prev => ({ ...prev, mapUri: val }))}
            onResolved={(place) => handleApplyGoogleMapsPlace(place, 'edit')}
          />

          {/* 1. Identificação & Serviço */}
          <div className="space-y-4 pt-5 border-t border-white/[0.06]">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 font-sans">
              Identificação &amp; Serviço
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input 
                label="Nome da Empresa / Negócio" 
                placeholder="Ex: Agência Criativa" 
                value={editFormData.companyName}
                onChange={e => setEditFormData({ ...editFormData, companyName: e.target.value })}
                required
              />
              <Select
                label="Serviço de Interesse"
                value={editFormData.serviceType}
                onChange={e => setEditFormData({ ...editFormData, serviceType: e.target.value })}
                required
                className={cn(editFormData.serviceType ? "text-white" : "text-zinc-500")}
              >
                <option value="" className="bg-zinc-950 text-zinc-500">Selecione um serviço</option>
                <option value="Website & Perfil Google" className="bg-zinc-950 text-white">Website &amp; Perfil Google</option>
                <option value="Gestão de Redes Sociais" className="bg-zinc-950 text-white">Gestão de Redes Sociais</option>
                <option value="Tráfego Pago" className="bg-zinc-950 text-white">Tráfego Pago</option>
                <option value="Automações" className="bg-zinc-950 text-white">Automações</option>
                <option value="Aplicações" className="bg-zinc-950 text-white">Aplicações</option>
                <option value="Outros" className="bg-zinc-950 text-white">Outros</option>
              </Select>
            </div>
            {isWebsiteGoogleService(editFormData.serviceType) && (
              <WebsiteLinksFields
                value={editWebsiteLinks}
                onChange={setEditWebsiteLinks}
              />
            )}
            {hasServicePlatforms(editFormData.serviceType) && (
              <ServicePlatformsFields
                serviceType={editFormData.serviceType}
                socialPlatforms={editSocialPlatforms}
                onSocialPlatformsChange={setEditSocialPlatforms}
                paidTrafficPlatforms={editPaidPlatforms}
                onPaidTrafficPlatformsChange={setEditPaidPlatforms}
              />
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input 
                label="Morada" 
                placeholder="Ex: Avenida da Liberdade 120, Lisboa" 
                value={editFormData.address}
                onChange={e => setEditFormData({ ...editFormData, address: e.target.value })}
              />
              <Input 
                label="Website" 
                placeholder="Ex: https://www.empresa.pt" 
                value={editFormData.website}
                onChange={e => setEditFormData({ ...editFormData, website: e.target.value })}
              />
            </div>
          </div>

          {/* 2. Contactos */}
          <div className="space-y-4 pt-5 border-t border-white/[0.06]">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 font-sans">
              Contactos
            </h4>

            {/* Edit Contact Names */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 font-sans block ml-0.5">
                Nome do Responsável
              </label>
              <div className="space-y-2">
                {editContactNames.map((name, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input 
                      placeholder="Ex: João Silva" 
                      value={name}
                      onChange={e => {
                        const updated = [...editContactNames];
                        updated[idx] = e.target.value;
                        setEditContactNames(updated);
                      }}
                      className="w-full flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-vela-red/40 transition-all font-sans"
                    />
                    {editContactNames.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setEditContactNames(editContactNames.filter((_, i) => i !== idx))}
                        className="p-2.5 rounded-xl bg-white/[0.04] border border-white/5 text-zinc-500 hover:text-red-400 transition-colors shrink-0"
                        aria-label="Remover responsável"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setEditContactNames([...editContactNames, ''])}
                className="text-[10px] font-bold uppercase tracking-wider text-vela-red hover:text-vela-red/80 flex items-center gap-1.5 ml-0.5 pt-0.5"
              >
                <Plus size={12} /> Adicionar outro responsável
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Edit Phones */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 font-sans block ml-0.5">
                  Telemóvel
                </label>
                <div className="space-y-2">
                  {editPhones.map((phone, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input 
                        placeholder="Ex: +351 912 345 678" 
                        type="tel"
                        value={phone}
                        onChange={e => {
                          const updated = [...editPhones];
                          updated[idx] = e.target.value;
                          setEditPhones(updated);
                        }}
                        className="w-full flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-vela-red/40 transition-all font-sans"
                      />
                      {editPhones.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setEditPhones(editPhones.filter((_, i) => i !== idx))}
                          className="p-2.5 rounded-xl bg-white/[0.04] border border-white/5 text-zinc-500 hover:text-red-400 transition-colors shrink-0"
                          aria-label="Remover telemóvel"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setEditPhones([...editPhones, ''])}
                  className="text-[10px] font-bold uppercase tracking-wider text-vela-red hover:text-vela-red/80 flex items-center gap-1.5 ml-0.5 pt-0.5"
                >
                  <Plus size={12} /> Adicionar outro telemóvel
                </button>
              </div>

              {/* Edit Emails */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 font-sans block ml-0.5">
                  Email
                </label>
                <div className="space-y-2">
                  {editEmails.map((email, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input 
                        placeholder="Ex: contacto@empresa.com" 
                        type="email"
                        value={email}
                        onChange={e => {
                          const updated = [...editEmails];
                          updated[idx] = e.target.value;
                          setEditEmails(updated);
                        }}
                        className="w-full flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-vela-red/40 transition-all font-sans"
                      />
                      {editEmails.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setEditEmails(editEmails.filter((_, i) => i !== idx))}
                          className="p-2.5 rounded-xl bg-white/[0.04] border border-white/5 text-zinc-500 hover:text-red-400 transition-colors shrink-0"
                          aria-label="Remover email"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setEditEmails([...editEmails, ''])}
                  className="text-[10px] font-bold uppercase tracking-wider text-vela-red hover:text-vela-red/80 flex items-center gap-1.5 ml-0.5 pt-0.5"
                >
                  <Plus size={12} /> Adicionar outro email
                </button>
              </div>
            </div>
          </div>

          {/* 3. Observações */}
          <div className="space-y-2 pt-5 border-t border-white/[0.06]">
            <Input 
              label="Nota / Observação" 
              placeholder="Ex: Observações importantes..." 
              value={editFormData.note}
              onChange={e => setEditFormData({ ...editFormData, note: e.target.value })}
            />
          </div>

          {/* Footer */}
          <div className="pt-5 border-t border-white/[0.06] flex items-center justify-end gap-3">
            <Button 
              type="button" 
              variant="secondary" 
              onClick={() => setEditingProspect(null)}
            >
              Cancelar
            </Button>
            <Button type="submit">
              Guardar Alterações
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      {prospectToDelete && (
        <ConfirmDeleteModal
          isOpen={!!prospectToDelete}
          onClose={() => setProspectToDelete(null)}
          onConfirm={async () => {
            await deleteProspect(prospectToDelete.id);
          }}
          itemName={prospectToDelete.name}
          itemType="Prospect"
          subtitle={prospectToDelete.contactName}
        />
      )}
    </div>
  );
};
