import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/Button';
import { formatBarGroups } from '@/lib/structuralCalculations';
import type { FootingRegisterRow } from '@/types/database';

interface FootingRegisterTableProps {
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

const HEADERS = ['Mark', 'Type', 'L x W (mm)', 'Thk (mm)', 'Qty', 'F. Depth', 'Pedestal', 'Storey', 'Cover', 'Bot X', 'Bot Y', 'Top', 'Excavation', 'Concrete', 'Steel', 'Engineer', 'Package'];

export function FootingRegisterTable({ rows, groupsByRegister, packageName, engineerName, onEditRow, onDeleteRow }: FootingRegisterTableProps) {
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
            const ftg = row as unknown as FootingRegisterRow;
            const groups = groupsByRegister[ftg.id] ?? [];
            const dims = `${Number(ftg.footing_length_mm)}x${Number(ftg.footing_width_mm)}`;
            const pedestal = `${Number(ftg.pedestal_length_mm)}x${Number(ftg.pedestal_width_mm)}x${Number(ftg.pedestal_height_mm)}`;
            return (
              <tr key={ftg.id} className="transition-colors hover:bg-stone-50">
                <td className="px-4 py-3 whitespace-nowrap font-medium text-stone-900">{ftg.mark}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{ftg.footing_type}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{dims}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{Number(ftg.thickness_mm)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{Number(ftg.quantity)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{Number(ftg.foundation_depth_m).toFixed(2)} m</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{pedestal}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{ftg.storey_range ?? '-'}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{Number(ftg.clear_cover_mm)} mm</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{groupsForLayer(groups, 'bottom_x')}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{groupsForLayer(groups, 'bottom_y')}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{groupsForLayer(groups, 'top')}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{Number(ftg.excavation_volume_cum).toFixed(3)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{Number(ftg.concrete_volume_cum).toFixed(3)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{Number(ftg.steel_weight_kg).toFixed(2)}</td>
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
