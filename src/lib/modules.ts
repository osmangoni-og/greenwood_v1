import { Activity, Archive, Bell, BookOpen, Building2, Calculator, ClipboardList, Coins, FileText, FileSignature, Gauge, LayoutDashboard, Landmark, PencilRuler, PiggyBank, Settings, ShieldCheck, Store, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type ModuleId = 'dashboard' | 'executive' | 'project' | 'settings' | 'activity' | 'notifications' | 'documents' | 'design' | 'boq' | 'contractors' | 'vendors' | 'construction_finance' | 'asset_monetization' | 'contracts' | 'construction_tracking' | 'site_diary' | 'quality_control' | 'house_archive' | 'budget_management' | 'decision_log';

const HIDDEN_MODULES: ModuleId[] = ['decision_log'];

export interface ModuleDefinition {
  id: ModuleId;
  label: string;
  icon: LucideIcon;
}

export const MODULES: ModuleDefinition[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'executive', label: 'Executive Dashboard', icon: Gauge },
  { id: 'budget_management', label: 'Budget Management', icon: PiggyBank },
  { id: 'decision_log', label: 'Decision Log', icon: ClipboardList },
  { id: 'project', label: 'Project Profile', icon: Building2 },
  { id: 'design', label: 'Design Management', icon: PencilRuler },
  { id: 'boq', label: 'BOQ Management', icon: Calculator },
  { id: 'contractors', label: 'Contractors', icon: ClipboardList },
  { id: 'vendors', label: 'Vendors', icon: Store },
  { id: 'construction_finance', label: 'Construction Finance', icon: Landmark },
  { id: 'asset_monetization', label: 'Asset Monetization', icon: Coins },
  { id: 'contracts', label: 'Contract Management', icon: FileSignature },
  { id: 'construction_tracking', label: 'Construction Tracking', icon: Wrench },
  { id: 'site_diary', label: 'Daily Site Diary', icon: BookOpen },
  { id: 'quality_control', label: 'Quality Control', icon: ShieldCheck },
  { id: 'house_archive', label: 'House Archive', icon: Archive },
  { id: 'settings', label: 'User Settings', icon: Settings },
  { id: 'activity', label: 'Activity Log', icon: Activity },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'documents', label: 'Document Repository', icon: FileText },
];

export const VISIBLE_MODULES: ModuleDefinition[] = MODULES.filter((m) => !HIDDEN_MODULES.includes(m.id));

export function isModuleId(value: string): value is ModuleId {
  return MODULES.some((module) => module.id === value);
}

export function getRedirectModule(id: ModuleId): ModuleId | null {
  if (id === 'decision_log') return 'activity';
  return null;
}

export function isHiddenModule(id: ModuleId): boolean {
  return HIDDEN_MODULES.includes(id);
}
