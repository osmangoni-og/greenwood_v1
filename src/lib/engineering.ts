import { supabase, unwrap } from '@/lib/supabase';
import type { DesignPackageRow, DesignPackageStatus, EngineerRow } from '@/types/engineering';

export interface EngineerInput {
  name: string;
  firm: string | null;
  license_number: string | null;
  mobile: string | null;
  email: string | null;
  notes: string | null;
}

export interface DesignPackageInput {
  engineer_id: string;
  name: string;
  revision_label: string;
  status: DesignPackageStatus;
  notes: string | null;
}

export async function fetchEngineeringData(projectId: string): Promise<{ engineers: EngineerRow[]; packages: DesignPackageRow[] }> {
  const [engineers, packages] = await Promise.all([
    supabase.from('engineers').select('*').eq('project_id', projectId).order('name'),
    supabase.from('design_packages').select('*').eq('project_id', projectId).order('created_at'),
  ]);
  return {
    engineers: unwrap<EngineerRow[]>(engineers),
    packages: unwrap<DesignPackageRow[]>(packages),
  };
}

export async function saveEngineer(projectId: string, input: EngineerInput, id?: string): Promise<void> {
  const result = id
    ? await supabase.from('engineers').update(input).eq('id', id)
    : await supabase.from('engineers').insert({ ...input, project_id: projectId });
  if (result.error) throw new Error(result.error.message);
}

export async function saveDesignPackage(projectId: string, input: DesignPackageInput, id?: string): Promise<void> {
  const result = id
    ? await supabase.from('design_packages').update(input).eq('id', id)
    : await supabase.from('design_packages').insert({ ...input, project_id: projectId });
  if (result.error) throw new Error(result.error.message);
}

export type PackageAction = 'select' | 'approve' | 'accept' | 'reject';

const PACKAGE_ACTION_RULES: Record<PackageAction, { from: DesignPackageStatus[]; to: DesignPackageStatus }> = {
  select: { from: ['draft', 'submitted', 'rejected'], to: 'selected' },
  approve: { from: ['selected'], to: 'approved' },
  accept: { from: ['approved'], to: 'accepted' },
  reject: { from: ['draft', 'submitted', 'selected'], to: 'rejected' },
};

export function getAvailablePackageActions(status: DesignPackageStatus): PackageAction[] {
  return (Object.keys(PACKAGE_ACTION_RULES) as PackageAction[]).filter((action) => PACKAGE_ACTION_RULES[action].from.includes(status));
}

export async function applyDesignPackageAction(projectId: string, pkg: DesignPackageRow, action: PackageAction): Promise<void> {
  const rule = PACKAGE_ACTION_RULES[action];
  if (!rule.from.includes(pkg.status)) throw new Error('This package has changed status. Refresh and try again.');

  if (action === 'select') {
    const { error } = await supabase
      .from('design_packages')
      .update({ status: 'draft', updated_at: new Date().toISOString() })
      .eq('project_id', projectId)
      .eq('status', 'selected')
      .neq('id', pkg.id);
    if (error) throw new Error(error.message);
  }
  if (action === 'accept') {
    const { error } = await supabase
      .from('design_packages')
      .update({ status: 'superseded', updated_at: new Date().toISOString() })
      .eq('project_id', projectId)
      .eq('status', 'accepted')
      .neq('id', pkg.id);
    if (error) throw new Error(error.message);
  }

  const { error } = await supabase
    .from('design_packages')
    .update({ status: rule.to, updated_at: new Date().toISOString() })
    .eq('id', pkg.id);
  if (error) throw new Error(error.message);
}

