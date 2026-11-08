import { supabase, unwrap } from '@/lib/supabase';
import type {
  BidScoreRow,
  ContractorBidItemRow,
  ContractorBidRow,
  ContractorRankingRow,
  ContractorRow,
  ContractorType,
  ContractorSelectionStatus,
  EvaluationCriterion,
  TenderRow,
} from '@/types/database';

export async function fetchContractors(projectId: string): Promise<ContractorRow[]> {
  return unwrap<ContractorRow[]>(
    await supabase
      .from('contractors')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false }),
  );
}

export async function fetchContractorsByType(projectId: string, type: ContractorType): Promise<ContractorRow[]> {
  return unwrap<ContractorRow[]>(
    await supabase
      .from('contractors')
      .select('*')
      .eq('project_id', projectId)
      .eq('contractor_type', type)
      .order('name', { ascending: true }),
  );
}

export async function setContractorSelection(
  projectId: string,
  contractorId: string,
  status: ContractorSelectionStatus,
): Promise<void> {
  if (status === 'selected') {
    const { error: demoteError } = await supabase
      .from('contractors')
      .update({ selection_status: 'rejected', selection_date: null })
      .eq('project_id', projectId)
      .neq('id', contractorId);
    if (demoteError) throw new Error(demoteError.message);
  }
  const { error } = await supabase
    .from('contractors')
    .update({
      selection_status: status,
      selection_date: status === 'selected' ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq('id', contractorId);
  if (error) throw new Error(error.message);
}

export async function fetchLatestBidItems(contractorId: string): Promise<ContractorBidItemRow[]> {
  const bids = unwrap<{ id: string }[]>(
    await supabase
      .from('contractor_bids')
      .select('id')
      .eq('contractor_id', contractorId)
      .order('created_at', { ascending: false }),
  );
  if (bids.length === 0) return [];
  const items = unwrap<ContractorBidItemRow[]>(
    await supabase
      .from('contractor_bid_items')
      .select('*')
      .in('bid_id', bids.map((b) => b.id))
      .order('sort_order', { ascending: true }),
  );
  const latestBidId = bids.find((b) => items.some((i) => i.bid_id === b.id))?.id;
  return items.filter((i) => i.bid_id === latestBidId);
}

export async function fetchBidItemsForBids(bidIds: string[]): Promise<ContractorBidItemRow[]> {
  if (bidIds.length === 0) return [];
  return unwrap<ContractorBidItemRow[]>(
    await supabase
      .from('contractor_bid_items')
      .select('*')
      .in('bid_id', bidIds)
      .order('sort_order', { ascending: true }),
  );
}

export function buildReferenceAreas(items: ContractorBidItemRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const area = Number(item.area);
    if (area > 0 && !map.has(item.element)) {
      map.set(item.element, area);
    }
  }
  return map;
}

export function computeAverageRate(items: ContractorBidItemRow[]): number | null {
  const totalArea = items.reduce((sum, i) => sum + Number(i.area), 0);
  if (totalArea <= 0) return null;
  const totalAmount = items.reduce((sum, i) => sum + Number(i.amount), 0);
  return totalAmount / totalArea;
}

export async function fetchTenders(projectId: string): Promise<TenderRow[]> {
  return unwrap<TenderRow[]>(
    await supabase
      .from('tenders')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false }),
  );
}

export async function fetchBids(tenderId: string): Promise<ContractorBidRow[]> {
  return unwrap<ContractorBidRow[]>(
    await supabase
      .from('contractor_bids')
      .select('*')
      .eq('tender_id', tenderId)
      .order('created_at', { ascending: false }),
  );
}

export async function fetchScores(bidId: string): Promise<BidScoreRow[]> {
  return unwrap<BidScoreRow[]>(
    await supabase
      .from('bid_scores')
      .select('*')
      .eq('bid_id', bidId)
      .order('criterion', { ascending: true }),
  );
}

export async function fetchRanking(tenderId: string): Promise<ContractorRankingRow[]> {
  const { data, error } = await supabase.rpc('get_contractor_ranking', { p_tender_id: tenderId });
  if (error) throw new Error(error.message);
  return (data ?? []) as ContractorRankingRow[];
}

export async function upsertScore(
  bidId: string,
  criterion: EvaluationCriterion,
  score: number,
): Promise<void> {
  const existing = unwrap<BidScoreRow[]>(
    await supabase.from('bid_scores').select('*').eq('bid_id', bidId).eq('criterion', criterion),
  );
  if (existing.length > 0) {
    const { error } = await supabase
      .from('bid_scores')
      .update({ score, updated_at: new Date().toISOString() })
      .eq('id', existing[0].id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('bid_scores').insert({
      bid_id: bidId,
      criterion,
      score,
    });
    if (error) throw new Error(error.message);
  }
}
