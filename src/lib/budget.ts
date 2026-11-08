import { fetchCashForecasts, fetchConstructionFinanceSummary, fetchFundingSources } from '@/lib/constructionFinance';
import { fetchConstructionPhases, type ConstructionPhaseRow } from '@/lib/constructionTracking';
import { fetchFundingDependencies } from '@/lib/fundingDependencies';
import { buildFundingSummary, type FundingSummary } from '@/lib/fundingSummary';
import { fetchRateVendors } from '@/lib/rates';
import { supabase, unwrap } from '@/lib/supabase';
import type {
  BudgetContingencyDrawdownRow,
  BudgetRevisionTrigger,
  BudgetRevisionRow,
  BudgetVersionLineRow,
  BudgetVersionRow,
  ConstructionCashFlowForecastRow,
  ConstructionFundingSourceRow,
  ContingencyCategory,
  ContractorPaymentRow,
  CostCommitmentRow,
  CostCommitmentType,
  FundingDependencyRow,
  LaborPaymentRow,
  MaterialDeliveryLinkRow,
  ProjectCostActualRow,
  ProjectCostCommittedRow,
  PurchaseOrderRow,
  SupplierInvoiceBalanceRow,
  SupplierPaymentRow,
  VendorRow,
} from '@/types/database';

export interface BudgetWorkspace {
  versions: BudgetVersionRow[];
  lines: BudgetVersionLineRow[];
  revisions: BudgetRevisionRow[];
  drawdowns: BudgetContingencyDrawdownRow[];
  actuals: ProjectCostActualRow[];
  committed: ProjectCostCommittedRow[];
  contractorPayments: ContractorPaymentRow[];
  laborPayments: LaborPaymentRow[];
  purchaseOrders: PurchaseOrderRow[];
  commitments: CostCommitmentRow[];
  deliveries: MaterialDeliveryLinkRow[];
  supplierInvoices: SupplierInvoiceBalanceRow[];
  supplierPayments: SupplierPaymentRow[];
  phases: ConstructionPhaseRow[];
  vendors: VendorRow[];
  fundingSources: ConstructionFundingSourceRow[];
  fundingDependencies: FundingDependencyRow[];
  fundingSummary: FundingSummary;
  cashForecasts: ConstructionCashFlowForecastRow[];
}

function activeBudgetLines(versions: BudgetVersionRow[], lines: BudgetVersionLineRow[]): BudgetVersionLineRow[] {
  const active = versions.find((version) => version.is_active) ?? null;
  return active ? lines.filter((line) => line.budget_version_id === active.id) : [];
}

export async function loadBudgetWorkspace(projectId: string): Promise<BudgetWorkspace> {
  const [versions, lines, revisions, drawdowns, actuals, committed, contractorPayments, laborPayments, purchaseOrders, commitments, deliveries, supplierInvoices, supplierPayments, phases, vendors, fundingSources, fundingDependencies, funding, cashForecasts] = await Promise.all([
    supabase.from('budget_versions').select('*').eq('project_id', projectId).order('version_number', { ascending: false }),
    supabase.from('budget_version_lines').select('*').eq('project_id', projectId).order('category'),
    supabase.from('budget_revisions').select('*').eq('project_id', projectId).order('revision_number', { ascending: false }),
    supabase.from('budget_contingencies').select('*').eq('project_id', projectId).order('drawdown_date', { ascending: false }),
    supabase.from('project_cost_actuals').select('*').eq('project_id', projectId),
    supabase.from('project_cost_committed').select('*').eq('project_id', projectId),
    supabase.from('contractor_payments').select('*').eq('project_id', projectId).order('payment_date', { ascending: false }),
    supabase.from('labor_payments').select('*').eq('project_id', projectId).order('payment_date', { ascending: false }),
    supabase.from('purchase_orders').select('*').eq('project_id', projectId).order('order_date', { ascending: false }),
    supabase.from('cost_commitments').select('*').eq('project_id', projectId).order('party_name'),
    supabase.from('material_deliveries').select('id, project_id, delivery_date, material_type, total_amount_bdt, purchase_order_id').eq('project_id', projectId).order('delivery_date', { ascending: false }),
    supabase.from('supplier_invoice_balances').select('*').eq('project_id', projectId).order('invoice_date', { ascending: false }),
    supabase.from('supplier_payments').select('*').eq('project_id', projectId).order('payment_date', { ascending: false }),
    fetchConstructionPhases(projectId),
    fetchRateVendors(projectId),
    fetchFundingSources(projectId),
    fetchFundingDependencies(projectId),
    fetchConstructionFinanceSummary(projectId),
    fetchCashForecasts(projectId),
  ]);
  const versionRows = unwrap<BudgetVersionRow[]>(versions);
  const lineRows = unwrap<BudgetVersionLineRow[]>(lines);
  return {
    versions: versionRows,
    lines: lineRows,
    revisions: unwrap<BudgetRevisionRow[]>(revisions),
    drawdowns: unwrap<BudgetContingencyDrawdownRow[]>(drawdowns),
    actuals: unwrap<ProjectCostActualRow[]>(actuals),
    committed: unwrap<ProjectCostCommittedRow[]>(committed),
    contractorPayments: unwrap<ContractorPaymentRow[]>(contractorPayments),
    laborPayments: unwrap<LaborPaymentRow[]>(laborPayments),
    purchaseOrders: unwrap<PurchaseOrderRow[]>(purchaseOrders),
    commitments: unwrap<CostCommitmentRow[]>(commitments),
    deliveries: unwrap<MaterialDeliveryLinkRow[]>(deliveries),
    supplierInvoices: unwrap<SupplierInvoiceBalanceRow[]>(supplierInvoices),
    supplierPayments: unwrap<SupplierPaymentRow[]>(supplierPayments),
    phases,
    vendors,
    fundingSources,
    fundingDependencies,
    fundingSummary: buildFundingSummary({ budgetLines: activeBudgetLines(versionRows, lineRows), sources: fundingSources, finance: funding }),
    cashForecasts,
  };
}

export async function updateBudgetVersionLabel(
  versionId: string,
  versionLabel: string,
  notes: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('budget_versions')
    .update({ version_label: versionLabel.trim(), notes: notes?.trim() || null })
    .eq('id', versionId);
  if (error) throw new Error(error.message);
}

export async function updateBudgetRevision(
  revisionId: string,
  patch: { reason?: string; trigger_type?: BudgetRevisionTrigger; revision_note?: string | null; impact_description?: string | null },
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.reason !== undefined) update.reason = patch.reason.trim();
  if (patch.trigger_type !== undefined) update.trigger_type = patch.trigger_type;
  if (patch.revision_note !== undefined) update.revision_note = patch.revision_note?.trim() || null;
  if (patch.impact_description !== undefined) update.impact_description = patch.impact_description?.trim() || null;
  const { error } = await supabase.from('budget_revisions').update(update).eq('id', revisionId);
  if (error) throw new Error(error.message);
}

export async function createBudgetDraft(projectId: string, copyFromVersionId: string | null): Promise<string> {
  const { data, error } = await supabase.rpc('create_budget_draft', { p_project_id: projectId, p_copy_from: copyFromVersionId });
  if (error) throw new Error(error.message);
  return data as string;
}

export interface DraftLineInput {
  level: BudgetVersionLineRow['level'];
  category: string;
  phase_key: string | null;
  budget_amount_bdt: number;
  notes: string | null;
}

export async function replaceDraftLines(projectId: string, versionId: string, lines: DraftLineInput[]): Promise<void> {
  const cleared = await supabase.from('budget_version_lines').delete().eq('budget_version_id', versionId);
  if (cleared.error) throw new Error(cleared.error.message);
  if (lines.length === 0) return;
  const inserted = await supabase.from('budget_version_lines').insert(lines.map((line) => ({ ...line, budget_version_id: versionId, project_id: projectId })));
  if (inserted.error) throw new Error(inserted.error.message);
}

export async function approveBudgetVersion(
  versionId: string,
  reason: string,
  approvedBy: string,
  triggerType: BudgetRevisionTrigger = 'other',
  revisionNote?: string,
  impactDescription?: string,
): Promise<void> {
  const { error } = await supabase.rpc('approve_budget_version', {
    p_version_id: versionId,
    p_reason: reason,
    p_approved_by: approvedBy,
    p_trigger_type: triggerType,
    p_revision_note: revisionNote ?? null,
    p_impact_description: impactDescription ?? null,
  });
  if (error) throw new Error(error.message);
}

export interface ContingencyDrawdownInput {
  projectId: string;
  budgetVersionId: string;
  drawdownDate: string;
  amount: number;
  category: ContingencyCategory;
  phaseKey: string | null;
  purpose: string;
  approvedBy: string;
  notes: string | null;
}

export async function recordContingencyDrawdown(input: ContingencyDrawdownInput): Promise<void> {
  const { error } = await supabase.from('budget_contingencies').insert({
    project_id: input.projectId,
    budget_version_id: input.budgetVersionId,
    drawdown_date: input.drawdownDate,
    amount_bdt: input.amount,
    category: input.category,
    phase_key: input.phaseKey,
    purpose: input.purpose,
    approved_by: input.approvedBy,
    notes: input.notes,
  });
  if (error) throw new Error(error.message);
}

export async function cancelPurchaseOrder(id: string): Promise<void> {
  const { error } = await supabase.from('purchase_orders').update({ status: 'cancelled' }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function linkDeliveryToPurchaseOrder(deliveryId: string, purchaseOrderId: string | null): Promise<void> {
  const { error } = await supabase.from('material_deliveries').update({ purchase_order_id: purchaseOrderId }).eq('id', deliveryId);
  if (error) throw new Error(error.message);
}

export type CostEntryInput =
  | { kind: 'contractor_payment'; projectId: string; payeeName: string; paymentDate: string; amount: number; phaseKey: string | null; category: string; reference: string | null }
  | { kind: 'labor_payment'; projectId: string; paymentDate: string; workerGroup: string; workersCount: number; amount: number; phaseKey: string | null; category: string }
  | { kind: 'purchase_order'; projectId: string; vendorId: string | null; poNumber: string; orderDate: string; amount: number; phaseKey: string | null; category: string; description: string | null }
  | { kind: 'cost_commitment'; projectId: string; commitmentType: CostCommitmentType; partyName: string; contractValue: number; outstanding: number; phaseKey: string | null; category: string };

export async function recordCostEntry(input: CostEntryInput): Promise<void> {
  const result = input.kind === 'contractor_payment'
    ? await supabase.from('contractor_payments').insert({ project_id: input.projectId, payee_name: input.payeeName, payment_date: input.paymentDate, amount_bdt: input.amount, phase_key: input.phaseKey, reference: input.reference, category: input.category })
    : input.kind === 'labor_payment'
      ? await supabase.from('labor_payments').insert({ project_id: input.projectId, payment_date: input.paymentDate, worker_group: input.workerGroup, workers_count: input.workersCount, amount_bdt: input.amount, phase_key: input.phaseKey, category: input.category })
      : input.kind === 'purchase_order'
        ? await supabase.from('purchase_orders').insert({ project_id: input.projectId, vendor_id: input.vendorId, po_number: input.poNumber, order_date: input.orderDate, amount_bdt: input.amount, phase_key: input.phaseKey, category: input.category, description: input.description, status: 'issued' })
        : await supabase.from('cost_commitments').insert({ project_id: input.projectId, commitment_type: input.commitmentType, party_name: input.partyName, contract_value_bdt: input.contractValue, outstanding_amount_bdt: input.outstanding, phase_key: input.phaseKey, category: input.category });
  if (result.error) throw new Error(result.error.message);
}

export async function closeCostCommitment(id: string): Promise<void> {
  const { error } = await supabase.from('cost_commitments').update({ status: 'closed', outstanding_amount_bdt: 0, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

export interface SupplierInvoiceInput {
  projectId: string;
  vendorId: string | null;
  purchaseOrderId: string | null;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  amount: number;
  notes: string | null;
}

export async function recordSupplierInvoice(input: SupplierInvoiceInput): Promise<void> {
  const { error } = await supabase.from('supplier_invoices').insert({
    project_id: input.projectId,
    vendor_id: input.vendorId,
    purchase_order_id: input.purchaseOrderId,
    invoice_number: input.invoiceNumber,
    invoice_date: input.invoiceDate,
    due_date: input.dueDate,
    amount_bdt: input.amount,
    notes: input.notes,
  });
  if (error) throw new Error(error.message);
}

export interface SupplierPaymentInput {
  projectId: string;
  supplierInvoiceId: string;
  paymentDate: string;
  amount: number;
  method: string | null;
  reference: string | null;
  notes: string | null;
}

export async function recordSupplierPayment(input: SupplierPaymentInput): Promise<void> {
  const { error } = await supabase.from('supplier_payments').insert({
    project_id: input.projectId,
    supplier_invoice_id: input.supplierInvoiceId,
    payment_date: input.paymentDate,
    amount_bdt: input.amount,
    method: input.method,
    reference: input.reference,
    notes: input.notes,
  });
  if (error) throw new Error(error.message);
}
