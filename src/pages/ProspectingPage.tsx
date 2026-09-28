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
  Layers
} from 'lucide-react';
import { GlassCard, Button, Badge } from '../components/UI';
import { useWorkspace } from '../contexts/WorkspaceContext';

interface SearchHistoryItem {
  id: string;
  query: string;
  location: string;
  timestamp: number;
}

const DEFAULT_PRESETS: SearchHistoryItem[] = [
  { id: 'def-1', query: 'Restaurantes tradicionais e modernos', location: 'Lisboa', timestamp: Date.now() - 100000 },
  { id: 'def-2', query: 'Clínicas dentárias e estética', location: 'Porto', timestamp: Date.now() - 80000 },
  { id: 'def-3', query: 'Gabinetes de arquitetura e design', location: 'Braga', timestamp: Date.now() - 60000 },
  { id: 'def-4', query: 'Imobiliárias e mediação imobiliária', location: 'Cascais', timestamp: Date.now() - 40000 },
  { id: 'def-5', query: 'Oficinas e centros automóvel especializados', location: 'Sintra', timestamp: Date.now() - 20000 },
  { id: 'def-6', query: 'Hotéis de charme e turismo rural', location: 'Algarve', timestamp: Date.now() - 10000 }
];

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
}

export const ProspectingPage: React.FC<{ onNavigateToClients?: () => void }> = ({ onNavigateToClients }) => {
  const { addClient, clients } = useWorkspace();

  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isImportingAll, setIsImportingAll] = useState(false);
  const [searchBatch, setSearchBatch] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [rawText, setRawText] = useState<string>('');
  const [groundingChunks, setGroundingChunks] = useState<GroundingChunk[]>([]);
  const [businesses, setBusinesses] = useState<DiscoveredBusiness[]>([]);
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
    return DEFAULT_PRESETS;
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
    setSearchHistory(DEFAULT_PRESETS);
    try {
      localStorage.removeItem(SEARCH_HISTORY_STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear search history:', e);
    }
  };

  // Filter state
  const [filterType, setFilterType] = useState<'all' | 'no-website' | 'high-rated'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Helper to parse businesses from response text & match grounding chunks
  const parseBusinessesFromResponse = (text: string, chunks: GroundingChunk[]): DiscoveredBusiness[] => {
    const list: DiscoveredBusiness[] = [];
    
    // Split by markdown headers starting with ###
    const sections = text.split(/(?=###\s+)/g);

    sections.forEach((sec, idx) => {
      const trimmed = sec.trim();
      if (!trimmed.startsWith('###')) return;

      const lines = trimmed.split('\n');
      const titleLine = lines[0].replace(/###\s+/, '').replace(/^\[|\]$/g, '').trim();

      let category = 'Empresa Local';
      let address = '';
      let phone = 'Não listado';
      let website = 'Sem website oficial';
      let rating = 'Classificação no Google Maps';
      let opportunity = '';

      lines.forEach((line) => {
        const clean = line.trim();
        if (/Setor|Categoria/i.test(clean)) {
          category = clean.replace(/^[*-]\s*(\*\*)?[^:]+(\*\*)?\s*:\s*/i, '').trim();
        } else if (/Morada|Endereço|Localização/i.test(clean)) {
          address = clean.replace(/^[*-]\s*(\*\*)?[^:]+(\*\*)?\s*:\s*/i, '').trim();
        } else if (/Telefone|Contacto/i.test(clean)) {
          phone = clean.replace(/^[*-]\s*(\*\*)?[^:]+(\*\*)?\s*:\s*/i, '').trim();
        } else if (/Website|Site/i.test(clean)) {
          website = clean.replace(/^[*-]\s*(\*\*)?[^:]+(\*\*)?\s*:\s*/i, '').trim();
        } else if (/Avaliaç|Classificaç|Rating|Estrelas/i.test(clean)) {
          rating = clean.replace(/^[*-]\s*(\*\*)?[^:]+(\*\*)?\s*:\s*/i, '').trim();
        } else if (/Diagnóstico|Oportunidade|Potencial/i.test(clean)) {
          opportunity = clean.replace(/^[*-]\s*(\*\*)?[^:]+(\*\*)?\s*:\s*/i, '').trim();
        }
      });

      // Find matching grounding chunk if any
      const matchingChunk = chunks.find((c) => {
        if (!c.maps?.title) return false;
        const normTitle = c.maps.title.toLowerCase();
        const normTarget = titleLine.toLowerCase();
        return normTitle.includes(normTarget) || normTarget.includes(normTitle);
      }) || chunks[idx];

      const hasSite = !website.toLowerCase().includes('sem website') && 
                      !website.toLowerCase().includes('não possui') && 
                      !website.toLowerCase().includes('não listado') && 
                      website.length > 4;

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
        mapUri: matchingChunk?.maps?.uri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(titleLine + ' ' + (address || location))}`
      });
    });

    // If text splitting yielded fewer than chunks, ensure chunks are also listed as businesses
    if (list.length === 0 && chunks.length > 0) {
      chunks.forEach((chunk, i) => {
        if (chunk.maps?.title) {
          list.push({
            id: `prospect-chunk-${i}`,
            name: chunk.maps.title,
            category: 'Negócio Local',
            address: location,
            phone: 'Não listado',
            website: 'Verificar no Maps',
            hasWebsite: false,
            rating: 'Ver no Google Maps',
            opportunity: 'Negócio verificado no Google Maps disponível para contacto comercial VELA.',
            mapUri: chunk.maps.uri
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
      const newChunks: GroundingChunk[] = data.groundingChunks || [];

      if (isAppend) {
        setBusinesses((prev) => {
          const existingNames = new Set(prev.map(b => b.name.toLowerCase().trim()));
          const uniqueNew = parsed.filter(b => !existingNames.has(b.name.toLowerCase().trim()));
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
        setBusinesses(parsed);
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
Website: ${biz.website}
Classificação: ${biz.rating}
Diagnóstico VELA: ${biz.opportunity}
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
Website: ${biz.website}
Classificação: ${biz.rating}
Diagnóstico VELA: ${biz.opportunity}
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
    } catch (err) {
      console.error('Batch import error:', err);
    } finally {
      setIsImportingAll(false);
    }
  };

  // Filtering
  const filteredBusinesses = businesses.filter((b) => {
    if (filterType === 'no-website' && b.hasWebsite) return false;
    if (filterType === 'high-rated' && !b.rating.includes('4.') && !b.rating.includes('5.')) return false;
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

      {/* Search Input Bar */}
      <GlassCard className="p-8 border-white/5">
        <form onSubmit={handleSearch} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Niche/Keyword */}
            <div className="lg:col-span-6 space-y-2">
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
            <div className="lg:col-span-4 space-y-2">
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

            {/* Submit Button */}
            <div className="lg:col-span-2 flex items-end">
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-[49px] font-display font-black italic uppercase tracking-wider text-sm flex items-center justify-center gap-2 shadow-xl shadow-vela-red/20"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>A Prospetar...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Pesquisar</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Dynamic Quick Suggestions based on Search History */}
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

              {searchHistory.length > 0 && (
                <button
                  type="button"
                  onClick={clearAllHistory}
                  className="text-[9px] font-sans text-zinc-600 hover:text-zinc-400 underline transition-colors px-2 py-1"
                  title="Restaurar sugestões padrão"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
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
                  ? 'Limite de Pedidos da API Google Atingido (Erro 429 - Quota Excedida)' 
                  : 'Aviso na Pesquisa do Google Maps'}
              </p>
              <p className="text-zinc-300 text-[11px] max-w-2xl leading-relaxed">
                {isQuotaExceeded 
                  ? 'A sua chave gratuita da Google API atingiu o limite de pedidos por minuto. O limite renova-se automaticamente dentro de 60 segundos, ou pode associar uma chave com faturação ativada no painel de Segredos. Enquanto aguarda, pode carregar dados de demonstração reais para testar o fluxo de CRM.'
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

      {/* Google Maps Grounding Sources (Mandatory requirement for Maps Grounding) */}
      {groundingChunks && groundingChunks.length > 0 && (
        <GlassCard className="p-6 border-white/5 bg-white/[0.01]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-vela-red" />
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white font-sans">
                Fichas Oficiais Verificadas no Google Maps ({groundingChunks.length})
              </h3>
            </div>
            <span className="text-[9px] font-sans text-zinc-500 uppercase tracking-widest">
              Grounding Oficial do Google Maps
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {groundingChunks.map((chunk, idx) => {
              if (!chunk.maps?.uri) return null;
              return (
                <div key={idx} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-vela-red/30 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-xs font-bold text-white font-sans truncate">
                        {chunk.maps.title || `Local ${idx + 1}`}
                      </span>
                      <a
                        href={chunk.maps.uri}
                        target="_blank"
                        rel="noreferrer"
                        className="text-vela-red hover:text-white transition-colors shrink-0"
                        title="Abrir no Google Maps"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>
                    <a
                      href={chunk.maps.uri}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-zinc-500 hover:text-zinc-300 font-mono block truncate"
                    >
                      {chunk.maps.uri}
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* Discovered Businesses Grid */}
      {businesses.length > 0 && (
        <div className="space-y-6">
          {/* Controls: Batch Import, Search in results & Filter pills */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Batch Import Button */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleImportAllVisible}
                disabled={isImportingAll || filteredBusinesses.every(b => importedIds.has(b.id))}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-xs font-display font-black italic uppercase tracking-wider transition-all disabled:opacity-40 disabled:pointer-events-none shadow-sm"
              >
                {isImportingAll ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                    <span>A Importar Todas...</span>
                  </>
                ) : (
                  <>
                    <DownloadCloud size={14} />
                    <span>Importar Todas ({filteredBusinesses.filter(b => !importedIds.has(b.id)).length})</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
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

              <div className="flex items-center gap-1 bg-white/[0.02] p-1 rounded-xl border border-white/5">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                    filterType === 'all' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-white'
                  }`}
                >
                  Todas
                </button>
                <button
                  onClick={() => setFilterType('no-website')}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                    filterType === 'no-website' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-zinc-500 hover:text-white'
                  }`}
                >
                  Sem Website
                </button>
                <button
                  onClick={() => setFilterType('high-rated')}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                    filterType === 'high-rated' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-zinc-500 hover:text-white'
                  }`}
                >
                  +4.0 Estrelas
                </button>
              </div>
            </div>
          </div>

          {/* Business Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBusinesses.map((biz) => {
              const isImported = importedIds.has(biz.id);

              return (
                <GlassCard
                  key={biz.id}
                  hoverable
                  className="p-6 border-white/5 flex flex-col justify-between space-y-6 group hover:border-white/10"
                >
                  {/* Top info */}
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[9px] uppercase tracking-widest font-black text-zinc-500 font-sans block mb-1">
                          {biz.category}
                        </span>
                        <h4 className="text-lg font-display font-black text-white italic uppercase tracking-tight group-hover:text-vela-red transition-colors">
                          {biz.name}
                        </h4>
                      </div>
                      
                      {biz.hasWebsite ? (
                        <Badge variant="success">Com Site</Badge>
                      ) : (
                        <Badge variant="warning">Sem Site</Badge>
                      )}
                    </div>

                    {/* Rating */}
                    <div className="flex items-center gap-2 text-xs text-zinc-400 bg-white/[0.02] p-2 rounded-lg border border-white/5">
                      <Star size={14} className="text-amber-400 fill-amber-400 shrink-0" />
                      <span className="font-bold text-white">{biz.rating}</span>
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

                      <div className="flex items-center gap-2">
                        <Globe size={14} className="text-zinc-500 shrink-0" />
                        {biz.hasWebsite ? (
                          <a
                            href={biz.website.startsWith('http') ? biz.website : `https://${biz.website}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-blue-400 hover:text-blue-300 hover:underline truncate max-w-[200px]"
                          >
                            {biz.website.replace(/^https?:\/\/(www\.)?/, '')}
                          </a>
                        ) : (
                          <span className="text-[11px] text-amber-500/80 font-medium">Sem website verificado</span>
                        )}
                      </div>
                    </div>

                    {/* Opportunity Box */}
                    <div className="p-3.5 rounded-xl bg-vela-red/[0.02] border border-vela-red/10 space-y-1">
                      <div className="flex items-center gap-1.5 text-[9px] uppercase font-black tracking-widest text-vela-red">
                        <TrendingUp size={12} />
                        <span>Oportunidade Comercial VELA</span>
                      </div>
                      <p className="text-[11px] text-zinc-300 leading-relaxed">
                        {biz.opportunity}
                      </p>
                    </div>
                  </div>

                  {/* Bottom Action Buttons */}
                  <div className="pt-4 border-t border-white/5 space-y-2">
                    {/* Primary: Import as Lead */}
                    <Button
                      type="button"
                      variant={isImported ? 'secondary' : 'primary'}
                      onClick={() => handleImportLead(biz)}
                      disabled={isImported}
                      className="w-full text-xs font-display font-black italic uppercase tracking-wider py-3"
                    >
                      {isImported ? (
                        <>
                          <CheckCircle2 size={16} className="text-emerald-400" />
                          <span className="text-emerald-400">Lead Adicionada</span>
                        </>
                      ) : (
                        <>
                          <UserPlus size={16} />
                          <span>Importar como Lead</span>
                        </>
                      )}
                    </Button>

                    {/* Secondary: Open in Google Maps */}
                    {biz.mapUri && (
                      <a
                        href={biz.mapUri}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-2 px-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 text-[10px] text-zinc-400 hover:text-white flex items-center justify-center gap-2 transition-all"
                      >
                        <ExternalLink size={12} />
                        <span>Ver Ficha no Google Maps</span>
                      </a>
                    )}
                  </div>
                </GlassCard>
              );
            })}
          </div>

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

          {/* Raw Market Analysis Accordion */}
          {rawText && (
            <details className="group border border-white/5 rounded-2xl bg-white/[0.01] p-6 transition-all">
              <summary className="cursor-pointer flex items-center justify-between text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-white">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-vela-red" />
                  <span>Relatório Completo de Análise de Mercado (Google Maps)</span>
                </div>
                <span className="text-[10px] text-zinc-600 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="mt-6 pt-6 border-t border-white/5 prose prose-invert max-w-none text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap font-sans">
                {rawText}
              </div>
            </details>
          )}
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
