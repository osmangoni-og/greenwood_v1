import { supabase, unwrap } from '@/lib/supabase';
import type {
  FinancingBalanceRow,
  MaterialDeliveryRow,
  OwnerDepositRow,
  VendorDepositRow,
  VendorRow,
} from '@/types/database';

export async function fetchOwnerDeposits(projectId: string): Promise<OwnerDepositRow[]> {
  return unwrap<OwnerDepositRow[]>(
    await supabase
      .from('owner_deposits')
      .select('*')
      .eq('project_id', projectId)
      .order('deposit_date', { ascending: false }),
  );
}

export async function fetchVendorDeposits(projectId: string): Promise<VendorDepositRow[]> {
  return unwrap<VendorDepositRow[]>(
    await supabase
      .from('vendor_deposits')
      .select('*')
      .eq('project_id', projectId)
      .order('deposit_date', { ascending: false }),
  );
}

export async function fetchMaterialDeliveries(projectId: string): Promise<MaterialDeliveryRow[]> {
  return unwrap<MaterialDeliveryRow[]>(
    await supabase
      .from('material_deliveries')
      .select('*')
      .eq('project_id', projectId)
      .order('delivery_date', { ascending: false }),
  );
}

export async function fetchFinancingBalance(projectId: string): Promise<FinancingBalanceRow | null> {
  const { data, error } = await supabase.rpc('get_financing_balance', { p_project_id: projectId });
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return null;
  return data[0] as FinancingBalanceRow;
}

export async function fetchVendorsForFinancing(projectId: string): Promise<VendorRow[]> {
  return unwrap<VendorRow[]>(
    await supabase
      .from('vendors')
      .select('*')
      .eq('project_id', projectId)
      .order('name', { ascending: true }),
  );
}
