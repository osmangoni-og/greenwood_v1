import { supabase, unwrap } from '@/lib/supabase';
import type {
  VendorContractRow,
  VendorPerformanceRow,
  VendorRow,
  VendorScorecardRow,
} from '@/types/database';

export async function fetchVendors(projectId: string): Promise<VendorRow[]> {
  return unwrap<VendorRow[]>(
    await supabase
      .from('vendors')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false }),
  );
}

export async function fetchVendorContracts(vendorId: string): Promise<VendorContractRow[]> {
  return unwrap<VendorContractRow[]>(
    await supabase
      .from('vendor_contracts')
      .select('*')
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false }),
  );
}

export async function fetchVendorPerformance(vendorId: string): Promise<VendorPerformanceRow[]> {
  return unwrap<VendorPerformanceRow[]>(
    await supabase
      .from('vendor_performance')
      .select('*')
      .eq('vendor_id', vendorId)
      .order('review_date', { ascending: false }),
  );
}

export async function fetchVendorScorecard(vendorId: string): Promise<VendorScorecardRow | null> {
  const { data, error } = await supabase.rpc('get_vendor_scorecard', { p_vendor_id: vendorId });
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return null;
  return data[0] as VendorScorecardRow;
}
