import { supabase, unwrap } from '@/lib/supabase';
import type { LandSaleScoreRow, MonetizableAssetRow } from '@/types/database';

export async function fetchLandSaleScores(projectId: string): Promise<LandSaleScoreRow[]> {
  return unwrap<LandSaleScoreRow[]>(await supabase.from('land_sale_scores').select('*').eq('project_id', projectId).order('net_signal', { ascending: false }));
}
export async function fetchLandAssets(projectId: string): Promise<MonetizableAssetRow[]> {
  return unwrap<MonetizableAssetRow[]>(await supabase.from('monetizable_assets').select('*').eq('project_id', projectId).in('asset_type', ['agricultural_land', 'residential_plot', 'commercial_land', 'existing_house']).order('asset_name'));
}
