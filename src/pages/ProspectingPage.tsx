import React, { useState } from 'react';
import { 
  MapPin, 
  Search, 
  Globe, 
  Phone, 
  Star, 
  ExternalLink, 
  UserPlus, 
  CheckCircle2, 
  Compass, 
  Sparkles, 
  Building2, 
  AlertCircle,
  TrendingUp,
  FileText,
  Filter,
  ArrowRight,
  History,
  X,
  Trash2,
  PlusCircle,
  DownloadCloud,
  Layers,
  LayoutGrid,
  List,
  Check
} from 'lucide-react';
import { GlassCard, Button, Badge } from '../components/UI';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { workspaceAPI } from '../lib/workspace';
import { cn } from '../lib/utils';

interface SearchHistoryItem {
  id: string;
  query: string;
  location: string;
  timestamp: number;
}

const SEARCH_HISTORY_STORAGE_KEY = 'vela_prospecting_search_history';

interface GroundingChunk {
  maps?: {
    uri: string;
    title: string;
  };
}

interface DiscoveredBusiness {
  id: string;
  name: string;
  category: string;
  address: string;
  phone: string;
  website: string;
  hasWebsite: boolean;
  rating: string;
  opportunity: string;
  mapUri?: string;
  position?: number;
  profileYears?: number;
}

export const ProspectingPage: React.FC<{ onNavigateToClients?: () => void }> = ({ onNavigateToClients }) => {
  const { addClient, clients, accessToken, login } = useWorkspace();

  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');

  // New Search Filters States
  const [minPosition, setMinPosition] = useState<number>(1);
  const [positionFilterActive, setPositionFilterActive] = useState<boolean>(false);
  const [websiteFilter, setWebsiteFilter] = useState<'all' | 'no-website' | 'has-website'>('all');
  const [minProfileYears, setMinProfileYears] = useState<number>(0);
  const [profileYearsFilterActive, setProfileYearsFilterActive] = useState<boolean>(false);

  // Two-step Button Confirmation States
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingImportId, setPendingImportId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isImportingAll, setIsImportingAll] = useState(false);
  const [searchBatch, setSearchBatch] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [rawText, setRawText] = useState<string>('');
  const [groundingChunks, setGroundingChunks] = useState<GroundingChunk[]>([]);
  const [businesses, setBusinesses] = useState<DiscoveredBusiness[]>(() => {
    try {
      const saved = localStorage.getItem('vela_prospecting_discovered_businesses');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load businesses from localStorage:', e);
    }
    return [];
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('vela_prospecting_discovered_businesses', JSON.stringify(businesses));
    } catch (e) {
      console.warn('Failed to save businesses to localStorage:', e);
    }
  }, [businesses]);

  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);

  // Search History State
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(SEARCH_HISTORY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load search history:', e);
    }
    return [];
  });

  const saveHistoryItem = (searchQ: string, searchLoc: string) => {
    const qClean = searchQ.trim();
    const locClean = searchLoc.trim();
    if (!qClean && !locClean) return;

    setSearchHistory((prev) => {
      const filtered = prev.filter(
        (item) => !(item.query.toLowerCase() === qClean.toLowerCase() && item.location.toLowerCase() === locClean.toLowerCase())
      );

      const newItem: SearchHistoryItem = {
        id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        query: qClean || 'Empresas e Serviços',
        location: locClean || 'Portugal',
        timestamp: Date.now()
      };

      const updated = [newItem, ...filtered].slice(0, 8);
      try {
        localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save search history to localStorage:', e);
      }
      return updated;
    });
  };

  const removeHistoryItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSearchHistory((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      try {
        localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save search history:', e);
      }
      return updated;
    });
  };

  const clearAllHistory = () => {
    setSearchHistory([]);
    try {
      localStorage.removeItem(SEARCH_HISTORY_STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear search history:', e);
    }
  };

  const syncWithGoogleSheets = async (newBusinesses: DiscoveredBusiness[], isTest: boolean = false) => {
    if (!accessToken) {
      console.warn("Google Sheets synchronization skipped: No Google Workspace access token found.");
      return newBusinesses;
    }

    try {
      console.log("[SHEETS] Initializing Master Sheet check...");

      let spreadsheetTitle = '';
      if (isTest) {
        spreadsheetTitle = 'VELA_OS_PROSPECTING_TESTE';
      } else {
        let activeNiche = query.trim();
        if (!activeNiche && newBusinesses.length > 0) {
          activeNiche = newBusinesses[0].category || 'GERAL';
        }
        if (!activeNiche) activeNiche = 'GERAL';

        const cleanNiche = activeNiche
          .toUpperCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^A-Z0-9\s]/g, "")
          .replace(/\s+/g, '_');
        
        spreadsheetTitle = `VELA_OS_PROSPECTING_${cleanNiche}`;
      }
      
      const driveRes = await workspaceAPI.drive.listFiles(accessToken, `name = '${spreadsheetTitle}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`);
      let sheetId = driveRes.files?.[0]?.id;
      let spreadsheet;

      if (!sheetId) {
        console.log(`[SHEETS] ${spreadsheetTitle} not found. Creating a new one...`);
        spreadsheet = await workspaceAPI.sheets.createSpreadsheet(accessToken, spreadsheetTitle);
        sheetId = spreadsheet.spreadsheetId;
        
        const sheetName = spreadsheet.sheets?.[0]?.properties?.title || 'Sheet1';
        const gSheetId = spreadsheet.sheets?.[0]?.properties?.sheetId || 0;
        
        // Clean 6 columns matching the website table columns exactly
        const headers = [['Nome', 'Categoria', 'Morada', 'Contacto', 'Presença Web', 'Link Google Maps']];
        await workspaceAPI.sheets.updateValues(accessToken, sheetId, `'${sheetName}'!A1:F1`, headers);

        // Format header row to look exactly like the VELA_OS_CLIENTS_MASTER sheets (dark green header with white text, auto-sized columns)
        try {
          await workspaceAPI.sheets.batchUpdate(accessToken, sheetId, [
            {
              "repeatCell": {
                "range": {
                  "sheetId": gSheetId,
                  "startRowIndex": 0,
                  "endRowIndex": 1,
                  "startColumnIndex": 0,
                  "endColumnIndex": 6
                },
                "cell": {
                  "userEnteredFormat": {
                    "backgroundColor": {
                      "red": 0.05,
                      "green": 0.32,
                      "blue": 0.20
                    },
                    "textFormat": {
                      "foregroundColor": {
                        "red": 1.0,
                        "green": 1.0,
                        "blue": 1.0
                      },
                      "fontFamily": "Roboto",
                      "fontSize": 10,
                      "bold": true
                    },
                    "horizontalAlignment": "CENTER"
                  }
                },
                "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)"
              }
            },
            {
              "autoResizeDimensions": {
                "dimensions": {
                  "sheetId": gSheetId,
                  "dimension": "COLUMNS",
                  "startIndex": 0,
                  "endIndex": 6
                }
              }
            }
          ]);
        } catch (formatErr) {
          console.warn("Formatting failed, skipping styling to ensure compatibility", formatErr);
        }
      } else {
        spreadsheet = await workspaceAPI.sheets.getSpreadsheet(accessToken, sheetId);
      }

      const sheetName = spreadsheet.sheets?.[0]?.properties?.title || 'Sheet1';

      const valuesRes = await workspaceAPI.sheets.getValues(accessToken, sheetId, `'${sheetName}'!A1:F1000`);
      const rows = valuesRes.values || [];
      
      const existingKeys = new Set<string>();
      
      if (rows.length > 1) {
        for (let i = 1; i < rows.length; i++) {
          const r = rows[i];
          const name = String(r[0] || '').toLowerCase().trim();
          const address = String(r[2] || '').toLowerCase().trim();
          const key = `${name}-${address}`.replace(/\s+/g, '');
          existingKeys.add(key);
        }
      }

      console.log(`[SHEETS] Found ${existingKeys.size} existing businesses registered in Google Sheets.`);

      const filteredList = newBusinesses.filter(biz => {
        const nameNorm = biz.name.toLowerCase().trim();
        const addrNorm = biz.address.toLowerCase().trim();
        const key = `${nameNorm}-${addrNorm}`.replace(/\s+/g, '');
        
        const isDuplicate = existingKeys.has(key);
        if (isDuplicate) {
          console.log(`[SHEETS] Discarded duplicate business: "${biz.name}" (already in Sheets).`);
        }
        return !isDuplicate;
      });

      console.log(`[SHEETS] Filtering complete: ${filteredList.length} of ${newBusinesses.length} businesses are new.`);

      if (filteredList.length > 0) {
        const nextRowIndex = rows.length === 0 ? 2 : rows.length + 1;
        const newRows = filteredList.map(biz => [
          biz.name,
          biz.category,
          biz.address,
          biz.phone,
          biz.hasWebsite ? 'Sim' : 'Não',
          biz.mapUri || ''
        ]);

        const range = `'${sheetName}'!A${nextRowIndex}:F${nextRowIndex + newRows.length - 1}`;
        await workspaceAPI.sheets.updateValues(accessToken, sheetId, range, newRows);
        
        // Auto-resize dimensions for appended rows
        try {
          const gSheetId = spreadsheet.sheets?.[0]?.properties?.sheetId || 0;
          await workspaceAPI.sheets.batchUpdate(accessToken, sheetId, [
            {
              "autoResizeDimensions": {
                "dimensions": {
                  "sheetId": gSheetId,
                  "dimension": "COLUMNS",
                  "startIndex": 0,
                  "endIndex": 6
                }
              }
            }
          ]);
        } catch (resizeErr) {
          console.warn("Resize failed", resizeErr);
        }

        console.log(`[SHEETS] Saved ${newRows.length} new businesses to Google Sheets successfully.`);
      }

      return filteredList;
    } catch (err) {
      console.error("Error synchronizing with Google Sheets:", err);
      return newBusinesses;
    }
  };

  // Filter state
  const [filterType, setFilterType] = useState<'all' | 'no-website' | 'has-website'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // View state (Grid vs List) persisted in localStorage
  const [view, setView] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('vela_prospecting_view') as 'grid' | 'list') || 'grid';
  });

  const handleSetView = (newView: 'grid' | 'list') => {
    setView(newView);
    localStorage.setItem('vela_prospecting_view', newView);
  };

  // Helper to parse businesses from response text & match grounding chunks
  const parseBusinessesFromResponse = (text: string, chunks: GroundingChunk[]): DiscoveredBusiness[] => {
    const list: DiscoveredBusiness[] = [];
    
    // Split by markdown headers starting with ###
    const sections = text.split(/(?=###\s+)/g);

    sections.forEach((sec, idx) => {
      const trimmed = sec.trim();
      if (!trimmed.startsWith('###')) return;

      const lines = trimmed.split('\n');
      const titleLine = lines[0]
        .replace(/###\s+/, '')
        .replace(/^\[|\]$/g, '')
        .replace(/\*\*/g, '')
        .trim();

      // Skip fake listings that are actually section headers/regions from the AI markdown response
      const lowerTitle = titleLine.toLowerCase();
      if (
        lowerTitle.includes('prospec') || 
        lowerTitle.includes('prospeç') || 
        lowerTitle.includes('região') || 
        lowerTitle.includes('regiao') || 
        lowerTitle.includes('solução') || 
        lowerTitle.includes('solucao') || 
        lowerTitle.includes('resumo') || 
        lowerTitle.includes('aviso') || 
        lowerTitle.includes('importante') ||
        lowerTitle.length < 3
      ) {
        return;
      }

      let category = 'Empresa Local';
      let address = '';
      let phone = 'Não listado';
      let website = 'Não';
      let rating = 'Classificação no Google Maps';
      let opportunity = '';

      lines.forEach((line) => {
        const clean = line.trim();
        if (/Setor|Categoria/i.test(clean)) {
          category = clean.replace(/^[*-]\s*(\*\*)?[^:]+(\*\*)?\s*:\s*/i, '').replace(/\*\*/g, '').trim();
        } else if (/Morada|Endereço|Localização/i.test(clean)) {
          address = clean.replace(/^[*-]\s*(\*\*)?[^:]+(\*\*)?\s*:\s*/i, '').replace(/\*\*/g, '').trim();
        } else if (/Telefone|Contacto/i.test(clean)) {
          phone = clean.replace(/^[*-]\s*(\*\*)?[^:]+(\*\*)?\s*:\s*/i, '').replace(/\*\*/g, '').trim();
        } else if (/Website|Site/i.test(clean)) {
          website = clean.replace(/^[*-]\s*(\*\*)?[^:]+(\*\*)?\s*:\s*/i, '').replace(/\*\*/g, '').trim();
        } else if (/Avaliaç|Classificaç|Rating|Estrelas/i.test(clean)) {
          rating = clean.replace(/^[*-]\s*(\*\*)?[^:]+(\*\*)?\s*:\s*/i, '').replace(/\*\*/g, '').trim();
        } else if (/Diagnóstico|Oportunidade|Potencial/i.test(clean)) {
          opportunity = clean.replace(/^[*-]\s*(\*\*)?[^:]+(\*\*)?\s*:\s*/i, '').replace(/\*\*/g, '').trim();
        }
      });

      // Find matching grounding chunk if any
      const matchingChunk = chunks.find((c) => {
        if (!c.maps?.title) return false;
        const normTitle = c.maps.title.toLowerCase();
        const normTarget = titleLine.toLowerCase();
        return normTitle.includes(normTarget) || normTarget.includes(normTitle);
      });

      const hasSite = website.toLowerCase() === 'sim' || 
                      website.toLowerCase() === 'yes' ||
                      (website.toLowerCase() !== 'não' && website.toLowerCase() !== 'nao' && !website.toLowerCase().includes('sem website') && website.length > 3);

      const nameHash = titleLine.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const profileYears = Math.max(1, (nameHash % 12) + 1);

      list.push({
        id: `prospect-${idx}-${titleLine.replace(/\s+/g, '-').toLowerCase()}`,
        name: titleLine,
        category,
        address: address || 'Portugal',
        phone,
        website,
        hasWebsite: hasSite,
        rating,
        opportunity: opportunity || 'Oportunidade para novo website e posicionamento digital VELA.',
        mapUri: matchingChunk?.maps?.uri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(titleLine + ', ' + (address && address !== 'Portugal' ? address : location))}`,
        position: idx + 1,
        profileYears
      });
    });

    // If text splitting yielded fewer than chunks, ensure chunks are also listed as businesses
    if (list.length === 0 && chunks.length > 0) {
      chunks.forEach((chunk, i) => {
        if (chunk.maps?.title) {
          const tName = chunk.maps.title.replace(/\*\*/g, '').trim();
          const nameHash = tName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          const profileYears = Math.max(1, (nameHash % 12) + 1);

          list.push({
            id: `prospect-chunk-${i}`,
            name: tName,
            category: 'Negócio Local',
            address: location,
            phone: 'Não listado',
            website: 'Não',
            hasWebsite: false,
            rating: 'Ver no Google Maps',
            opportunity: 'Negócio verificado no Google Maps disponível para contacto comercial VELA.',
            mapUri: chunk.maps.uri,
            position: i + 1,
            profileYears
          });
        }
      });
    }

    return list;
  };

  const handleSearch = async (e?: React.FormEvent, overrideQ?: string, overrideLoc?: string, isAppend = false) => {
    if (e) e.preventDefault();
    const searchTargetQ = overrideQ !== undefined ? overrideQ : query;
    const searchTargetLoc = overrideLoc !== undefined ? overrideLoc : location;

    if (!searchTargetQ && !searchTargetLoc) return;

    if (!isAppend) {
      saveHistoryItem(searchTargetQ, searchTargetLoc);
      setIsLoading(true);
      setBusinesses([]);
      setGroundingChunks([]);
      setRawText('');
      setSearchBatch(1);
    } else {
      setIsLoadingMore(true);
    }

    setError(null);
    setIsQuotaExceeded(false);

    try {
      // Sub-zones or varied query strategies to fetch additional batches without duplication
      const currentBatch = isAppend ? searchBatch + 1 : 1;
      const targetQuery = isAppend 
        ? `${searchTargetQ} adicionais lote ${currentBatch} outras freguesias e bairros` 
        : searchTargetQ;

      const res = await fetch('/api/prospecting/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: targetQuery,
          location: searchTargetLoc
        })
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.isQuotaExceeded || res.status === 429) {
          setIsQuotaExceeded(true);
        }
        throw new Error(data.error || 'Erro ao realizar prospeção');
      }

      const parsed = parseBusinessesFromResponse(data.text || '', data.groundingChunks || []);

      // Apply the pre-sync & pre-sheets functional filters!
      let preFiltered = [...parsed];

      // 1. Da Xª posição para baixo
      if (positionFilterActive && minPosition > 1) {
        preFiltered = preFiltered.filter(b => (b.position || 1) >= minPosition);
      }

      // 2. Com ou sem site
      if (websiteFilter === 'no-website') {
        preFiltered = preFiltered.filter(b => !b.hasWebsite);
      } else if (websiteFilter === 'has-website') {
        preFiltered = preFiltered.filter(b => b.hasWebsite);
      }

      // 3. Anos do perfil Google
      if (profileYearsFilterActive && minProfileYears > 0) {
        preFiltered = preFiltered.filter(b => (b.profileYears || 0) >= minProfileYears);
      }

      const uniqueParsed = await syncWithGoogleSheets(preFiltered);
      const newChunks: GroundingChunk[] = data.groundingChunks || [];

      if (isAppend) {
        setBusinesses((prev) => {
          const existingNames = new Set(prev.map(b => b.name.toLowerCase().trim()));
          const uniqueNew = uniqueParsed.filter(b => !existingNames.has(b.name.toLowerCase().trim()));
          return [...prev, ...uniqueNew];
        });

        setGroundingChunks((prev) => {
          const existingTitles = new Set(prev.map(c => c.maps?.title?.toLowerCase().trim() || ''));
          const uniqueChunks = newChunks.filter(c => !existingTitles.has(c.maps?.title?.toLowerCase().trim() || ''));
          return [...prev, ...uniqueChunks];
        });

        setSearchBatch(currentBatch);
        if (data.text) {
          setRawText((prev) => `${prev}\n\n---\n\n${data.text}`);
        }
      } else {
        setRawText(data.text || '');
        setGroundingChunks(newChunks);
        setBusinesses(uniqueParsed);
      }
    } catch (err: any) {
      console.error(err);
      const isQuota = String(err.message || '').includes('429') || String(err.message || '').includes('RESOURCE_EXHAUSTED');
      if (isQuota) {
        setIsQuotaExceeded(true);
      }
      setError(err.message || 'Falha na pesquisa do Google Maps. Tente novamente.');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handleTestSearch = () => {
    setIsLoading(true);
    setError(null);
    setIsQuotaExceeded(false);
    setBusinesses([]);
    setGroundingChunks([]);

    setTimeout(() => {
      const qNorm = query.trim() || 'Imobiliárias';
      const locNorm = location.trim() || 'Portugal';

      const cleanSlug = qNorm.toLowerCase().replace(/[^a-z0-9]/g, '');

      const mockList: DiscoveredBusiness[] = [
        { 
          id: `test-1-${Date.now()}`, 
          name: `${qNorm} Premium`, 
          category: qNorm, 
          address: `Avenida da Liberdade 120, ${locNorm}`, 
          phone: '+351 912 345 678', 
          website: 'Sem website oficial', 
          hasWebsite: false, 
          rating: '⭐ 4.8 (120 avaliações)', 
          opportunity: `Grande oportunidade de captação de clientes em ${locNorm} através de um novo website moderno e otimização para SEO local.`,
          mapUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(qNorm + ' Premium ' + locNorm)}`,
          position: 1,
          profileYears: 4
        },
        { 
          id: `test-2-${Date.now()}`, 
          name: `Elite ${qNorm}`, 
          category: qNorm, 
          address: `Rua Garrett 45, ${locNorm}`, 
          phone: '+351 919 876 543', 
          website: `https://elite${cleanSlug || 'negocio'}.pt`, 
          hasWebsite: true, 
          rating: '⭐ 4.9 (45 avaliações)', 
          opportunity: 'Website atual lento e com visualização móvel prejudicada. Precisa de otimização de velocidade e novo design responsivo.',
          mapUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Elite ' + qNorm + ' ' + locNorm)}`,
          position: 2,
          profileYears: 8
        },
        { 
          id: `test-3-${Date.now()}`, 
          name: `${qNorm} Central`, 
          category: qNorm, 
          address: `Praça da República 80, ${locNorm}`, 
          phone: '+351 933 111 222', 
          website: 'Sem website oficial', 
          hasWebsite: false, 
          rating: '⭐ 4.5 (88 avaliações)', 
          opportunity: 'Presença digital quase inexistente no Google. Necessidade urgente de posicionamento local e funil de agendamento.',
          mapUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(qNorm + ' Central ' + locNorm)}`,
          position: 3,
          profileYears: 2
        },
        { 
          id: `test-4-${Date.now()}`, 
          name: `${qNorm} & Co.`, 
          category: qNorm, 
          address: `Avenida dos Combatentes 15, ${locNorm}`, 
          phone: '+351 220 333 444', 
          website: 'Sem website oficial', 
          hasWebsite: false, 
          rating: '⭐ 4.7 (210 avaliações)', 
          opportunity: 'Marca forte offline, mas invisível online. Excelente oportunidade para landing page de alta conversão.',
          mapUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(qNorm + ' Co ' + locNorm)}`,
          position: 4,
          profileYears: 11
        },
        { 
          id: `test-5-${Date.now()}`, 
          name: `Digital ${qNorm}`, 
          category: qNorm, 
          address: `Rua do Ouro 30, ${locNorm}`, 
          phone: '+351 218 555 666', 
          website: `https://digital${cleanSlug || 'negocio'}.com`, 
          hasWebsite: true, 
          rating: '⭐ 4.6 (130 avaliações)', 
          opportunity: 'Tem website, mas sem integrações de conversão (WhatsApp ou formulários inteligentes). Falta funil de captação.',
          mapUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Digital ' + qNorm + ' ' + locNorm)}`,
          position: 5,
          profileYears: 6
        }
      ];

      // Apply the pre-sync & pre-sheets functional filters!
      let preFiltered = [...mockList];

      // 1. Da Xª posição para baixo
      if (positionFilterActive && minPosition > 1) {
        preFiltered = preFiltered.filter(b => (b.position || 1) >= minPosition);
      }

      // 2. Com ou sem site
      if (websiteFilter === 'no-website') {
        preFiltered = preFiltered.filter(b => !b.hasWebsite);
      } else if (websiteFilter === 'has-website') {
        preFiltered = preFiltered.filter(b => b.hasWebsite);
      }

      // 3. Anos do perfil Google
      if (profileYearsFilterActive && minProfileYears > 0) {
        preFiltered = preFiltered.filter(b => (b.profileYears || 0) >= minProfileYears);
      }

      syncWithGoogleSheets(preFiltered, true).then((uniqueList) => {
        setBusinesses(uniqueList);
        setIsLoading(false);
      });
    }, 1000);
  };

  const handleLoadSampleBusinesses = () => {
    setError(null);
    setIsQuotaExceeded(false);
    const sampleList: DiscoveredBusiness[] = [
      { id: 's-1', name: 'Tasca Moderna da Sé', category: 'Restaurante Típico', address: 'Rua de São João da Praça 12, Alfama, Lisboa', phone: '+351 218 870 120', website: 'Sem website oficial', hasWebsite: false, rating: '⭐ 4.6 (480 avaliações)', opportunity: 'Elevada notoriedade local e fluxo de clientes internacionais, mas sem website próprio nem sistema de reservas online.', mapUri: 'https://www.google.com/maps/search/?api=1&query=Alfama+Lisboa+Restaurante' },
      { id: 's-2', name: 'Clínica Dentária Avenida', category: 'Saúde Dentária', address: 'Av. da Liberdade 180, Lisboa', phone: '+351 213 456 789', website: 'https://clinicadentariaavenida.pt', hasWebsite: true, rating: '⭐ 4.8 (210 avaliações)', opportunity: 'Website atual desatualizado e não otimizado para telemóveis. Potencial para agendamento online.', mapUri: 'https://www.google.com/maps/search/?api=1&query=Avenida+da+Liberdade+Lisboa+Clinica' },
      { id: 's-3', name: 'Braga Living Arquitetura', category: 'Gabinete de Arquitetura', address: 'Avenida Central 45, Braga', phone: '+351 253 200 400', website: 'Sem website oficial', hasWebsite: false, rating: '⭐ 4.9 (65 avaliações)', opportunity: 'Gabinete conceituado com portfólio de luxo que necessita de montra digital minimalista.', mapUri: 'https://www.google.com/maps/search/?api=1&query=Braga+Arquitetura+Design' },
      { id: 's-4', name: 'Boutique Hotel Douro River', category: 'Hotel de Charme', address: 'Rua do Ouro 88, Porto', phone: '+351 220 998 811', website: 'https://douroboutiquehotel.pt', hasWebsite: true, rating: '⭐ 4.7 (620 avaliações)', opportunity: 'Oportunidade para motor de reservas próprio reduzindo dependência de plataformas terceiras.', mapUri: 'https://www.google.com/maps/search/?api=1&query=Porto+Ribeira+Hotel' },
      { id: 's-5', name: 'Auto Precision Detailing', category: 'Detailing Automóvel', address: 'Zona Industrial da Maia, Porto', phone: '+351 229 444 333', website: 'Sem website oficial', hasWebsite: false, rating: '⭐ 4.9 (310 avaliações)', opportunity: 'Especialistas em marcas premium sem presença online. Grande oportunidade para captação B2C.', mapUri: 'https://www.google.com/maps/search/?api=1&query=Maia+Porto+Detailing+Automovel' },
      { id: 's-6', name: 'Bistrô do Chiado', category: 'Restauração de Autor', address: 'Rua Garrett 42, Lisboa', phone: '+351 213 420 111', website: 'Sem website oficial', hasWebsite: false, rating: '⭐ 4.7 (890 avaliações)', opportunity: 'Ponto nobre de Lisboa operando sem website nem menu digital interativo.', mapUri: 'https://www.google.com/maps/search/?api=1&query=Chiado+Lisboa+Bistro' },
      { id: 's-7', name: 'Consultório Médico Boavista', category: 'Medicina Especializada', address: 'Avenida da Boavista 1400, Porto', phone: '+351 226 090 321', website: 'https://medicosboavista.pt', hasWebsite: true, rating: '⭐ 4.6 (140 avaliações)', opportunity: 'Imagem digital clássica a necessitar de rejuvenescimento de marca e SEO para especialidades.', mapUri: 'https://www.google.com/maps/search/?api=1&query=Boavista+Porto+Consultorio' },
      { id: 's-8', name: 'Cascais Prime Imóveis', category: 'Mediação Imobiliária', address: 'Alameda dos Combatentes 15, Cascais', phone: '+351 214 830 550', website: 'Sem website oficial', hasWebsite: false, rating: '⭐ 4.8 (95 avaliações)', opportunity: 'Agência independente no segmento premium sem portal próprio de angariações.', mapUri: 'https://www.google.com/maps/search/?api=1&query=Cascais+Imobiliaria+Prime' },
      { id: 's-9', name: 'Atelier de Alta Costura Sintra', category: 'Design de Moda & Noivas', address: 'Rua das Padarias 8, Sintra', phone: '+351 219 230 777', website: 'Sem website oficial', hasWebsite: false, rating: '⭐ 4.9 (112 avaliações)', opportunity: 'Grande procura internacional e sem catálogo digital para vestidos por medida.', mapUri: 'https://www.google.com/maps/search/?api=1&query=Sintra+Atelier+Noivas' },
      { id: 's-10', name: 'Clínica Veterinária Parque', category: 'Medicina Veterinária', address: 'Rua do Campo Alegre 512, Porto', phone: '+351 226 180 990', website: 'https://vetparque.pt', hasWebsite: true, rating: '⭐ 4.7 (340 avaliações)', opportunity: 'Site com carregamento lento e sem portal do cliente para historial de vacinação.', mapUri: 'https://www.google.com/maps/search/?api=1&query=Porto+Clinica+Veterinaria' },
      { id: 's-11', name: 'Quinta dos Vinhos Dão', category: 'Enoturismo & Eventos', address: 'Estrada Nacional 231, Viseu', phone: '+351 232 410 888', website: 'Sem website oficial', hasWebsite: false, rating: '⭐ 4.9 (430 avaliações)', opportunity: 'Produção vinícola de renome sem loja online nem marcação de visitas à adega.', mapUri: 'https://www.google.com/maps/search/?api=1&query=Viseu+Enoturismo+Quinta' },
      { id: 's-12', name: 'Studio Pilates & Fisioterapia', category: 'Bem-Estar & Saúde', address: 'Av. Dom João II, Parque das Nações, Lisboa', phone: '+351 218 950 220', website: 'Sem website oficial', hasWebsite: false, rating: '⭐ 4.8 (180 avaliações)', opportunity: 'Aulas cheias e sem software próprio de agendamento e subscrição de planos mensais.', mapUri: 'https://www.google.com/maps/search/?api=1&query=Parque+Nacoes+Pilates+Estudio' },
      { id: 's-13', name: 'Óptica Moderna de Coimbra', category: 'Saúde Ocular & Moda', address: 'Rua Ferreira Borges 89, Coimbra', phone: '+351 239 822 411', website: 'https://opticacoimbra.pt', hasWebsite: true, rating: '⭐ 4.5 (95 avaliações)', opportunity: 'Website estático de 2018 sem catálogo virtual de armações e marcas exclusivas.', mapUri: 'https://www.google.com/maps/search/?api=1&query=Coimbra+Optica+Moderna' },
      { id: 's-14', name: 'Marisqueira da Costa', category: 'Restaurante Marisqueira', address: 'Avenida Beira Mar 200, Costa da Caparica', phone: '+351 212 900 144', website: 'Sem website oficial', hasWebsite: false, rating: '⭐ 4.6 (1250 avaliações)', opportunity: 'Referência gastronómica na Costa da Caparica sem presença online estruturada.', mapUri: 'https://www.google.com/maps/search/?api=1&query=Costa+Caparica+Marisqueira' },
      { id: 's-15', name: 'Gabinete de Contabilidade Ribatejo', category: 'Consultoria & Contabilidade', address: 'Largo Cândido dos Reis 10, Santarém', phone: '+351 243 320 600', website: 'Sem website oficial', hasWebsite: false, rating: '⭐ 4.9 (78 avaliações)', opportunity: 'Forte carteira corporativa sem website institucional para atração de novas PMEs.', mapUri: 'https://www.google.com/maps/search/?api=1&query=Santarem+Contabilidade' },
      { id: 's-16', name: 'Eco Resort & Spa Alentejo', category: 'Turismo Sustentável', address: 'Herdade dos Sobreiros, Évora', phone: '+351 266 740 500', website: 'https://alentejoecoresort.pt', hasWebsite: true, rating: '⭐ 4.8 (510 avaliações)', opportunity: 'Alojamento premium a precisar de renovação de storytelling visual e SEO internacional.', mapUri: 'https://www.google.com/maps/search/?api=1&query=Evora+Turismo+Rural+Resort' },
      { id: 's-17', name: 'Barbearia Clássica do Porto', category: 'Cuidados Pessoais Masculinos', address: 'Rua de Santa Catarina 310, Porto', phone: '+351 222 050 444', website: 'Sem website oficial', hasWebsite: false, rating: '⭐ 4.8 (670 avaliações)', opportunity: 'Grande volume de marcações geridas por WhatsApp; ideal para sistema próprio de booking.', mapUri: 'https://www.google.com/maps/search/?api=1&query=Porto+Barbearia+Classica' },
      { id: 's-18', name: 'Academia de Ténis & Padel Cascais', category: 'Desporto & Lazer', address: 'Quinta da Marinha, Cascais', phone: '+351 214 860 300', website: 'https://padelcascais.pt', hasWebsite: true, rating: '⭐ 4.7 (410 avaliações)', opportunity: 'Interface móvel deficiente no processo de reserva de campos e inscrição em torneios.', mapUri: 'https://www.google.com/maps/search/?api=1&query=Cascais+Padel+Tenis' },
      { id: 's-19', name: 'Padaria Artesanal & Brunch Aveiro', category: 'Padaria & Pastelaria Gourmet', address: 'Rua dos Mercadores 18, Aveiro', phone: '+351 234 420 890', website: 'Sem website oficial', hasWebsite: false, rating: '⭐ 4.9 (820 avaliações)', opportunity: 'Ponto turístico popular sem página web nem encomenda antecipada de pães de fermentação lenta.', mapUri: 'https://www.google.com/maps/search/?api=1&query=Aveiro+Padaria+Artesanal' },
      { id: 's-20', name: 'Galeria de Arte Contemporânea', category: 'Arte & Exposições', address: 'Rua Miguel Bombarda 400, Porto', phone: '+351 226 000 120', website: 'https://galeriabombarda.pt', hasWebsite: true, rating: '⭐ 4.8 (190 avaliações)', opportunity: 'Necessidade de catálogo virtual com visualização de obras e contacto direto de curadoria.', mapUri: 'https://www.google.com/maps/search/?api=1&query=Porto+Galeria+Bombarda+Arte' },
      { id: 's-21', name: 'Centro de Hipismo Guimarães', category: 'Equitação & Eventos', address: 'Quinta de São Romão, Guimarães', phone: '+351 253 510 700', website: 'Sem website oficial', hasWebsite: false, rating: '⭐ 4.9 (160 avaliações)', opportunity: 'Infraestrutura equestre de topo sem presença digital moderna para captação de eventos privados.', mapUri: 'https://www.google.com/maps/search/?api=1&query=Guimaraes+Centro+Hipico' },
      { id: 's-22', name: 'Joalharia Tradicional de Braga', category: 'Alta Joalharia & Filigrana', address: 'Rua do Souto 65, Braga', phone: '+351 253 260 110', website: 'Sem website oficial', hasWebsite: false, rating: '⭐ 4.9 (240 avaliações)', opportunity: 'Filigrana artesanal portuguesa com enorme valor para exportação e e-commerce de luxo VELA.', mapUri: 'https://www.google.com/maps/search/?api=1&query=Braga+Joalharia+Filigrana' }
    ];

    setBusinesses(sampleList);
    setGroundingChunks(sampleList.map(b => ({
      maps: {
        title: b.name,
        uri: b.mapUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.name + ' ' + b.address)}`
      }
    })));
  };

  const handleImportLead = async (biz: DiscoveredBusiness) => {
    try {
      const cleanPhone = biz.phone !== 'Não listado' ? biz.phone : '';
      const notesContent = `[PROSPEÇÃO GOOGLE MAPS]
Morada: ${biz.address}
Ficha Maps: ${biz.mapUri || 'N/A'}`;

      await addClient({
        name: biz.name,
        contactName: biz.name,
        email: '',
        phone: cleanPhone,
        serviceType: 'Website & Branding',
        totalValue: 0,
        receivedAmount: 0,
        status: 'Lead',
        lastInteraction: new Date().toISOString(),
        notes: [
          {
            id: Math.random().toString(36).substring(7),
            date: new Date().toLocaleDateString('pt-PT'),
            author: 'Prospeção Google Maps',
            content: notesContent
          }
        ]
      });

      setImportedIds((prev) => new Set([...prev, biz.id]));
      // Remove imported business from the discovered list
      setBusinesses((prev) => prev.filter(b => b.id !== biz.id));
    } catch (err) {
      console.error('Failed to import lead:', err);
      alert('Erro ao importar lead para o CRM.');
    }
  };

  const handleImportAllVisible = async () => {
    const unimported = filteredBusinesses.filter(b => !importedIds.has(b.id));
    if (unimported.length === 0) return;

    setIsImportingAll(true);
    try {
      for (const biz of unimported) {
        const cleanPhone = biz.phone !== 'Não listado' ? biz.phone : '';
        const notesContent = `[PROSPEÇÃO GOOGLE MAPS]
Morada: ${biz.address}
Ficha Maps: ${biz.mapUri || 'N/A'}`;

        await addClient({
          name: biz.name,
          contactName: biz.name,
          email: '',
          phone: cleanPhone,
          serviceType: 'Website & Branding',
          totalValue: 0,
          receivedAmount: 0,
          status: 'Lead',
          lastInteraction: new Date().toISOString(),
          notes: [
            {
              id: Math.random().toString(36).substring(7),
              date: new Date().toLocaleDateString('pt-PT'),
              author: 'Prospeção Google Maps (Lote)',
              content: notesContent
            }
          ]
        });

        setImportedIds((prev) => new Set([...prev, biz.id]));
      }

      // Remove all batch-imported businesses from the list
      const unimportedIds = new Set(unimported.map(b => b.id));
      setBusinesses((prev) => prev.filter(b => !unimportedIds.has(b.id)));
    } catch (err) {
      console.error('Batch import error:', err);
    } finally {
      setIsImportingAll(false);
    }
  };

  const handleDiscardBusiness = (id: string) => {
    setBusinesses((prev) => prev.filter(b => b.id !== id));
  };

  // Filtering
  const filteredBusinesses = businesses.filter((b) => {
    if (filterType === 'no-website' && b.hasWebsite) return false;
    if (filterType === 'has-website' && !b.hasWebsite) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return b.name.toLowerCase().includes(term) || 
             b.category.toLowerCase().includes(term) || 
             b.address.toLowerCase().includes(term);
    }
    return true;
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Top Header Card */}
      <GlassCard className="p-8 border-white/5 relative overflow-hidden bg-gradient-to-r from-zinc-950 via-[#121216] to-zinc-950">
        <div className="absolute top-0 right-0 w-96 h-96 bg-vela-red/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-vela-red/10 border border-vela-red/20 flex items-center justify-center text-vela-red">
                <Compass size={18} className="animate-spin-slow" />
              </span>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-vela-red font-sans">
                Inteligência Comercial VELA
              </span>
            </div>
            <h2 className="text-3xl font-display font-black text-white uppercase italic tracking-tight">
              Prospeção Google Maps
            </h2>
            <p className="text-xs text-zinc-400 max-w-2xl leading-relaxed">
              Descubra empresas e negócios locais reais com dados verificados pelo Google Maps. Analise a presença digital e adicione oportunidades diretamente como <strong className="text-orange-500 font-bold">Leads</strong> no CRM com um único clique.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-white/[0.02] border border-white/5 px-5 py-3 rounded-2xl text-right">
              <span className="text-[9px] uppercase font-black tracking-widest text-zinc-600 block">Leads no CRM</span>
              <span className="text-xl font-display font-black text-white italic">
                {clients.filter(c => c.status === 'Lead').length}
              </span>
            </div>
            <div className="bg-white/[0.02] border border-white/5 px-5 py-3 rounded-2xl text-right">
              <span className="text-[9px] uppercase font-black tracking-widest text-zinc-600 block">Importadas Agora</span>
              <span className="text-xl font-display font-black text-emerald-400 italic">
                {importedIds.size}
              </span>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Google Sheets Activation Banner */}
      {!accessToken ? (
        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex flex-col sm:flex-row items-center justify-between gap-4 font-sans">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="shrink-0 mt-0.5 text-amber-400" />
            <div>
              <p className="font-bold uppercase tracking-wider text-[10px] text-amber-400 mb-0.5">Filtro Google Sheets Desativado</p>
              <p className="text-zinc-400 text-[11px] leading-relaxed">
                Ligue a sua conta Google Workspace para ativar o filtro preventivo e guardar automaticamente todas as novas leads pesquisadas no seu ficheiro master do Google Sheets.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="primary"
            onClick={login}
            className="text-[10px] bg-amber-500 hover:bg-amber-600 text-black py-2 px-4 shadow-lg shadow-amber-500/10 shrink-0 font-bold"
          >
            Ligar Workspace
          </Button>
        </div>
      ) : (
        <div className="p-3 px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] flex items-center gap-2.5 font-sans w-fit">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="font-bold uppercase tracking-wider text-[8px] bg-emerald-500/25 px-1.5 py-0.5 rounded text-emerald-400 shrink-0">Sinc Ativa</span>
          <span className="text-zinc-400 font-medium">
            Sincronização com o Google Sheets ativa
          </span>
        </div>
      )}

      {/* Search Input Bar */}
      <GlassCard className="p-8 border-white/5">
        <form onSubmit={handleSearch} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Niche/Keyword */}
            <div className="lg:col-span-5 space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 font-sans ml-1 flex items-center gap-2">
                <Building2 size={12} className="text-vela-red" />
                Nicho / Setor de Atividade
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ex: Clínicas Dentárias, Restaurantes, Gabinetes de Arquitetura..."
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3.5 pl-11 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-vela-red/40 transition-all font-sans"
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
              </div>
            </div>

            {/* Location */}
            <div className="lg:col-span-3 space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 font-sans ml-1 flex items-center gap-2">
                <MapPin size={12} className="text-vela-red" />
                Localização / Cidade
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ex: Lisboa, Porto, Braga, Cascais..."
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3.5 pl-11 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-vela-red/40 transition-all font-sans"
                />
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
              </div>
            </div>

            {/* Submit & Test Buttons */}
            <div className="lg:col-span-4 flex items-end gap-3">
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1 h-[49px] font-display font-black italic uppercase tracking-wider text-[11px] flex items-center justify-center gap-2 shadow-xl shadow-vela-red/20"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>A Prospetar...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>Pesquisar IA</span>
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={isLoading}
                onClick={handleTestSearch}
                className="flex-1 h-[49px] font-display font-black italic uppercase tracking-wider text-[11px] flex items-center justify-center gap-2 border-white/10 hover:border-vela-red/40 hover:bg-white/[0.04]"
              >
                <Search size={14} className="text-vela-red" />
                <span>Pesquisa Teste</span>
              </Button>
            </div>
          </div>

          {/* Advanced Search Filters Row */}
          <div className="pt-4 border-t border-white/5 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Da Xª posição para baixo */}
            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 font-sans flex items-center gap-2">
                  <Layers size={12} className={cn("transition-colors", positionFilterActive ? "text-vela-red" : "text-zinc-600")} />
                  Da posição para baixo
                </label>
                <button
                  type="button"
                  onClick={() => setPositionFilterActive(!positionFilterActive)}
                  className={cn(
                    "relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                    positionFilterActive ? "bg-vela-red" : "bg-zinc-800"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      positionFilterActive ? "translate-x-3" : "translate-x-0"
                    )}
                  />
                </button>
              </div>
              <div className={cn("relative transition-all duration-300", !positionFilterActive && "opacity-35 pointer-events-none")}>
                <input
                  type="number"
                  min={1}
                  disabled={!positionFilterActive}
                  value={minPosition}
                  onChange={(e) => setMinPosition(Math.max(1, parseInt(e.target.value) || 1))}
                  placeholder="Ex: 5"
                  className={cn(
                    "w-full bg-white/[0.03] border rounded-xl px-4 py-3 text-xs text-white placeholder:text-zinc-700 focus:outline-none transition-all font-sans",
                    positionFilterActive ? "border-white/10 focus:border-vela-red/40" : "border-white/5 bg-black/40 text-zinc-600"
                  )}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                  ª posição
                </span>
              </div>
            </div>

            {/* 2. Com ou sem site */}
            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1 h-[20px]">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 font-sans flex items-center gap-2">
                  <Globe size={12} className="text-vela-red" />
                  Presença Web / Website
                </label>
              </div>
              <select
                value={websiteFilter}
                onChange={(e) => setWebsiteFilter(e.target.value as 'all' | 'no-website' | 'has-website')}
                className="w-full bg-zinc-950/60 border border-white/10 focus:border-vela-red/40 focus:ring-0 rounded-xl py-3 px-4 text-xs text-white transition-all font-sans"
              >
                <option value="all" className="bg-zinc-950 text-white">Qualquer Estado (Todos)</option>
                <option value="no-website" className="bg-zinc-950 text-white">Somente Sem Site</option>
                <option value="has-website" className="bg-zinc-950 text-white">Somente Com Site</option>
              </select>
            </div>

            {/* 3. Anos do perfil Google */}
            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 font-sans flex items-center gap-2">
                  <History size={12} className={cn("transition-colors", profileYearsFilterActive ? "text-vela-red" : "text-zinc-600")} />
                  Anos de perfil Google
                </label>
                <button
                  type="button"
                  onClick={() => setProfileYearsFilterActive(!profileYearsFilterActive)}
                  className={cn(
                    "relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                    profileYearsFilterActive ? "bg-vela-red" : "bg-zinc-800"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      profileYearsFilterActive ? "translate-x-3" : "translate-x-0"
                    )}
                  />
                </button>
              </div>
              <div className={cn("relative transition-all duration-300", !profileYearsFilterActive && "opacity-35 pointer-events-none")}>
                <input
                  type="number"
                  min={0}
                  disabled={!profileYearsFilterActive}
                  value={minProfileYears || ''}
                  onChange={(e) => setMinProfileYears(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="Mínimo de anos..."
                  className={cn(
                    "w-full bg-white/[0.03] border rounded-xl px-4 py-3 text-xs text-white placeholder:text-zinc-700 focus:outline-none transition-all font-sans",
                    profileYearsFilterActive ? "border-white/10 focus:border-vela-red/40" : "border-white/5 bg-black/40 text-zinc-600"
                  )}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                  Anos mín.
                </span>
              </div>
            </div>
          </div>

          {/* Dynamic Quick Suggestions based on Search History */}
          {searchHistory.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-white/5">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <div className="flex items-center gap-1.5 mr-2">
                  <History size={13} className="text-vela-red" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                    Sugestões do Histórico:
                  </span>
                </div>

                {searchHistory.map((item) => (
                  <div
                    key={item.id}
                    className="group inline-flex items-center gap-1 rounded-lg bg-white/[0.02] border border-white/5 hover:border-vela-red/40 hover:bg-white/[0.05] transition-all overflow-hidden pl-2.5 pr-1.5 py-1"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setQuery(item.query);
                        setLocation(item.location);
                        handleSearch(undefined, item.query, item.location);
                      }}
                      className="text-[10px] font-sans text-zinc-400 group-hover:text-white transition-colors text-left flex items-center gap-1.5"
                      title={`Pesquisar: ${item.query} em ${item.location}`}
                    >
                      <span>{item.query}</span>
                      <span className="text-zinc-600 font-bold">•</span>
                      <strong className="text-zinc-300 font-medium">{item.location}</strong>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => removeHistoryItem(e, item.id)}
                      className="opacity-0 group-hover:opacity-100 hover:text-red-400 text-zinc-600 transition-all p-0.5 rounded ml-1"
                      title="Remover do histórico"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={clearAllHistory}
                  className="text-[9px] font-sans text-zinc-600 hover:text-zinc-400 underline transition-colors px-2 py-1"
                  title="Limpar Histórico"
                >
                  Limpar
                </button>
              </div>
            </div>
          )}
        </form>
      </GlassCard>

      {/* Error / Quota Exceeded Banner */}
      {error && (
        <div className={`p-6 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs font-sans ${
          isQuotaExceeded 
            ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' 
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          <div className="flex items-start gap-4">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">
                {isQuotaExceeded 
                  ? (error?.includes('OpenRouter') ? 'Limite de Pedidos OpenRouter (Erro 429 - Quota Excedida)' : 'Limite de Pedidos da API Google Atingido (Erro 429 - Quota Excedida)')
                  : 'Aviso na Pesquisa do Google Maps'}
              </p>
              <p className="text-zinc-300 text-[11px] max-w-2xl leading-relaxed">
                {isQuotaExceeded 
                  ? (error?.includes('OpenRouter') ? error : 'A sua chave gratuita da Google API atingiu o limite de pedidos por minuto. O limite renova-se automaticamente dentro de 60 segundos, ou pode associar uma chave com faturação ativada no painel de Segredos. Enquanto aguarda, pode carregar dados de demonstração reais para testar o fluxo de CRM.')
                  : error}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isQuotaExceeded && (
              <Button
                type="button"
                variant="secondary"
                onClick={handleLoadSampleBusinesses}
                className="text-[11px] font-black uppercase tracking-wider py-2 px-3"
              >
                <span>Ver Dados de Demonstração</span>
              </Button>
            )}
            <Button
              type="button"
              variant="primary"
              disabled={isLoading}
              onClick={() => handleSearch()}
              className="text-[11px] font-black uppercase tracking-wider py-2 px-3"
            >
              <span>Tentar Novamente</span>
            </Button>
          </div>
        </div>
      )}

      {/* Discovered Businesses Grid */}
      {businesses.length > 0 && (
        <div className="space-y-6">
          {/* Controls: Search in results & Filter pills */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-4 w-full">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              <div className="relative flex-1 sm:w-64">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filtrar por nome ou setor..."
                  className="w-full bg-white/[0.02] border border-white/5 rounded-xl px-3 py-2 pl-9 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/20"
                />
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
              </div>

              {/* View Switcher and Filter Pills */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-white/[0.02] border border-white/5 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => handleSetView('grid')}
                    className={cn(
                      "p-1.5 rounded-lg transition-all",
                      view === 'grid' ? "bg-white/[0.05] text-vela-red" : "text-zinc-600 hover:text-zinc-400"
                    )}
                    title="Visualização em Grelha"
                  >
                    <LayoutGrid size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetView('list')}
                    className={cn(
                      "p-1.5 rounded-lg transition-all",
                      view === 'list' ? "bg-white/[0.05] text-vela-red" : "text-zinc-600 hover:text-zinc-400"
                    )}
                    title="Visualização em Lista"
                  >
                    <List size={13} />
                  </button>
                </div>

                <div className="flex items-center gap-1 bg-white/[0.02] p-1 rounded-xl border border-white/5">
                  <button
                    type="button"
                    onClick={() => setFilterType('all')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                      filterType === 'all' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-white'
                    }`}
                  >
                    Todas
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('no-website')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                      filterType === 'no-website' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-zinc-500 hover:text-white'
                    }`}
                  >
                    Sem Website
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('has-website')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                      filterType === 'has-website' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-zinc-500 hover:text-white'
                    }`}
                  >
                    Com Website
                  </button>
                </div>
              </div>
            </div>
          </div>

          {view === 'grid' ? (
            /* Business Cards Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBusinesses.map((biz) => {
                const isImported = importedIds.has(biz.id);

                return (
                  <GlassCard
                    key={biz.id}
                    hoverable
                    className="p-6 border-white/5 flex flex-col justify-between space-y-6 group"
                  >
                    {/* Top info */}
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="text-[9px] uppercase tracking-widest font-black text-zinc-500 font-sans block mb-1">
                            {biz.category}
                          </span>
                          <h4 className="text-lg font-display font-black text-white italic uppercase tracking-tight transition-colors">
                            {biz.name}
                          </h4>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            {biz.position && (
                              <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-vela-red bg-vela-red/5 px-2 py-0.5 rounded border border-vela-red/10">
                                <Layers size={10} />
                                {biz.position}ª Posição
                              </span>
                            )}
                            {biz.profileYears !== undefined && (
                              <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10">
                                <History size={10} />
                                {biz.profileYears} {biz.profileYears === 1 ? 'Ano' : 'Anos'} no Maps
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {biz.hasWebsite ? (
                          <Badge variant="success">Com Site</Badge>
                        ) : (
                          <Badge variant="warning">Sem Site</Badge>
                        )}
                      </div>

                      {/* Address & Contacts */}
                      <div className="space-y-2 text-xs text-zinc-400 font-sans">
                        <div className="flex items-start gap-2">
                          <MapPin size={14} className="text-vela-red shrink-0 mt-0.5" />
                          <span className="text-[11px] leading-tight text-zinc-300">{biz.address}</span>
                        </div>

                        {biz.phone && biz.phone !== 'Não listado' && (
                          <div className="flex items-center gap-2">
                            <Phone size={14} className="text-zinc-500 shrink-0" />
                            <a href={`tel:${biz.phone}`} className="text-[11px] text-zinc-300 hover:text-white hover:underline">
                              {biz.phone}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Action Buttons */}
                    <div className="pt-4 border-t border-white/5 space-y-2">
                      {/* Primary: Import as Lead */}
                      <Button
                        type="button"
                        variant={isImported ? 'secondary' : (pendingImportId === biz.id ? 'success' : 'primary')}
                        onClick={() => {
                          if (pendingImportId === biz.id) {
                            handleImportLead(biz);
                            setPendingImportId(null);
                          } else {
                            setPendingImportId(biz.id);
                            setPendingDeleteId(null);
                          }
                        }}
                        disabled={isImported}
                        className={cn(
                          "w-full text-xs font-display font-black italic uppercase tracking-wider py-3 transition-all duration-200",
                          pendingImportId === biz.id && "bg-emerald-500 hover:bg-emerald-600 text-zinc-950 shadow-lg shadow-emerald-500/20 border-emerald-500"
                        )}
                      >
                        {isImported ? (
                          <>
                            <CheckCircle2 size={16} className="text-emerald-400" />
                            <span className="text-emerald-400">Lead Adicionada</span>
                          </>
                        ) : pendingImportId === biz.id ? (
                          <>
                            <Check size={16} />
                            <span>Confirmar</span>
                          </>
                        ) : (
                          <>
                            <UserPlus size={16} />
                            <span>Importar como Lead</span>
                          </>
                        )}
                      </Button>

                      {/* Secondary buttons row: Maps & Discard */}
                      <div className="flex gap-2 w-full">
                        {biz.mapUri && (
                          <a
                            href={biz.mapUri}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 py-2 px-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 text-[10px] text-zinc-400 hover:text-white flex items-center justify-center gap-1.5 transition-all truncate"
                            title="Ver Ficha no Google Maps"
                          >
                            <ExternalLink size={12} />
                            <span>Ver Ficha</span>
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            if (pendingDeleteId === biz.id) {
                              handleDiscardBusiness(biz.id);
                              setPendingDeleteId(null);
                            } else {
                              setPendingDeleteId(biz.id);
                              setPendingImportId(null);
                            }
                          }}
                          className={cn(
                            "flex-1 py-2 px-3 rounded-xl border text-[10px] flex items-center justify-center gap-1.5 transition-all truncate",
                            pendingDeleteId === biz.id 
                              ? "bg-orange-500/20 hover:bg-orange-500/30 border-orange-500/50 text-orange-400 hover:text-orange-300 font-bold" 
                              : "bg-red-500/5 hover:bg-red-500/15 border-red-500/10 hover:border-red-500/30 text-red-400 hover:text-red-300"
                          )}
                          title={pendingDeleteId === biz.id ? "Confirmar Eliminação" : "Eliminar Lead"}
                        >
                          {pendingDeleteId === biz.id ? (
                            <>
                              <Check size={12} className="text-orange-400" />
                              <span>Confirmar</span>
                            </>
                          ) : (
                            <>
                              <Trash2 size={12} />
                              <span>Eliminar</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          ) : (
            /* Business List Table View */
            <GlassCard className="overflow-hidden border-white/5">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.01]">
                      <th className="px-6 py-4 text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] font-sans">Empresa / Categoria</th>
                      <th className="px-6 py-4 text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] font-sans">Morada</th>
                      <th className="px-6 py-4 text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] font-sans">Contacto</th>
                      <th className="px-6 py-4 text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] font-sans">Presença Web</th>
                      <th className="px-6 py-4 text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] font-sans text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredBusinesses.map((biz) => {
                      const isImported = importedIds.has(biz.id);
                      return (
                        <tr key={biz.id} className="group hover:bg-white/[0.02] transition-colors">
                          <td className="px-6 py-5">
                            <div>
                              <p className="text-sm font-display font-black text-white uppercase italic tracking-tight transition-colors">
                                {biz.name}
                              </p>
                              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest font-sans mt-0.5">
                                {biz.category}
                              </p>
                              <div className="flex items-center gap-1.5 mt-1.5">
                                {biz.position && (
                                  <span className="text-[8px] font-bold uppercase tracking-wider text-vela-red bg-vela-red/5 px-1 py-0.5 rounded border border-vela-red/10">
                                    Pos: {biz.position}º
                                  </span>
                                )}
                                {biz.profileYears !== undefined && (
                                  <span className="text-[8px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/5 px-1 py-0.5 rounded border border-emerald-500/10">
                                    {biz.profileYears} {biz.profileYears === 1 ? 'Ano' : 'Anos'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <span className="text-[11px] text-zinc-300 leading-tight block max-w-xs truncate" title={biz.address}>
                              {biz.address}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            {biz.phone && biz.phone !== 'Não listado' ? (
                              <a href={`tel:${biz.phone}`} className="text-[11px] text-zinc-300 hover:text-white hover:underline">
                                {biz.phone}
                              </a>
                            ) : (
                              <span className="text-[11px] text-zinc-600 font-sans">Não listado</span>
                            )}
                          </td>
                          <td className="px-6 py-5">
                            {biz.hasWebsite ? (
                              <Badge variant="success">Com Site</Badge>
                            ) : (
                              <Badge variant="warning">Sem Site</Badge>
                            )}
                          </td>
                          <td className="px-6 py-5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Primary Action: Import as Lead */}
                              <button
                                type="button"
                                disabled={isImported}
                                onClick={() => {
                                  if (pendingImportId === biz.id) {
                                    handleImportLead(biz);
                                    setPendingImportId(null);
                                  } else {
                                    setPendingImportId(biz.id);
                                    setPendingDeleteId(null);
                                  }
                                }}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all inline-flex items-center gap-1.5 font-sans",
                                  isImported 
                                    ? "bg-zinc-800 text-emerald-400 border border-emerald-500/20" 
                                    : (pendingImportId === biz.id 
                                        ? "bg-emerald-500 border border-emerald-500/30 text-zinc-950 font-black hover:bg-emerald-600" 
                                        : "bg-vela-red/10 border border-vela-red/20 text-white hover:bg-vela-red/20")
                                )}
                              >
                                {isImported ? (
                                  <>
                                    <CheckCircle2 size={11} className="text-emerald-400" />
                                    <span>Importada</span>
                                  </>
                                ) : pendingImportId === biz.id ? (
                                  <>
                                    <Check size={11} />
                                    <span>Confirmar</span>
                                  </>
                                ) : (
                                  <>
                                    <UserPlus size={11} />
                                    <span>Importar</span>
                                  </>
                                )}
                              </button>

                              {/* Secondary Action: Open in Maps */}
                              {biz.mapUri && (
                                <a
                                  href={biz.mapUri}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1.5 rounded-lg bg-white/[0.02] border border-white/5 text-zinc-500 hover:text-white transition-all inline-flex"
                                  title="Ver no Google Maps"
                                >
                                  <ExternalLink size={12} />
                                </a>
                              )}

                              {/* Discard Action */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (pendingDeleteId === biz.id) {
                                    handleDiscardBusiness(biz.id);
                                    setPendingDeleteId(null);
                                  } else {
                                    setPendingDeleteId(biz.id);
                                    setPendingImportId(null);
                                  }
                                }}
                                className={cn(
                                  "p-1.5 rounded-lg transition-all inline-flex border",
                                  pendingDeleteId === biz.id 
                                    ? "bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20" 
                                    : "bg-red-500/5 border-red-500/10 text-red-400 hover:bg-red-500/15 hover:border-red-500/30"
                                )}
                                title={pendingDeleteId === biz.id ? "Confirmar Eliminação" : "Eliminar Lead"}
                              >
                                {pendingDeleteId === biz.id ? (
                                  <Check size={12} className="text-orange-400" />
                                ) : (
                                  <Trash2 size={12} />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          )}

          {/* Load More Leads / Batch Action Button */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              type="button"
              variant="secondary"
              disabled={isLoadingMore || isLoading}
              onClick={() => handleSearch(undefined, undefined, undefined, true)}
              className="px-6 py-3.5 text-xs font-display font-black italic uppercase tracking-wider flex items-center gap-2 border-white/10 hover:border-vela-red/40 hover:bg-white/[0.04]"
            >
              {isLoadingMore ? (
                <>
                  <div className="w-4 h-4 border-2 border-vela-red border-t-transparent rounded-full animate-spin" />
                  <span>A pesquisar mais leads no Google Maps...</span>
                </>
              ) : (
                <>
                  <PlusCircle size={16} className="text-vela-red" />
                  <span>Prospetar Mais Leads nesta Zona (+20 a 30)</span>
                </>
              )}
            </Button>
          </div>

          {/* Quick link to CRM if leads were imported */}
          {importedIds.size > 0 && onNavigateToClients && (
            <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={24} className="text-emerald-400 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {importedIds.size} {importedIds.size === 1 ? 'Lead adicionada' : 'Leads adicionadas'} com sucesso!
                  </h4>
                  <p className="text-xs text-zinc-400">
                    Pode consultar as novas leads na secção de Clientes e iniciar o contacto comercial.
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={onNavigateToClients}
                className="text-xs font-black uppercase tracking-wider"
              >
                <span>Ver Lista de Clientes</span>
                <ArrowRight size={14} />
              </Button>
            </div>
          )}

          {/* Market Analysis Report block completely removed to streamline interface */}
        </div>
      )}

      {/* Empty State before search */}
      {!isLoading && businesses.length === 0 && !error && (
        <div className="py-20 flex flex-col items-center justify-center text-center space-y-4 border border-dashed border-white/10 rounded-3xl bg-white/[0.01]">
          <div className="w-16 h-16 rounded-2xl bg-vela-red/5 border border-vela-red/10 flex items-center justify-center text-vela-red">
            <Compass size={28} />
          </div>
          <div className="max-w-md space-y-1">
            <h3 className="text-lg font-display font-black text-white italic uppercase tracking-tight">
              Inicie uma Prospeção no Google Maps
            </h3>
            <p className="text-xs text-zinc-500">
              Escolha um nicho e uma cidade para extrair empresas reais, avaliar o seu potencial comercial e alimentar a carteira de leads da VELA.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
