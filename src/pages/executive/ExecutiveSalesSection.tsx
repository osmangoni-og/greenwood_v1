import { ProgressBar } from '@/components/ProgressBar';
import { StatusBadge } from '@/components/StatusBadge';
import { ASSET_TYPE_LABELS, LAND_SALE_RECOMMENDATION_LABELS, RATE_MATERIAL_LABELS, type LandSaleRecommendation } from '@/types/database';
import { formatDate, formatLabel, formatTaka } from '@/lib/format';
import type { ExecutiveDashboardData } from '@/lib/executiveDashboard';
import { SectionCard } from '@/pages/executive/SectionCard';

const RECOMMENDATION_TONE: Record<LandSaleRecommendation, 'error' | 'warning' | 'neutral' | 'success'> = {
  sell_immediately: 'error',
  sell_if_needed: 'warning',
  hold: 'neutral',
  protected_asset: 'success',
};

const OFFER_TONE: Record<string, 'neutral' | 'warning' | 'success' | 'error'> = {
  received: 'neutral',
  negotiating: 'warning',
  accepted: 'success',
  rejected: 'error',
  expired: 'error',
};

export function ExecutiveSalesSection({ data }: { data: ExecutiveDashboardData }) {
  const { assets, assetProgress, highestOffer, landRanking, rateTrends } = data;
  const soldPct = assetProgress.totalCount > 0 ? (assetProgress.soldCount / assetProgress.totalCount) * 100 : 0;

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <SectionCard title="Asset sale progress" description="Sold assets against everything on the monetization list.">
        <div className="space-y-5">
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-3xl font-semibold tabular-nums text-stone-900">{Math.round(soldPct)}%</span>
              <span className="text-sm text-stone-600">
                {assetProgress.soldCount} of {assetProgress.totalCount} sold
              </span>
            </div>
            <div className="mt-3">
              <ProgressBar value={soldPct} label="Assets sold" tone="accent" />
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-4 border-t border-stone-100 pt-4 text-sm">
            <div>
              <dt className="text-xs text-stone-500">Sold value</dt>
              <dd className="mt-1 font-medium text-stone-900">{formatTaka(assetProgress.soldValue)}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Estimated value</dt>
              <dd className="mt-1 font-medium text-stone-900">{formatTaka(assetProgress.estimatedValue)}</dd>
            </div>
          </dl>
          {assets.length > 0 && (
            <ul className="divide-y divide-stone-100 border-t border-stone-100">
              {assets.map((asset) => (
                <li key={asset.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0 truncate text-stone-800">
                    {asset.asset_name}
                    <span className="block text-xs text-stone-500">{ASSET_TYPE_LABELS[asset.asset_type]}</span>
                  </span>
                  <StatusBadge tone={asset.status === 'sold' ? 'success' : 'neutral'}>{formatLabel(asset.status)}</StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Highest property offer" description="The top offer that has not been rejected or expired.">
        {highestOffer ? (
          <div className="space-y-3">
            <p className="text-3xl font-semibold tabular-nums text-stone-900">{formatTaka(highestOffer.amount)}</p>
            <p className="text-sm font-medium text-stone-800">{highestOffer.assetName}</p>
            <div className="flex items-center justify-between gap-3 text-sm text-stone-600">
              <span className="truncate">Buyer: {highestOffer.buyerName}</span>
              <StatusBadge tone={OFFER_TONE[highestOffer.status] ?? 'neutral'}>{formatLabel(highestOffer.status)}</StatusBadge>
            </div>
          </div>
        ) : (
          <p className="text-sm text-stone-500">No live offers recorded yet.</p>
        )}
      </SectionCard>

      <SectionCard title="Land sale priority ranking" description="Assets ordered by net sell signal, highest first.">
        {landRanking.length === 0 ? (
          <p className="text-sm text-stone-500">No land sale scores have been entered yet.</p>
        ) : (
          <ol className="space-y-3">
            {landRanking.map((row, index) => (
              <li key={row.id} className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-semibold text-stone-700">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-stone-900">{row.asset_name}</p>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-stone-900">{row.net_signal.toFixed(1)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <StatusBadge tone={RECOMMENDATION_TONE[row.recommendation]}>{LAND_SALE_RECOMMENDATION_LABELS[row.recommendation]}</StatusBadge>
                    <span className="text-xs text-stone-500">Sell {row.sell_pressure.toFixed(1)} · Hold {row.hold_pressure.toFixed(1)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </SectionCard>

      <div className="xl:col-span-3">
        <SectionCard title="Latest material rates" description="Most recent recorded rate for each material and its change from the previous entry.">
          {rateTrends.length === 0 ? (
            <p className="text-sm text-stone-500">No material rates recorded yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {rateTrends.map((trend) => {
                const change = trend.change_percent;
                const rising = change !== null && change > 0;
                const falling = change !== null && change < 0;
                return (
                  <div key={trend.material_type} className="rounded-xl border border-stone-200 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-stone-800">{RATE_MATERIAL_LABELS[trend.material_type]}</p>
                      <span
                        className={`text-xs font-semibold tabular-nums ${rising ? 'text-rose-700' : falling ? 'text-emerald-700' : 'text-stone-500'}`}
                      >
                        {change === null ? 'No change data' : `${change > 0 ? '+' : ''}${change.toFixed(1)}%`}
                      </span>
                    </div>
                    <p className="mt-2 text-2xl font-semibold tabular-nums text-stone-900">
                      {formatTaka(trend.latest_rate)}
                      <span className="ml-1 text-sm font-normal text-stone-500">/ {trend.latest_unit}</span>
                    </p>
                    <p className="mt-1 text-xs text-stone-500">Recorded {formatDate(trend.latest_date)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
