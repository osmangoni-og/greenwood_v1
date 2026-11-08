import { useState, type FormEvent } from 'react';
import { Card, CardHeader } from '@/components/Card';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { recordActivity } from '@/lib/activity';
import { BUDGET_ALERT_KEY } from '@/lib/settings';
import { supabase } from '@/lib/supabase';

interface PreferencesCardProps {
  projectId: string | null;
  threshold: number;
  onSaved: () => void;
}

const FORM_ID = 'preferences-form';

export function PreferencesCard({ projectId, threshold, onSaved }: PreferencesCardProps) {
  const [value, setValue] = useState(String(threshold));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const pct = Number(value);
    if (!Number.isInteger(pct) || pct < 1 || pct > 100) {
      setError('Enter a whole number from 1 to 100.');
      return;
    }

    setSaving(true);
    setError(null);
    const { error: saveError } = await supabase.from('settings').upsert(
      {
        key: BUDGET_ALERT_KEY,
        value: { value: pct },
        description: 'Warn when spending reaches this percent of budget',
      },
      { onConflict: 'key' },
    );
    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    await recordActivity({
      projectId,
      action: 'update',
      entityType: 'preference',
      summary: `Budget alert threshold set to ${pct}%`,
    });
    onSaved();
  }

  return (
    <Card>
      <CardHeader
        title="Budget alerts"
        description="A warning notification is created when spending first reaches this share of the budget."
      />
      <form id={FORM_ID} onSubmit={handleSubmit} className="mt-6 max-w-sm space-y-5">
        <FormError message={error} />
        <FormField label="Alert threshold (% of budget)" htmlFor="alert-threshold" hint="Enter a value from 1 to 100.">
          <input
            id="alert-threshold"
            type="number"
            min={1}
            max={100}
            step={1}
            className={inputClassName}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </FormField>
        <Button type="submit" form={FORM_ID} disabled={saving}>
          {saving ? 'Saving...' : 'Save preferences'}
        </Button>
      </form>
    </Card>
  );
}
