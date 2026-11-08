import { AlertTriangle, BarChart3, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardHeader } from '@/components/Card';
import { ProgressBar } from '@/components/ProgressBar';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/StatePanel';
import { cx } from '@/lib/cx';
import { formatDate, formatTaka } from '@/lib/format';
import { buildMaterialInflation, buildPriceIncreaseAlerts, PRICE_ALERT_THRESHOLD_PERCENT, type MaterialInflationRow } from '@/lib/rateInflation';
import { RATE_MATERIAL_LABELS, type MaterialRateHistoryRow } from '@/types/database';

const ALERT_LIMIT = 10;

function signedPercent(value: number | null): string {
  if (value === null) return 'Not enough history';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

export function InflationSection({ rows }: { rows: MaterialRateHistoryRow[] }) {
  if (!rows.length) {
    return <EmptyState icon={BarChart3} title="No inflation data yet" description="Record at least two purchase rates for a material to see price movement and alerts." />;
  }

  const inflation = buildMaterialInflation(rows);
  const alerts = buildPriceIncreaseAlerts(rows);
  const tracked = inflation.filter((row) => row.inflationPercent !== null);
  const highest = tracked[0] ?? null;
  const maxAbsolute = Math.max(1, ...tracked.map((row) => Math.abs(row.inflationPercent ?? 0)));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Materials tracked" value={String(inflation.length)} hint="Material and unit combinations" icon={BarChart3} />
        <StatCard label="Highest inflation" value={highest ? signedPercent(highest.inflationPercent) : 'No data'} hint={highest ? RATE_MATERIAL_LABELS[highest.material] : 'Needs two months of rates'} icon={TrendingUp} tone="error" />
        <StatCard label="Price increase alerts" value={String(alerts.length)} hint={`Rises of ${PRICE_ALERT_THRESHOLD_PERCENT}% or more`} icon={AlertTriangle} tone="accent" />
      </div>

      <Card>
        <CardHeader title="Material inflation" description="Change in monthly average rate from the first to the latest recorded month" />
        <div className="mt-4 space-y-4">
          {inflation.map((row) => (
            <InflationRow key={row.key} row={row} maxAbsolute={maxAbsolute} />
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Price increase alerts" description={`Purchases at least ${PRICE_ALERT_THRESHOLD_PERCENT}% above the previous recorded rate for the same material`} />
        {alerts.length ? (
          <ul className="mt-4 divide-y divide-stone-100">
            {alerts.slice(0, ALERT_LIMIT).map((alert) => (
              <li key={alert.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-stone-800">{RATE_MATERIAL_LABELS[alert.material]} <span className="text-stone-500">per {alert.unit}</span></p>
                  <p className="text-xs text-stone-500">{formatDate(alert.date)} · {formatTaka(alert.previousRate)} to {formatTaka(alert.rate)}</p>
                </div>
                <StatusBadge tone="error">+{alert.changePercent.toFixed(1)}%</StatusBadge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-stone-500">No price increases at or above the alert threshold.</p>
        )}
        {alerts.length > ALERT_LIMIT && <p className="mt-3 text-xs text-stone-500">Showing the {ALERT_LIMIT} most recent of {alerts.length} alerts.</p>}
      </Card>
    </div>
  );
}

function InflationRow({ row, maxAbsolute }: { row: MaterialInflationRow; maxAbsolute: number }) {
  const change = row.inflationPercent;
  const rising = change !== null && change > 0;
  const width = change === null ? 0 : (Math.abs(change) / maxAbsolute) * 100;

  return (
    <div className="rounded-xl border border-stone-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-stone-900">{RATE_MATERIAL_LABELS[row.material]} <span className="font-normal text-stone-500">per {row.unit}</span></p>
          <p className="mt-1 text-xs text-stone-500">
            {row.monthsTracked > 1 ? `${monthLabel(row.firstMonth)} to ${monthLabel(row.latestMonth)}` : `Only ${monthLabel(row.latestMonth)} recorded`}
          </p>
        </div>
        <div className="text-right">
          <p className={cx('flex items-center justify-end gap-1 text-sm font-semibold', rising ? 'text-rose-700' : change === null ? 'text-stone-500' : 'text-emerald-700')}>
            {change !== null && (rising ? <TrendingUp className="h-4 w-4" aria-hidden /> : <TrendingDown className="h-4 w-4" aria-hidden />)}
            {signedPercent(change)}
          </p>
          <p className="mt-1 text-xs text-stone-500">Latest avg {formatTaka(row.latestAverage)}</p>
        </div>
      </div>
      {change !== null && (
        <div className="mt-3">
          <ProgressBar value={width} tone={rising ? 'error' : 'primary'} label={`${RATE_MATERIAL_LABELS[row.material]} inflation magnitude`} />
        </div>
      )}
      {row.latestMonthChangePercent !== null && (
        <p className="mt-2 text-xs text-stone-500">Latest month vs previous: {signedPercent(row.latestMonthChangePercent)}</p>
      )}
    </div>
  );
}
