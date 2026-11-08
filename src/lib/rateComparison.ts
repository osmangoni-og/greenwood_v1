import { CONTRACTOR_RATE_ELEMENTS, type ContractorBidItemRow } from '@/types/database';

export interface RateScheduleSummary {
  totalArea: number;
  totalAmount: number;
  averageRate: number | null;
  highestRate: number | null;
  lowestRate: number | null;
}

export function summarizeRateSchedule(items: ContractorBidItemRow[]): RateScheduleSummary {
  const totalArea = items.reduce((sum, i) => sum + Number(i.area), 0);
  const totalAmount = items.reduce((sum, i) => sum + Number(i.amount), 0);
  const rates = items.map((i) => Number(i.rate)).filter((r) => r > 0);
  return {
    totalArea,
    totalAmount,
    averageRate: totalArea > 0 ? totalAmount / totalArea : null,
    highestRate: rates.length > 0 ? Math.max(...rates) : null,
    lowestRate: rates.length > 0 ? Math.min(...rates) : null,
  };
}

export interface ComparisonBidder {
  bidId: string;
  name: string;
}

export interface ComparisonCell {
  rate: number;
  amount: number;
  unit: string;
}

export interface ComparisonLine {
  element: string;
  cells: Record<string, ComparisonCell | null>;
  lowestBidId: string | null;
  highestBidId: string | null;
  variance: number | null;
}

export interface RateComparison {
  bidders: ComparisonBidder[];
  lines: ComparisonLine[];
  totals: Record<string, number>;
  lowestTotalBidId: string | null;
  highestTotalBidId: string | null;
}

export function buildRateComparison(
  bidders: ComparisonBidder[],
  items: ContractorBidItemRow[],
): RateComparison {
  const lines: ComparisonLine[] = CONTRACTOR_RATE_ELEMENTS.map((element) => {
    const cells: Record<string, ComparisonCell | null> = {};
    for (const bidder of bidders) {
      const hit = items.find((i) => i.bid_id === bidder.bidId && i.element === element);
      cells[bidder.bidId] = hit ? { rate: Number(hit.rate), amount: Number(hit.amount), unit: hit.unit || 'sft' } : null;
    }
    const priced = bidders.filter((b) => cells[b.bidId] !== null);
    const sorted = [...priced].sort((a, b) => cells[a.bidId]!.amount - cells[b.bidId]!.amount);
    const lowest = sorted[0];
    const highest = sorted[sorted.length - 1];
    return {
      element,
      cells,
      lowestBidId: lowest?.bidId ?? null,
      highestBidId: highest?.bidId ?? null,
      variance:
        priced.length >= 2 && lowest && highest
          ? cells[highest.bidId]!.amount - cells[lowest.bidId]!.amount
          : null,
    };
  });

  const totals: Record<string, number> = {};
  for (const bidder of bidders) {
    totals[bidder.bidId] = items
      .filter((i) => i.bid_id === bidder.bidId)
      .reduce((sum, i) => sum + Number(i.amount), 0);
  }
  const hasItems = bidders.filter((b) => items.some((i) => i.bid_id === b.bidId));
  const byTotal = [...hasItems].sort((a, b) => totals[a.bidId] - totals[b.bidId]);

  return {
    bidders,
    lines,
    totals,
    lowestTotalBidId: byTotal[0]?.bidId ?? null,
    highestTotalBidId: byTotal[byTotal.length - 1]?.bidId ?? null,
  };
}
