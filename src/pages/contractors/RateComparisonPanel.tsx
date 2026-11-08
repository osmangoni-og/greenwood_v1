import { useMemo } from 'react';
import { Card, CardHeader } from '@/components/Card';
import { cx } from '@/lib/cx';
import { formatTaka } from '@/lib/format';
import { buildRateComparison, type ComparisonBidder } from '@/lib/rateComparison';
import type { ContractorBidItemRow } from '@/types/database';

interface Props {
  bidders: ComparisonBidder[];
  items: ContractorBidItemRow[];
}

export function RateComparisonPanel({ bidders, items }: Props) {
  const comparison = useMemo(() => buildRateComparison(bidders, items), [bidders, items]);
  const nameOf = (bidId: string | null) => bidders.find((b) => b.bidId === bidId)?.name ?? '-';
  const hasRates = items.length > 0;

  return (
    <Card>
      <CardHeader title="Contractor rate comparison" description="Element-wise rates across all bids on this tender. Lowest amount per element is highlighted." />
      {!hasRates ? (
        <p className="mt-3 text-sm text-stone-500">Add a rate schedule to a bid to compare contractors element by element.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                <th className="py-2 pr-3 font-medium">Construction element</th>
                {bidders.map((b) => (
                  <th key={b.bidId} className="py-2 pr-3 font-medium">{b.name}</th>
                ))}
                <th className="py-2 pr-3 text-right font-medium">Variance</th>
                <th className="py-2 pr-3 font-medium">Lowest bidder</th>
                <th className="py-2 font-medium">Highest bidder</th>
              </tr>
            </thead>
            <tbody>
              {comparison.lines.map((line) => (
                <tr key={line.element} className="border-b border-stone-100">
                  <td className="py-2 pr-3 font-medium text-stone-800">{line.element}</td>
                  {bidders.map((b) => {
                    const cell = line.cells[b.bidId];
                    const isLowest = line.lowestBidId === b.bidId && cell !== null;
                    return (
                      <td key={b.bidId} className="py-2 pr-3">
                        {cell ? (
                          <div className={cx('inline-block rounded-md px-2 py-1', isLowest && 'bg-emerald-50 text-emerald-800')}>
                            <p className="font-medium">{formatTaka(cell.rate)} / {cell.unit}</p>
                            <p className="text-xs text-stone-500">{formatTaka(cell.amount)}</p>
                          </div>
                        ) : (
                          <span className="text-stone-400">Not priced</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="py-2 pr-3 text-right text-stone-700">{line.variance !== null ? formatTaka(line.variance) : '-'}</td>
                  <td className="py-2 pr-3 text-stone-700">{nameOf(line.lowestBidId)}</td>
                  <td className="py-2 text-stone-700">{nameOf(line.highestBidId)}</td>
                </tr>
              ))}
              <tr className="bg-stone-50 font-semibold text-stone-900">
                <td className="py-2 pr-3">Total bid</td>
                {bidders.map((b) => (
                  <td key={b.bidId} className="py-2 pr-3">{formatTaka(comparison.totals[b.bidId] ?? 0)}</td>
                ))}
                <td className="py-2 pr-3" />
                <td className="py-2 pr-3 text-stone-700">{nameOf(comparison.lowestTotalBidId)}</td>
                <td className="py-2 text-stone-700">{nameOf(comparison.highestTotalBidId)}</td>
              </tr>
              <tr className="text-stone-600">
                <td className="py-2 pr-3">Premium over lowest bid</td>
                {bidders.map((b) => {
                  const lowest = comparison.totals[comparison.lowestTotalBidId ?? ''] ?? 0;
                  const total = comparison.totals[b.bidId] ?? 0;
                  return (
                    <td key={b.bidId} className="py-2 pr-3">
                      {total > lowest ? formatTaka(total - lowest) : '-'}
                    </td>
                  );
                })}
                <td colSpan={3} />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
