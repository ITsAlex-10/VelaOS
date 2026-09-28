import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, CheckCircle2, AlertTriangle, X } from 'lucide-react';

interface BackgroundActionConfig<T = any> {
  title?: string;
  action: () => Promise<T>;
  errorMessage?: string;
  onSuccess?: (result: T) => void;
  onError?: (err: any) => void;
}

interface ErrorNotification {
  id: string;
  message: string;
  timestamp: number;
}

interface BackgroundActionContextType {
  runBackgroundAction: <T = any>(config: BackgroundActionConfig<T>) => Promise<T | undefined>;
  dismissError: (id: string) => void;
}

const BackgroundActionContext = createContext<BackgroundActionContextType | undefined>(undefined);

export const BackgroundActionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeCount, setActiveCount] = useState(0);
  const [currentTitle, setCurrentTitle] = useState<string>('A guardar alterações...');
  const [justCompleted, setJustCompleted] = useState(false);
  const [errors, setErrors] = useState<ErrorNotification[]>([]);
  
  const completionTimerRef = useRef<NodeJS.Timeout | null>(null);

  const dismissError = useCallback((id: string) => {
    setErrors(prev => prev.filter(e => e.id !== id));
  }, []);

  const runBackgroundAction = useCallback(async <T = any>(config: BackgroundActionConfig<T>): Promise<T | undefined> => {
    const { title = 'A guardar alterações...', action, errorMessage, onSuccess, onError } = config;
    
    // Clear any active completion timer
    if (completionTimerRef.current) {
      clearTimeout(completionTimerRef.current);
      completionTimerRef.current = null;
    }
    setJustCompleted(false);

    setCurrentTitle(title);
    setActiveCount(prev => prev + 1);

    try {
      const result = await action();
      
      setActiveCount(prev => {
        const next = Math.max(0, prev - 1);
        if (next === 0) {
          // Trigger brief subtle completion state
          setJustCompleted(true);
          completionTimerRef.current = setTimeout(() => {
            setJustCompleted(false);
            completionTimerRef.current = null;
          }, 1500);
        }
        return next;
      });

      if (onSuccess) {
        onSuccess(result);
      }
      return result;
    } catch (err: any) {
      console.error('Background action failed:', err);

      setActiveCount(prev => Math.max(0, prev - 1));
      setJustCompleted(false);

      const errorMsg = errorMessage || err?.message || 'Ocorreu um erro ao processar o pedido.';
      const newError: ErrorNotification = {
        id: Math.random().toString(36).substring(7),
        message: errorMsg,
        timestamp: Date.now()
      };

      setErrors(prev => [...prev.slice(-3), newError]);

      // Auto-dismiss error after 7 seconds
      setTimeout(() => {
        dismissError(newError.id);
      }, 7000);

      if (onError) {
        onError(err);
      }
      return undefined;
    }
  }, [dismissError]);

  return (
    <BackgroundActionContext.Provider value={{ runBackgroundAction, dismissError }}>
      {children}

      {/* Floating subtle indicators and notifications in bottom right */}
      <div className="fixed bottom-6 right-6 z-[99999] flex flex-col items-end gap-3 pointer-events-none max-w-sm">
        {/* Subtle Background Progress Indicator */}
        <AnimatePresence>
          {(activeCount > 0 || justCompleted) && (
            <motion.div
              key="subtle-progress-pill"
              initial={{ opacity: 0, y: 15, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#0e0e12]/95 border border-white/10 shadow-2xl shadow-black/80 backdrop-blur-xl"
            >
              {activeCount > 0 ? (
                <>
                  <div className="relative flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-vela-red animate-ping absolute" />
                    <span className="w-2 h-2 rounded-full bg-vela-red" />
                  </div>
                  <Loader2 size={13} className="animate-spin text-zinc-400 shrink-0" />
                  <span className="text-xs font-sans font-medium text-zinc-200 truncate max-w-[220px]">
                    {currentTitle}
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  <span className="text-xs font-sans font-medium text-emerald-300">
                    Alteração guardada
                  </span>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Notification Banners (Only displayed in case of error) */}
        <AnimatePresence>
          {errors.map((err) => (
            <motion.div
              key={err.id}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.9 }}
              transition={{ duration: 0.25 }}
              className="pointer-events-auto w-full flex items-start gap-3 p-4 rounded-2xl bg-[#180d0f]/98 border border-red-500/30 shadow-2xl shadow-red-950/60 backdrop-blur-2xl text-left"
            >
              <div className="w-8 h-8 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0 mt-0.5">
                <AlertTriangle size={16} />
              </div>
              <div className="flex-1 min-w-0 pr-1">
                <p className="text-xs font-bold text-white font-display uppercase tracking-wider">
                  Erro ao Processar
                </p>
                <p className="text-xs text-red-200/90 font-sans mt-0.5 leading-relaxed break-words">
                  {err.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => dismissError(err.id)}
                className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-all shrink-0"
                aria-label="Fechar notificação"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </BackgroundActionContext.Provider>
  );
};

export const useBackgroundAction = () => {
  const context = useContext(BackgroundActionContext);
  if (!context) {
    throw new Error('useBackgroundAction must be used within a BackgroundActionProvider');
  }
  return context;
};
