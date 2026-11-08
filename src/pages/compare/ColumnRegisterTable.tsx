import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/Button';
import { formatBarGroups, type BarGroup } from '@/lib/columnCalculations';
import type { ColumnRegisterRow } from '@/types/database';

interface ColumnRegisterTableProps {
  rows: Record<string, unknown>[];
  groupsByRegister: Record<string, BarGroup[]>;
  packageName: string;
  engineerName: string;
  onEditRow: (row: Record<string, unknown>) => void;
  onDeleteRow: (row: Record<string, unknown>) => void;
}

const HEADERS = [
  'Mark',
  'Column type',
  'Dimensions (mm)',
  'Quantity',
  'Storey range',
  'Clear cover',
  'Main reinforcement',
  'Tie diameter',
  'Tie spacing',
  'Concrete (cum)',
  'Steel (kg)',
  'Engineer',
  'Package',
];

export function ColumnRegisterTable({ rows, groupsByRegister, packageName, engineerName, onEditRow, onDeleteRow }: ColumnRegisterTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-stone-200 text-sm">
        <thead className="bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
          <tr>
            {HEADERS.map((header) => (
              <th key={header} className="px-4 py-3 whitespace-nowrap">{header}</th>
            ))}
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {rows.map((row) => {
            const col = row as unknown as ColumnRegisterRow;
            const groups = groupsByRegister[col.id] ?? [];
            const mainReinforcement = groups.length > 0 ? formatBarGroups(groups) : (col.main_reinforcement ?? '-');
            return (
              <tr key={col.id} className="transition-colors hover:bg-stone-50">
                <td className="px-4 py-3 whitespace-nowrap font-medium text-stone-900">{col.mark}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{col.column_type}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{col.dimensions_mm}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{Number(col.quantity)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{col.storey_range ?? '-'}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{Number(col.clear_cover_mm)} mm</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{mainReinforcement}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{col.tie_reinforcement ?? '-'}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{col.tie_spacing_notation ?? `${Number(col.tie_spacing_mm)} mm`}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{Number(col.concrete_volume_cum).toFixed(3)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{Number(col.steel_weight_kg).toFixed(2)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{engineerName}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{packageName}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" className="p-1.5" aria-label="Edit entry" onClick={() => onEditRow(row)}>
                      <Pencil className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      className="p-1.5 hover:text-rose-700"
                      aria-label="Delete entry"
                      onClick={() => onDeleteRow(row)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
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
