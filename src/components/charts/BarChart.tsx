export interface BarDatum {
  label: string;
  primary: number;
  secondary?: number;
}

interface BarChartProps {
  data: BarDatum[];
  primaryLabel: string;
  secondaryLabel?: string;
  formatValue: (value: number) => string;
}

export function BarChart({ data, primaryLabel, secondaryLabel, formatValue }: BarChartProps) {
  const max = Math.max(1, ...data.flatMap((datum) => [datum.primary, datum.secondary ?? 0]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 text-xs text-stone-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-primary-600" aria-hidden /> {primaryLabel}
        </span>
        {secondaryLabel && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-accent-500" aria-hidden /> {secondaryLabel}
          </span>
        )}
      </div>
      <div className="flex h-48 items-end gap-3 border-b border-stone-200 pb-px">
        {data.map((datum) => (
          <div key={datum.label} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1">
            <div className="flex h-full items-end justify-center gap-1">
              <div
                className="w-full max-w-[18px] rounded-t-md bg-primary-600 transition-all duration-700"
                style={{ height: `${(datum.primary / max) * 100}%` }}
                title={`${primaryLabel} ${datum.label}: ${formatValue(datum.primary)}`}
              />
              {datum.secondary !== undefined && (
                <div
                  className="w-full max-w-[18px] rounded-t-md bg-accent-500 transition-all duration-700"
                  style={{ height: `${((datum.secondary ?? 0) / max) * 100}%` }}
                  title={`${secondaryLabel ?? ''} ${datum.label}: ${formatValue(datum.secondary)}`}
                />
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        {data.map((datum) => (
          <p key={datum.label} className="min-w-0 flex-1 truncate text-center text-[11px] text-stone-500">
            {datum.label}
          </p>
        ))}
      </div>
    </div>
  );
}
