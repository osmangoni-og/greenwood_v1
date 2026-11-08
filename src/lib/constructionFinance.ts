import { supabase, unwrap } from '@/lib/supabase';
import type { ConstructionBudgetLineRow, ConstructionCashFlowForecastRow, ConstructionFinanceSummaryRow, ConstructionFundingSourceRow } from '@/types/database';

export async function fetchFundingSources(projectId: string): Promise<ConstructionFundingSourceRow[]> {
  return unwrap<ConstructionFundingSourceRow[]>(await supabase.from('construction_funding_sources').select('*').eq('project_id', projectId).order('expected_date', { ascending: true }));
}
export async function fetchBudgetLines(projectId: string): Promise<ConstructionBudgetLineRow[]> {
  return unwrap<ConstructionBudgetLineRow[]>(await supabase.from('construction_budget_lines').select('*').eq('project_id', projectId).order('category'));
}
export async function fetchCashForecasts(projectId: string): Promise<ConstructionCashFlowForecastRow[]> {
  return unwrap<ConstructionCashFlowForecastRow[]>(await supabase.from('construction_cash_flow_forecasts').select('*').eq('project_id', projectId).order('forecast_month'));
}
export async function fetchConstructionFinanceSummary(projectId: string): Promise<ConstructionFinanceSummaryRow | null> {
  const { data, error } = await supabase.rpc('get_construction_finance_summary', { p_project_id: projectId });
  if (error) throw new Error(error.message);
  return data && data.length ? data[0] as ConstructionFinanceSummaryRow : null;
}
