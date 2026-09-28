import React, { useMemo } from 'react';
import { GlassCard, Badge, Button } from '../components/UI';
import { formatCurrency, cn } from '../lib/utils';
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
  Euro,
  CircleDollarSign
} from 'lucide-react';
import { useWorkspace } from '../contexts/WorkspaceContext';

export const FinancesPage: React.FC = () => {
  const { clients } = useWorkspace();

  // Calculate real revenue data for the chart from client payments
  const chartData = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const currentYear = new Date().getFullYear();
    
    // Initialize data for all months of the current year
    const monthlyData: Record<string, { month: string, sales: number, received: number, index: number }> = {};
    months.forEach((m, i) => {
      monthlyData[m] = { month: m, sales: 0, received: 0, index: i };
    });

    // Aggregate data from payments
    (clients || []).forEach(client => {
      const hasPayments = client.payments && client.payments.length > 0;
      
      if (hasPayments) {
        (client.payments || []).forEach(payment => {
          if (!payment.date) return;
          
          const date = new Date(payment.date);
          if (date.getFullYear() === currentYear || (currentYear === 2024 && date.getFullYear() === 2024)) {
            const monthIndex = date.getMonth();
            const monthName = months[monthIndex];
            
            if (monthlyData[monthName]) {
              monthlyData[monthName].sales += payment.amount || 0;
              if (payment.status === 'received') {
                monthlyData[monthName].received += payment.amount || 0;
              }
            }
          }
        });
      } else {
        // Fallback: If no explicit payments, use the client totals
        // This ensures the chart reflects the cards even if transaction history is missing
        const date = client.lastInteraction ? new Date(client.lastInteraction) : new Date();
        if (date.getFullYear() === currentYear) {
          const monthIndex = date.getMonth();
          const monthName = months[monthIndex];
          
          if (monthlyData[monthName]) {
            monthlyData[monthName].sales += client.totalValue || 0;
            monthlyData[monthName].received += client.receivedAmount || 0;
          }
        }
      }
    });

    // Filter to show only months that have data or up to current month
    const currentMonthIdx = new Date().getMonth();
    return Object.values(monthlyData)
      .sort((a, b) => a.index - b.index)
      .filter((d, i) => i <= Math.max(currentMonthIdx, 5) || d.sales > 0);
  }, [clients]);

  // Calculate financial stats
  const totalSales = (clients || []).reduce((acc, c) => acc + (c.totalValue || 0), 0);
  const totalReceived = (clients || []).reduce((acc, c) => acc + (c.receivedAmount || 0), 0);
  const pendingRevenue = totalSales - totalReceived;

  const stats = [
    { label: 'Vendas Totais', value: formatCurrency(totalSales), icon: TrendingUp, color: 'text-vela-red', trend: '+12%' },
    { label: 'Total Recebido', value: formatCurrency(totalReceived), icon: ArrowUpRight, color: 'text-emerald-400', trend: '+8%' },
    { label: 'Total Pendente', value: formatCurrency(pendingRevenue), icon: Clock, color: 'text-amber-400', trend: '' },
  ];

  return (
    <div className="space-y-12 px-8 py-4 relative min-h-screen">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {stats.map((stat, i) => (
          <GlassCard 
            key={i} 
            hoverable 
            className="border-white/5 relative group p-8"
          >
            <p className="text-[10px] text-zinc-600 uppercase font-black tracking-[0.3em] mb-6 font-sans">{stat.label}</p>
            <div className="flex items-end justify-between">
              <h3 className="text-3xl font-display font-black text-white tracking-tighter leading-none italic">{stat.value}</h3>
              {stat.trend && (
                <div className="flex items-center gap-1 text-emerald-500 bg-emerald-500/5 px-3 py-1 rounded-lg border border-emerald-500/10 transition-colors group-hover:bg-emerald-500/10">
                  <ArrowUpRight size={10} />
                  <span className="text-[10px] font-sans font-black tracking-tighter">{stat.trend}</span>
                </div>
              )}
            </div>
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <stat.icon size={48} strokeWidth={1} />
            </div>
          </GlassCard>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Revenue Chart */}
        <GlassCard hoverable className="w-full p-10 flex flex-col min-h-[600px]">
          <div className="flex justify-between items-center mb-10 pl-[50px]">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-2 h-2 rounded-full bg-vela-red shadow-[0_0_10px_rgba(255,34,28,0.5)] animate-pulse" />
                <h3 className="text-2xl font-display font-black text-white tracking-tight uppercase italic">Fluxo de Capital</h3>
              </div>
            </div>
          </div>
          <div className="h-[400px] w-full mt-auto">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <filter id="glow-fin" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                  <linearGradient id="colorSalesFin" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ffffff" stopOpacity={0.05}/>
                    <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorReceivedFin" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF221C" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#FF221C" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.01)" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#27272a', fontSize: 9, fontWeight: 900, fontFamily: 'Montserrat', letterSpacing: '0.2em' }}
                  dy={20}
                />
                <YAxis 
                  width={50}
                  tickFormatter={(value) => value >= 1000 ? `€${(value / 1000).toFixed(1)}k` : `€${value}`}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#3f3f46', fontSize: 9, fontWeight: 900, fontFamily: 'Montserrat' }}
                />
                <Tooltip 
                  cursor={{ stroke: 'rgba(255,34,28,0.1)', strokeWidth: 20 }}
                  position={{ y: -80 }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const sales = payload.find(p => p.name === 'Vendas')?.value || 0;
                      const received = payload.find(p => p.name === 'Recebido')?.value || 0;
                      return (
                        <div className="bg-[#0D0D0F]/95 backdrop-blur-2xl border border-white/10 p-5 rounded-2xl shadow-2xl shadow-black/80 flex flex-col gap-3 min-w-[180px]">
                          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-1">{label}</p>
                          <div className="flex flex-col gap-2">
                             <div className="flex justify-between items-center bg-white/[0.03] p-3 rounded-xl border border-white/5">
                               <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Vendas</span>
                               <span className="text-xs font-black text-white font-display italic">{formatCurrency(sales as number)}</span>
                             </div>
                             <div className="flex justify-between items-center bg-vela-red/5 p-3 rounded-xl border border-vela-red/10">
                               <span className="text-[9px] font-black text-vela-red uppercase tracking-widest">Recebido</span>
                               <span className="text-xs font-black text-white font-display italic">{formatCurrency(received as number)}</span>
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
                  stroke="rgba(255,255,255,0.05)" 
                  fillOpacity={1} 
                  fill="url(#colorSalesFin)" 
                  strokeWidth={1} 
                  strokeDasharray="4 4"
                />
                <Area 
                  type="monotone" 
                  dataKey="received" 
                  name="Recebido"
                  stroke="#FF221C" 
                  fillOpacity={1} 
                  fill="url(#colorReceivedFin)" 
                  strokeWidth={4}
                  strokeLinecap="round"
                  activeDot={{ r: 6, fill: '#FF221C', stroke: '#0D0D0F', strokeWidth: 3 }}
                />
                <Area 
                  type="monotone" 
                  dataKey="received" 
                  name="glow"
                  stroke="#FF221C" 
                  strokeWidth={1}
                  fill="none"
                  filter="url(#glow-fin)"
                  opacity={0.8}
                  pointerEvents="none"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>


      </div>
    </div>
  );
};
