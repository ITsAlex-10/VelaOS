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
            initial={{ scale: 0.94, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md bg-[#0F0F12] border border-red-500/20 rounded-3xl overflow-hidden shadow-2xl shadow-red-950/40 p-6 sm:p-8"
          >
            {/* Top decorative glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-20 bg-red-600/15 blur-3xl pointer-events-none" />

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-5 right-5 p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-all"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>

            {/* Header Icon */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 shrink-0 shadow-lg shadow-red-500/10">
                <AlertTriangle size={24} strokeWidth={2} />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-red-400 font-sans">
                  Aviso de Confirmação
                </span>
                <h3 className="text-xl font-display font-bold text-white tracking-tight leading-tight mt-0.5">
                  Eliminar {itemType}?
                </h3>
              </div>
            </div>

            {/* Item Card */}
            <div className="bg-white/[0.02] border border-white/8 rounded-2xl p-4 mb-5">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600 font-sans">
                  Registo a remover
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/20">
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

            {/* Warning Text */}
            <p className="text-xs text-zinc-400 font-sans leading-relaxed mb-6">
              {warningNote || (
                <>
                  Tem a certeza de que deseja eliminar definitivamente{' '}
                  <strong className="text-white font-semibold">{itemName}</strong>?{' '}
                  Esta ação é irreversível e removerá todos os registos associados.
                </>
              )}
            </p>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3.5 px-4 rounded-xl text-xs font-display font-black uppercase tracking-wider text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 py-3.5 px-4 rounded-xl text-xs font-display font-black uppercase tracking-wider text-white bg-red-600 hover:bg-red-500 shadow-xl shadow-red-600/25 border border-red-500/30 transition-all flex items-center justify-center gap-2"
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
