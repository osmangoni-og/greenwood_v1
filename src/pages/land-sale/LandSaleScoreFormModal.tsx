import { useState } from 'react';
import { Button } from '@/components/Button';
import { FormError, FormField, inputClassName } from '@/components/FormField';
import { Modal } from '@/components/Modal';
import { getActiveUserId } from '@/lib/activeUser';
import { recordActivity } from '@/lib/activity';
import { supabase } from '@/lib/supabase';
import { LAND_SALE_FACTORS, type LandSaleScoreRow, type MonetizableAssetRow, type ProjectRow } from '@/types/database';

interface Props { project: ProjectRow; assets: MonetizableAssetRow[]; row: LandSaleScoreRow | null; onClose: () => void; onSaved: () => void; }

export function LandSaleScoreFormModal({ project, assets, row, onClose, onSaved }: Props) {
  const [assetId, setAssetId] = useState(row?.asset_id ?? '');
  const [assetName, setAssetName] = useState(row?.asset_name ?? '');
  const [location, setLocation] = useState(row?.location ?? '');
  const [estimatedValue, setEstimatedValue] = useState(row?.estimated_value_bdt ?? 0);
  const [scores, setScores] = useState<Record<string, number>>(Object.fromEntries(LAND_SALE_FACTORS.map((factor) => [factor.key, (row as Record<string, number> | null)?.[factor.key] ?? 5])));
  const [notes, setNotes] = useState(row?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleAssetSelect(id: string) { setAssetId(id); const asset = assets.find((item) => item.id === id); if (asset) { setAssetName(asset.asset_name); setEstimatedValue(Number(asset.estimated_value_bdt)); } }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(null);
    if (!assetName.trim()) { setError('Enter or select an asset name.'); return; }
    setBusy(true);
    try {
      const payload = {
        project_id: project.id,
        asset_id: assetId || null,
        asset_name: assetName.trim(),
        location: location.trim() || null,
        estimated_value_bdt: Number(estimatedValue) || null,
        funding_need_score: scores.funding_need_score,
        market_demand_score: scores.market_demand_score,
        appreciation_potential_score: scores.appreciation_potential_score,
        ease_of_sale_score: scores.ease_of_sale_score,
        ownership_complexity_score: scores.ownership_complexity_score,
        strategic_importance_score: scores.strategic_importance_score,
        future_family_use_score: scores.future_family_use_score,
        income_potential_score: scores.income_potential_score,
        notes: notes.trim() || null,
      };
      const result = row
        ? await supabase.from('land_sale_scores').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', row.id)
        : await supabase.from('land_sale_scores').insert({ ...payload, created_by: getActiveUserId() });
      if (result.error) throw new Error(result.error.message);
      await recordActivity({ projectId: project.id, action: row ? 'update' : 'create', entityType: 'land_sale_score', entityId: row?.id, summary: `${row ? 'Updated' : 'Scored'} land sale priority for ${assetName.trim()}` });
      onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save score.'); } finally { setBusy(false); }
  }

  return <Modal open title={row ? 'Edit land sale score' : 'Score a land asset'} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy ? 'Saving...' : 'Save score'}</Button></>}>
    <form onSubmit={submit} className="space-y-4">
      <FormField label="Link to existing asset" htmlFor="score-asset"><select id="score-asset" className={inputClassName} value={assetId} onChange={(e) => handleAssetSelect(e.target.value)}><option value="">Standalone entry</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.asset_name}</option>)}</select></FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Asset name" htmlFor="score-name"><input id="score-name" className={inputClassName} value={assetName} onChange={(e) => setAssetName(e.target.value)} placeholder="e.g. Savar residential plot" required /></FormField>
        <FormField label="Location" htmlFor="score-location"><input id="score-location" className={inputClassName} value={location} onChange={(e) => setLocation(e.target.value)} /></FormField>
      </div>
      <FormField label="Estimated value (Tk)" htmlFor="score-value"><input id="score-value" type="number" min={0} step="any" className={inputClassName} value={estimatedValue} onChange={(e) => setEstimatedValue(Number(e.target.value))} /></FormField>
      <div className="border-t border-stone-100 pt-4">
        <p className="mb-1 text-sm font-semibold text-stone-800">Factor scores</p>
        <p className="mb-4 text-xs text-stone-500">Score each factor from 1 (low) to 10 (high). The recommendation updates automatically.</p>
        <div className="space-y-4">
          {LAND_SALE_FACTORS.map((factor) => (
            <div key={factor.key}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-stone-800">{factor.label} <span className={factor.group === 'sell' ? 'ml-1 text-xs font-normal text-rose-600' : 'ml-1 text-xs font-normal text-emerald-600'}>{factor.group === 'sell' ? 'sell factor' : 'hold factor'}</span></p>
                  <p className="text-xs text-stone-500">{factor.description}</p>
                </div>
                <span className="text-lg font-bold text-stone-900">{scores[factor.key]}</span>
              </div>
              <input type="range" min={1} max={10} step={1} value={scores[factor.key]} onChange={(e) => setScores((prev) => ({ ...prev, [factor.key]: Number(e.target.value) }))} className="mt-2 w-full accent-primary-700" aria-label={factor.label} />
            </div>
          ))}
        </div>
      </div>
      <FormField label="Notes" htmlFor="score-notes"><textarea id="score-notes" rows={2} className={inputClassName} value={notes} onChange={(e) => setNotes(e.target.value)} /></FormField>
      <FormError message={error} />
    </form>
  </Modal>;
}
