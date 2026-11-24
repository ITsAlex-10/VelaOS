import React from 'react';
import { Calendar, CheckCircle2, FolderClock, Sparkles, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface ProjectOriginFieldsProps {
  isNewProject: boolean;
  onIsNewProjectChange: (isNew: boolean) => void;
  startDate: string;
  onStartDateChange: (date: string) => void;
  endDate: string;
  onEndDateChange: (date: string) => void;
  dateError?: string | null;
}

export const ProjectOriginFields: React.FC<ProjectOriginFieldsProps> = ({
  isNewProject,
  onIsNewProjectChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  dateError
}) => {
  return (
    <div className="space-y-3.5">
      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 font-sans block ml-0.5">
          Este projeto é novo?
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => {
              onIsNewProjectChange(true);
              onEndDateChange('');
            }}
            className={cn(
              "py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2",
              isNewProject
                ? "bg-vela-red border-vela-red text-white shadow-lg shadow-vela-red/15"
                : "bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white hover:border-white/20"
            )}
          >
            <Sparkles size={13} />
            Sim, Projeto Novo
          </button>
          <button
            type="button"
            onClick={() => onIsNewProjectChange(false)}
            className={cn(
              "py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2",
              !isNewProject
                ? "bg-vela-red border-vela-red text-white shadow-lg shadow-vela-red/15"
                : "bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white hover:border-white/20"
            )}
          >
            <FolderClock size={13} />
            Não, Já Existente
          </button>
        </div>
      </div>

      {!isNewProject && (
        <div className="space-y-3 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 font-sans block ml-0.5">
                Data de Início do Projeto <span className="text-vela-red">*</span>
              </label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => onStartDateChange(e.target.value)}
                  required={!isNewProject}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-vela-red/40 transition-all font-sans"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between ml-0.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 font-sans">
                  Data de Fim (Opcional)
                </label>
                {endDate && (
                  <button
                    type="button"
                    onClick={() => onEndDateChange('')}
                    className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white flex items-center gap-1"
                  >
                    <X size={10} /> Limpar
                  </button>
                )}
              </div>
              <div className="relative">
                <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                <input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => onEndDateChange(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-vela-red/40 transition-all font-sans"
                />
              </div>
            </div>
          </div>

          {dateError && (
            <p className="text-xs text-red-400 font-medium pl-0.5">{dateError}</p>
          )}

          {endDate && !dateError && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 leading-relaxed">
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Regra automática:</strong> Como foi marcada uma data de fim, o valor registado do projeto ficará automaticamente <strong>100% liquidado</strong> e o projeto será registado como <strong>Terminado</strong>.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
