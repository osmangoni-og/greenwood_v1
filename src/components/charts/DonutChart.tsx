interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  centerLabel: string;
  centerValue: string;
}

const RADIUS = 48;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function DonutChart({ segments, centerLabel, centerValue }: DonutChartProps) {
  const total = segments.reduce((sum, segment) => sum + Math.max(segment.value, 0), 0);
  let cumulative = 0;

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" role="img" aria-label={`${centerLabel}: ${centerValue}`}>
          <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="#f5f5f4" strokeWidth="16" />
          {total > 0 &&
            segments.map((segment) => {
              const length = (Math.max(segment.value, 0) / total) * CIRCUMFERENCE;
              const offset = -cumulative;
              cumulative += length;
              return (
                <circle
                  key={segment.label}
                  cx="60"
                  cy="60"
                  r={RADIUS}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="16"
                  strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                  strokeDashoffset={offset}
                  className="transition-all duration-700"
                >
                  <title>{`${segment.label}: ${segment.value.toLocaleString('en-US')}`}</title>
                </circle>
              );
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] font-medium uppercase tracking-wide text-stone-500">{centerLabel}</span>
          <span className="text-sm font-semibold text-stone-900">{centerValue}</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-stone-700">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} aria-hidden />
              <span className="truncate">{segment.label}</span>
            </span>
            <span className="shrink-0 font-medium text-stone-900">{total > 0 ? `${Math.round((segment.value / total) * 100)}%` : '0%'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
