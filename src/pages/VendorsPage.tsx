import { useState } from 'react';
import {
  ArrowLeft,
  Building2,
  FileText,
  Pencil,
  Plus,
  Star,
  Store,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/Button';
import { Card, CardHeader } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageHeader } from '@/components/PageHeader';
import { ProgressBar } from '@/components/ProgressBar';
import { StatCard } from '@/components/StatCard';
import { StatusBadge, type BadgeTone } from '@/components/StatusBadge';
import { Tabs } from '@/components/Tabs';
import { EmptyState, ErrorState, LoadingState } from '@/components/StatePanel';
import { useAsyncData } from '@/hooks/useAsyncData';
import { recordActivity } from '@/lib/activity';
import { fetchPrimaryProject } from '@/lib/projects';
import { fetchVendorContracts, fetchVendorPerformance, fetchVendorScorecard, fetchVendors } from '@/lib/vendors';
import { formatDate, formatTaka } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import {
  PERFORMANCE_CRITERION_LABELS,
  PERFORMANCE_CRITERION_WEIGHTS,
  VENDOR_CATEGORY_LABELS,
  VENDOR_PERFORMANCE_LABELS,
  type ProjectRow,
  type VendorContractRow,
  type VendorContractStatus,
  type VendorPerformanceRow,
  type VendorRow,
} from '@/types/database';
import { VendorFormModal } from '@/pages/vendors/VendorFormModal';
import { VendorContractFormModal } from '@/pages/vendors/VendorContractFormModal';
import { PerformanceFormModal } from '@/pages/vendors/PerformanceFormModal';
import { RateHistoryPage } from '@/pages/RateHistoryPage';

const SECTION_TABS = [
  { id: 'vendors', label: 'Vendor Management' },
  { id: 'rates', label: 'Rate History' },
] as const;
type SectionId = (typeof SECTION_TABS)[number]['id'];

const STATUS_TONE: Record<VendorContractStatus, BadgeTone> = {
  draft: 'neutral',
  active: 'success',
  completed: 'info',
  terminated: 'error',
};

const PERF_TONE: Record<string, BadgeTone> = {
  unrated: 'neutral',
  poor: 'error',
  average: 'warning',
  good: 'info',
  excellent: 'success',
};

interface ListData {
  project: ProjectRow | null;
  vendors: VendorRow[];
}

async function loadList(): Promise<ListData> {
  const project = await fetchPrimaryProject();
  if (!project) return { project: null, vendors: [] };
  const vendors = await fetchVendors(project.id);
  return { project, vendors };
}

export function VendorsPage() {
  const { data, error, loading, reload } = useAsyncData(loadList);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<VendorRow | null>(null);
  const [deleting, setDeleting] = useState<VendorRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [section, setSection] = useState<SectionId>('vendors');

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingState />;
  if (!data.project) {
    return <EmptyState icon={Store} title="No project yet" description="Vendors belong to the project. Create the project first." />;
  }

  if (selectedVendorId) {
    const vendor = data.vendors.find((v) => v.id === selectedVendorId);
    if (vendor) {
      return <VendorDetail vendor={vendor} project={data.project} onBack={() => setSelectedVendorId(null)} onChanged={reload} />;
    }
  }

  const { project, vendors } = data;

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);
    const { error: deleteErr } = await supabase.from('vendors').delete().eq('id', deleting.id);
    if (deleteErr) {
      setDeleteBusy(false);
      setDeleteError(deleteErr.message);
      return;
    }
    await recordActivity({
      projectId: project.id,
      action: 'delete',
      entityType: 'vendor',
      entityId: deleting.id,
      summary: `Removed vendor: ${deleting.name}`,
    });
    setDeleteBusy(false);
    setDeleting(null);
    reload();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendor Management"
        description="Maintain supplier records, track contracts, and generate performance scorecards."
        action={section === 'vendors' ? <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden /> Add vendor</Button> : null}
      />
      <Tabs items={SECTION_TABS} activeId={section} onChange={(id) => setSection(id as SectionId)} />

      {section === 'vendors' && (
        <>
      {vendors.length === 0 ? (
        <EmptyState icon={Store} title="No vendors yet" description="Add a supplier to start tracking contracts and performance." action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden /> Add vendor</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {vendors.map((vendor) => (
            <button
              key={vendor.id}
              type="button"
              onClick={() => setSelectedVendorId(vendor.id)}
              className="group flex flex-col rounded-2xl border border-stone-200 bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                  <Store className="h-5 w-5" aria-hidden />
                </span>
                <div className="flex items-center gap-1">
                  <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setEditing(vendor); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setEditing(vendor); } }} className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700">
                    <Pencil className="h-4 w-4" aria-hidden />
                  </span>
                  <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setDeleteError(null); setDeleting(vendor); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setDeleteError(null); setDeleting(vendor); } }} className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-700">
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </span>
                </div>
              </div>
              <h3 className="mt-4 text-base font-semibold text-stone-900 group-hover:text-primary-800">{vendor.name}</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusBadge tone="neutral">{VENDOR_CATEGORY_LABELS[vendor.vendor_category]}</StatusBadge>
                <StatusBadge tone={PERF_TONE[vendor.performance_status]}>{VENDOR_PERFORMANCE_LABELS[vendor.performance_status]}</StatusBadge>
              </div>
              {vendor.contact_person && <p className="mt-2 text-sm text-stone-500">{vendor.contact_person}</p>}
              {vendor.phone && <p className="text-sm text-stone-500">{vendor.phone}</p>}
            </button>
          ))}
        </div>
      )}

      {creating && <VendorFormModal project={project} vendor={null} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); reload(); }} />}
      {editing && <VendorFormModal project={project} vendor={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      <ConfirmDialog open={deleting !== null} title="Delete vendor" message={`Remove "${deleting?.name ?? ''}" and all its contracts and performance reviews? This cannot be undone.`} confirmLabel="Delete vendor" busy={deleteBusy} error={deleteError} onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />
        </>
      )}

      {section === 'rates' && <RateHistoryPage />}
    </div>
  );
}

interface DetailData {
  contracts: VendorContractRow[];
  performance: VendorPerformanceRow[];
  scorecard: { vendor_id: string; review_count: number; avg_quality: number; avg_delivery: number; avg_pricing: number; avg_responsiveness: number; overall_score: number; rating: string } | null;
}

interface DetailProps {
  vendor: VendorRow;
  project: ProjectRow;
  onBack: () => void;
  onChanged: () => void;
}

async function loadDetail(vendorId: string): Promise<DetailData> {
  const [contracts, performance, scorecard] = await Promise.all([
    fetchVendorContracts(vendorId),
    fetchVendorPerformance(vendorId),
    fetchVendorScorecard(vendorId),
  ]);
  return { contracts, performance, scorecard };
}

function VendorDetail({ vendor, project, onBack, onChanged }: DetailProps) {
  const { data, error, loading, reload } = useAsyncData(() => loadDetail(vendor.id));
  const [creatingContract, setCreatingContract] = useState(false);
  const [editingContract, setEditingContract] = useState<VendorContractRow | null>(null);
  const [deletingContract, setDeletingContract] = useState<VendorContractRow | null>(null);
  const [deleteContractBusy, setDeleteContractBusy] = useState(false);
  const [deleteContractError, setDeleteContractError] = useState<string | null>(null);
  const [creatingPerf, setCreatingPerf] = useState(false);
  const [editingPerf, setEditingPerf] = useState<VendorPerformanceRow | null>(null);
  const [deletingPerf, setDeletingPerf] = useState<VendorPerformanceRow | null>(null);
  const [deletePerfBusy, setDeletePerfBusy] = useState(false);
  const [deletePerfError, setDeletePerfError] = useState<string | null>(null);

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingState />;

  const { contracts, performance, scorecard } = data;
  const totalContractValue = contracts.reduce((sum, c) => sum + c.contract_value_bdt, 0);

  async function confirmDeleteContract() {
    if (!deletingContract) return;
    setDeleteContractBusy(true);
    setDeleteContractError(null);
    const { error: deleteErr } = await supabase.from('vendor_contracts').delete().eq('id', deletingContract.id);
    if (deleteErr) {
      setDeleteContractBusy(false);
      setDeleteContractError(deleteErr.message);
      return;
    }
    await recordActivity({ projectId: project.id, action: 'delete', entityType: 'vendor_contract', entityId: deletingContract.id, summary: `Removed contract: ${deletingContract.contract_title}` });
    setDeleteContractBusy(false);
    setDeletingContract(null);
    reload();
    onChanged();
  }

  async function confirmDeletePerf() {
    if (!deletingPerf) return;
    setDeletePerfBusy(true);
    setDeletePerfError(null);
    const { error: deleteErr } = await supabase.from('vendor_performance').delete().eq('id', deletingPerf.id);
    if (deleteErr) {
      setDeletePerfBusy(false);
      setDeletePerfError(deleteErr.message);
      return;
    }
    await recordActivity({ projectId: project.id, action: 'delete', entityType: 'vendor_performance', entityId: deletingPerf.id, summary: `Removed performance review for ${vendor.name}` });
    setDeletePerfBusy(false);
    setDeletingPerf(null);
    reload();
    onChanged();
  }

  return (
    <div className="space-y-6">
      <div>
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-stone-900">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to vendors
        </button>
      </div>

      <PageHeader
        title={vendor.name}
        description={VENDOR_CATEGORY_LABELS[vendor.vendor_category]}
        action={<Button onClick={() => setCreatingContract(true)}><Plus className="h-4 w-4" aria-hidden /> Add contract</Button>}
      />

      <div className="flex flex-wrap gap-2">
        <StatusBadge tone={PERF_TONE[vendor.performance_status]}>{VENDOR_PERFORMANCE_LABELS[vendor.performance_status]}</StatusBadge>
        {vendor.trade_license_number && <StatusBadge tone="neutral">License: {vendor.trade_license_number}</StatusBadge>}
        {vendor.nid_number && <StatusBadge tone="neutral">NID: {vendor.nid_number}</StatusBadge>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Contracts" value={String(contracts.length)} icon={FileText} tone="primary" />
        <StatCard label="Total contract value" value={formatTaka(totalContractValue)} icon={TrendingUp} tone="accent" />
        <StatCard label="Performance reviews" value={String(performance.length)} icon={Star} tone="primary" />
        <StatCard label="Scorecard score" value={scorecard ? `${Number(scorecard.overall_score).toFixed(1)}/10` : '-'} hint={scorecard ? VENDOR_PERFORMANCE_LABELS[scorecard.rating as keyof typeof VENDOR_PERFORMANCE_LABELS] ?? scorecard.rating : 'No reviews yet'} icon={Star} tone="accent" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Contact information" />
          <dl className="mt-3 space-y-2 text-sm">
            <DetailRow label="Contact person" value={vendor.contact_person} />
            <DetailRow label="Phone" value={vendor.phone} />
            <DetailRow label="Email" value={vendor.email} />
            <DetailRow label="Address" value={vendor.address} />
          </dl>
        </Card>
        <Card>
          <CardHeader title="Bank details" />
          <dl className="mt-3 space-y-2 text-sm">
            <DetailRow label="Account name" value={vendor.bank_account_name} />
            <DetailRow label="Account number" value={vendor.bank_account_number} />
            <DetailRow label="Bank" value={vendor.bank_name} />
            <DetailRow label="Branch" value={vendor.bank_branch} />
          </dl>
        </Card>
      </div>

      {scorecard && scorecard.review_count > 0 && <ScorecardSection scorecard={scorecard} />}

      <Card>
        <CardHeader title="Contracts" description={`${contracts.length} contract${contracts.length === 1 ? '' : 's'}`} action={<Button onClick={() => setCreatingContract(true)}><Plus className="h-4 w-4" aria-hidden /> Add contract</Button>} />
        <div className="mt-4 space-y-3">
          {contracts.length === 0 ? (
            <p className="py-6 text-center text-sm text-stone-500">No contracts yet.</p>
          ) : (
            contracts.map((contract) => (
              <div key={contract.id} className="flex items-start justify-between gap-4 rounded-xl border border-stone-100 p-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-stone-400" aria-hidden />
                    <h4 className="text-sm font-semibold text-stone-900">{contract.contract_title}</h4>
                    <StatusBadge tone={STATUS_TONE[contract.status]}>{contract.status}</StatusBadge>
                  </div>
                  {contract.scope && <p className="mt-1 text-sm text-stone-500">{contract.scope}</p>}
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-stone-500">
                    <span>Value: {formatTaka(contract.contract_value_bdt)}</span>
                    {contract.start_date && <span>Start: {formatDate(contract.start_date)}</span>}
                    {contract.end_date && <span>End: {formatDate(contract.end_date)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span role="button" tabIndex={0} onClick={() => setEditingContract(contract)} onKeyDown={(e) => { if (e.key === 'Enter') setEditingContract(contract); }} className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700">
                    <Pencil className="h-4 w-4" aria-hidden />
                  </span>
                  <span role="button" tabIndex={0} onClick={() => { setDeleteContractError(null); setDeletingContract(contract); }} onKeyDown={(e) => { if (e.key === 'Enter') { setDeleteContractError(null); setDeletingContract(contract); } }} className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-700">
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Performance reviews" description={`${performance.length} review${performance.length === 1 ? '' : 's'}`} action={<Button onClick={() => setCreatingPerf(true)}><Plus className="h-4 w-4" aria-hidden /> Add review</Button>} />
        <div className="mt-4 space-y-3">
          {performance.length === 0 ? (
            <p className="py-6 text-center text-sm text-stone-500">No performance reviews yet.</p>
          ) : (
            performance.map((entry) => (
              <div key={entry.id} className="flex items-start justify-between gap-4 rounded-xl border border-stone-100 p-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-amber-500" aria-hidden />
                    <h4 className="text-sm font-semibold text-stone-900">{formatDate(entry.review_date)}</h4>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-4">
                    <ScoreBadge label="Quality" value={entry.quality_score} />
                    <ScoreBadge label="Delivery" value={entry.delivery_score} />
                    <ScoreBadge label="Pricing" value={entry.pricing_score} />
                    <ScoreBadge label="Responsiveness" value={entry.responsiveness_score} />
                  </div>
                  {entry.notes && <p className="mt-2 text-sm text-stone-500">{entry.notes}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <span role="button" tabIndex={0} onClick={() => setEditingPerf(entry)} onKeyDown={(e) => { if (e.key === 'Enter') setEditingPerf(entry); }} className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700">
                    <Pencil className="h-4 w-4" aria-hidden />
                  </span>
                  <span role="button" tabIndex={0} onClick={() => { setDeletePerfError(null); setDeletingPerf(entry); }} onKeyDown={(e) => { if (e.key === 'Enter') { setDeletePerfError(null); setDeletingPerf(entry); } }} className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-700">
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {vendor.notes && (
        <Card>
          <CardHeader title="Notes" />
          <p className="mt-3 whitespace-pre-wrap text-sm text-stone-600">{vendor.notes}</p>
        </Card>
      )}

      {creatingContract && <VendorContractFormModal project={project} vendor={vendor} contract={null} onClose={() => setCreatingContract(false)} onSaved={() => { setCreatingContract(false); reload(); onChanged(); }} />}
      {editingContract && <VendorContractFormModal project={project} vendor={vendor} contract={editingContract} onClose={() => setEditingContract(null)} onSaved={() => { setEditingContract(null); reload(); onChanged(); }} />}
      <ConfirmDialog open={deletingContract !== null} title="Delete contract" message={`Remove "${deletingContract?.contract_title ?? ''}"?`} confirmLabel="Delete contract" busy={deleteContractBusy} error={deleteContractError} onConfirm={confirmDeleteContract} onCancel={() => setDeletingContract(null)} />
      {creatingPerf && <PerformanceFormModal project={project} vendor={vendor} entry={null} onClose={() => setCreatingPerf(false)} onSaved={() => { setCreatingPerf(false); reload(); onChanged(); }} />}
      {editingPerf && <PerformanceFormModal project={project} vendor={vendor} entry={editingPerf} onClose={() => setEditingPerf(null)} onSaved={() => { setEditingPerf(null); reload(); onChanged(); }} />}
      <ConfirmDialog open={deletingPerf !== null} title="Delete performance review" message="Remove this review? This cannot be undone." confirmLabel="Delete review" busy={deletePerfBusy} error={deletePerfError} onConfirm={confirmDeletePerf} onCancel={() => setDeletingPerf(null)} />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-stone-500">{label}</dt>
      <dd className="text-right font-medium text-stone-800">{value}</dd>
    </div>
  );
}

function ScoreBadge({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-stone-50 px-2.5 py-1.5 text-center">
      <p className="text-xs text-stone-500">{label}</p>
      <p className="text-sm font-semibold text-stone-900">{value}/10</p>
    </div>
  );
}

function ScorecardSection({ scorecard }: { scorecard: NonNullable<DetailData['scorecard']> }) {
  const criteria: { key: keyof typeof PERFORMANCE_CRITERION_LABELS; score: number; weight: number }[] = [
    { key: 'quality', score: Number(scorecard.avg_quality), weight: PERFORMANCE_CRITERION_WEIGHTS.quality },
    { key: 'delivery', score: Number(scorecard.avg_delivery), weight: PERFORMANCE_CRITERION_WEIGHTS.delivery },
    { key: 'pricing', score: Number(scorecard.avg_pricing), weight: PERFORMANCE_CRITERION_WEIGHTS.pricing },
    { key: 'responsiveness', score: Number(scorecard.avg_responsiveness), weight: PERFORMANCE_CRITERION_WEIGHTS.responsiveness },
  ];
  const overall = Number(scorecard.overall_score);
  return (
    <Card>
      <CardHeader title="Vendor scorecard" description="Database-calculated from all performance reviews." />
      <div className="mt-4 space-y-4">
        {criteria.map((c) => (
          <div key={c.key}>
            <div className="mb-1 flex justify-between text-sm text-stone-600">
              <span>{PERFORMANCE_CRITERION_LABELS[c.key]} <span className="text-xs text-stone-400">({c.weight}%)</span></span>
              <span className="font-medium text-stone-800">{c.score.toFixed(1)}/10</span>
            </div>
            <ProgressBar value={(c.score / 10) * 100} tone={c.score >= 7 ? 'primary' : c.score >= 5 ? 'warning' : 'error'} label={`${PERFORMANCE_CRITERION_LABELS[c.key]} score`} />
          </div>
        ))}
        <div className="flex items-center justify-between rounded-xl bg-primary-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary-700" aria-hidden />
            <span className="font-semibold text-primary-900">Overall score</span>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge tone={PERF_TONE[scorecard.rating] ?? 'neutral'}>{VENDOR_PERFORMANCE_LABELS[scorecard.rating as keyof typeof VENDOR_PERFORMANCE_LABELS] ?? scorecard.rating}</StatusBadge>
            <span className="text-lg font-bold text-primary-900">{overall.toFixed(2)}/10</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
