import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/Button';
import { formatBarGroups } from '@/lib/structuralCalculations';
import type { BeamRegisterRow } from '@/types/database';

interface BeamRegisterTableProps {
  rows: Record<string, unknown>[];
  groupsByRegister: Record<string, { layer: string; bar_count: number; diameter_mm: number }[]>;
  packageName: string;
  engineerName: string;
  onEditRow: (row: Record<string, unknown>) => void;
  onDeleteRow: (row: Record<string, unknown>) => void;
}

function groupsForLayer(groups: { layer: string; bar_count: number; diameter_mm: number }[], layer: string): string {
  const filtered = groups.filter((g) => g.layer === layer);
  if (filtered.length === 0) return '-';
  return formatBarGroups(filtered.map((g) => ({ bar_count: g.bar_count, diameter_mm: g.diameter_mm })));
}

const HEADERS = ['Mark', 'Type', 'Dimensions', 'Qty', 'Length (m)', 'Storey', 'Cover', 'Top', 'Bottom', 'Extra', 'Stirrup', 'Spacing', 'Concrete', 'Steel', 'Engineer', 'Package'];

export function BeamRegisterTable({ rows, groupsByRegister, packageName, engineerName, onEditRow, onDeleteRow }: BeamRegisterTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-stone-200 text-sm">
        <thead className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
          <tr>
            {HEADERS.map((h) => <th key={h} className="px-4 py-3 whitespace-nowrap">{h}</th>)}
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {rows.map((row) => {
            const beam = row as unknown as BeamRegisterRow;
            const groups = groupsByRegister[beam.id] ?? [];
            const top = groupsForLayer(groups, 'top');
            const bottom = groupsForLayer(groups, 'bottom');
            const extra = [groupsForLayer(groups, 'extra_left'), groupsForLayer(groups, 'extra_mid'), groupsForLayer(groups, 'extra_right')]
              .filter((v) => v !== '-')
              .join(' / ');
            return (
              <tr key={beam.id} className="transition-colors hover:bg-stone-50">
                <td className="px-4 py-3 whitespace-nowrap font-medium text-stone-900">{beam.mark}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{beam.beam_type}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{beam.dimensions_mm}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{Number(beam.quantity)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{Number(beam.length_m).toFixed(2)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{beam.storey_range ?? '-'}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{Number(beam.clear_cover_mm)} mm</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{top !== '-' ? top : (beam.main_reinforcement ?? '-')}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{bottom}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{extra || '-'}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{beam.tie_reinforcement ?? '-'}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{beam.tie_spacing_notation ?? `${Number(beam.tie_spacing_mm)} mm`}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{Number(beam.concrete_volume_cum).toFixed(3)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{Number(beam.steel_weight_kg).toFixed(2)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{engineerName}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{packageName}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" className="p-1.5" aria-label="Edit entry" onClick={() => onEditRow(row)}><Pencil className="h-4 w-4" aria-hidden /></Button>
                    <Button variant="ghost" className="p-1.5 hover:text-rose-700" aria-label="Delete entry" onClick={() => onDeleteRow(row)}><Trash2 className="h-4 w-4" aria-hidden /></Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
