import { TrendingUp, TrendingDown, GitCompare, Trophy, Scale, ShieldCheck } from 'lucide-react';
import { Card, CardHeader } from '@/components/Card';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { formatTaka, formatDate } from '@/lib/format';
import {
  getBudgetGrowthPct,
  getTopBudgetDrivers,
  computeRevisionImpact,
} from '@/lib/comparisonScoring';
import { BUDGET_REVISION_TRIGGER_LABELS, type BudgetRevisionTrigger } from '@/types/database';
import type { ExecutiveDashboardData } from '@/lib/executiveDashboard';

interface Props {
  data: ExecutiveDashboardData;
}

function triggerLabel(trigger: string | null): string {
  if (!trigger) return 'Other';
  return BUDGET_REVISION_TRIGGER_LABELS[trigger as BudgetRevisionTrigger] ?? trigger;
}

export function ExecutiveRevisionSection({ data }: Props) {
  const { revisions, budgetLines, versions } = data;
  const growthPct = getBudgetGrowthPct(revisions);
  const drivers = getTopBudgetDrivers(
    budgetLines.map((l) => ({ category: l.category, budget_amount_bdt: Number(l.budget_amount_bdt) })),
  );
  const impacts = computeRevisionImpact(revisions);
  const active = versions.find((v) => v.is_active) ?? null;
  const lastRev = revisions[0] ?? null;
  const growthTrend = growthPct > 0 ? 'up' : growthPct < 0 ? 'down' : 'flat';

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Budget growth %"
          value={`${growthPct > 0 ? '+' : ''}${growthPct.toFixed(1)}%`}
          hint="From first to latest revision"
          icon={growthTrend === 'up' ? TrendingUp : TrendingDown}
          tone={growthPct > 10 ? 'error' : growthPct > 0 ? 'accent' : 'primary'}
        />
        <StatCard
          label="Total revisions"
          value={String(revisions.length)}
          hint="Approved budget versions"
          icon={TrendingUp}
          tone="primary"
        />
        <StatCard
          label="Last revision trigger"
          value={lastRev?.trigger_type ? triggerLabel(lastRev.trigger_type) : 'None'}
          hint={lastRev ? formatDate(lastRev.revision_date) : 'No revisions yet'}
          icon={TrendingUp}
          tone="accent"
        />
        <StatCard
          label="Current budget version"
          value={active?.version_label ?? 'None'}
          hint={active ? (active.status === 'approved' ? 'Frozen' : active.status) : 'No active version'}
          icon={TrendingUp}
          tone={active ? 'primary' : 'error'}
        />
      </div>

      {revisions.length > 0 && (
        <Card>
          <CardHeader
            title="Revision trend"
            description="Budget total changes across revisions with trigger types and impact."
          />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
                  <th className="py-2 pr-4 font-medium">Revision</th>
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium">Trigger</th>
                  <th className="py-2 pr-4 text-right font-medium">Previous</th>
                  <th className="py-2 pr-4 text-right font-medium">New total</th>
                  <th className="py-2 pr-4 text-right font-medium">Impact</th>
                  <th className="py-2 pr-4 font-medium">Cost driver</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {impacts.slice(0, 8).map((impact) => {
                  const previousTotal = Number(revisions.find((r) => r.id === impact.revisionId)?.previous_total_bdt ?? 0);
                  const newTotal = Number(revisions.find((r) => r.id === impact.revisionId)?.new_total_bdt ?? 0);
                  return (
                    <tr key={impact.revisionId}>
                      <td className="py-3 pr-4 font-medium text-stone-800">R{impact.revisionNumber}</td>
                      <td className="py-3 pr-4 text-stone-600">{formatDate(impact.date)}</td>
                      <td className="py-3 pr-4">
                        <StatusBadge tone="neutral">{triggerLabel(impact.triggerType)}</StatusBadge>
                      </td>
                      <td className="py-3 pr-4 text-right text-stone-600">{formatTaka(previousTotal)}</td>
                      <td className="py-3 pr-4 text-right font-semibold text-stone-900">{formatTaka(newTotal)}</td>
                      <td
                        className={
                          impact.impactAmount > 0
                            ? 'py-3 pr-4 text-right font-medium text-rose-700'
                            : 'py-3 pr-4 text-right font-medium text-emerald-700'
                        }
                      >
                        {impact.impactAmount > 0 ? '+' : ''}
                        {impact.impactPct.toFixed(1)}%
                      </td>
                      <td className="py-3 pr-4 text-stone-600">{impact.largestCostDriver ?? '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {drivers.length > 0 && (
        <Card>
          <CardHeader
            title="Top budget drivers"
            description="Largest cost categories in the active budget."
          />
          <div className="mt-4 space-y-3">
            {drivers.map((driver) => (
              <div key={driver.category} className="flex items-center justify-between gap-4">
                <StatusBadge tone="primary">{driver.category}</StatusBadge>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold text-stone-900">{formatTaka(driver.amount)}</span>
                  <span className="text-xs text-stone-500">{driver.pct.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Design comparison summary"
          description="Recommended package based on constructability, risk, and cost analysis."
        />
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-stone-200 p-4">
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-primary-700" aria-hidden />
                <p className="text-xs font-medium text-stone-500">Lowest cost</p>
              </div>
              <p className="mt-2 text-sm font-semibold text-stone-900">See comparison page</p>
              <p className="mt-1 text-xs text-stone-500">Package with the lowest estimated structural cost.</p>
            </div>
            <div className="rounded-lg border border-stone-200 p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden />
                <p className="text-xs font-medium text-stone-500">Lowest risk</p>
              </div>
              <p className="mt-2 text-sm font-semibold text-stone-900">See comparison page</p>
              <p className="mt-1 text-xs text-stone-500">Package with the lowest risk and best constructability.</p>
            </div>
            <div className="rounded-lg border border-stone-200 bg-primary-50/50 p-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-600" aria-hidden />
                <p className="text-xs font-medium text-stone-500">Best value (recommended)</p>
              </div>
              <p className="mt-2 text-sm font-semibold text-stone-900">See comparison page</p>
              <p className="mt-1 text-xs text-stone-500">Best balance of cost, constructability, and risk.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-stone-50 p-4">
            <GitCompare className="h-5 w-5 text-stone-400" aria-hidden />
            <p className="text-sm text-stone-600">
              Open the Design Comparison page for the full package-level comparison with live
              constructability scores, risk assessment, brick/floor/roof metrics, and all four
              recommendation types.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
