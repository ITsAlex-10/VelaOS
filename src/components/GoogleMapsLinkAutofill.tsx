import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Sparkles, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

export interface ResolvedGoogleMapsPlace {
  placeId?: string;
  name: string;
  address: string;
  phone: string;
  website: string;
  email?: string;
  mapUri: string;
  category?: string;
  rating?: number;
  userRatingCount?: number;
}

interface GoogleMapsLinkAutofillProps {
  value: string;
  onChange: (newValue: string) => void;
  onResolved: (place: ResolvedGoogleMapsPlace) => void;
  placeholder?: string;
}

const isGoogleMapsLink = (url: string): boolean => {
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed.includes('maps.app.goo.gl') ||
    trimmed.includes('goo.gl/maps') ||
    trimmed.includes('google.com/maps') ||
    trimmed.includes('google.pt/maps') ||
    trimmed.includes('maps.google.') ||
    trimmed.includes('g.page/') ||
    trimmed.includes('share.google/')
  );
};

export const GoogleMapsLinkAutofill: React.FC<GoogleMapsLinkAutofillProps> = ({
  value,
  onChange,
  onResolved,
  placeholder = 'Cole aqui o link do Google Maps (ex: https://maps.app.goo.gl/...)'
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedInfo, setResolvedInfo] = useState<{
    name: string;
    category?: string;
    rating?: number;
    userRatingCount?: number;
    partial?: boolean;
    filledFields: string[];
  } | null>(null);

  const resolvedUrlsRef = useRef<Set<string>>(new Set());
  const onResolvedRef = useRef(onResolved);
  onResolvedRef.current = onResolved;

  const lookupPlace = useCallback(async (targetUrl: string) => {
    const cleanUrl = targetUrl.trim();
    if (!cleanUrl) {
      setError('Cole primeiro o link do perfil do Google Maps.');
      return;
    }

    resolvedUrlsRef.current.add(cleanUrl);
    setIsLoading(true);
    setError(null);
    setResolvedInfo(null);

    try {
      const response = await fetch('/api/maps/resolve-place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cleanUrl })
      });

      const data = await response.json().catch(() => null);

      if (
        response.status === 429 ||
        data?.quotaExceeded ||
        data?.error?.status === 'RESOURCE_EXHAUSTED'
      ) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        setError('Quota da Google Maps API atingida. Preencha os campos manualmente ou tente mais tarde.');
        return;
      }

      if (!response.ok || !data?.place) {
        setError(data?.error || 'Não foi possível extrair os dados deste link.');
        return;
      }

      const place: ResolvedGoogleMapsPlace = data.place;
      if (place.mapUri) {
        resolvedUrlsRef.current.add(place.mapUri.trim());
      }

      const filledFields: string[] = [];
      if (place.name) filledFields.push('Nome');
      if (place.address) filledFields.push('Morada');
      if (place.phone) filledFields.push('Telemóvel');
      if (place.email) filledFields.push('Email');
      if (place.website) filledFields.push('Website');

      setResolvedInfo({
        name: place.name,
        category: place.category,
        rating: place.rating,
        userRatingCount: place.userRatingCount,
        partial: !!data.partial,
        filledFields
      });
      onResolvedRef.current(place);
    } catch {
      setError('Erro de ligação ao tentar obter os dados do Google Maps.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Automatically trigger lookup when a valid Google Maps URL is pasted or typed
  useEffect(() => {
    const cleanUrl = value.trim();
    if (!cleanUrl || !isGoogleMapsLink(cleanUrl)) return;
    if (resolvedUrlsRef.current.has(cleanUrl)) return;

    const timer = setTimeout(() => {
      lookupPlace(cleanUrl);
    }, 350);

    return () => clearTimeout(timer);
  }, [value, lookupPlace]);

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text')?.trim();
    if (pastedText && isGoogleMapsLink(pastedText) && !resolvedUrlsRef.current.has(pastedText)) {
      setTimeout(() => {
        lookupPlace(pastedText);
      }, 30);
    }
  };

  return (
    <div className="space-y-2.5 p-3.5 rounded-2xl bg-white/[0.025] border border-white/[0.08]">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-300 font-sans flex items-center gap-1.5 ml-0.5">
          <MapPin size={12} className="text-vela-red shrink-0" />
          Link Direto para o Perfil do Google Maps
        </label>
        <span className="text-[10px] font-sans text-zinc-500 hidden sm:inline">Extração automática</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (error) setError(null);
            if (resolvedInfo) setResolvedInfo(null);
          }}
          onPaste={handlePaste}
          placeholder={placeholder}
          className="w-full flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-vela-red/40 transition-all font-sans"
        />
        <button
          type="button"
          onClick={() => {
            resolvedUrlsRef.current.delete(value.trim());
            lookupPlace(value);
          }}
          disabled={isLoading || !value.trim()}
          className={cn(
            "px-3.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shrink-0 border",
            isLoading || !value.trim()
              ? "bg-white/5 border-white/5 text-zinc-600 cursor-not-allowed"
              : "bg-vela-red/15 border-vela-red/30 text-vela-red hover:bg-vela-red hover:text-white cursor-pointer"
          )}
        >
          {isLoading ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              <span>A extrair...</span>
            </>
          ) : (
            <>
              <Sparkles size={13} />
              <span>Preencher Dados</span>
            </>
          )}
        </button>
      </div>

      {isLoading && (
        <p className="text-[11px] text-zinc-400 flex items-center gap-1.5 pl-0.5">
          <Loader2 size={11} className="animate-spin text-vela-red" />
          A extrair Morada, Telemóvel, Website e Email do Perfil...
        </p>
      )}

      {resolvedInfo && !isLoading && (
        <div
          className={cn(
            "text-[11px] space-y-0.5 pl-0.5",
            resolvedInfo.partial ? "text-amber-400" : "text-emerald-400"
          )}
        >
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={12} className="shrink-0" />
            <span>
              {resolvedInfo.partial ? 'Apenas nome extraído do URL: ' : 'Preenchido: '}
              <strong className="text-white">{resolvedInfo.name}</strong>
              {resolvedInfo.category ? ` • ${resolvedInfo.category}` : ''}
              {typeof resolvedInfo.rating === 'number'
                ? ` • ★ ${resolvedInfo.rating.toFixed(1)}${resolvedInfo.userRatingCount ? ` (${resolvedInfo.userRatingCount})` : ''}`
                : ''}
            </span>
          </div>
          {resolvedInfo.partial ? (
            <p className="text-[10px] text-zinc-400 pl-4">
              Este link não contém o ID completo do perfil. Use o botão &quot;Partilhar &gt; Copiar link&quot; (maps.app.goo.gl) ou o URL completo do Google Maps para extrair Morada, Telemóvel, Website e Email.
            </p>
          ) : (
            resolvedInfo.filledFields.length > 0 && (
              <p className="text-[10px] text-zinc-400 pl-4">
                Campos obtidos: {resolvedInfo.filledFields.join(', ')}
                {!resolvedInfo.filledFields.includes('Email') && ' (Email não listado publicamente no site)'}
              </p>
            )
          )}
        </div>
      )}

      {error && !isLoading && (
        <p className="text-[11px] text-red-400 flex items-center gap-1.5 pl-0.5">
          <AlertCircle size={12} className="shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
};
