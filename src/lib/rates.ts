import { supabase, unwrap } from '@/lib/supabase';
import type { MaterialRateHistoryRow, MonthlyMarketSnapshotRow, RateTrendSummaryRow, VendorRow } from '@/types/database';

export async function fetchRateHistory(projectId: string): Promise<MaterialRateHistoryRow[]> {
  return unwrap<MaterialRateHistoryRow[]>(await supabase.from('material_rate_history').select('*').eq('project_id', projectId).order('rate_date', { ascending: false }).order('created_at', { ascending: false }));
}

export async function fetchMarketSnapshots(projectId: string): Promise<MonthlyMarketSnapshotRow[]> {
  return unwrap<MonthlyMarketSnapshotRow[]>(await supabase.from('monthly_market_snapshots').select('*').eq('project_id', projectId).order('snapshot_month', { ascending: false }));
}

export async function fetchRateTrends(projectId: string): Promise<RateTrendSummaryRow[]> {
  const { data, error } = await supabase.rpc('get_rate_trend_summary', { p_project_id: projectId });
  if (error) throw new Error(error.message);
  return (data ?? []) as RateTrendSummaryRow[];
}

export async function fetchRateVendors(projectId: string): Promise<VendorRow[]> {
  return unwrap<VendorRow[]>(await supabase.from('vendors').select('*').eq('project_id', projectId).order('name'));
}
