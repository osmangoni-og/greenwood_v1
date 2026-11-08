import { supabase } from '@/lib/supabase';
import type { BarGroup } from '@/lib/structuralCalculations';

export interface RegisterFieldConfig {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select';
  step?: string;
  min?: string;
  options?: string[];
  default?: string;
}

export interface RegisterConfig {
  table: string;
  label: string;
  fields: RegisterFieldConfig[];
}

export const REGISTER_CONFIGS: Record<string, RegisterConfig> = {
  columns: {
    table: 'column_registers',
    label: 'Column Register',
    fields: [],
  },
  beams: {
    table: 'beam_registers',
    label: 'Beam Register',
    fields: [],
  },
  footings: {
    table: 'footing_registers',
    label: 'Footing Register',
    fields: [],
  },
  slabs: {
    table: 'slab_registers',
    label: 'Slab Register',
    fields: [],
  },
  rebar: {
    table: 'rebar_registers',
    label: 'Rebar Register',
    fields: [],
  },
  boq: {
    table: 'design_boq_items',
    label: 'BOQ Items',
    fields: [
      { name: 'item_description', label: 'Item description', type: 'text' },
      { name: 'unit', label: 'Unit', type: 'text', default: 'cum' },
      { name: 'quantity', label: 'Quantity', type: 'number', step: '0.01', min: '0', default: '0' },
      { name: 'unit_rate_bdt', label: 'Unit rate (Tk)', type: 'number', step: '0.01', min: '0', default: '0' },
      { name: 'total_bdt', label: 'Total (Tk)', type: 'number', step: '0.01', min: '0', default: '0' },
      { name: 'notes', label: 'Notes', type: 'text' },
    ],
  },
};

export type RegisterKey = keyof typeof REGISTER_CONFIGS;

export const REGISTER_TABS: { key: RegisterKey; label: string }[] = [
  { key: 'columns', label: 'Columns' },
  { key: 'beams', label: 'Beams' },
  { key: 'footings', label: 'Footings' },
  { key: 'slabs', label: 'Slabs' },
  { key: 'rebar', label: 'Rebar' },
  { key: 'boq', label: 'BOQ' },
];

export function emptyRegisterRow(config: RegisterConfig): Record<string, string> {
  const row: Record<string, string> = {};
  for (const field of config.fields) {
    row[field.name] = field.default ?? '';
  }
  return row;
}

export async function fetchRegisterRows(config: RegisterConfig, designId: string): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase
    .from(config.table)
    .select('*')
    .eq('design_id', designId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Record<string, unknown>[];
}

export async function fetchColumnReinforcementGroups(registerIds: string[]): Promise<Record<string, BarGroup[]>> {
  if (registerIds.length === 0) return {};
  const { data, error } = await supabase
    .from('column_reinforcement_groups')
    .select('column_register_id, bar_count, diameter_mm, sort_order')
    .in('column_register_id', registerIds)
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  const map: Record<string, BarGroup[]> = {};
  for (const row of (data ?? []) as { column_register_id: string; bar_count: number; diameter_mm: number }[]) {
    (map[row.column_register_id] ??= []).push({ bar_count: Number(row.bar_count), diameter_mm: Number(row.diameter_mm) });
  }
  return map;
}

export async function fetchBeamReinforcementGroups(registerIds: string[]): Promise<Record<string, { layer: string; bar_count: number; diameter_mm: number }[]>> {
  if (registerIds.length === 0) return {};
  const { data, error } = await supabase
    .from('beam_reinforcement_groups')
    .select('beam_register_id, layer, bar_count, diameter_mm, sort_order')
    .in('beam_register_id', registerIds)
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  const map: Record<string, { layer: string; bar_count: number; diameter_mm: number }[]> = {};
  for (const row of (data ?? []) as { beam_register_id: string; layer: string; bar_count: number; diameter_mm: number }[]) {
    (map[row.beam_register_id] ??= []).push({ layer: row.layer, bar_count: Number(row.bar_count), diameter_mm: Number(row.diameter_mm) });
  }
  return map;
}

export async function fetchFootingReinforcementGroups(registerIds: string[]): Promise<Record<string, { layer: string; bar_count: number; diameter_mm: number }[]>> {
  if (registerIds.length === 0) return {};
  const { data, error } = await supabase
    .from('footing_reinforcement_groups')
    .select('footing_register_id, layer, bar_count, diameter_mm, sort_order')
    .in('footing_register_id', registerIds)
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  const map: Record<string, { layer: string; bar_count: number; diameter_mm: number }[]> = {};
  for (const row of (data ?? []) as { footing_register_id: string; layer: string; bar_count: number; diameter_mm: number }[]) {
    (map[row.footing_register_id] ??= []).push({ layer: row.layer, bar_count: Number(row.bar_count), diameter_mm: Number(row.diameter_mm) });
  }
  return map;
}

export async function fetchSlabReinforcementGroups(registerIds: string[]): Promise<Record<string, { layer: string; direction: string | null; bar_count: number; diameter_mm: number; length_m: number }[]>> {
  if (registerIds.length === 0) return {};
  const { data, error } = await supabase
    .from('slab_reinforcement_groups')
    .select('slab_register_id, layer, direction, bar_count, diameter_mm, length_m, sort_order')
    .in('slab_register_id', registerIds)
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  const map: Record<string, { layer: string; direction: string | null; bar_count: number; diameter_mm: number; length_m: number }[]> = {};
  for (const row of (data ?? []) as { slab_register_id: string; layer: string; direction: string | null; bar_count: number; diameter_mm: number; length_m: number }[]) {
    (map[row.slab_register_id] ??= []).push({ layer: row.layer, direction: row.direction, bar_count: Number(row.bar_count), diameter_mm: Number(row.diameter_mm), length_m: Number(row.length_m) });
  }
  return map;
}

export async function deleteRegisterRow(config: RegisterConfig, rowId: string): Promise<void> {
  const { error } = await supabase.from(config.table).delete().eq('id', rowId);
  if (error) throw new Error(error.message);
}
