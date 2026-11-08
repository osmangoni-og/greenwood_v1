import { Coins, HandCoins, Home, Landmark, MapPin, Percent, PiggyBank, TrendingDown } from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { Card, CardHeader } from '@/components/Card';
import { ProgressBar } from '@/components/ProgressBar';
import { StatusBadge } from '@/components/StatusBadge';
import type { ExecutiveDashboardData } from '@/lib/executiveDashboard';
import { formatPercent, formatTaka } from '@/lib/format';

interface Props {
  data: ExecutiveDashboardData;
}

export function GreenwoodWidgetsPanel({ data }: Props) {
  const { finance, funding, assets, highestOffer, landRanking, budget } = data;
  const totalBudget = funding.approvedBudget;
  const fundingCoverage = funding.fundingCoveragePercent;
  const remainingBudget = Math.max(0, totalBudget - Number(finance?.actual_cost ?? budget.spent));
  const forecastCompletion = Number(finance?.actual_cost ?? budget.spent) + Math.max(0, Number(finance?.cost_overrun ?? 0));

  // House sale progress
  const houseAssets = assets.filter((a) => a.asset_type === 'existing_house');
  const housesSold = houseAssets.filter((a) => a.status === 'sold').length;
  const houseSalePct = houseAssets.length > 0 ? (housesSold / houseAssets.length) * 100 : 0;
  const houseSaleValue = houseAssets.filter((a) => a.status === 'sold').reduce((s, a) => s + (a.sale_value_bdt ?? 0), 0);

  // Land sale progress
  const landAssets = assets.filter((a) => a.asset_type === 'agricultural_land' || a.asset_type === 'residential_plot' || a.asset_type === 'commercial_land');
  const landSold = landAssets.filter((a) => a.status === 'sold').length;
  const landSalePct = landAssets.length > 0 ? (landSold / landAssets.length) * 100 : 0;
  const landSaleValue = landAssets.filter((a) => a.status === 'sold').reduce((s, a) => s + (a.sale_value_bdt ?? 0), 0);

  // Asset monetization total
  const assetMonetizationTotal = assets.filter((a) => a.status === 'sold').reduce((s, a) => s + (a.sale_value_bdt ?? 0), 0);

  // Construction funding status
  const fundingReceivedPct = funding.fundingPlanned > 0 ? (funding.fundingReceived / funding.fundingPlanned) * 100 : 0;

  // Land sale ranking top 3
  const topLand = landRanking.slice(0, 3);

  return <div className="space-y-6">
    <div className="rounded-2xl bg-gradient-to-br from-teal-800 to-cyan-900 p-5 text-white">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-teal-200">Greenwood Miazi Bari</p>
      <h2 className="mt-1 text-2xl font-semibold">Project Monetization & Funding Widgets</h2>
      <p className="mt-1 text-sm text-teal-100">Real-time view of asset sales, funding coverage, and projected completion cost.</p>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="House sale progress" value={formatPercent(houseSalePct)} hint={`${housesSold} of ${houseAssets.length} houses sold | ${formatTaka(houseSaleValue)}`} icon={Home} tone="primary" />
      <StatCard label="Land sale progress" value={formatPercent(landSalePct)} hint={`${landSold} of ${landAssets.length} land parcels sold | ${formatTaka(landSaleValue)}`} icon={MapPin} tone="primary" />
      <StatCard label="Highest active offer" value={highestOffer ? formatTaka(highestOffer.amount) : 'No offers'} hint={highestOffer ? `${highestOffer.assetName} — ${highestOffer.buyerName}` : 'No active offers on any asset'} icon={HandCoins} tone="accent" />
      <StatCard label="Asset monetization total" value={formatTaka(assetMonetizationTotal)} hint={`${assets.filter((a) => a.status === 'sold').length} assets sold`} icon={Coins} tone="accent" />
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Construction funding status" value={`${formatPercent(fundingReceivedPct)} received`} hint={`${formatTaka(funding.fundingReceived)} of ${formatTaka(funding.fundingPlanned)}`} icon={Landmark} tone={fundingReceivedPct < 100 ? 'error' : 'accent'} />
      <StatCard label="Funding coverage" value={`${fundingCoverage.toFixed(1)}%`} hint="Received + risk-adjusted vs total budget" icon={Percent} tone={fundingCoverage < 100 ? 'error' : 'accent'} />
      <StatCard label="Remaining budget" value={formatTaka(remainingBudget)} hint="Budget minus actual cost so far" icon={PiggyBank} tone="primary" />
      <StatCard label="Forecast completion cost" value={formatTaka(forecastCompletion)} hint="Actual cost plus projected overrun" icon={TrendingDown} tone={forecastCompletion > totalBudget ? 'error' : 'primary'} />
    </div>

    {(houseAssets.length > 0 || landAssets.length > 0) && (
      <Card>
        <CardHeader title="Asset sale breakdown" description="Sale progress by asset type." />
        <div className="mt-4 space-y-4">
          {houseAssets.length > 0 && <SaleProgressRow label="Houses" sold={housesSold} total={houseAssets.length} value={houseSaleValue} icon={Home} />}
          {landAssets.length > 0 && <SaleProgressRow label="Land parcels" sold={landSold} total={landAssets.length} value={landSaleValue} icon={MapPin} />}
        </div>
      </Card>
    )}

    {topLand.length > 0 && (
      <Card>
        <CardHeader title="Land sale priority ranking" description="Top 3 land assets by sell pressure score." />
        <div className="mt-4 divide-y divide-stone-100">
          {topLand.map((row, index) => (
            <div key={row.id} className="flex items-center justify-between gap-4 py-3 text-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-800">{index + 1}</span>
                <div>
                  <p className="font-medium text-stone-800">{row.asset_name}</p>
                  <p className="text-xs text-stone-500">{row.location ?? 'No location'} | Est. {formatTaka(row.estimated_value_bdt ?? 0)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-stone-900">{row.net_signal > 0 ? '+' : ''}{row.net_signal.toFixed(0)}</span>
                <StatusBadge tone={row.recommendation === 'sell_immediately' ? 'error' : row.recommendation === 'sell_if_needed' ? 'warning' : row.recommendation === 'hold' ? 'info' : 'success'}>
                  {row.recommendation.replace(/_/g, ' ')}
                </StatusBadge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    )}

    {highestOffer && (
      <Card>
        <CardHeader title="Highest active offer detail" description="The best live offer across all monetizable assets." />
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-stone-50 p-4"><p className="text-xs text-stone-500">Offer amount</p><p className="mt-1 text-lg font-semibold text-stone-900">{formatTaka(highestOffer.amount)}</p></div>
          <div className="rounded-xl bg-stone-50 p-4"><p className="text-xs text-stone-500">Asset</p><p className="mt-1 text-sm font-semibold text-stone-900">{highestOffer.assetName}</p></div>
          <div className="rounded-xl bg-stone-50 p-4"><p className="text-xs text-stone-500">Buyer</p><p className="mt-1 text-sm font-semibold text-stone-900">{highestOffer.buyerName}</p><StatusBadge tone={highestOffer.status === 'accepted' ? 'success' : highestOffer.status === 'negotiating' ? 'warning' : 'neutral'}>{highestOffer.status}</StatusBadge></div>
        </div>
      </Card>
    )}

    <Card>
      <CardHeader title="Construction funding status" description="Received, risk-adjusted, and gap against the total budget." />
      <div className="mt-4 space-y-4">
        <div>
          <div className="flex justify-between text-sm"><span className="font-medium text-stone-700">Funding received</span><span className="text-stone-800">{formatTaka(funding.fundingReceived)} ({formatPercent(fundingReceivedPct)} of planned)</span></div>
          <div className="mt-2"><ProgressBar value={fundingReceivedPct} tone="primary" label="Received vs planned funding" /></div>
        </div>
        <div>
          <div className="flex justify-between text-sm"><span className="font-medium text-stone-700">Funding coverage (received + risk-adjusted)</span><span className="text-stone-800">{formatPercent(fundingCoverage)} of budget</span></div>
          <div className="mt-2"><ProgressBar value={Math.min(100, fundingCoverage)} tone={fundingCoverage < 100 ? 'error' : 'accent'} label="Coverage vs total budget" /></div>
        </div>
        {funding.fundingGap > 0 && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">Funding gap of {formatTaka(funding.fundingGap)} remains after risk-adjusted sources.</p>}
      </div>
    </Card>
  </div>;
}

function SaleProgressRow({ label, sold, total, value, icon: Icon }: { label: string; sold: number; total: number; value: number; icon: React.ComponentType<{ className?: string }> }) {
  const pct = total > 0 ? (sold / total) * 100 : 0;
  return <div>
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2 font-medium text-stone-700"><Icon className="h-4 w-4 text-stone-400" aria-hidden /> {label}</span>
      <span className="text-stone-600">{sold} of {total} sold | {formatTaka(value)}</span>
    </div>
    <div className="mt-2"><ProgressBar value={pct} tone="primary" label={`${label} sale progress`} /></div>
  </div>;
}
