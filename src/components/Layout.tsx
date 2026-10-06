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
  ChevronRight,
  LogOut,
  Compass,
  UserCheck,
  Target
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './UI';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { auth } from '../lib/firebase';
import { VelaLogo } from './VelaLogo';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

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

export const Layout: React.FC<{ 
  children: React.ReactNode; 
  activeTab: string; 
  setActiveTab: (tab: string) => void;
  onLogout?: () => void;
}> = ({ children, activeTab, setActiveTab, onLogout }) => {
  const { clients, isClientsLoaded, leads } = useWorkspace();
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
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

  return (
    <div className="flex h-screen overflow-hidden bg-[#0D0D0F] font-sans">
      {/* Sidebar */}
      <aside className="w-72 border-r border-white/5 flex flex-col p-8 space-y-12 bg-[#0D0D0F] z-50">
        <div className="flex items-center px-1">
          <VelaLogo 
            variant="horizontal" 
            className="h-20" 
            style={{
              width: '99999px',
              height: '99999px',
              marginBottom: '-50px',
              paddingTop: '0px',
              marginTop: '-30px'
            }}
          />
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const isLeads = item.id === 'leads';
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  'w-full flex items-center justify-between px-5 py-4 rounded-xl transition-all duration-300 group relative',
                  activeTab === item.id 
                    ? 'bg-white/[0.04] text-white inner-glow border border-white/5 focus:outline-none' 
                    : 'text-zinc-500 hover:text-white hover:bg-white/[0.02]'
                )}
              >
                <div className="flex items-center gap-4">
                  {activeTab === item.id && (
                     <motion.div 
                       layoutId="activeTabGlow"
                       className="absolute left-0 w-1 h-6 bg-vela-red rounded-r-full"
                       transition={{ type: "spring", stiffness: 300, damping: 30 }}
                     />
                  )}
                  <item.icon 
                    size={18} 
                    className={cn('transition-all', activeTab === item.id ? 'text-vela-red' : 'opacity-40 group-hover:opacity-100 group-hover:scale-110')} 
                  />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] font-sans">{item.label}</span>
                </div>

                {isLeads && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {porContactarCount > 0 && (
                      <span 
                        className="text-[8px] font-black px-1.5 py-0.5 rounded bg-amber-500 text-zinc-950 font-mono shadow-sm shadow-amber-500/30"
                        title="Leads Por Contactar"
                      >
                        {porContactarCount}
                      </span>
                    )}
                    {ligarMaisTardeCount > 0 && (
                      <span 
                        className="text-[8px] font-black px-1.5 py-0.5 rounded bg-sky-500 text-white font-mono shadow-sm shadow-sky-500/30"
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

        <div className="mt-auto pt-8 border-t border-white/5">
          <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5 flex items-center gap-4 group hover:bg-white/[0.04] transition-all cursor-pointer">
            <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center text-[10px] font-black font-sans text-zinc-500 group-hover:text-white transition-colors">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-normal text-white uppercase tracking-widest truncate">{userName}</p>
              <p className="text-[9px] text-zinc-600 font-normal uppercase tracking-widest mt-1 truncate">{userRole}</p>
            </div>
            <button 
              onClick={onLogout}
              className="text-zinc-600 hover:text-vela-red transition-colors p-2"
              title="Terminar Sessão"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-dashboard relative">
        {/* PROGRESSIVE LOADING BAR */}
        {!isClientsLoaded && (
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-white/5 overflow-hidden z-50">
            <motion.div 
              initial={{ left: "-100%" }}
              animate={{ left: "100%" }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="absolute top-0 bottom-0 w-1/3 bg-gradient-to-r from-transparent via-vela-red to-transparent"
            />
          </div>
        )}

        {/* Top Navbar */}
        <header className="h-24 flex items-center justify-between px-12 z-10 shrink-0">
          <div className="space-y-1">
            <h1 className="text-sm font-black text-white uppercase tracking-[0.3em] font-sans">
              {activeTab === 'dashboard' ? 'Painel de Inteligência' : 
               activeTab === 'leads' ? 'Pipeline de Leads & Oportunidades' :
               activeTab === 'clients' ? 'Clientes' :
               activeTab === 'projects' ? 'Gestão de Projetos' :
               activeTab === 'prospecting' ? 'Prospeção Google Maps' :
               activeTab === 'chat' ? 'Centro de Mensagens' :
               activeTab === 'meetings' ? 'Agenda de Reuniões' :
               activeTab === 'finance' ? 'Fluxo de Capital' :
               activeTab === 'settings' ? 'Definições do Sistema' :
               activeTab.replace('-', ' ')}
            </h1>
            <div className="h-0.5 w-12 bg-vela-red" />
          </div>
          
          <div />
        </header>

        {/* Scrollable Area */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto z-10 custom-scrollbar p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};
