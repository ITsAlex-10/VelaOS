import React from 'react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className, hoverable = false, onClick }) => {
  const isInteractive = hoverable || !!onClick;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      className={cn(
        'glass rounded-2xl p-6 relative overflow-hidden inner-glow transition-[transform,background-color,border-color,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
        isInteractive && 'hover:-translate-y-0.5 hover:bg-[#19191F]/95 hover:border-white/[0.15] hover:shadow-[0_10px_28px_-14px_rgba(0,0,0,0.75)]',
        onClick && 'active:translate-y-0 active:scale-[0.995]',
        className
      )}
    >
      <div className="relative z-10 h-full">
        {children}
      </div>
    </motion.div>
  );
};

export const Badge: React.FC<{
  children: React.ReactNode;
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'info' | 'blue' | 'primary' | 'orange' | 'yellow' | 'red';
  className?: string;
}> = ({ children, variant = 'default', className }) => {
  const variants = {
    default: 'bg-white/[0.04] text-zinc-400 border border-white/[0.07]',
    secondary: 'bg-white/[0.04] text-zinc-400 border border-white/[0.07]',
    success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    info: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
    blue: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
    primary: 'bg-vela-red/10 text-vela-red border border-vela-red/20',
    orange: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
    yellow: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
    red: 'bg-red-500/10 text-red-400 border border-red-500/20',
  };
  
  return (
    <span className={cn('px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-[0.12em] font-sans shrink-0 whitespace-nowrap', variants[variant], className)}>
      {children}
    </span>
  );
};

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'success';
  }
> = ({ children, className, variant = 'primary', ...props }) => {
  const variants = {
    primary: 'bg-vela-red text-white hover:bg-[#FF3630] shadow-lg shadow-vela-red/20 hover:shadow-vela-red/30 border border-vela-red/25',
    secondary: 'bg-white/[0.04] text-zinc-200 border border-white/10 hover:bg-white/[0.08] hover:text-white hover:border-white/20',
    outline: 'bg-transparent text-zinc-300 border border-white/10 hover:bg-white/[0.05] hover:text-white hover:border-white/25',
    ghost: 'text-zinc-400 hover:text-white hover:bg-white/[0.06] border border-transparent',
    success: 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400 border border-emerald-400/30 shadow-lg shadow-emerald-500/15 hover:shadow-emerald-500/25',
  };
  
  return (
    <motion.button
      whileTap={{ scale: 0.985 }}
      className={cn(
        'px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-[transform,background-color,border-color,box-shadow,color] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-[1px] active:translate-y-0 disabled:hover:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 whitespace-nowrap',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  size = 'md',
  children,
}) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-2xl',
    xl: 'max-w-3xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md" 
      />
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          'relative w-full bg-[#121215]/95 backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl shadow-black/70 flex flex-col max-h-[90vh]',
          sizeClasses[size]
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-5 sm:px-7 border-b border-white/[0.07] shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm font-black text-white uppercase tracking-[0.16em] font-sans truncate">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-zinc-400 font-sans mt-1 truncate">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela"
            className="p-2 -mr-1.5 -mt-1 rounded-xl text-zinc-500 hover:text-white hover:bg-white/[0.07] hover:scale-105 active:scale-95 transition-all duration-150 shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div className="px-6 py-5 sm:px-7 sm:py-6 overflow-y-auto flex-1 custom-scrollbar">
          {children}
        </div>
      </motion.div>
    </div>
  );
};

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
  containerClassName?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  icon,
  containerClassName,
  className,
  ...props
}) => (
  <div className={cn("space-y-1.5", containerClassName)}>
    {label && (
      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-0.5 block font-sans">
        {label}
        {props.required && <span className="text-vela-red ml-1">*</span>}
      </label>
    )}
    <div className="relative">
      {icon && (
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none flex items-center">
          {icon}
        </div>
      )}
      <input
        className={cn(
          "w-full bg-white/[0.03] border border-white/10 hover:border-white/20 rounded-xl py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-vela-red/45 focus:bg-white/[0.05] transition-[border-color,background-color] duration-150 font-sans disabled:opacity-50 disabled:hover:border-white/10",
          icon ? "pl-10 pr-4" : "px-4",
          className
        )}
        {...props}
      />
    </div>
  </div>
);

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  containerClassName?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  containerClassName,
  children,
  className,
  ...props
}) => (
  <div className={cn("space-y-1.5", containerClassName)}>
    {label && (
      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-0.5 block font-sans">
        {label}
        {props.required && <span className="text-vela-red ml-1">*</span>}
      </label>
    )}
    <div className="relative">
      <select
        className={cn(
          "w-full bg-[#16161A] border border-white/10 hover:border-white/20 rounded-xl pl-4 pr-10 py-2.5 text-sm text-white focus:outline-none focus:border-vela-red/45 transition-colors duration-150 font-sans appearance-none disabled:opacity-50 disabled:hover:border-white/10 cursor-pointer",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </div>
    </div>
  </div>
);
