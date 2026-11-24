import React from 'react';
import { Repeat, Calendar } from 'lucide-react';
import { BillingFrequency, CustomIntervalUnit } from '../types';

interface RecurringBillingFieldsProps {
  frequency: BillingFrequency;
  onFrequencyChange: (val: BillingFrequency) => void;
  customIntervalValue: string;
  onCustomIntervalValueChange: (val: string) => void;
  customIntervalUnit: CustomIntervalUnit;
  onCustomIntervalUnitChange: (val: CustomIntervalUnit) => void;
  startDate: string;
  onStartDateChange: (val: string) => void;
  dateLabel?: string;
}

export const RecurringBillingFields: React.FC<RecurringBillingFieldsProps> = ({
  frequency,
  onFrequencyChange,
  customIntervalValue,
  onCustomIntervalValueChange,
  customIntervalUnit,
  onCustomIntervalUnitChange,
  startDate,
  onStartDateChange,
  dateLabel = 'Data da 1ª Cobrança'
}) => {
  return (
    <div className="space-y-3.5 p-4 bg-white/[0.02] border border-white/[0.08] rounded-2xl animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center gap-2">
        <Repeat size={13} className="text-vela-red" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300 font-sans">
          Configuração de Periodicidade
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-0.5 block">
            Periodicidade
          </label>
          <select
            value={frequency}
            onChange={(e) => onFrequencyChange(e.target.value as BillingFrequency)}
            className="w-full bg-[#16161A] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-vela-red/40 transition-all font-sans"
          >
            <option value="monthly" className="bg-zinc-900">Mensal (1 mês)</option>
            <option value="weekly" className="bg-zinc-900">Semanal (7 dias)</option>
            <option value="biweekly" className="bg-zinc-900">Quinzenal (14 dias)</option>
            <option value="quarterly" className="bg-zinc-900">Trimestral (3 meses)</option>
            <option value="semiannual" className="bg-zinc-900">Semestral (6 meses)</option>
            <option value="annual" className="bg-zinc-900">Anual (12 meses)</option>
            <option value="custom" className="bg-zinc-900">Personalizado</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-0.5 block">
            {dateLabel}
          </label>
          <div className="relative">
            <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-vela-red/40 transition-all font-sans"
              required
            />
          </div>
        </div>
      </div>

      {frequency === 'custom' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-0.5 block">
              Repetir a cada
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={customIntervalValue}
              onChange={(e) => onCustomIntervalValueChange(e.target.value)}
              placeholder="Ex: 2"
              required
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-vela-red/40 transition-all font-sans"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-0.5 block">
              Unidade
            </label>
            <select
              value={customIntervalUnit}
              onChange={(e) => onCustomIntervalUnitChange(e.target.value as CustomIntervalUnit)}
              className="w-full bg-[#16161A] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-vela-red/40 transition-all font-sans"
            >
              <option value="days" className="bg-zinc-900">Dias</option>
              <option value="weeks" className="bg-zinc-900">Semanas</option>
              <option value="months" className="bg-zinc-900">Meses</option>
              <option value="years" className="bg-zinc-900">Anos</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
