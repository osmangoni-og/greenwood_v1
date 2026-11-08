import { inputClassName } from '@/components/FormField';
import { feetInchesToMm, mmToFeetInches } from '@/lib/units';

interface FeetInchesInputProps {
  id: string;
  label: string;
  valueMm: number;
  onChangeMm: (mm: number) => void;
}

export function FeetInchesInput({ id, label, valueMm, onChangeMm }: FeetInchesInputProps) {
  const { feet, inches } = mmToFeetInches(valueMm);
  const toNumber = (raw: string) => Math.max(0, Number(raw) || 0);

  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium text-stone-700">{label}</legend>
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1 text-xs text-stone-500">
          Feet
          <input
            id={`${id}-feet`}
            type="number"
            min={0}
            step={1}
            className={inputClassName}
            value={feet}
            onChange={(e) => onChangeMm(feetInchesToMm(toNumber(e.target.value), inches))}
          />
        </label>
        <label className="space-y-1 text-xs text-stone-500">
          Inches
          <input
            id={`${id}-inches`}
            type="number"
            min={0}
            step="any"
            className={inputClassName}
            value={inches}
            onChange={(e) => onChangeMm(feetInchesToMm(feet, toNumber(e.target.value)))}
          />
        </label>
      </div>
    </fieldset>
  );
}
