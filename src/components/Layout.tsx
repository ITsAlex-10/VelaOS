import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  Calendar, 
  CircleDollarSign, 
  Settings,
  Bell,
  LogOut,
  Compass,
  UserCheck,
  Target,
  RefreshCw,
  Menu,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { auth } from '../lib/firebase';
import { VelaLogo } from './VelaLogo';

const navItems = [
  { id: 'dashboard', label: 'Painel', icon: LayoutDashboard },
  { id: 'prospecting', label: 'Prospeção', icon: Compass },
  { id: 'leads', label: 'Leads', icon: UserCheck, hasBadge: true },
  { id: 'prospects', label: 'Prospects', icon: Target },
  { id: 'clients', label: 'Clientes', icon: Users },
  { id: 'projects', label: 'Projetos', icon: Briefcase },
  { id: 'chat', label: 'Mensagens', icon: Bell },
  { id: 'meetings', label: 'Reuniões', icon: Calendar },
  { id: 'finance', label: 'Finanças', icon: CircleDollarSign },
  { id: 'settings', label: 'Definições', icon: Settings },
];

const TAB_META: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: 'Painel Geral', subtitle: 'Visão operacional e comercial em tempo real' },
  prospecting: { title: 'Prospeção Google Maps', subtitle: 'Descoberta de negócios locais e importação para CRM' },
  leads: { title: 'Pipeline de Leads', subtitle: 'Qualificação inicial e acompanhamento comercial' },
  prospects: { title: 'Pipeline de Prospects', subtitle: 'Reuniões, propostas apresentadas e fecho de negócio' },
  clients: { title: 'Clientes', subtitle: 'Diretório de entidades ativas e saldos financeiros' },
  projects: { title: 'Gestão de Projetos', subtitle: 'Execução, propostas, prazos e ficheiros Drive' },
  chat: { title: 'Centro de Mensagens', subtitle: 'Comunicação direta com clientes' },
  meetings: { title: 'Agenda de Reuniões', subtitle: 'Sincronização com Google Calendar & Meet' },
  finance: { title: 'Finanças', subtitle: 'Faturação, liquidações e receita recorrente' },
  settings: { title: 'Definições', subtitle: 'Bases de dados, pastas de nicho e acessos' },
  'client-profile': { title: 'Ficha da Entidade', subtitle: 'Informação completa, financeiro e documentação' },
};

export const Layout: React.FC<{ 
  children: React.ReactNode; 
  activeTab: string; 
  setActiveTab: (tab: string) => void;
  onLogout?: () => void;
}> = ({ children, activeTab, setActiveTab, onLogout }) => {
  const { isClientsLoaded, leads, accessToken, hasWorkspaceUser, login } = useWorkspace();
  const [isReconnecting, setIsReconnecting] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const handleReconnectWorkspace = async () => {
    setIsReconnecting(true);
    try {
      await login();
    } finally {
      setIsReconnecting(false);
    }
  };

  React.useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
    setMobileMenuOpen(false);
  }, [activeTab]);

  const porContactarCount = (leads || []).filter(l => l.status === 'Por contactar').length;
  const ligarMaisTardeCount = (leads || []).filter(l => l.status === 'Ligar mais tarde').length;

  const currentUser = auth.currentUser;
  const userEmail = currentUser?.email || 'alexandrecpsousa@gmail.com';
  const isVelaTeam = userEmail.toLowerCase() === 'vela.web.team@gmail.com';
  const userName = currentUser?.displayName || (isVelaTeam ? 'Vela Web Team' : userEmail.split('@')[0].replace('.', ' '));
  const userRole = isVelaTeam ? 'Equipa Web' : 'Diretor Criativo';
  const initials = isVelaTeam ? 'VW' : (currentUser?.displayName 
    ? currentUser.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() 
    : userEmail.slice(0, 2).toUpperCase());

  const tabMeta = TAB_META[activeTab] || { title: activeTab.replace('-', ' '), subtitle: 'Vela OS' };

  const SidebarContent = (
    <div className="flex flex-col h-full p-5 sm:p-6">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-2 pb-6 mb-4 border-b border-white/[0.06]">
        <VelaLogo 
          variant="horizontal" 
          className="h-10 w-auto object-contain"
        />
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.05] transition-colors"
          aria-label="Fechar menu"
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar pr-1">
        {navItems.map((item) => {
          const isLeads = item.id === 'leads';
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={cn(
                'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-[transform,background-color,border-color,color] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] group relative',
                isActive 
                  ? 'bg-white/[0.06] text-white border border-white/[0.08]' 
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.04] hover:border-white/[0.06] hover:translate-x-0.5 border border-transparent'
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                {isActive && (
                  <motion.div 
                    layoutId="activeTabGlow"
                    className="absolute left-0 w-1 h-5 bg-vela-red rounded-r-full"
                    transition={{ type: "spring", stiffness: 350, damping: 32 }}
                  />
                )}
                <item.icon 
                  size={17} 
                  className={cn(
                    'shrink-0 transition-[transform,color] duration-150',
                    isActive ? 'text-vela-red' : 'text-zinc-500 group-hover:text-zinc-200 group-hover:scale-105'
                  )} 
                />
                <span className="text-xs font-semibold tracking-wide font-sans truncate">
                  {item.label}
                </span>
              </div>

              {isLeads && (porContactarCount > 0 || ligarMaisTardeCount > 0) && (
                <div className="flex items-center gap-1 shrink-0 tabular-nums">
                  {porContactarCount > 0 && (
                    <span 
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/25 font-mono"
                      title="Leads Por Contactar"
                    >
                      {porContactarCount}
                    </span>
                  )}
                  {ligarMaisTardeCount > 0 && (
                    <span 
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-sky-500/15 text-sky-400 border border-sky-500/25 font-mono"
                      title="Leads Ligar Mais Tarde"
                    >
                      {ligarMaisTardeCount}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Account Footer */}
      <div className="mt-4 pt-4 border-t border-white/[0.06]">
        <div className="bg-white/[0.02] rounded-xl p-3 border border-white/[0.06] flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center text-[11px] font-bold font-sans text-zinc-300 shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{userName}</p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider truncate">{userRole}</p>
          </div>
          <button 
            type="button"
            onClick={onLogout}
            className="text-zinc-500 hover:text-vela-red hover:bg-vela-red/10 hover:scale-105 active:scale-95 rounded-lg transition-all duration-150 p-2 shrink-0"
            title="Terminar Sessão"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#0D0D0F] font-sans text-[#F5F5F7]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-white/[0.06] flex-col bg-[#0D0D0F] z-30">
        {SidebarContent}
      </aside>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative w-72 max-w-[85vw] h-full bg-[#0D0D0F] border-r border-white/10 z-10 flex flex-col"
            >
              {SidebarContent}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-dashboard relative min-w-0">
        {/* Progressive Loading Bar */}
        {!isClientsLoaded && (
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/5 overflow-hidden z-50">
            <motion.div 
              initial={{ left: "-100%" }}
              animate={{ left: "100%" }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="absolute top-0 bottom-0 w-1/3 bg-gradient-to-r from-transparent via-vela-red to-transparent"
            />
          </div>
        )}

        {/* Top Header */}
        <header className="h-16 sm:h-20 flex items-center justify-between gap-4 px-4 sm:px-8 lg:px-10 border-b border-white/[0.06] bg-[#0D0D0F]/70 backdrop-blur-xl z-20 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-1 rounded-xl bg-white/[0.04] border border-white/10 text-zinc-300 hover:text-white transition-colors shrink-0"
              aria-label="Abrir navegação"
            >
              <Menu size={18} />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight font-sans truncate">
                {tabMeta.title}
              </h1>
              <p className="text-[11px] text-zinc-500 truncate hidden sm:block">
                {tabMeta.subtitle}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            {hasWorkspaceUser && !accessToken && (
              <button
                type="button"
                onClick={handleReconnectWorkspace}
                disabled={isReconnecting}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 hover:-translate-y-[1px] active:translate-y-0 border border-amber-500/25 text-amber-300 text-[11px] font-bold transition-all duration-150 disabled:opacity-50 disabled:hover:translate-y-0"
                title="Reativar sincronização com Google Drive, Sheets e Calendar"
              >
                <RefreshCw size={13} className={isReconnecting ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">{isReconnecting ? 'A ligar...' : 'Reconectar Google Workspace'}</span>
                <span className="sm:hidden">{isReconnecting ? '...' : 'Reconectar'}</span>
              </button>
            )}
          </div>
        </header>

        {/* Scrollable Area */}
        <div
          ref={scrollContainerRef}
          className={cn(
            "flex-1 overflow-y-auto z-10 custom-scrollbar",
            activeTab === 'chat' ? "p-4 sm:p-6" : "px-4 sm:px-8 lg:px-10 py-6 sm:py-8"
          )}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className={activeTab === 'chat' ? "h-full" : "max-w-[1400px] mx-auto"}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};
