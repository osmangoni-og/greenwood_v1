import type { LucideIcon } from 'lucide-react';
import { cx } from '@/lib/cx';

const TONE_CLASSES = {
  primary: 'bg-primary-50 text-primary-700',
  accent: 'bg-accent-50 text-accent-700',
  error: 'bg-rose-50 text-rose-700',
} as const;

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: keyof typeof TONE_CLASSES;
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'primary' }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-stone-500">{label}</p>
        <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', TONE_CLASSES[tone])}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-stone-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}
