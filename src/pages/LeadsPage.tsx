import React, { useState } from 'react';
import { GlassCard, Button, Modal, Input, Select } from '../components/UI';
import { cn } from '../lib/utils';
import { 
  Search, 
  Phone, 
  PhoneOff,
  Clock, 
  XCircle,
  Plus, 
  Loader2, 
  Trash2,
  ExternalLink,
  Target,
  PlusCircle,
  MapPin,
  Sparkles,
  RefreshCw,
  Edit3,
  FileText,
  Globe,
  Calendar,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useBackgroundAction } from '../contexts/BackgroundActionContext';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
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

interface LeadsPageProps {
  onLeadClick: (lead: any) => void;
  onNavigateToClients?: () => void;
  onNavigateToProspecting?: () => void;
}

export const LeadsPage: React.FC<LeadsPageProps> = ({ 
  onLeadClick, 
  onNavigateToClients,
  onNavigateToProspecting 
}) => {
  const { leads, createLead, updateLead, deleteLead, moveLeadToProspects, scheduleMeet, accessToken } = useWorkspace();
  const { runBackgroundAction } = useBackgroundAction();
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'alphabetical'>('recent');
  const [leadToDelete, setLeadToDelete] = useState<any | null>(null);
  const [editingLead, setEditingLead] = useState<any | null>(null);
  const [leadToQualify, setLeadToQualify] = useState<any | null>(null);
  const [qualifyStep, setQualifyStep] = useState<'choose' | 'schedule'>('choose');
  const [qualifyMeetingDate, setQualifyMeetingDate] = useState('');
  const [qualifyHostingerIds, setQualifyHostingerIds] = useState<string[]>([]);
  const availableHostingerLinks = useAvailableHostingerLinks();

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

  const handleOpenEditLead = (lead: any) => {
    setEditingLead(lead);
    const latestNote = lead.notes?.[0]?.content || '';
    setEditContactNames(lead.contactName ? lead.contactName.split(',').map((s: string) => s.trim()) : ['']);
    setEditEmails(lead.email ? lead.email.split(',').map((s: string) => s.trim()) : ['']);
    setEditPhones(lead.phone && lead.phone !== 'Não listado' ? lead.phone.split(',').map((s: string) => s.trim()) : ['']);
    setEditFormData({
      companyName: lead.name || '',
      address: lead.address || '',
      website: lead.website && lead.website !== 'Não' ? lead.website : '',
      mapUri: lead.mapUri || '',
      note: latestNote,
      serviceType: lead.serviceType || '',
      rating: lead.rating || '',
      placeId: lead.placeId || ''
    });
    setEditWebsiteLinks(buildWebsiteLinksPayload(lead.websiteLinks));
    setEditSocialPlatforms(normalizeSocialMediaPlatforms(lead.socialMediaPlatforms));
    setEditPaidPlatforms(normalizePaidTrafficPlatforms(lead.paidTrafficPlatforms));
  };

  const handleSaveEditLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLead || !editFormData.companyName || !editFormData.serviceType) return;

    const existingNotes = editingLead.notes || [];
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

    const leadId = editingLead.id;
    setEditingLead(null);

    runBackgroundAction({
      title: `A atualizar lead "${payload.name}"...`,
      action: async () => {
        await updateLead(leadId, payload);
      },
      errorMessage: 'Erro ao atualizar lead.'
    });
  };
  
  // 4 big interactive card filters
  const [activeFilter, setActiveFilter] = useState<'Por contactar' | 'Não atendeu' | 'Ligar mais tarde' | 'Não interessado'>('Por contactar');
  const [websiteFilter, setWebsiteFilter] = useState<'all' | 'has-website' | 'no-website'>('all');

  const leadHasWebsite = (lead: any): boolean => {
    const rawWebsite = (lead?.website || '').trim();
    const normalized = rawWebsite.toLowerCase();
    const hasExplicitNoWebsite =
      normalized === 'não' ||
      normalized === 'nao' ||
      normalized.startsWith('sem website');
    if (hasExplicitNoWebsite) return false;
    if (rawWebsite.length > 0) return true;
    return Boolean(lead?.hasWebsite);
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

  // Count leads for each status
  const getCount = (status: string) => (leads || []).filter(l => l.status === status).length;

  const porContactarLeads = (leads || []).filter(l => l.status === 'Por contactar');
  const porContactarWithSiteCount = porContactarLeads.filter(l => leadHasWebsite(l)).length;
  const porContactarWithoutSiteCount = porContactarLeads.length - porContactarWithSiteCount;

  const filteredLeads = (leads || []).filter(l => {
    const matchesFilter = l.status === activeFilter;
    const matchesWebsite =
      activeFilter !== 'Por contactar' || websiteFilter === 'all'
        ? true
        : websiteFilter === 'has-website'
          ? leadHasWebsite(l)
          : !leadHasWebsite(l);
    const matchesSearch = !searchQuery ? true : (
      (l.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.contactName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.phone || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
    return matchesFilter && matchesWebsite && matchesSearch;
  });

  const sortedLeads = [...filteredLeads].sort((a, b) => {
    if (sortBy === 'alphabetical') {
      return (a.name || '').localeCompare(b.name || '');
    } else {
      const timeA = new Date(a.lastInteraction || 0).getTime();
      const timeB = new Date(b.lastInteraction || 0).getTime();
      return timeB - timeA;
    }
  });

  const handleAddManualLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName || !formData.serviceType) return;

    const payload = {
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
      status: 'Por contactar',
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

    runBackgroundAction({
      title: `A registar lead "${payload.name}"...`,
      action: async () => {
        await createLead(payload);
      },
      errorMessage: 'Erro ao registar lead manualmente.'
    });
  };

  const handleMoveStatus = (leadId: string, newStatus: string) => {
    runBackgroundAction({
      title: `A mover para "${newStatus}"...`,
      action: async () => {
        await updateLead(leadId, { status: newStatus, lastInteraction: new Date().toISOString() });
      },
      errorMessage: 'Erro ao atualizar estado da lead.'
    });
  };

  const getDefaultQualifyDate = () => {
    const d = new Date(Date.now() + 3600000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const handleOpenQualifyModal = (lead: any) => {
    setLeadToQualify(lead);
    setQualifyStep('choose');
    setQualifyMeetingDate(getDefaultQualifyDate());
    setQualifyHostingerIds([]);
  };

  const handleConfirmQualifyWithMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadToQualify || !qualifyMeetingDate) return;

    const lead = leadToQualify;
    const scheduledDate = qualifyMeetingDate;
    const projectName = lead.serviceType || 'Projeto Geral';
    const summary = `Reunião: ${lead.name} (${projectName})`;
    const chosenHostingerLinks = availableHostingerLinks
      .filter((item) => qualifyHostingerIds.includes(item.id))
      .map(({ id, entityName, projectName: pName, url }) => ({
        id,
        entityName,
        projectName: pName,
        url,
      }));

    setLeadToQualify(null);

    runBackgroundAction({
      title: `A agendar reunião e passar "${lead.name}" para Prospects...`,
      action: async () => {
        const createdEvent = await scheduleMeet(
          summary,
          scheduledDate + ':00',
          chosenHostingerLinks
        );
        const existingIds = Array.isArray(lead.associatedMeetingIds)
          ? lead.associatedMeetingIds
          : [];
        const mergedIds = createdEvent?.id
          ? Array.from(
              new Set([
                ...existingIds,
                ...(lead.associatedMeetingId ? [lead.associatedMeetingId] : []),
                createdEvent.id,
              ])
            )
          : existingIds;

        await moveLeadToProspects(lead.id, {
          status: 'Reunião Agendada',
          ...(createdEvent?.id
            ? {
                associatedMeetingId: createdEvent.id,
                associatedMeetingIds: mergedIds,
              }
            : {}),
          lastInteraction: new Date().toISOString(),
        });
      },
      errorMessage: `Erro ao agendar reunião e qualificar "${lead.name}".`,
    });
  };

  const handleQualifyWithoutMeeting = () => {
    if (!leadToQualify) return;
    const lead = leadToQualify;
    setLeadToQualify(null);

    runBackgroundAction({
      title: `A mover "${lead.name}" para Prospects...`,
      action: async () => {
        await moveLeadToProspects(lead.id, { status: 'Por Agendar' });
      },
      errorMessage: 'Erro ao qualificar lead para Prospects.'
    });
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h2 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-white">
            Pipeline de Leads
          </h2>
          <p className="text-sm text-zinc-400 max-w-xl leading-relaxed">
            Central de leads angariadas para contacto comercial. Mova as leads entre os estados ou qualifique-as como <strong className="text-white font-semibold">Prospect</strong> após interesse confirmado.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowModal(true)}
          className="shrink-0"
        >
          <Plus size={15} />
          <span>Nova Lead Manual</span>
        </Button>
      </header>

      {/* 4 Stage Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {([
          {
            id: 'Por contactar' as const,
            label: 'Por Contactar',
            subtext: 'Prontas para primeiro contacto',
            icon: Phone,
            activeCard: 'border-amber-500/40 bg-amber-500/[0.04]',
            activeLabel: 'text-amber-400',
            activeCount: 'text-amber-400',
            activeIcon: 'bg-amber-500/15 border-amber-500/30 text-amber-400'
          },
          {
            id: 'Não atendeu' as const,
            label: 'Não Atendeu',
            subtext: 'Sem resposta na tentativa',
            icon: PhoneOff,
            activeCard: 'border-red-500/40 bg-red-500/[0.04]',
            activeLabel: 'text-red-400',
            activeCount: 'text-red-400',
            activeIcon: 'bg-red-500/15 border-red-500/30 text-red-400'
          },
          {
            id: 'Ligar mais tarde' as const,
            label: 'Ligar Mais Tarde',
            subtext: 'Seguimento comercial agendado',
            icon: Clock,
            activeCard: 'border-sky-500/40 bg-sky-500/[0.04]',
            activeLabel: 'text-sky-400',
            activeCount: 'text-sky-400',
            activeIcon: 'bg-sky-500/15 border-sky-500/30 text-sky-400'
          },
          {
            id: 'Não interessado' as const,
            label: 'Não Interessado',
            subtext: 'Sem interesse comercial atual',
            icon: XCircle,
            activeCard: 'border-zinc-500/40 bg-zinc-500/[0.05]',
            activeLabel: 'text-zinc-300',
            activeCount: 'text-zinc-200',
            activeIcon: 'bg-zinc-500/20 border-zinc-500/30 text-zinc-300'
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
                        {count === 1 ? 'lead' : 'leads'}
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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-5 border-t border-white/[0.06]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-display font-bold text-white tracking-tight">
              {activeFilter}
            </h3>
            <span className="text-xs font-semibold text-zinc-500 tabular-nums">
              ({sortedLeads.length})
            </span>
          </div>

          {activeFilter === 'Por contactar' && (
            <div className="flex items-center gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/[0.07]">
              <button
                type="button"
                onClick={() => setWebsiteFilter('all')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors tabular-nums",
                  websiteFilter === 'all'
                    ? "bg-white/10 text-white"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                Todos ({porContactarLeads.length})
              </button>
              <button
                type="button"
                onClick={() => setWebsiteFilter('has-website')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors tabular-nums",
                  websiteFilter === 'has-website'
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                Com site ({porContactarWithSiteCount})
              </button>
              <button
                type="button"
                onClick={() => setWebsiteFilter('no-website')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors tabular-nums",
                  websiteFilter === 'no-website'
                    ? "bg-amber-500/15 text-amber-400 border border-amber-500/25"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                Sem site ({porContactarWithoutSiteCount})
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
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
              placeholder="Pesquisar leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 bg-white/[0.03] border border-white/[0.08] rounded-xl pl-9 pr-3 text-xs text-white focus:outline-none focus:border-vela-red/50 transition-colors placeholder:text-zinc-600"
            />
          </div>
        </div>
      </div>

      {/* Leads Cards Grid */}
      {sortedLeads.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {sortedLeads.map((lead) => {
            const hasSite = leadHasWebsite(lead);
            return (
              <GlassCard
                key={lead.id}
                className="p-6 hover:border-white/[0.14] transition-colors flex flex-col justify-between gap-5"
              >
                <div className="space-y-4">
                  {/* Card Top */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <h4
                        onClick={() => onLeadClick(lead)}
                        className="text-base font-display font-bold text-white hover:text-vela-red transition-colors cursor-pointer truncate"
                      >
                        {lead.name}
                      </h4>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                        <span>{lead.serviceType || 'Website & Rebranding'}</span>
                        {(() => {
                          const included = getIncludedPlatformsForEntity(lead);
                          if (included.length === 0) return null;
                          return (
                            <>
                              <span className="text-zinc-700">·</span>
                              <span className="text-zinc-300 font-medium">{included.join(' · ')}</span>
                            </>
                          );
                        })()}
                        <span className="text-zinc-700">·</span>
                        <span className={cn("inline-flex items-center gap-1 font-medium", hasSite ? "text-emerald-400" : "text-amber-400")}>
                          <Globe size={11} />
                          {hasSite ? 'Com site' : 'Sem site'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEditLead(lead)}
                        className="text-zinc-500 hover:text-white p-2 rounded-lg hover:bg-white/[0.06] hover:-translate-y-[1px] active:translate-y-0 transition-all duration-150"
                        title="Editar Lead"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setLeadToDelete(lead)}
                        className="text-zinc-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 hover:-translate-y-[1px] active:translate-y-0 transition-all duration-150"
                        title="Eliminar Lead"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="space-y-1.5 text-xs text-zinc-400">
                    {lead.address && (
                      <div className="flex items-start gap-2">
                        <MapPin size={13} className="text-zinc-500 shrink-0 mt-0.5" />
                        <span className="text-zinc-300 leading-snug">{lead.address}</span>
                      </div>
                    )}
                    {lead.contactName && (
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-500 text-[11px] font-medium">Responsável:</span>
                        <span className="text-zinc-200">{lead.contactName}</span>
                      </div>
                    )}
                    {lead.email && (
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-500 text-[11px] font-medium">Email:</span>
                        <span className="text-zinc-200 truncate">{lead.email}</span>
                      </div>
                    )}
                    {lead.phone && lead.phone !== 'Não listado' && (
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-500 text-[11px] font-medium">Telemóvel:</span>
                        <a href={`tel:${lead.phone}`} className="text-zinc-200 hover:text-white hover:underline inline-flex items-center gap-1.5 tabular-nums">
                          {lead.phone}
                          <Phone size={11} className="text-emerald-400" />
                        </a>
                      </div>
                    )}
                    {hasSite && lead.website && (
                      <div className="flex items-center gap-2">
                        <Globe size={13} className="text-emerald-400 shrink-0" />
                        <a
                          href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-300 hover:text-white hover:underline truncate"
                        >
                          {lead.website}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Note & Opportunity */}
                  {lead.notes && lead.notes.length > 0 && (
                    <div className="bg-white/[0.025] p-3.5 rounded-xl border border-white/[0.06] space-y-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                        <FileText size={11} />
                        Observação · <span className="tabular-nums">{lead.notes[0].date}</span>
                      </span>
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        {lead.notes[0].content}
                      </p>
                    </div>
                  )}

                  {lead.opportunity && (
                    <div className="bg-white/[0.025] p-3.5 rounded-xl border border-white/[0.06] space-y-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/90 flex items-center gap-1.5">
                        <Sparkles size={11} />
                        Diagnóstico de Oportunidade
                      </span>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        {lead.opportunity}
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="pt-4 border-t border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-zinc-500">Mover:</span>
                    <select
                      value={lead.status}
                      onChange={(e) => handleMoveStatus(lead.id, e.target.value)}
                      className="bg-[#0D0D0F] border border-white/[0.08] focus:border-white/25 focus:outline-none rounded-lg py-1.5 px-2.5 text-xs text-zinc-300 font-medium transition-colors"
                    >
                      <option value="Por contactar">Por Contactar</option>
                      <option value="Não atendeu">Não Atendeu</option>
                      <option value="Ligar mais tarde">Ligar mais tarde</option>
                      <option value="Não interessado">Não interessado</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 justify-end">
                    <a
                      href={lead.mapUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.name + ' ' + (lead.address || ''))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2 px-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.07] hover:border-white/[0.16] text-zinc-300 hover:text-white hover:-translate-y-[1px] active:translate-y-0 transition-all duration-150 inline-flex items-center gap-1.5 text-xs font-medium"
                      title="Ver Ficha no Google Maps"
                    >
                      <ExternalLink size={13} />
                      <span>Maps</span>
                    </a>
                    <Button
                      onClick={() => handleOpenQualifyModal(lead)}
                      className="py-2 px-3.5 text-xs"
                    >
                      <Target size={13} />
                      <span>Qualificar p/ Prospect</span>
                    </Button>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      ) : (
        <div className="py-16 flex flex-col items-center justify-center text-center space-y-3 border border-dashed border-white/[0.08] rounded-2xl bg-white/[0.01]">
          <div className="w-11 h-11 rounded-xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-center text-zinc-500">
            <Search size={18} />
          </div>
          <div className="max-w-xs space-y-1">
            <h4 className="text-sm font-display font-bold text-white">Sem Leads Aqui</h4>
            <p className="text-xs text-zinc-500 leading-relaxed">
              {activeFilter === 'Por contactar' && websiteFilter !== 'all'
                ? `Nenhuma lead "${websiteFilter === 'has-website' ? 'Com site' : 'Sem site'}" encontrada em "Por contactar".`
                : `Nenhuma lead com o estado "${activeFilter}" encontrada nesta secção.`}
            </p>
          </div>
        </div>
      )}

      {/* Add Manual Lead Modal */}
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
        }} 
        title="Adicionar Lead Manual"
        subtitle="Preencha via Google Maps ou introduza os dados comerciais"
        size="lg"
      >
        <form onSubmit={handleAddManualLead} className="space-y-6">
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
                placeholder="Ex: Imobiliária Central" 
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

          {/* 3. Observações */}
          <div className="space-y-2 pt-5 border-t border-white/[0.06]">
            <Input 
              label="Nota Inicial" 
              placeholder="Ex: Observações importantes sobre a lead..." 
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
            <Button type="submit">
              Registrar Lead
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Manual Lead Modal */}
      <Modal 
        isOpen={!!editingLead} 
        onClose={() => setEditingLead(null)} 
        title="Editar Lead"
        subtitle={editingLead?.name}
        size="lg"
      >
        <form onSubmit={handleSaveEditLead} className="space-y-6">
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
                placeholder="Ex: Imobiliária Central" 
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
              onClick={() => setEditingLead(null)}
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
      {leadToDelete && (
        <ConfirmDeleteModal
          isOpen={!!leadToDelete}
          onClose={() => setLeadToDelete(null)}
          onConfirm={async () => {
            await deleteLead(leadToDelete.id);
          }}
          itemName={leadToDelete.name}
          itemType="Lead"
          subtitle={leadToDelete.contactName}
        />
      )}

      {/* Qualify Lead -> Prospect Choice & Conditional Meeting Scheduling Modal */}
      <Modal
        isOpen={!!leadToQualify}
        onClose={() => setLeadToQualify(null)}
        title={
          qualifyStep === 'choose'
            ? 'Passar para Prospect'
            : 'Agendar Reunião · Passar a Prospect'
        }
        subtitle={leadToQualify?.name}
        size="md"
      >
        {leadToQualify && qualifyStep === 'choose' && (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-white/[0.025] border border-white/[0.07] space-y-2.5">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-zinc-400">Entidade</span>
                <span className="text-white font-semibold truncate">{leadToQualify.name} (Lead → Prospect)</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-xs pt-2 border-t border-white/[0.06]">
                <span className="text-zinc-400">Projeto</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1.5 truncate">
                  <CheckCircle2 size={12} className="shrink-0" />
                  <span>{leadToQualify.serviceType || 'Projeto Geral'}</span>
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              <p className="text-xs font-medium text-zinc-400">
                Escolha o estado inicial do Prospect:
              </p>

              <button
                type="button"
                onClick={handleQualifyWithoutMeeting}
                className="w-full text-left p-4 rounded-xl bg-white/[0.02] hover:bg-amber-500/[0.06] border border-white/10 hover:border-amber-500/40 transition-all duration-150 flex items-start gap-3.5 group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                  <Clock size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white group-hover:text-amber-300 transition-colors">
                    Prospect Por Agendar
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                    Passar para Prospects no estado &ldquo;Por Agendar&rdquo; sem marcar reunião agora.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setQualifyMeetingDate(getDefaultQualifyDate());
                  setQualifyHostingerIds([]);
                  setQualifyStep('schedule');
                }}
                className="w-full text-left p-4 rounded-xl bg-white/[0.02] hover:bg-emerald-500/[0.06] border border-white/10 hover:border-emerald-500/40 transition-all duration-150 flex items-start gap-3.5 group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                  <Calendar size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white group-hover:text-emerald-300 transition-colors">
                    Prospect Reunião Agendada
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                    Agendar a reunião no Google Calendar / Meet e desbloquear a ficha comercial.
                  </p>
                </div>
              </button>
            </div>

            <div className="pt-4 border-t border-white/[0.06]">
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => setLeadToQualify(null)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {leadToQualify && qualifyStep === 'schedule' && (
          <form onSubmit={handleConfirmQualifyWithMeeting} className="space-y-5">
            <div className="p-4 rounded-xl bg-white/[0.025] border border-white/[0.07] space-y-2.5">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-zinc-400">Entidade</span>
                <span className="text-white font-semibold truncate">{leadToQualify.name} (Lead → Prospect)</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-xs pt-2 border-t border-white/[0.06]">
                <span className="text-zinc-400">Projeto</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1.5 truncate">
                  <CheckCircle2 size={12} className="shrink-0" />
                  <span>{leadToQualify.serviceType || 'Projeto Geral'}</span>
                </span>
              </div>
            </div>

            <Input
              label="Data e Hora da Reunião"
              type="datetime-local"
              value={qualifyMeetingDate}
              onChange={(e) => setQualifyMeetingDate(e.target.value)}
              icon={<Calendar size={15} />}
              required
            />

            <HostingerLinksSelector
              selectedIds={qualifyHostingerIds}
              onChange={setQualifyHostingerIds}
              priorityProjectId={leadToQualify.id}
            />

            {!accessToken ? (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5 text-xs text-amber-300 leading-relaxed">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>
                  Google Workspace não está ligado. Ligue o calendário para agendar automaticamente ou volte atrás para passar como &ldquo;Por Agendar&rdquo;.
                </span>
              </div>
            ) : (
              <p className="text-xs text-zinc-400 leading-relaxed">
                Ao confirmar, será criado um evento no Google Calendar com link Google Meet e o prospect passará diretamente para <strong className="text-emerald-400 font-semibold">Reunião Agendada</strong>.
              </p>
            )}

            <div className="pt-4 border-t border-white/[0.06] flex items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setQualifyStep('choose')}
              >
                Voltar
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={!qualifyMeetingDate || !accessToken}
              >
                <Calendar size={14} />
                <span>Agendar e Passar a Prospect</span>
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
