import type { MaterialRateHistoryRow, RateMaterialType } from '@/types/database';

export const PRICE_ALERT_THRESHOLD_PERCENT = 5;

export interface MaterialInflationRow {
  key: string;
  material: RateMaterialType;
  unit: string;
  firstMonth: string;
  latestMonth: string;
  firstAverage: number;
  latestAverage: number;
  monthsTracked: number;
  inflationPercent: number | null;
  latestMonthChangePercent: number | null;
}

export interface PriceIncreaseAlert {
  id: string;
  material: RateMaterialType;
  unit: string;
  date: string;
  previousRate: number;
  rate: number;
  changePercent: number;
}

function percentChange(from: number, to: number): number {
  return from === 0 ? 0 : ((to - from) / from) * 100;
}

function seriesKey(row: MaterialRateHistoryRow): string {
  return `${row.material_type}|${row.unit}`;
}

function groupBySeries(rows: MaterialRateHistoryRow[]): Map<string, MaterialRateHistoryRow[]> {
  const groups = new Map<string, MaterialRateHistoryRow[]>();
  for (const row of rows) {
    const key = seriesKey(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => a.rate_date.localeCompare(b.rate_date) || a.created_at.localeCompare(b.created_at));
  }
  return groups;
}

export function buildMaterialInflation(rows: MaterialRateHistoryRow[]): MaterialInflationRow[] {
  const result: MaterialInflationRow[] = [];

  for (const [key, series] of groupBySeries(rows)) {
    const monthly = new Map<string, { sum: number; count: number }>();
    for (const row of series) {
      const month = row.rate_date.slice(0, 7);
      const entry = monthly.get(month) ?? { sum: 0, count: 0 };
      monthly.set(month, { sum: entry.sum + row.rate_bdt, count: entry.count + 1 });
    }

    const months = [...monthly.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, { sum, count }]) => ({ month, average: sum / count }));
    const first = months[0];
    const latest = months[months.length - 1];
    const previous = months.length > 1 ? months[months.length - 2] : null;

    result.push({
      key,
      material: series[0].material_type,
      unit: series[0].unit,
      firstMonth: first.month,
      latestMonth: latest.month,
      firstAverage: first.average,
      latestAverage: latest.average,
      monthsTracked: months.length,
      inflationPercent: months.length > 1 ? percentChange(first.average, latest.average) : null,
      latestMonthChangePercent: previous ? percentChange(previous.average, latest.average) : null,
    });
  }

  return result.sort((a, b) => (b.inflationPercent ?? -Infinity) - (a.inflationPercent ?? -Infinity));
}

export function buildPriceIncreaseAlerts(rows: MaterialRateHistoryRow[]): PriceIncreaseAlert[] {
  const alerts: PriceIncreaseAlert[] = [];

  for (const series of groupBySeries(rows).values()) {
    for (let index = 1; index < series.length; index += 1) {
      const previous = series[index - 1];
      const current = series[index];
      const changePercent = percentChange(previous.rate_bdt, current.rate_bdt);
      if (changePercent >= PRICE_ALERT_THRESHOLD_PERCENT) {
        alerts.push({
          id: current.id,
          material: current.material_type,
          unit: current.unit,
          date: current.rate_date,
          previousRate: previous.rate_bdt,
          rate: current.rate_bdt,
          changePercent,
        });
      }
    }
  }

  return alerts.sort((a, b) => b.date.localeCompare(a.date));
}
