import { supabase, unwrap } from '@/lib/supabase';
import type { SettingRow } from '@/types/database';

export const BUDGET_ALERT_KEY = 'budget_alert_threshold_pct';
const DEFAULT_BUDGET_ALERT_PCT = 85;

export async function fetchSettings(): Promise<SettingRow[]> {
  return unwrap<SettingRow[]>(await supabase.from('settings').select('*').order('key', { ascending: true }));
}

export function readBudgetAlertThreshold(settings: SettingRow[]): number {
  const row = settings.find((setting) => setting.key === BUDGET_ALERT_KEY);
  const value = Number(row?.value.value);
  return Number.isFinite(value) ? value : DEFAULT_BUDGET_ALERT_PCT;
}
