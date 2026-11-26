import React, { useMemo, useState } from 'react';
import { GlassCard, Badge } from '../components/UI';
import { formatCurrency } from '../lib/utils';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { 
  TrendingUp, 
  ArrowUpRight,
  Clock,
  Repeat,
  Calendar,
  CheckCircle2,
  Building2,
  Folder,
  X
} from 'lucide-react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { calculateMonthlyEquivalent, formatFrequencyLabel, getTodayISO } from '../lib/billing';
import { Client } from '../types';

interface ParsedDateInfo {
  year: number;
  monthIndex: number;
  isoDate: string;
}

const parseSafeDate = (rawDate?: string): ParsedDateInfo | null => {
  if (!rawDate) return null;
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(rawDate.trim());
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (year > 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return {
        year,
        monthIndex: month - 1,
        isoDate: `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
      };
    }
  }
  const d = new Date(rawDate);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return {
    year: yyyy,
    monthIndex: d.getMonth(),
    isoDate: `${yyyy}-${mm}-${dd}`
  };
};

const formatDisplayDate = (isoDate: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return isoDate;
  return `${m[3]}/${m[2]}/${m[1]}`;
};

const isAcceptedSaleClient = (client: Client): boolean => {
  if (client.status === 'Cliente' || client.status === 'Terminado') return true;
  if (client.proposal?.status === 'aceite') return true;
  return false;
};

const getAcceptedSaleDate = (client: Client): ParsedDateInfo => {
  const adjudicationDates = (client.payments || [])
    .filter(p => p.type === 'adjudication')
    .map(p => p.saleDate || p.date);
  const allPaymentDates = (client.payments || []).map(p => p.saleDate || p.date);

  const candidates = [
    client.saleDate,
    client.proposal?.acceptedAt,
    client.projectStartDate,
    client.proposal?.status === 'aceite' ? client.proposal?.date : undefined,
    ...adjudicationDates,
    ...allPaymentDates,
    client.projectEndDate,
    client.lastInteraction,
  ];
  for (const dt of candidates) {
    const parsed = parseSafeDate(dt);
    if (parsed) return parsed;
  }
  return parseSafeDate(getTodayISO())!;
};

const getClientGroupInfo = (record: Client, allClients: Client[]) => {
  const nameNorm = (record.name || 'Sem Nome').trim().toLowerCase();
  const parentDoc = record.parentClientId
    ? allClients.find(c => c.id === record.parentClientId)
    : allClients.find(c => !c.parentClientId && (c.name || '').trim().toLowerCase() === nameNorm);
  const key = parentDoc?.id || `name:${nameNorm}`;
  const label = parentDoc?.name || record.name || 'Cliente sem nome';
  return { key, label };
};

const hasFinancialDataOrActiveProject = (c: Client): boolean => {
  if (!c.projectRemoved) return true;
  if ((c.totalValue || 0) > 0 || (c.receivedAmount || 0) > 0) return true;
  if ((c.payments?.length || 0) > 0) return true;
  if (c.recurringBilling?.enabled && c.status !== 'Terminado') return true;
  return false;
};

export const FinancesPage: React.FC = () => {
  const { clients } = useWorkspace();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedClientKey, setSelectedClientKey] = useState<string>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');

  const allClientsList = useMemo(() => clients || [], [clients]);

  const acceptedClients = useMemo(
    () => allClientsList.filter(isAcceptedSaleClient),
    [allClientsList]
  );

  const recurringClients = useMemo(() => {
    return allClientsList.filter(c => c.recurringBilling?.enabled && c.status !== 'Terminado');
  }, [allClientsList]);

  const filterableProjectRecords = useMemo(() => {
    const seen = new Set<string>();
    const list: Client[] = [];
    [...acceptedClients, ...recurringClients].forEach(c => {
      if (seen.has(c.id)) return;
      if (!hasFinancialDataOrActiveProject(c)) return;
      seen.add(c.id);
      list.push(c);
    });
    return list;
  }, [acceptedClients, recurringClients]);

  const clientFilterOptions = useMemo(() => {
    const map = new Map<string, { key: string; label: string }>();
    filterableProjectRecords.forEach(record => {
      const info = getClientGroupInfo(record, allClientsList);
      if (!map.has(info.key)) {
        map.set(info.key, info);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'pt'));
  }, [filterableProjectRecords, allClientsList]);

  const projectFilterOptions = useMemo(() => {
    const scoped = selectedClientKey === 'all'
      ? filterableProjectRecords
      : filterableProjectRecords.filter(
          record => getClientGroupInfo(record, allClientsList).key === selectedClientKey
        );

    const baseItems = scoped.map(record => {
      const clientInfo = getClientGroupInfo(record, allClientsList);
      const baseProjectLabel = record.serviceType || 'Projeto Geral';
      const displayBase = selectedClientKey === 'all'
        ? `${clientInfo.label} — ${baseProjectLabel}`
        : baseProjectLabel;
      return {
        id: record.id,
        clientKey: clientInfo.key,
        clientLabel: clientInfo.label,
        projectLabel: baseProjectLabel,
        displayBase,
        status: record.status,
        saleDate: record.saleDate || record.proposal?.acceptedAt || record.projectStartDate
      };
    });

    const labelCounts = new Map<string, number>();
    baseItems.forEach(item => {
      labelCounts.set(item.displayBase, (labelCounts.get(item.displayBase) || 0) + 1);
    });

    return baseItems
      .map(item => {
        const isDuplicate = (labelCounts.get(item.displayBase) || 0) > 1;
        const parsedDate = parseSafeDate(item.saleDate);
        const suffix = isDuplicate
          ? ` (${item.status}${parsedDate ? ` · ${formatDisplayDate(parsedDate.isoDate)}` : ''})`
          : '';
        return {
          id: item.id,
          label: `${item.displayBase}${suffix}`
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label, 'pt'));
  }, [filterableProjectRecords, selectedClientKey, allClientsList]);

  const filteredAcceptedClients = useMemo(() => {
    return acceptedClients.filter(c => {
      if (selectedProjectId !== 'all' && c.id !== selectedProjectId) return false;
      if (selectedClientKey !== 'all' && getClientGroupInfo(c, allClientsList).key !== selectedClientKey) return false;
      return true;
    });
  }, [acceptedClients, selectedClientKey, selectedProjectId, allClientsList]);

  const filteredRecurringClients = useMemo(() => {
    return recurringClients.filter(c => {
      if (selectedProjectId !== 'all' && c.id !== selectedProjectId) return false;
      if (selectedClientKey !== 'all' && getClientGroupInfo(c, allClientsList).key !== selectedClientKey) return false;
      return true;
    });
  }, [recurringClients, selectedClientKey, selectedProjectId, allClientsList]);

  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYear]);
    const relevant = [...filteredAcceptedClients, ...filteredRecurringClients];
    relevant.forEach(client => {
      (client.payments || []).forEach(p => {
        const parsedDate = parseSafeDate(p.date);
        if (parsedDate) years.add(parsedDate.year);
        const parsedSale = parseSafeDate(p.saleDate);
        if (parsedSale) years.add(parsedSale.year);
      });
      const fallbackDates = [
        client.saleDate,
        client.proposal?.acceptedAt,
        client.proposal?.status === 'aceite' ? client.proposal?.date : undefined,
        client.projectEndDate,
        client.projectStartDate,
        client.lastInteraction
      ];
      fallbackDates.forEach(dt => {
        const parsed = parseSafeDate(dt);
        if (parsed) years.add(parsed.year);
      });
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [filteredAcceptedClients, filteredRecurringClients, currentYear]);

  const effectiveYear = availableYears.includes(selectedYear) ? selectedYear : availableYears[0];

  const handleClientFilterChange = (newClientKey: string) => {
    setSelectedClientKey(newClientKey);
    setSelectedProjectId('all');
  };

  const handleClearFilters = () => {
    setSelectedClientKey('all');
    setSelectedProjectId('all');
  };

  const hasActiveFilters = selectedClientKey !== 'all' || selectedProjectId !== 'all';

  // Sales happen when a proposal is accepted (fixed date & value); liquidations increase Received on payment.date
  const chartData = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    const monthlyData: Record<string, { month: string, sales: number, received: number, index: number }> = {};
    months.forEach((m, i) => {
      monthlyData[m] = { month: m, sales: 0, received: 0, index: i };
    });

    filteredAcceptedClients.forEach(client => {
      const payments = client.payments || [];
      const saleParsed = getAcceptedSaleDate(client);
      const isRecurring = Boolean(client.recurringBilling?.enabled);

      let trackedTotal = 0;
      let trackedReceived = 0;

      if (!isRecurring) {
        const totalSaleValue = client.totalValue || 0;
        if (totalSaleValue > 0 && saleParsed.year === effectiveYear) {
          const saleMonthName = months[saleParsed.monthIndex];
          if (monthlyData[saleMonthName]) {
            monthlyData[saleMonthName].sales += totalSaleValue;
          }
        }
      }

      payments.forEach(payment => {
        const amt = payment.amount || 0;
        trackedTotal += amt;

        if (isRecurring && amt > 0) {
          const cycleParsed =
            payment.type === 'recurring'
              ? (parseSafeDate(payment.saleDate || payment.date) || saleParsed)
              : saleParsed;
          if (cycleParsed.year === effectiveYear) {
            const cycleMonthName = months[cycleParsed.monthIndex];
            if (monthlyData[cycleMonthName]) {
              monthlyData[cycleMonthName].sales += amt;
            }
          }
        }

        if (payment.status === 'received' && amt > 0) {
          trackedReceived += amt;
          const receivedParsed = parseSafeDate(payment.date) || saleParsed;
          if (receivedParsed.year === effectiveYear) {
            const recMonthName = months[receivedParsed.monthIndex];
            if (monthlyData[recMonthName]) {
              monthlyData[recMonthName].received += amt;
            }
          }
        }
      });

      if (isRecurring) {
        const untrackedSales = Math.max(0, (client.totalValue || 0) - trackedTotal);
        if (untrackedSales > 0.005 && saleParsed.year === effectiveYear) {
          const saleMonthName = months[saleParsed.monthIndex];
          if (monthlyData[saleMonthName]) {
            monthlyData[saleMonthName].sales += untrackedSales;
          }
        }
      }

      const untrackedReceived = Math.max(0, (client.receivedAmount || 0) - trackedReceived);
      if (untrackedReceived > 0.005) {
        const fallbackRaw =
          client.projectEndDate ||
          client.saleDate ||
          client.proposal?.acceptedAt ||
          client.projectStartDate ||
          client.lastInteraction ||
          getTodayISO();
        const parsed = parseSafeDate(fallbackRaw) || saleParsed;
        if (parsed.year === effectiveYear) {
          const monthName = months[parsed.monthIndex];
          if (monthlyData[monthName]) {
            monthlyData[monthName].received += untrackedReceived;
          }
        }
      }
    });

    const currentMonthIdx = new Date().getMonth();
    return Object.values(monthlyData)
      .sort((a, b) => a.index - b.index)
      .filter((d, i) =>
        effectiveYear !== currentYear ||
        i <= Math.max(currentMonthIdx, 5) ||
        d.sales > 0 ||
        d.received > 0
      );
  }, [filteredAcceptedClients, effectiveYear, currentYear]);

  // Build liquidation ledger sorted by date desc
  const liquidationHistory = useMemo(() => {
    const entries: Array<{
      id: string;
      clientId: string;
      clientName: string;
      serviceType: string;
      description: string;
      isoDate: string;
      year: number;
      amount: number;
    }> = [];

    filteredAcceptedClients.forEach(client => {
      const payments = client.payments || [];
      let trackedReceived = 0;

      payments.forEach(p => {
        if (p.status === 'received' && (p.amount || 0) > 0) {
          trackedReceived += p.amount || 0;
          const parsed = parseSafeDate(p.date) || parseSafeDate(client.lastInteraction) || parseSafeDate(getTodayISO())!;
          entries.push({
            id: `${client.id}-${p.id}`,
            clientId: client.id,
            clientName: client.name,
            serviceType: client.serviceType || 'Projeto',
            description:
              p.description ||
              (p.type === 'adjudication'
                ? 'Adjudicação'
                : p.type === 'recurring'
                  ? 'Pagamento Recorrente'
                  : 'Liquidação'),
            isoDate: parsed.isoDate,
            year: parsed.year,
            amount: p.amount || 0
          });
        }
      });

      const untrackedReceived = Math.max(0, (client.receivedAmount || 0) - trackedReceived);
      if (untrackedReceived > 0.005) {
        const fallbackRaw =
          client.projectEndDate ||
          client.saleDate ||
          client.proposal?.acceptedAt ||
          client.projectStartDate ||
          client.lastInteraction ||
          getTodayISO();
        const parsed = parseSafeDate(fallbackRaw) || parseSafeDate(getTodayISO())!;
        entries.push({
          id: `${client.id}-legacy`,
          clientId: client.id,
          clientName: client.name,
          serviceType: client.serviceType || 'Projeto',
          description: 'Liquidação registada',
          isoDate: parsed.isoDate,
          year: parsed.year,
          amount: untrackedReceived
        });
      }
    });

    return entries
      .filter(e => e.year === effectiveYear)
      .sort((a, b) => b.isoDate.localeCompare(a.isoDate));
  }, [filteredAcceptedClients, effectiveYear]);

  const totalLiquidatedInYear = useMemo(() => {
    return liquidationHistory.reduce((acc, item) => acc + item.amount, 0);
  }, [liquidationHistory]);

  // Calculate financial stats strictly over accepted proposals/sales
  const totalSales = filteredAcceptedClients.reduce((acc, c) => acc + (c.totalValue || 0), 0);
  const totalReceived = filteredAcceptedClients.reduce((acc, c) => acc + (c.receivedAmount || 0), 0);
  const pendingRevenue = Math.max(0, totalSales - totalReceived);

  const activeRecurringClients = useMemo(() => {
    return filteredRecurringClients.filter(c => c.status === 'Cliente' && c.recurringBilling?.active);
  }, [filteredRecurringClients]);

  const totalMRR = useMemo(() => {
    return activeRecurringClients.reduce((acc, c) => acc + calculateMonthlyEquivalent(c.recurringBilling), 0);
  }, [activeRecurringClients]);

  const collectionRate = totalSales > 0 ? Math.round((totalReceived / totalSales) * 100) : 0;

  const stats = [
    {
      label: 'Vendas Totais',
      value: formatCurrency(totalSales),
      icon: TrendingUp,
      color: 'text-vela-red',
      subtext: `${filteredAcceptedClients.filter(c => (c.totalValue || 0) > 0).length} propostas aceites`
    },
    {
      label: 'Total Recebido',
      value: formatCurrency(totalReceived),
      icon: ArrowUpRight,
      color: 'text-emerald-400',
      subtext: `${collectionRate}% do total contratado`
    },
    {
      label: 'Total Pendente',
      value: formatCurrency(pendingRevenue),
      icon: Clock,
      color: 'text-amber-400',
      subtext: pendingRevenue > 0 ? 'Por liquidar' : 'Totalmente liquidado'
    },
    {
      label: 'Receita Recorrente (MRR)',
      value: formatCurrency(totalMRR),
      icon: Repeat,
      color: 'text-vela-red',
      subtext: activeRecurringClients.length > 0 ? `${activeRecurringClients.length} subscrições ativas` : 'Sem subscrições ativas'
    },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Filtros por Cliente e Projeto */}
      <GlassCard className="p-4 sm:px-5 sm:py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0 text-zinc-400">
                <Building2 size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <label htmlFor="finance-client-filter" className="block text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 mb-1">
                  Cliente
                </label>
                <select
                  id="finance-client-filter"
                  value={selectedClientKey}
                  onChange={(e) => handleClientFilterChange(e.target.value)}
                  className="w-full bg-[#16161A] border border-white/10 hover:border-white/25 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-vela-red/40 transition-colors duration-150 cursor-pointer truncate"
                >
                  <option value="all">Todos os clientes</option>
                  {clientFilterOptions.map(opt => (
                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0 text-zinc-400">
                <Folder size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <label htmlFor="finance-project-filter" className="block text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 mb-1">
                  Projeto
                </label>
                <select
                  id="finance-project-filter"
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full bg-[#16161A] border border-white/10 hover:border-white/25 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-vela-red/40 transition-colors duration-150 cursor-pointer truncate"
                >
                  <option value="all">Todos os projetos</option>
                  {projectFilterOptions.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between lg:justify-end gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-white/[0.06]">
            <span className="text-xs text-zinc-400 tabular-nums whitespace-nowrap">
              {filteredAcceptedClients.length} {filteredAcceptedClients.length === 1 ? 'projeto contabilizado' : 'projetos contabilizados'}
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 text-xs font-semibold text-zinc-200 hover:text-white transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <X size={13} />
                Limpar filtros
              </button>
            )}
          </div>
        </div>
      </GlassCard>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, i) => (
          <GlassCard key={i} hoverable className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2 min-w-0">
                <p className="text-[11px] text-zinc-400 uppercase font-bold tracking-[0.14em] font-sans truncate">
                  {stat.label}
                </p>
                <h3 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight tabular-nums leading-none">
                  {stat.value}
                </h3>
                <p className="text-[11px] text-zinc-500 font-medium tabular-nums">
                  {stat.subtext}
                </p>
              </div>
              <div className={`w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0 ${stat.color}`}>
                <stat.icon size={18} strokeWidth={1.75} />
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Revenue Chart */}
      <GlassCard className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-6 border-b border-white/[0.06]">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight font-sans">
              Fluxo de Capital
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Comparativo mensal entre propostas aceites (vendas) e valores liquidados
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-4 text-xs text-zinc-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-white/30 rounded-full" />
                Vendas
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-vela-red rounded-full" />
                Recebido
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-zinc-500" />
              <select
                value={effectiveYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                aria-label="Selecionar ano financeiro"
                className="bg-[#16161A] border border-white/10 hover:border-white/25 rounded-xl px-3.5 py-2 text-xs font-semibold text-white tabular-nums focus:outline-none focus:border-vela-red/40 transition-colors duration-150 cursor-pointer"
              >
                {availableYears.map(yr => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="h-[360px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSalesFin" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ffffff" stopOpacity={0.08} />
                  <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorReceivedFin" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF221C" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#FF221C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#71717a', fontSize: 11, fontWeight: 600, fontFamily: 'Montserrat' }}
                dy={12}
              />
              <YAxis
                width={56}
                tickFormatter={(value) => value >= 1000 ? `€${(value / 1000).toFixed(1)}k` : `€${value}`}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#71717a', fontSize: 11, fontWeight: 600, fontFamily: 'JetBrains Mono' }}
              />
              <Tooltip
                cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const sales = payload.find(p => p.name === 'Vendas')?.value || 0;
                    const received = payload.find(p => p.name === 'Recebido')?.value || 0;
                    return (
                      <div className="bg-[#121215]/95 backdrop-blur-xl border border-white/10 p-4 rounded-xl shadow-2xl flex flex-col gap-2.5 min-w-[180px] tabular-nums">
                        <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">{label} {effectiveYear}</p>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between items-center gap-4">
                            <span className="text-zinc-400">Vendas</span>
                            <span className="font-bold text-white">{formatCurrency(sales as number)}</span>
                          </div>
                          <div className="flex justify-between items-center gap-4">
                            <span className="text-vela-red font-medium">Recebido</span>
                            <span className="font-bold text-white">{formatCurrency(received as number)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="sales"
                name="Vendas"
                stroke="rgba(255,255,255,0.22)"
                fillOpacity={1}
                fill="url(#colorSalesFin)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
              <Area
                type="monotone"
                dataKey="received"
                name="Recebido"
                stroke="#FF221C"
                fillOpacity={1}
                fill="url(#colorReceivedFin)"
                strokeWidth={2.5}
                strokeLinecap="round"
                activeDot={{ r: 5, fill: '#FF221C', stroke: '#0D0D0F', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      {/* Histórico de Liquidações */}
      <GlassCard className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={17} className="text-emerald-400" />
            <h3 className="text-base font-bold text-white tracking-tight font-sans">
              Histórico de Liquidações ({effectiveYear})
            </h3>
          </div>
          <Badge variant="success" className="tabular-nums">
            Total em {effectiveYear}: {formatCurrency(totalLiquidatedInYear)}
          </Badge>
        </div>

        {liquidationHistory.length > 0 ? (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                  <th className="py-3 pr-4">Cliente / Projeto</th>
                  <th className="py-3 px-4">Descrição</th>
                  <th className="py-3 px-4">Data da Liquidação</th>
                  <th className="py-3 pl-4 text-right">Valor Liquidado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-xs">
                {liquidationHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.025] transition-colors duration-150">
                    <td className="py-3.5 pr-4">
                      <p className="font-semibold text-white">{item.clientName}</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">{item.serviceType}</p>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-300">
                      {item.description}
                    </td>
                    <td className="py-3.5 px-4 text-zinc-400 font-mono text-xs tabular-nums">
                      {formatDisplayDate(item.isoDate)}
                    </td>
                    <td className="py-3.5 pl-4 text-right font-bold text-emerald-400 tabular-nums">
                      {formatCurrency(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-zinc-500 py-10 text-center">
            Sem liquidações registadas em {effectiveYear}.
          </p>
        )}
      </GlassCard>

      {/* Subscrições & Cobranças Recorrentes */}
      {filteredRecurringClients.length > 0 && (
        <GlassCard className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-5 border-b border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <Repeat size={16} className="text-vela-red" />
              <h3 className="text-base font-bold text-white tracking-tight font-sans">
                Subscrições &amp; Cobranças Recorrentes ({filteredRecurringClients.length})
              </h3>
            </div>
            <Badge variant="primary" className="tabular-nums">MRR Estimado: {formatCurrency(totalMRR)}/mês</Badge>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                  <th className="py-3 pr-4">Cliente / Projeto</th>
                  <th className="py-3 px-4">Periodicidade</th>
                  <th className="py-3 px-4">Valor / Ciclo</th>
                  <th className="py-3 px-4">Próxima Cobrança</th>
                  <th className="py-3 pl-4 text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-xs">
                {filteredRecurringClients.map((rc) => {
                  const rb = rc.recurringBilling!;
                  return (
                    <tr key={rc.id} className="hover:bg-white/[0.025] transition-colors duration-150">
                      <td className="py-3.5 pr-4">
                        <p className="font-semibold text-white">{rc.name}</p>
                        <p className="text-[11px] text-zinc-500 mt-0.5">{rc.serviceType}</p>
                      </td>
                      <td className="py-3.5 px-4 text-zinc-300">
                        {formatFrequencyLabel(rb)}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-white tabular-nums">
                        {formatCurrency(rb.amount)}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-400 font-mono text-xs tabular-nums">
                        {rb.nextBillingDate || '—'}
                      </td>
                      <td className="py-3.5 pl-4 text-right">
                        <Badge variant={rb.active ? 'success' : 'default'}>
                          {rb.active ? 'Ativa' : rc.status === 'Pendente' ? 'Proposta' : 'Pausada'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
};

