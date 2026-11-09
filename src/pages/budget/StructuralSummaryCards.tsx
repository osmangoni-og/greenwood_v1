import { useEffect, useState } from 'react';
import { Box, Columns3, Layers, Square, Weight, Wallet } from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { formatTaka } from '@/lib/format';
import { loadProjectProfile, type ProjectProfileSummary } from '@/lib/projectProfile';

type LoadState = 'loading' | 'ready' | 'error';

export function StructuralSummaryCards() {
  const [profile, setProfile] = useState<ProjectProfileSummary | null>(null);
  const [state, setState] = useState<LoadState>('loading');

  useEffect(() => {
    let cancelled = false;
    loadProjectProfile()
      .then((result) => {
        if (cancelled) return;
        setProfile(result);
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => { cancelled = true; };
  }, []);

  const structure = profile?.structure ?? null;
  const hint = state === 'loading' ? 'Loading structural registers' : state === 'error' ? 'Could not load structural data' : 'From structural registers';
  const shown = (format: () => string) => (structure ? format() : '—');

  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
    <StatCard label="Structural cost" value={shown(() => formatTaka(structure!.structuralCostBdt))} hint={hint} icon={Wallet} tone="primary" />
    <StatCard label="Columns" value={shown(() => String(structure!.totalColumns))} hint={hint} icon={Columns3} tone="accent" />
    <StatCard label="Beams" value={shown(() => String(structure!.totalBeams))} hint={hint} icon={Layers} tone="accent" />
    <StatCard label="Footings" value={shown(() => String(structure!.totalFootings))} hint={hint} icon={Box} tone="accent" />
    <StatCard label="Slabs" value={shown(() => String(structure!.totalSlabs))} hint={hint} icon={Square} tone="accent" />
    <StatCard label="Rebar weight" value={shown(() => `${Math.round(structure!.rebarWeightKg).toLocaleString('en-US')} kg`)} hint={hint} icon={Weight} tone="accent" />
  </div>;
}
