import { BillingFrequency, CustomIntervalUnit, RecurringBillingConfig } from '../types';

export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function calculateNextBillingDate(
  fromDateStr: string,
  frequency: BillingFrequency,
  customValue?: number,
  customUnit?: CustomIntervalUnit
): string {
  const parts = (fromDateStr || getTodayISO()).split('-').map(Number);
  const year = parts[0] || new Date().getFullYear();
  const month = (parts[1] || (new Date().getMonth() + 1)) - 1;
  const day = parts[2] || new Date().getDate();

  const date = new Date(year, month, day);

  const addMonthsClamped = (d: Date, monthsToAdd: number) => {
    const targetDay = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthsToAdd);
    const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(targetDay, maxDay));
  };

  switch (frequency) {
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'biweekly':
      date.setDate(date.getDate() + 14);
      break;
    case 'monthly':
      addMonthsClamped(date, 1);
      break;
    case 'quarterly':
      addMonthsClamped(date, 3);
      break;
    case 'semiannual':
      addMonthsClamped(date, 6);
      break;
    case 'annual':
      addMonthsClamped(date, 12);
      break;
    case 'custom': {
      const val = Math.max(1, Math.floor(customValue || 1));
      const unit = customUnit || 'days';
      if (unit === 'days') {
        date.setDate(date.getDate() + val);
      } else if (unit === 'weeks') {
        date.setDate(date.getDate() + val * 7);
      } else if (unit === 'months') {
        addMonthsClamped(date, val);
      } else if (unit === 'years') {
        addMonthsClamped(date, val * 12);
      }
      break;
    }
    default:
      addMonthsClamped(date, 1);
  }

  const resY = date.getFullYear();
  const resM = String(date.getMonth() + 1).padStart(2, '0');
  const resD = String(date.getDate()).padStart(2, '0');
  return `${resY}-${resM}-${resD}`;
}

export function formatFrequencyLabel(config?: Partial<RecurringBillingConfig> | null): string {
  if (!config?.frequency) return 'Mensal';
  switch (config.frequency) {
    case 'weekly':
      return 'Semanal';
    case 'biweekly':
      return 'Quinzenal';
    case 'monthly':
      return 'Mensal';
    case 'quarterly':
      return 'Trimestral';
    case 'semiannual':
      return 'Semestral';
    case 'annual':
      return 'Anual';
    case 'custom': {
      const val = Math.max(1, config.customIntervalValue || 1);
      const unit = config.customIntervalUnit || 'days';
      const unitLabels: Record<CustomIntervalUnit, [string, string]> = {
        days: ['dia', 'dias'],
        weeks: ['semana', 'semanas'],
        months: ['mês', 'meses'],
        years: ['ano', 'anos']
      };
      const [singular, plural] = unitLabels[unit] || ['dia', 'dias'];
      return `A cada ${val} ${val === 1 ? singular : plural}`;
    }
    default:
      return 'Mensal';
  }
}

export function calculateMonthlyEquivalent(config?: RecurringBillingConfig | null): number {
  if (!config || !config.enabled || !config.active || !config.amount) return 0;
  const amount = Number(config.amount) || 0;

  switch (config.frequency) {
    case 'weekly':
      return amount * (52 / 12);
    case 'biweekly':
      return amount * (26 / 12);
    case 'monthly':
      return amount;
    case 'quarterly':
      return amount / 3;
    case 'semiannual':
      return amount / 6;
    case 'annual':
      return amount / 12;
    case 'custom': {
      const val = Math.max(1, config.customIntervalValue || 1);
      const unit = config.customIntervalUnit || 'days';
      if (unit === 'days') return amount * (30.4375 / val);
      if (unit === 'weeks') return amount * (52 / 12 / val);
      if (unit === 'months') return amount / val;
      if (unit === 'years') return amount / (val * 12);
      return amount;
    }
    default:
      return amount;
  }
}
