import { cx } from '@/lib/cx';

export type ProgressTone = 'primary' | 'accent' | 'warning' | 'error';

const BAR_CLASSES: Record<ProgressTone, string> = {
  primary: 'bg-primary-600',
  accent: 'bg-accent-500',
  warning: 'bg-amber-500',
  error: 'bg-rose-500',
};

interface ProgressBarProps {
  value: number;
  tone?: ProgressTone;
  label: string;
}

export function ProgressBar({ value, tone = 'primary', label }: ProgressBarProps) {
  const clamped = Math.min(Math.max(value, 0), 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className="h-2.5 w-full overflow-hidden rounded-full bg-stone-200"
    >
      <div
        className={cx('h-full rounded-full transition-[width] duration-700 ease-out', BAR_CLASSES[tone])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
