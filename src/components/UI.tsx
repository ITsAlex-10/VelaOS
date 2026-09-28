import React from 'react';
import { cn } from '../lib/utils';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className, hoverable = false, onClick }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseX = useSpring(x, { stiffness: 150, damping: 20 });
  const mouseY = useSpring(y, { stiffness: 150, damping: 20 });

  const rotateX = useTransform(mouseY, [-0.5, 0.5], [7, -7]);
  const rotateY = useTransform(mouseX, [-0.5, 0.5], [-7, 7]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!hoverable) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseXPos = e.clientX - rect.left;
    const mouseYPos = e.clientY - rect.top;
    const xPct = (mouseXPos / width) - 0.5;
    const yPct = (mouseYPos / height) - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={cn(
        'glass rounded-2xl p-8 transition-all duration-300 relative group overflow-hidden inner-glow transform-gpu',
        (hoverable || onClick) && 'hover:bg-white/[0.04] hover:border-white/20 active:scale-[0.99]',
        className
      )}
      style={{ backfaceVisibility: 'hidden' }}
    >
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
};

export const Badge: React.FC<{ children: React.ReactNode; variant?: 'default' | 'success' | 'warning' | 'info' | 'primary' | 'orange' | 'yellow' | 'red'; className?: string }> = ({ children, variant = 'default', className }) => {
  const variants = {
    default: 'bg-white/5 text-zinc-500 border border-white/5',
    success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10',
    warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/10',
    info: 'bg-blue-500/10 text-blue-400 border border-blue-500/10',
    primary: 'bg-vela-red/10 text-vela-red border border-vela-red/20',
    orange: 'bg-orange-500/10 text-orange-400 border border-orange-500/10',
    yellow: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/10',
    red: 'bg-red-500/10 text-red-500 border border-red-500/10',
  };
  
  return (
    <span className={cn('px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-[0.15em] font-sans shrink-0 whitespace-nowrap', variants[variant], className)}>
      {children}
    </span>
  );
};

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }> = ({ children, className, variant = 'primary', ...props }) => {
  const variants = {
    primary: 'bg-vela-red text-white hover:bg-vela-red/90 shadow-xl shadow-vela-red/20',
    secondary: 'bg-white/5 text-zinc-300 border border-white/5 hover:bg-white/10 hover:border-white/10',
    ghost: 'text-zinc-500 hover:text-white hover:bg-white/5',
  };
  
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      className={cn(
        'px-6 py-3 rounded-xl text-xs font-normal uppercase tracking-widest transition-all disabled:opacity-50 inline-flex items-center justify-center gap-3',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
};

export const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-12">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative w-full max-w-xl glass border-white/10 rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="flex items-center justify-between p-8 border-b border-white/5">
          <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] font-sans">{title}</h3>
          <button onClick={onClose} className="p-2 -mr-2 text-zinc-500 hover:text-white transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div className="p-8 max-h-[70vh] overflow-y-auto">
          {children}
        </div>
      </motion.div>
    </div>
  );
};

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string }> = ({ label, className, ...props }) => (
  <div className="space-y-2 mb-6">
    {label && <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">{label}</label>}
    <input
      className={cn(
        "w-full bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-vela-red/30 transition-all font-sans",
        className
      )}
      {...props}
    />
  </div>
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }> = ({ label, children, className, ...props }) => (
  <div className="space-y-2 mb-6">
    {label && <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">{label}</label>}
    <div className="relative">
      <select
        className={cn(
          "w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-vela-red/30 transition-all font-sans appearance-none",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </div>
    </div>
  </div>
);
