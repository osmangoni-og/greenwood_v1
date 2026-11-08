import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  Gavel,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';
import { Button } from '@/components/Button';
import { Card, CardHeader } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageHeader } from '@/components/PageHeader';
import { ProgressBar } from '@/components/ProgressBar';
import { StatCard } from '@/components/StatCard';
import { StatusBadge, type BadgeTone } from '@/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/StatePanel';
import { useAsyncData } from '@/hooks/useAsyncData';
import { buildReferenceAreas, fetchBidItemsForBids, fetchBids, fetchContractors, fetchRanking, fetchScores, fetchTenders, setContractorSelection, upsertScore } from '@/lib/contractors';
import { recordActivity } from '@/lib/activity';
import { calculateAdvanceAmount } from '@/lib/advancePayment';
import { cx } from '@/lib/cx';
import { formatDate, formatDateTime, formatTaka } from '@/lib/format';
import { fetchPrimaryProject } from '@/lib/projects';
import { supabase } from '@/lib/supabase';
import {
  CONTRACTOR_SELECTION_LABELS,
  CONTRACTOR_TYPE_LABELS,
  CRITERION_LABELS,
  CRITERION_WEIGHTS,
  EVALUATION_CRITERIA,
  type ContractorBidItemRow,
  type ContractorBidRow,
  type ContractorRankingRow,
  type ContractorRow,
  type ContractorSelectionStatus,
  type EvaluationCriterion,
  type ProjectRow,
  type TenderRow,
  type TenderStatus,
} from '@/types/database';
import { ContractorFormModal } from '@/pages/contractors/ContractorFormModal';
import { TenderFormModal } from '@/pages/contractors/TenderFormModal';
import { BidFormModal } from '@/pages/contractors/BidFormModal';
import { BidRateScheduleModal } from '@/pages/contractors/BidRateScheduleModal';
import { RateComparisonPanel } from '@/pages/contractors/RateComparisonPanel';

const TENDER_STATUS_TONE: Record<TenderStatus, BadgeTone> = {
  draft: 'neutral',
  open: 'info',
  under_evaluation: 'warning',
  awarded: 'success',
  closed: 'neutral',
};

const CONTRACTOR_SELECTION_TONE: Record<ContractorSelectionStatus, BadgeTone> = {
  candidate: 'neutral',
  evaluated: 'info',
  selected: 'success',
  inactive: 'warning',
  rejected: 'neutral',
};

interface ListData {
  project: ProjectRow | null;
  contractors: ContractorRow[];
  tenders: TenderRow[];
  rankings: ContractorRankingRow[];
  bidItems: ContractorBidItemRow[];
}

async function loadList(): Promise<ListData> {
  const project = await fetchPrimaryProject();
  if (!project) return { project: null, contractors: [], tenders: [], rankings: [], bidItems: [] };
  const [contractors, tenders] = await Promise.all([
    fetchContractors(project.id),
    fetchTenders(project.id),
  ]);
  const tenderIds = tenders.map((t) => t.id);
  if (tenderIds.length === 0) {
    return { project, contractors, tenders, rankings: [], bidItems: [] };
  }
  const [bidResults, rankingResults] = await Promise.all([
    Promise.all(tenderIds.map((id) => fetchBids(id))),
    Promise.all(tenderIds.map((id) => fetchRanking(id))),
  ]);
  const bids = bidResults.flat();
  const rankings = rankingResults.flat();
  const bidIds = bids.map((b) => b.id);
  const bidItems = bidIds.length > 0 ? await fetchBidItemsForBids(bidIds) : [];
  return { project, contractors, tenders, rankings, bidItems };
}

export function ContractorsPage() {
  const { data, error, loading, reload } = useAsyncData(loadList);
  const [activeTab, setActiveTab] = useState<'tenders' | 'contractors'>('tenders');
  const [selectedTenderId, setSelectedTenderId] = useState<string | null>(null);
  const [creatingContractor, setCreatingContractor] = useState(false);
  const [editingContractor, setEditingContractor] = useState<ContractorRow | null>(null);
  const [deletingContractor, setDeletingContractor] = useState<ContractorRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [creatingTender, setCreatingTender] = useState(false);
  const [editingTender, setEditingTender] = useState<TenderRow | null>(null);
  const [deletingTender, setDeletingTender] = useState<TenderRow | null>(null);
  const [deleteTenderBusy, setDeleteTenderBusy] = useState(false);
  const [deleteTenderError, setDeleteTenderError] = useState<string | null>(null);

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingState />;
  if (!data.project) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="No project yet"
        description="Contractors and tenders belong to the project. Create the project first."
      />
    );
  }

  if (selectedTenderId) {
    const tender = data.tenders.find((t) => t.id === selectedTenderId);
    if (tender) {
      return (
        <TenderDetail
          tender={tender}
          project={data.project}
          contractors={data.contractors}
          onBack={() => setSelectedTenderId(null)}
          onChanged={reload}
        />
      );
    }
  }

  const { project, contractors, tenders, rankings, bidItems } = data;

  const performanceByContractor = new Map<string, number>();
  for (const r of rankings) {
    const existing = performanceByContractor.get(r.contractor_id);
    if (existing === undefined || Number(r.weighted_total) > existing) {
      performanceByContractor.set(r.contractor_id, Number(r.weighted_total));
    }
  }
  const contractorBidIds = new Map<string, string[]>();
  for (const r of rankings) {
    const ids = contractorBidIds.get(r.contractor_id) ?? [];
    ids.push(r.bid_id);
    contractorBidIds.set(r.contractor_id, ids);
  }
  const contractValueByContractor = new Map<string, number>();
  const avgRateByContractor = new Map<string, { rate: number; unit: string }>();
  for (const [contractorId, bIds] of contractorBidIds) {
    const items = bidItems.filter((i) => bIds.includes(i.bid_id));
    const totalAmount = items.reduce((s, i) => s + Number(i.amount), 0);
    const totalArea = items.reduce((s, i) => s + Number(i.area), 0);
    contractValueByContractor.set(contractorId, totalAmount);
    if (totalArea > 0) {
      const unit = items.map((i) => i.unit).find((u) => u && u.trim()) || 'sft';
      avgRateByContractor.set(contractorId, { rate: totalAmount / totalArea, unit });
    }
  }

  async function confirmDeleteContractor() {
    if (!deletingContractor) return;
    setDeleteBusy(true);
    setDeleteError(null);
    const { error: deleteErr } = await supabase.from('contractors').delete().eq('id', deletingContractor.id);
    if (deleteErr) {
      setDeleteBusy(false);
      setDeleteError(deleteErr.message);
      return;
    }
    await recordActivity({
      projectId: project.id,
      action: 'delete',
      entityType: 'contractor',
      entityId: deletingContractor.id,
      summary: `Removed contractor: ${deletingContractor.name}`,
    });
    setDeleteBusy(false);
    setDeletingContractor(null);
    reload();
  }

  async function confirmDeleteTender() {
    if (!deletingTender) return;
    setDeleteTenderBusy(true);
    setDeleteTenderError(null);
    const { error: deleteErr } = await supabase.from('tenders').delete().eq('id', deletingTender.id);
    if (deleteErr) {
      setDeleteTenderBusy(false);
      setDeleteTenderError(deleteErr.message);
      return;
    }
    await recordActivity({
      projectId: project.id,
      action: 'delete',
      entityType: 'tender',
      entityId: deletingTender.id,
      summary: `Removed tender: ${deletingTender.title}`,
    });
    setDeleteTenderBusy(false);
    setDeletingTender(null);
    reload();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contractor Evaluation"
        description="Collect bids, score them on a weighted matrix, and generate database-calculated rankings."
        action={
          activeTab === 'tenders' ? (
            <Button onClick={() => setCreatingTender(true)}>
              <Plus className="h-4 w-4" aria-hidden /> New tender
            </Button>
          ) : (
            <Button onClick={() => setCreatingContractor(true)}>
              <Plus className="h-4 w-4" aria-hidden /> Add contractor
            </Button>
          )
        }
      />

      <div className="flex gap-2 border-b border-stone-200">
        <TabButton active={activeTab === 'tenders'} onClick={() => setActiveTab('tenders')} label="Tenders" icon={Gavel} />
        <TabButton active={activeTab === 'contractors'} onClick={() => setActiveTab('contractors')} label="Contractors" icon={Users} />
      </div>

      {activeTab === 'tenders' ? (
        tenders.length === 0 ? (
          <EmptyState
            icon={Gavel}
            title="No tenders yet"
            description="Create a tender to start collecting contractor bids."
            action={<Button onClick={() => setCreatingTender(true)}><Plus className="h-4 w-4" aria-hidden /> New tender</Button>}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {tenders.map((tender) => (
              <button
                key={tender.id}
                type="button"
                onClick={() => setSelectedTenderId(tender.id)}
                className="group flex flex-col rounded-2xl border border-stone-200 bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                    <Gavel className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="flex items-center gap-1">
                    <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setEditingTender(tender); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setEditingTender(tender); } }} className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700">
                      <Pencil className="h-4 w-4" aria-hidden />
                    </span>
                    <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setDeleteTenderError(null); setDeletingTender(tender); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setDeleteTenderError(null); setDeletingTender(tender); } }} className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-700">
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </span>
                  </div>
                </div>
                <h3 className="mt-4 text-base font-semibold text-stone-900 group-hover:text-primary-800">{tender.title}</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusBadge tone="neutral">{CONTRACTOR_TYPE_LABELS[tender.tender_type]}</StatusBadge>
                  <StatusBadge tone={TENDER_STATUS_TONE[tender.status]}>{tender.status.replace(/_/g, ' ')}</StatusBadge>
                </div>
                <p className="mt-auto pt-4 text-xs text-stone-400">{formatDateTime(tender.created_at)}</p>
              </button>
            ))}
          </div>
        )
      ) : contractors.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No contractors yet"
          description="Add contractors so they can submit bids on tenders."
          action={<Button onClick={() => setCreatingContractor(true)}><Plus className="h-4 w-4" aria-hidden /> Add contractor</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {contractors.map((contractor) => (
            <ContractorCard
              key={contractor.id}
              contractor={contractor}
              isSelected={contractor.selection_status === 'selected'}
              performanceScore={performanceByContractor.get(contractor.id) ?? null}
              contractValue={contractValueByContractor.get(contractor.id) ?? null}
              averageRate={avgRateByContractor.get(contractor.id) ?? null}
              onEdit={() => setEditingContractor(contractor)}
              onDelete={() => { setDeleteError(null); setDeletingContractor(contractor); }}
            />
          ))}
        </div>
      )}

      {creatingTender && <TenderFormModal project={project} tender={null} onClose={() => setCreatingTender(false)} onSaved={() => { setCreatingTender(false); reload(); }} />}
      {editingTender && <TenderFormModal project={project} tender={editingTender} onClose={() => setEditingTender(null)} onSaved={() => { setEditingTender(null); reload(); }} />}
      <ConfirmDialog open={deletingTender !== null} title="Delete tender" message={`Remove "${deletingTender?.title ?? ''}" and all its bids and scores? This cannot be undone.`} confirmLabel="Delete tender" busy={deleteTenderBusy} error={deleteTenderError} onConfirm={confirmDeleteTender} onCancel={() => setDeletingTender(null)} />
      {creatingContractor && <ContractorFormModal project={project} contractor={null} onClose={() => setCreatingContractor(false)} onSaved={() => { setCreatingContractor(false); reload(); }} />}
      {editingContractor && <ContractorFormModal project={project} contractor={editingContractor} onClose={() => setEditingContractor(null)} onSaved={() => { setEditingContractor(null); reload(); }} />}
      <ConfirmDialog open={deletingContractor !== null} title="Delete contractor" message={`Remove "${deletingContractor?.name ?? ''}"? This will fail if bids reference it.`} confirmLabel="Delete contractor" busy={deleteBusy} error={deleteError} onConfirm={confirmDeleteContractor} onCancel={() => setDeletingContractor(null)} />
    </div>
  );
}

interface ContractorCardProps {
  contractor: ContractorRow;
  isSelected: boolean;
  performanceScore: number | null;
  contractValue: number | null;
  averageRate: { rate: number; unit: string } | null;
  onEdit: () => void;
  onDelete: () => void;
}

function ContractorCard({ contractor, isSelected, performanceScore, contractValue, averageRate, onEdit, onDelete }: ContractorCardProps) {
  return (
    <div className={cx('flex flex-col rounded-2xl border p-5 shadow-sm transition-all', isSelected ? 'border-2 border-primary-300 bg-primary-50/40 ring-1 ring-primary-200' : 'border-stone-200 bg-white')}>
      <div className="flex items-center justify-between gap-3">
        <span className={cx('flex h-10 w-10 items-center justify-center rounded-xl', isSelected ? 'bg-primary-100 text-primary-700' : 'bg-primary-50 text-primary-700')}>
          {isSelected ? <CheckCircle2 className="h-5 w-5" aria-hidden /> : <Users className="h-5 w-5" aria-hidden />}
        </span>
        <div className="flex items-center gap-1">
          <span role="button" tabIndex={0} onClick={onEdit} onKeyDown={(e) => { if (e.key === 'Enter') onEdit(); }} className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700">
            <Pencil className="h-4 w-4" aria-hidden />
          </span>
          <span role="button" tabIndex={0} onClick={onDelete} onKeyDown={(e) => { if (e.key === 'Enter') onDelete(); }} className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-700">
            <Trash2 className="h-4 w-4" aria-hidden />
          </span>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <h3 className="text-base font-semibold text-stone-900">{contractor.name}</h3>
        {isSelected && <StatusBadge tone="success">Selected</StatusBadge>}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <StatusBadge tone="primary">{CONTRACTOR_TYPE_LABELS[contractor.contractor_type]}</StatusBadge>
        {contractor.years_experience > 0 && <StatusBadge tone="neutral">{contractor.years_experience} yrs exp</StatusBadge>}
        <StatusBadge tone={CONTRACTOR_SELECTION_TONE[contractor.selection_status]}>{CONTRACTOR_SELECTION_LABELS[contractor.selection_status]}</StatusBadge>
      </div>
      {contractor.contact_person && <p className="mt-2 text-sm text-stone-500">{contractor.contact_person}</p>}
      {contractor.phone && <p className="text-sm text-stone-500">{contractor.phone}</p>}
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg bg-stone-50 px-3 py-2">
          <p className="text-xs text-stone-500">Contract value</p>
          <p className="text-sm font-semibold text-stone-900">{contractValue !== null && contractValue > 0 ? formatTaka(contractValue) : 'No bid'}</p>
        </div>
        <div className="rounded-lg bg-stone-50 px-3 py-2">
          <p className="text-xs text-stone-500">Average rate</p>
          <p className="text-sm font-semibold text-stone-900">{averageRate !== null ? `${formatTaka(averageRate.rate)} / ${averageRate.unit}` : 'No rates'}</p>
        </div>
        <div className="rounded-lg bg-stone-50 px-3 py-2">
          <p className="text-xs text-stone-500">Performance score</p>
          <p className="text-sm font-semibold text-stone-900">{performanceScore !== null ? `${performanceScore.toFixed(2)}/10` : 'Not scored'}</p>
        </div>
      </div>
      <div className="mt-auto border-t border-stone-100 pt-4 text-xs text-stone-500">
        {contractor.selection_date ? `Selected on ${formatDate(contractor.selection_date)}` : 'Not selected'}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label, icon: Icon }: { active: boolean; onClick: () => void; label: string; icon: typeof Gavel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
        active ? 'border-primary-700 text-primary-800' : 'border-transparent text-stone-500 hover:text-stone-800',
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {label}
    </button>
  );
}

interface DetailData {
  bids: ContractorBidRow[];
  ranking: ContractorRankingRow[];
  items: ContractorBidItemRow[];
}

interface DetailProps {
  tender: TenderRow;
  project: ProjectRow;
  contractors: ContractorRow[];
  onBack: () => void;
  onChanged: () => void;
}

function TenderDetail({ tender, project, contractors, onBack, onChanged }: DetailProps) {
  const { data, error, loading, reload } = useAsyncData(async (): Promise<DetailData> => {
    const [bids, ranking] = await Promise.all([fetchBids(tender.id), fetchRanking(tender.id)]);
    const items = await fetchBidItemsForBids(bids.map((b) => b.id));
    return { bids, ranking, items };
  });
  const [creatingBid, setCreatingBid] = useState(false);
  const [editingBid, setEditingBid] = useState<ContractorBidRow | null>(null);
  const [deletingBid, setDeletingBid] = useState<ContractorBidRow | null>(null);
  const [deleteBidBusy, setDeleteBidBusy] = useState(false);
  const [deleteBidError, setDeleteBidError] = useState<string | null>(null);
  const [rateBid, setRateBid] = useState<ContractorBidRow | null>(null);
  const [selectBusyId, setSelectBusyId] = useState<string | null>(null);
  const [selectError, setSelectError] = useState<string | null>(null);

  const eligibleContractors = useMemo(
    () => contractors.filter((c) => c.contractor_type === tender.tender_type),
    [contractors, tender.tender_type],
  );

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingState />;

  const { bids, ranking, items } = data;
  const bidTotals = new Map<string, number>();
  for (const item of items) {
    bidTotals.set(item.bid_id, (bidTotals.get(item.bid_id) ?? 0) + Number(item.amount));
  }
  const nameForBid = (bid: ContractorBidRow) => contractors.find((c) => c.id === bid.contractor_id)?.name ?? 'Unknown';
  const comparisonBidders = bids.map((bid) => ({ bidId: bid.id, name: nameForBid(bid) }));

  async function handleSelectContractor(contractor: ContractorRow) {
    setSelectBusyId(contractor.id);
    setSelectError(null);
    try {
      await setContractorSelection(project.id, contractor.id, 'selected');
      await recordActivity({
        projectId: project.id,
        action: 'update',
        entityType: 'contractor',
        entityId: contractor.id,
        summary: `Selected ${contractor.name} as winning contractor for ${tender.title}`,
      });
      reload();
      onChanged();
    } catch (err) {
      setSelectError(err instanceof Error ? err.message : 'Could not select contractor.');
    } finally {
      setSelectBusyId(null);
    }
  }

  async function confirmDeleteBid() {
    if (!deletingBid) return;
    setDeleteBidBusy(true);
    setDeleteBidError(null);
    const { error: deleteErr } = await supabase.from('contractor_bids').delete().eq('id', deletingBid.id);
    if (deleteErr) {
      setDeleteBidBusy(false);
      setDeleteBidError(deleteErr.message);
      return;
    }
    await recordActivity({
      projectId: project.id,
      action: 'delete',
      entityType: 'contractor_bid',
      entityId: deletingBid.id,
      summary: `Removed bid from ${tender.title}`,
    });
    setDeleteBidBusy(false);
    setDeletingBid(null);
    reload();
    onChanged();
  }

  return (
    <div className="space-y-6">
      <div>
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-stone-900">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to tenders
        </button>
      </div>

      <PageHeader
        title={tender.title}
        description={`${CONTRACTOR_TYPE_LABELS[tender.tender_type]} - ${tender.status.replace(/_/g, ' ')}`}
        action={
          <Button onClick={() => setCreatingBid(true)} disabled={eligibleContractors.length === 0}>
            <Plus className="h-4 w-4" aria-hidden /> Add bid
          </Button>
        }
      />

      {selectError && <p className="text-sm text-rose-700">{selectError}</p>}

      {eligibleContractors.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No {CONTRACTOR_TYPE_LABELS[tender.tender_type]} contractors found. Add contractors of this type to receive bids.
        </div>
      )}

      {tender.scope_description && (
        <Card>
          <CardHeader title="Scope of work" />
          <p className="mt-3 whitespace-pre-wrap text-sm text-stone-600">{tender.scope_description}</p>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Bids received" value={String(bids.length)} icon={Gavel} tone="primary" />
        <StatCard label="Lowest quote" value={bids.length > 0 ? formatTaka(Math.min(...bids.map((b) => b.quotation_amount_bdt))) : '-'} icon={TrendingUp} tone="accent" />
        <StatCard label="Highest quote" value={bids.length > 0 ? formatTaka(Math.max(...bids.map((b) => b.quotation_amount_bdt))) : '-'} icon={TrendingUp} tone="primary" />
        <StatCard label="Top ranked" value={ranking.length > 0 ? ranking[0].contractor_name : '-'} hint={ranking.length > 0 ? `Score ${Number(ranking[0].weighted_total).toFixed(2)}/10` : undefined} icon={Trophy} tone="accent" />
      </div>

      {ranking.length > 0 && <RankingTable ranking={ranking} />}

      <SelectedContractorCard contractors={contractors} items={items} bidTotals={bidTotals} />

      {bids.length > 0 && <RateComparisonPanel bidders={comparisonBidders} items={items} />}

      {bids.length === 0 ? (
        <EmptyState icon={Gavel} title="No bids yet" description="Add a bid to start the evaluation." action={<Button onClick={() => setCreatingBid(true)} disabled={eligibleContractors.length === 0}><Plus className="h-4 w-4" aria-hidden /> Add bid</Button>} />
      ) : (
        <div className="space-y-4">
          {bids.map((bid) => {
            const contractor = contractors.find((c) => c.id === bid.contractor_id);
            const rank = ranking.find((r) => r.bid_id === bid.id);
            return (
              <BidCard
                key={bid.id}
                bid={bid}
                contractorName={contractor?.name ?? 'Unknown'}
                rank={rank?.rank}
                weightedTotal={rank ? Number(rank.weighted_total) : null}
                isWinning={contractor?.selection_status === 'selected'}
                selectBusy={selectBusyId === contractor?.id}
                onEdit={() => setEditingBid(bid)}
                onRateSchedule={() => setRateBid(bid)}
                onDelete={() => { setDeleteBidError(null); setDeletingBid(bid); }}
                onSelect={() => contractor && void handleSelectContractor(contractor)}
                onScoreChanged={reload}
                projectId={project.id}
                tenderTitle={tender.title}
              />
            );
          })}
        </div>
      )}

      {creatingBid && <BidFormModal project={project} tender={tender} bid={null} contractors={eligibleContractors} onClose={() => setCreatingBid(false)} onSaved={() => { setCreatingBid(false); reload(); onChanged(); }} />}
      {rateBid && (
        <BidRateScheduleModal
          projectId={project.id}
          bid={rateBid}
          contractorName={contractors.find((c) => c.id === rateBid.contractor_id)?.name ?? 'Unknown'}
          otherLowestBidTotal={lowestOtherBidTotal(bidTotals, rateBid.id)}
          referenceAreas={buildReferenceAreas(items.filter((i) => i.bid_id !== rateBid.id))}
          onClose={() => setRateBid(null)}
          onSaved={() => { setRateBid(null); reload(); onChanged(); }}
        />
      )}
      {editingBid && <BidFormModal project={project} tender={tender} bid={editingBid} contractors={eligibleContractors} onClose={() => setEditingBid(null)} onSaved={() => { setEditingBid(null); reload(); onChanged(); }} />}
      <ConfirmDialog open={deletingBid !== null} title="Delete bid" message={`Remove this bid? This cannot be undone.`} confirmLabel="Delete bid" busy={deleteBidBusy} error={deleteBidError} onConfirm={confirmDeleteBid} onCancel={() => setDeletingBid(null)} />
    </div>
  );
}

function lowestOtherBidTotal(bidTotals: Map<string, number>, excludeBidId: string): number | null {
  const others = [...bidTotals.entries()].filter(([bidId]) => bidId !== excludeBidId).map(([, total]) => total);
  return others.length > 0 ? Math.min(...others) : null;
}

function SelectedContractorCard({ contractors, items, bidTotals }: { contractors: ContractorRow[]; items: ContractorBidItemRow[]; bidTotals: Map<string, number> }) {
  const selected = contractors.find((c) => c.selection_status === 'selected');
  if (!selected) {
    return (
      <Card>
        <CardHeader title="Selected contractor" description="One contractor is selected for the project." />
        <p className="mt-3 text-sm text-stone-500">No contractor has been selected yet. Select a winning contractor from a bid above.</p>
      </Card>
    );
  }
  const selectedBidItems = items.filter((i) => i.bid_id !== null);
  const selectedBidTotal = bidTotals.size > 0 ? Math.min(...[...bidTotals.values()]) : null;
  const totalArea = selectedBidItems.reduce((s, i) => s + Number(i.area), 0);
  const totalAmount = selectedBidItems.reduce((s, i) => s + Number(i.amount), 0);
  const avgRate = totalArea > 0 ? totalAmount / totalArea : null;
  const avgUnit = selectedBidItems.map((i) => i.unit).find((u) => u && u.trim()) || 'sft';
  const lowestCompeting = selectedBidTotal !== null ? selectedBidTotal : null;
  const potentialSaving = lowestCompeting !== null && totalAmount > 0 ? lowestCompeting - totalAmount : null;
  return (
    <Card>
      <CardHeader title="Selected contractor" description="The contractor chosen for this project." />
      <div className="mt-4 rounded-xl border-2 border-primary-200 bg-primary-50/40 p-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-primary-700" aria-hidden />
          <p className="text-sm font-semibold text-primary-900">{selected.name}</p>
          <StatusBadge tone="success">{CONTRACTOR_SELECTION_LABELS[selected.selection_status]}</StatusBadge>
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-xs text-stone-500">Selection date</p>
            <p className="text-sm font-semibold text-stone-900">{selected.selection_date ? formatDate(selected.selection_date) : 'Not set'}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Contract value</p>
            <p className="text-sm font-semibold text-stone-900">{totalAmount > 0 ? formatTaka(totalAmount) : 'No rate schedule'}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Average rate</p>
            <p className="text-sm font-semibold text-stone-900">{avgRate !== null ? `${formatTaka(avgRate)} / ${avgUnit}` : 'No rate schedule'}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Lowest competing bid</p>
            <p className="text-sm font-semibold text-stone-900">{lowestCompeting !== null ? formatTaka(lowestCompeting) : 'No other bids'}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Potential saving</p>
            <p className="text-sm font-semibold text-stone-900">{potentialSaving !== null ? formatTaka(potentialSaving) : 'Not available'}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

function RankingTable({ ranking }: { ranking: ContractorRankingRow[] }) {
  return (
    <Card>
      <CardHeader title="Contractor rankings" description="Generated by the database using the weighted evaluation matrix." />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
              <th className="py-2 pr-4 font-medium">Rank</th>
              <th className="py-2 pr-4 font-medium">Contractor</th>
              <th className="py-2 pr-4 text-right font-medium">Quote</th>
              <th className="py-2 pr-4 text-right font-medium">Advance</th>
              <th className="py-2 pr-4 text-right font-medium">Timeline</th>
              <th className="py-2 pr-4 text-right font-medium">Weighted score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {ranking.map((row) => (
              <tr key={row.bid_id} className={cx('hover:bg-stone-50', row.rank === 1 && 'bg-amber-50/60')}>
                <td className="py-2 pr-4">
                  {row.rank === 1 ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-700"><Trophy className="h-4 w-4" aria-hidden /> 1</span>
                  ) : (
                    <span className="font-medium text-stone-600">{row.rank}</span>
                  )}
                </td>
                <td className="py-2 pr-4 font-medium text-stone-800">{row.contractor_name}</td>
                <td className="py-2 pr-4 text-right text-stone-600">{formatTaka(Number(row.quotation_amount_bdt))}</td>
                <td className="py-2 pr-4 text-right text-stone-600">{Number(row.advance_required_pct).toFixed(0)}%</td>
                <td className="py-2 pr-4 text-right text-stone-600">{row.timeline_days}d</td>
                <td className="py-2 pr-4 text-right">
                  <span className="font-semibold text-stone-900">{Number(row.weighted_total).toFixed(2)}</span>
                  <span className="text-stone-400">/10</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

interface BidCardProps {
  bid: ContractorBidRow;
  contractorName: string;
  rank: number | undefined;
  weightedTotal: number | null;
  isWinning: boolean;
  selectBusy: boolean;
  onEdit: () => void;
  onRateSchedule: () => void;
  onDelete: () => void;
  onSelect: () => void;
  onScoreChanged: () => void;
  projectId: string;
  tenderTitle: string;
}

function BidCard({ bid, contractorName, rank, weightedTotal, isWinning, selectBusy, onEdit, onRateSchedule, onDelete, onSelect, onScoreChanged, projectId, tenderTitle }: BidCardProps) {
  const { data: scores, error: scoreError, loading: loadingScores } = useAsyncData<Record<string, number>>(async () => {
    const rows = await fetchScores(bid.id);
    const map: Record<string, number> = {};
    for (const row of rows) {
      map[row.criterion] = row.score;
    }
    return map;
  });
  const [localScores, setLocalScores] = useState<Record<string, number>>({});
  const [updateError, setUpdateError] = useState<string | null>(null);

  const currentScores = Object.keys(localScores).length > 0 ? localScores : (scores ?? {});

  async function handleScoreChange(criterion: EvaluationCriterion, value: number) {
    setLocalScores((prev) => ({ ...prev, [criterion]: value }));
    try {
      await upsertScore(bid.id, criterion, value);
      await recordActivity({
        projectId,
        action: 'update',
        entityType: 'bid_score',
        entityId: bid.id,
        summary: `Scored ${criterion} for ${tenderTitle} - ${contractorName}`,
      });
      onScoreChanged();
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : 'Could not save score.');
    }
  }

  return (
    <Card>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold text-stone-900">{contractorName}</h3>
            {rank && (
              <StatusBadge tone={rank === 1 ? 'success' : 'neutral'}>Rank {rank}</StatusBadge>
            )}
            {weightedTotal !== null && (
              <StatusBadge tone="primary">Score {weightedTotal.toFixed(2)}/10</StatusBadge>
            )}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-stone-50 px-3 py-2">
              <p className="text-xs text-stone-500">Quotation</p>
              <p className="text-sm font-semibold text-stone-900">{formatTaka(bid.quotation_amount_bdt)}</p>
            </div>
            <div className="rounded-lg bg-stone-50 px-3 py-2">
              <p className="text-xs text-stone-500">Advance</p>
              <p className="text-sm font-semibold text-stone-900">{bid.advance_required_pct}% ({formatTaka(calculateAdvanceAmount(bid.quotation_amount_bdt, bid.advance_required_pct))})</p>
            </div>
            <div className="rounded-lg bg-stone-50 px-3 py-2">
              <p className="text-xs text-stone-500">Timeline</p>
              <p className="text-sm font-semibold text-stone-900">{bid.timeline_days} days</p>
            </div>
            <div className="rounded-lg bg-stone-50 px-3 py-2">
              <p className="text-xs text-stone-500">Payment terms</p>
              <p className="text-sm text-stone-700">{bid.payment_terms ?? '-'}</p>
            </div>
          </div>
          {bid.scope_notes && <p className="mt-3 text-sm text-stone-500">{bid.scope_notes}</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          {isWinning ? (
            <StatusBadge tone="success">Winning contractor</StatusBadge>
          ) : (
            <Button variant="secondary" disabled={selectBusy} onClick={onSelect}>
              <CheckCircle2 className="h-4 w-4" aria-hidden /> Select as winning
            </Button>
          )}
          <div className="flex items-center gap-1">
            <span role="button" tabIndex={0} title="Rate schedule" onClick={onRateSchedule} onKeyDown={(e) => { if (e.key === 'Enter') onRateSchedule(); }} className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700">
              <Calculator className="h-4 w-4" aria-hidden />
            </span>
            <span role="button" tabIndex={0} onClick={onEdit} onKeyDown={(e) => { if (e.key === 'Enter') onEdit(); }} className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700">
              <Pencil className="h-4 w-4" aria-hidden />
            </span>
            <span role="button" tabIndex={0} onClick={onDelete} onKeyDown={(e) => { if (e.key === 'Enter') onDelete(); }} className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-700">
              <Trash2 className="h-4 w-4" aria-hidden />
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5 border-t border-stone-100 pt-4">
        <h4 className="text-sm font-semibold text-stone-800">Evaluation matrix</h4>
        <p className="mt-0.5 text-xs text-stone-500">Score each criterion from 1 to 10. Weighted total is calculated by the database.</p>
        {loadingScores ? (
          <p className="mt-3 text-sm text-stone-400">Loading scores...</p>
        ) : (
          <div className="mt-4 space-y-4">
            {EVALUATION_CRITERIA.map((criterion) => (
              <ScoreRow
                key={criterion}
                criterion={criterion}
                value={currentScores[criterion] ?? 5}
                onChange={(v) => handleScoreChange(criterion, v)}
              />
            ))}
          </div>
        )}
        {(scoreError || updateError) && (
          <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{scoreError ?? updateError}</p>
        )}
      </div>
    </Card>
  );
}

function ScoreRow({ criterion, value, onChange }: { criterion: EvaluationCriterion; value: number; onChange: (v: number) => void }) {
  const weight = CRITERION_WEIGHTS[criterion];
  const label = CRITERION_LABELS[criterion];
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm text-stone-600">
        <span>{label} <span className="text-xs text-stone-400">({weight}%)</span></span>
        <span className="font-medium text-stone-800">{value}/10</span>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={1}
          max={10}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-stone-200 accent-primary-700"
          aria-label={`${label} score`}
        />
        <div className="w-24">
          <ProgressBar value={(value / 10) * 100} tone="primary" label={`${label} progress`} />
        </div>
      </div>
    </div>
  );
}
