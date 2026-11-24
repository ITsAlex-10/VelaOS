import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { useBackgroundAction } from '../contexts/BackgroundActionContext';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  itemName: string;
  itemType?: 'Lead' | 'Cliente' | 'Entidade' | string;
  subtitle?: string;
  warningNote?: string;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  itemType = 'Entidade',
  subtitle,
  warningNote
}) => {
  const { runBackgroundAction } = useBackgroundAction();

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleConfirm = () => {
    // 1. Close popup IMMEDIATELY
    onClose();

    // 2. Process action in background with subtle progress indicator
    runBackgroundAction({
      title: `A eliminar ${itemType.toLowerCase()} "${itemName}"...`,
      action: async () => {
        await onConfirm();
      },
      errorMessage: `Erro ao eliminar ${itemType.toLowerCase()} "${itemName}". Tente novamente.`
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop with blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/85 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 12 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-md bg-[#121215]/95 backdrop-blur-2xl border border-red-500/20 rounded-3xl overflow-hidden shadow-2xl shadow-black/70"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-white/[0.06]">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-500 shrink-0">
                  <AlertTriangle size={20} strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-red-400 font-sans block">
                    Confirmar Eliminação
                  </span>
                  <h3 className="text-lg font-display font-bold text-white tracking-tight leading-tight mt-0.5 truncate">
                    Eliminar {itemType}?
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 -mr-1.5 -mt-1 rounded-xl text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors shrink-0"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 font-sans">
                    Registo selecionado
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/20">
                    {itemType}
                  </span>
                </div>
                <p className="text-base font-bold text-white font-display truncate">
                  {itemName}
                </p>
                {subtitle && (
                  <p className="text-xs text-zinc-400 font-sans truncate mt-0.5">
                    {subtitle}
                  </p>
                )}
              </div>

              <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                {warningNote || (
                  <>
                    Tem a certeza de que deseja eliminar definitivamente{' '}
                    <strong className="text-white font-semibold">{itemName}</strong>?{' '}
                    Esta ação é irreversível e removerá todos os registos associados.
                  </>
                )}
              </p>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-white/[0.015] border-t border-white/[0.06] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-zinc-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-red-600 hover:bg-red-500 shadow-lg shadow-red-600/20 border border-red-500/30 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <Trash2 size={14} />
                <span>Eliminar Definitivamente</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
