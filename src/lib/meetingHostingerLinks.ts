import { MeetingHostingerLink } from '../types';
import { normalizeWebsiteLinkUrl } from '../components/WebsiteLinksSection';

const PREP_HEADER = 'Links Hostinger (Preparação):';

export function buildMeetingEventMetadata(hostingerLinks?: MeetingHostingerLink[]) {
  const deduped = new Map<string, MeetingHostingerLink>();
  (hostingerLinks || []).forEach((item) => {
    const normalizedUrl = normalizeWebsiteLinkUrl(item.url);
    if (!normalizedUrl) return;
    if (!deduped.has(item.id)) {
      deduped.set(item.id, {
        id: item.id,
        entityName: (item.entityName || 'Entidade').trim(),
        projectName: (item.projectName || 'Projeto Geral').trim(),
        url: normalizedUrl,
      });
    }
  });

  const cleanLinks = Array.from(deduped.values());
  const descriptionLines = ['Reunião agendada via Vela OS'];

  if (cleanLinks.length > 0) {
    descriptionLines.push('', PREP_HEADER);
    cleanLinks.forEach((l) => {
      descriptionLines.push(`• ${l.entityName} — ${l.projectName}: ${l.url}`);
    });
  }

  const compactPayload = JSON.stringify(
    cleanLinks.map((l) => ({
      i: l.id,
      e: l.entityName,
      p: l.projectName,
      u: l.url,
    }))
  );

  return {
    cleanLinks,
    description: descriptionLines.join('\n'),
    extendedProperties:
      cleanLinks.length > 0 && compactPayload.length <= 950
        ? { private: { velaHostingerLinks: compactPayload } }
        : undefined,
  };
}

export function parseHostingerLinksFromEvent(event: any): MeetingHostingerLink[] {
  const fromProp = event?.extendedProperties?.private?.velaHostingerLinks;
  if (typeof fromProp === 'string' && fromProp.trim()) {
    try {
      const parsed = JSON.parse(fromProp);
      if (Array.isArray(parsed)) {
        const items: MeetingHostingerLink[] = parsed
          .map((x: any, idx: number) => ({
            id: String(x?.i || x?.id || `prop-${idx}`),
            entityName: String(x?.e || x?.entityName || 'Entidade'),
            projectName: String(x?.p || x?.projectName || 'Projeto'),
            url: normalizeWebsiteLinkUrl(x?.u || x?.url || ''),
          }))
          .filter((x) => Boolean(x.url));
        if (items.length > 0) return items;
      }
    } catch {
      // Fall through to description parsing
    }
  }

  const desc = typeof event?.description === 'string' ? event.description : '';
  if (!desc.includes(PREP_HEADER)) return [];

  const section = desc.split(PREP_HEADER)[1] || '';
  const results: MeetingHostingerLink[] = [];
  const lines = section.split('\n');

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line.startsWith('•')) return;
    const match = line.match(/^•\s*(.+?)\s*(?:—|-)\s*(.+?):\s*(https?:\/\/\S+)$/i);
    if (match) {
      const url = normalizeWebsiteLinkUrl(match[3]);
      if (url) {
        results.push({
          id: `desc-${idx}`,
          entityName: match[1].trim(),
          projectName: match[2].trim(),
          url,
        });
      }
    }
  });

  return results;
}

export function openAllHostingerLinks(
  links: MeetingHostingerLink[]
): { opened: number; blocked: number; urls: string[] } {
  const uniqueUrls = Array.from(
    new Set(
      (links || [])
        .map((l) => normalizeWebsiteLinkUrl(l.url))
        .filter(Boolean)
    )
  );

  let opened = 0;
  let blocked = 0;

  uniqueUrls.forEach((url) => {
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (win) {
      opened++;
    } else {
      blocked++;
    }
  });

  return { opened, blocked, urls: uniqueUrls };
}
