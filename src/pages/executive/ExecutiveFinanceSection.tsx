import { DonutChart } from '@/components/charts/DonutChart';
import { BarChart } from '@/components/charts/BarChart';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate, formatTaka } from '@/lib/format';
import type { ExecutiveDashboardData } from '@/lib/executiveDashboard';
import { SectionCard } from '@/pages/executive/SectionCard';

const MONTH_FORMAT = new Intl.DateTimeFormat('en-GB', { month: 'short', year: '2-digit' });

function formatMonth(isoMonth: string): string {
  return MONTH_FORMAT.format(new Date(`${isoMonth.slice(0, 7)}-01T00:00:00`));
}

export function ExecutiveFinanceSection({ data }: { data: ExecutiveDashboardData }) {
  const { funding, fundingSources, cashForecasts, upcomingDue } = data;
  const received = funding.fundingReceived;
  const planned = funding.fundingPlanned;
  const pending = funding.fundingExpected;
  const gap = funding.fundingGap;

  const forecasts = [...cashForecasts]
    .sort((a, b) => a.forecast_month.localeCompare(b.forecast_month))
    .slice(-12)
    .map((row) => ({
      label: formatMonth(row.forecast_month),
      primary: row.expected_inflow_bdt,
      secondary: row.expected_outflow_bdt,
    }));

  const bySource = fundingSources
    .filter((source) => source.status !== 'cancelled')
    .map((source) => ({ label: source.source_name, planned: source.planned_amount_bdt, received: source.received_amount_bdt }));

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="xl:col-span-2">
        <SectionCard title="Funding mix" description="How the planned construction funding is covered today.">
          <DonutChart
            segments={[
              { label: 'Received', value: received, color: '#0f766e' },
              { label: 'Planned, not yet received', value: pending, color: '#d97706' },
              { label: 'Unfunded gap', value: gap, color: '#be123c' },
            ]}
            centerLabel="Planned"
            centerValue={formatTaka(planned)}
          />
          {bySource.length > 0 && (
            <ul className="mt-6 divide-y divide-stone-100 border-t border-stone-100 pt-2">
              {bySource.map((source) => {
                const pct = source.planned > 0 ? Math.min((source.received / source.planned) * 100, 100) : 0;
                return (
                  <li key={source.label} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <span className="min-w-0 truncate font-medium text-stone-800">{source.label}</span>
                    <span className="shrink-0 text-stone-600">
                      {formatTaka(source.received)} of {formatTaka(source.planned)} <span className="text-stone-400">({Math.round(pct)}%)</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Upcoming payments" description="Unread reminders with a due date from today onward.">
        {upcomingDue.length === 0 ? (
          <p className="text-sm text-stone-500">No upcoming due items.</p>
        ) : (
          <ul className="space-y-3">
            {upcomingDue.map((item) => (
              <li key={item.id} className="rounded-xl border border-stone-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-sm font-medium text-stone-900">{item.title}</p>
                  <StatusBadge tone={item.severity === 'error' ? 'error' : 'warning'}>{formatDate(item.due_date ?? '')}</StatusBadge>
                </div>
                {item.message && <p className="mt-1 text-xs text-stone-500">{item.message}</p>}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <div className="xl:col-span-3">
        <SectionCard title="Cash flow forecast" description="Expected money in and money out for the next months on the plan.">
          {forecasts.length === 0 ? (
            <p className="text-sm text-stone-500">No cash flow forecast has been entered yet.</p>
          ) : (
            <BarChart data={forecasts} primaryLabel="Expected inflow" secondaryLabel="Expected outflow" formatValue={formatTaka} />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
