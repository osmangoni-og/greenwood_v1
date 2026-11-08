import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/Button';
import type { RebarRegisterRow } from '@/types/database';

interface RebarRegisterTableProps {
  rows: Record<string, unknown>[];
  packageName: string;
  engineerName: string;
  onEditRow: (row: Record<string, unknown>) => void;
  onDeleteRow: (row: Record<string, unknown>) => void;
}

const HEADERS = ['Element', 'Mark', 'Bar mark', 'Dia (mm)', 'Count', 'Length/bar (m)', 'Total len (m)', 'Unit wt (kg/m)', 'Total wt (kg)', 'Shape', 'Remarks', 'Engineer', 'Package'];

export function RebarRegisterTable({ rows, packageName, engineerName, onEditRow, onDeleteRow }: RebarRegisterTableProps) {
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
            const rebar = row as unknown as RebarRegisterRow;
            return (
              <tr key={rebar.id} className="transition-colors hover:bg-stone-50">
                <td className="px-4 py-3 whitespace-nowrap font-medium text-stone-900">{rebar.element_type}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{rebar.element_mark ?? rebar.mark}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{rebar.bar_mark ?? '-'}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{Number(rebar.bar_diameter_mm)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{Number(rebar.number_of_bars)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{Number(rebar.length_per_bar_m).toFixed(2)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{Number(rebar.total_length_m).toFixed(2)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{Number(rebar.unit_weight_kg_per_m).toFixed(4)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{Number(rebar.total_weight_kg).toFixed(2)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{rebar.shape_code ?? '-'}</td>
                <td className="px-4 py-3 whitespace-nowrap text-stone-700">{rebar.remarks ?? '-'}</td>
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
