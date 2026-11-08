import { useMemo, useState } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Pencil,
  Plus,
  Trash2,
  Truck,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/Button';
import { Card, CardHeader } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { StatusBadge, type BadgeTone } from '@/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/StatePanel';
import { useAsyncData } from '@/hooks/useAsyncData';
import { recordActivity } from '@/lib/activity';
import {
  fetchFinancingBalance,
  fetchMaterialDeliveries,
  fetchOwnerDeposits,
  fetchVendorDeposits,
  fetchVendorsForFinancing,
} from '@/lib/financing';
import { formatDate, formatTaka } from '@/lib/format';
import { fetchPrimaryProject } from '@/lib/projects';
import { supabase } from '@/lib/supabase';
import {
  MATERIAL_TYPE_LABELS,
  OWNER_DEPOSIT_TYPE_LABELS,
  type FinancingBalanceRow,
  type MaterialDeliveryRow,
  type OwnerDepositRow,
  type ProjectRow,
  type VendorDepositRow,
  type VendorRow,
} from '@/types/database';
import { OwnerDepositFormModal } from '@/pages/financing/OwnerDepositFormModal';
import { VendorDepositFormModal } from '@/pages/financing/VendorDepositFormModal';
import { DeliveryFormModal } from '@/pages/financing/DeliveryFormModal';

interface ListData {
  project: ProjectRow | null;
  ownerDeposits: OwnerDepositRow[];
  vendorDeposits: VendorDepositRow[];
  deliveries: MaterialDeliveryRow[];
  balance: FinancingBalanceRow | null;
  vendors: VendorRow[];
}

async function loadList(): Promise<ListData> {
  const project = await fetchPrimaryProject();
  if (!project) return { project: null, ownerDeposits: [], vendorDeposits: [], deliveries: [], balance: null, vendors: [] };
  const [ownerDeposits, vendorDeposits, deliveries, balance, vendors] = await Promise.all([
    fetchOwnerDeposits(project.id),
    fetchVendorDeposits(project.id),
    fetchMaterialDeliveries(project.id),
    fetchFinancingBalance(project.id),
    fetchVendorsForFinancing(project.id),
  ]);
  return { project, ownerDeposits, vendorDeposits, deliveries, balance, vendors };
}

type LedgerEntry = {
  id: string;
  date: string;
  description: string;
  credit: number;
  debit: number;
  type: 'owner_deposit' | 'vendor_deposit' | 'delivery';
  vendorName: string | null;
};

export function FinancingPage() {
  const { data, error, loading, reload } = useAsyncData(loadList);
  const [activeTab, setActiveTab] = useState<'overview' | 'owner' | 'vendor' | 'deliveries' | 'ledger'>('overview');
  const [creatingOwner, setCreatingOwner] = useState(false);
  const [editingOwner, setEditingOwner] = useState<OwnerDepositRow | null>(null);
  const [deletingOwner, setDeletingOwner] = useState<OwnerDepositRow | null>(null);
  const [creatingVendorDep, setCreatingVendorDep] = useState(false);
  const [editingVendorDep, setEditingVendorDep] = useState<VendorDepositRow | null>(null);
  const [deletingVendorDep, setDeletingVendorDep] = useState<VendorDepositRow | null>(null);
  const [creatingDelivery, setCreatingDelivery] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<MaterialDeliveryRow | null>(null);
  const [deletingDelivery, setDeletingDelivery] = useState<MaterialDeliveryRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const ledger = useMemo(() => {
    if (!data) return [];
    const entries: LedgerEntry[] = [];
    for (const d of data.ownerDeposits) {
      entries.push({
        id: d.id,
        date: d.deposit_date,
        description: `Owner ${OWNER_DEPOSIT_TYPE_LABELS[d.deposit_type].toLowerCase()}`,
        credit: d.amount_bdt,
        debit: 0,
        type: 'owner_deposit',
        vendorName: null,
      });
    }
    for (const d of data.vendorDeposits) {
      const vendor = data.vendors.find((v) => v.id === d.vendor_id);
      entries.push({
        id: d.id,
        date: d.deposit_date,
        description: 'Vendor deposit',
        credit: d.amount_bdt,
        debit: 0,
        type: 'vendor_deposit',
        vendorName: vendor?.name ?? null,
      });
    }
    for (const d of data.deliveries) {
      const vendor = data.vendors.find((v) => v.id === d.vendor_id);
      entries.push({
        id: d.id,
        date: d.delivery_date,
        description: `${MATERIAL_TYPE_LABELS[d.material_type]} delivery`,
        credit: 0,
        debit: d.total_amount_bdt,
        type: 'delivery',
        vendorName: vendor?.name ?? null,
      });
    }
    entries.sort((a, b) => b.date.localeCompare(a.date));
    return entries;
  }, [data]);

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingState />;
  if (!data.project) {
    return <EmptyState icon={Wallet} title="No project yet" description="Material financing belongs to the project. Create the project first." />;
  }

  const { project, ownerDeposits, vendorDeposits, deliveries, balance, vendors } = data;

  function currentDeleteTarget() {
    if (deletingOwner) return { id: deletingOwner.id, table: 'owner_deposits', label: 'owner deposit', summary: `Removed owner deposit Tk ${deletingOwner.amount_bdt}` };
    if (deletingVendorDep) return { id: deletingVendorDep.id, table: 'vendor_deposits', label: 'vendor deposit', summary: `Removed vendor deposit Tk ${deletingVendorDep.amount_bdt}` };
    if (deletingDelivery) {
      return { id: deletingDelivery.id, table: 'material_deliveries', label: 'delivery', summary: `Removed delivery: ${MATERIAL_TYPE_LABELS[deletingDelivery.material_type]} (Tk ${deletingDelivery.total_amount_bdt})` };
    }
    return null;
  }

  async function confirmDelete() {
    const target = currentDeleteTarget();
    if (!target) return;
    setDeleteBusy(true);
    setDeleteError(null);
    const { error: deleteErr } = await supabase.from(target.table).delete().eq('id', target.id);
    if (deleteErr) {
      setDeleteBusy(false);
      setDeleteError(deleteErr.message);
      return;
    }
    await recordActivity({ projectId: project.id, action: 'delete', entityType: target.label, entityId: target.id, summary: target.summary });
    setDeleteBusy(false);
    setDeletingOwner(null);
    setDeletingVendorDep(null);
    setDeletingDelivery(null);
    reload();
  }

  const deleteTarget = currentDeleteTarget();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Material Financing"
        description="Track owner deposits, vendor deposits, material deliveries, and real-time running balances."
        action={renderActionButton()}
      />

      <div className="flex gap-2 overflow-x-auto border-b border-stone-200 pb-px">
        <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} label="Overview" />
        <TabButton active={activeTab === 'owner'} onClick={() => setActiveTab('owner')} label="Deposit Register" />
        <TabButton active={activeTab === 'vendor'} onClick={() => setActiveTab('vendor')} label="Vendor Account" />
        <TabButton active={activeTab === 'deliveries'} onClick={() => setActiveTab('deliveries')} label="Delivery Register" />
        <TabButton active={activeTab === 'ledger'} onClick={() => setActiveTab('ledger')} label="Ledger" />
      </div>

      {activeTab === 'overview' && (
        <OverviewSection balance={balance} deliveries={deliveries} />
      )}

      {activeTab === 'owner' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setCreatingOwner(true)}><Plus className="h-4 w-4" aria-hidden /> Add deposit</Button>
          </div>
          {ownerDeposits.length === 0 ? (
            <EmptyState icon={ArrowDownCircle} title="No owner deposits yet" description="Record the initial 500,000 BDT deposit and monthly deposits here." action={<Button onClick={() => setCreatingOwner(true)}><Plus className="h-4 w-4" aria-hidden /> Add deposit</Button>} />
          ) : (
            <Card>
              <CardHeader title="Owner deposits" description={`${ownerDeposits.length} entries`} />
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
                      <th className="py-2 pr-4 font-medium">Date</th>
                      <th className="py-2 pr-4 font-medium">Type</th>
                      <th className="py-2 pr-4 text-right font-medium">Amount</th>
                      <th className="py-2 pr-4 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {ownerDeposits.map((row) => (
                      <tr key={row.id} className="hover:bg-stone-50">
                        <td className="py-2 pr-4 text-stone-600">{formatDate(row.deposit_date)}</td>
                        <td className="py-2 pr-4">
                          <div className="flex flex-col gap-1">
                            <StatusBadge tone="primary">{OWNER_DEPOSIT_TYPE_LABELS[row.deposit_type]}</StatusBadge>
                            <div className="flex gap-4 text-xs text-stone-500">
                              {row.payment_method && <span>{row.payment_method}</span>}
                              {row.reference_number && <span>Ref: {row.reference_number}</span>}
                            </div>
                          </div>
                        </td>
                        <td className="py-2 pr-4 text-right font-semibold text-stone-900">{formatTaka(row.amount_bdt)}</td>
                        <td className="py-2 pr-4 text-right">
                          <div className="inline-flex gap-1">
                            <span role="button" tabIndex={0} onClick={() => setEditingOwner(row)} onKeyDown={(e) => { if (e.key === 'Enter') setEditingOwner(row); }} className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"><Pencil className="h-4 w-4" aria-hidden /></span>
                            <span role="button" tabIndex={0} onClick={() => { setDeleteError(null); setDeletingOwner(row); }} onKeyDown={(e) => { if (e.key === 'Enter') { setDeleteError(null); setDeletingOwner(row); } }} className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-700"><Trash2 className="h-4 w-4" aria-hidden /></span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'vendor' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setCreatingVendorDep(true)}><Plus className="h-4 w-4" aria-hidden /> Add deposit</Button>
          </div>
          {vendorDeposits.length === 0 ? (
            <EmptyState icon={ArrowDownCircle} title="No vendor deposits yet" description="Record payments deposited to vendor accounts here." action={<Button onClick={() => setCreatingVendorDep(true)}><Plus className="h-4 w-4" aria-hidden /> Add deposit</Button>} />
          ) : (
            <Card>
              <CardHeader title="Vendor deposits" description={`${vendorDeposits.length} entries`} />
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
                      <th className="py-2 pr-4 font-medium">Date</th>
                      <th className="py-2 pr-4 font-medium">Vendor</th>
                      <th className="py-2 pr-4 text-right font-medium">Amount</th>
                      <th className="py-2 pr-4 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {vendorDeposits.map((row) => {
                      const v = vendors.find((x) => x.id === row.vendor_id);
                      return (
                        <tr key={row.id} className="hover:bg-stone-50">
                          <td className="py-2 pr-4 text-stone-600">{formatDate(row.deposit_date)}</td>
                          <td className="py-2 pr-4">
                            <div className="flex flex-col gap-1">
                              <StatusBadge tone="accent">{v?.name ?? 'General'}</StatusBadge>
                              <div className="flex gap-4 text-xs text-stone-500">
                                {row.payment_method && <span>{row.payment_method}</span>}
                                {row.reference_number && <span>Ref: {row.reference_number}</span>}
                              </div>
                            </div>
                          </td>
                          <td className="py-2 pr-4 text-right font-semibold text-stone-900">{formatTaka(row.amount_bdt)}</td>
                          <td className="py-2 pr-4 text-right">
                            <div className="inline-flex gap-1">
                              <span role="button" tabIndex={0} onClick={() => setEditingVendorDep(row)} onKeyDown={(e) => { if (e.key === 'Enter') setEditingVendorDep(row); }} className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"><Pencil className="h-4 w-4" aria-hidden /></span>
                              <span role="button" tabIndex={0} onClick={() => { setDeleteError(null); setDeletingVendorDep(row); }} onKeyDown={(e) => { if (e.key === 'Enter') { setDeleteError(null); setDeletingVendorDep(row); } }} className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-700"><Trash2 className="h-4 w-4" aria-hidden /></span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'deliveries' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setCreatingDelivery(true)}><Plus className="h-4 w-4" aria-hidden /> Add delivery</Button>
          </div>
          {deliveries.length === 0 ? (
            <EmptyState icon={Truck} title="No deliveries yet" description="Record rod, cement, brick, sand, and stone chip deliveries here." action={<Button onClick={() => setCreatingDelivery(true)}><Plus className="h-4 w-4" aria-hidden /> Add delivery</Button>} />
          ) : (
            <Card>
              <CardHeader title="Material deliveries" description={`${deliveries.length} entries`} />
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
                      <th className="py-2 pr-4 font-medium">Date</th>
                      <th className="py-2 pr-4 font-medium">Vendor</th>
                      <th className="py-2 pr-4 font-medium">Material</th>
                      <th className="py-2 pr-4 text-right font-medium">Qty</th>
                      <th className="py-2 pr-4 text-right font-medium">Rate</th>
                      <th className="py-2 pr-4 text-right font-medium">Total</th>
                      <th className="py-2 pr-4 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {deliveries.map((d) => {
                      const v = vendors.find((x) => x.id === d.vendor_id);
                      return (
                        <tr key={d.id} className="hover:bg-stone-50">
                          <td className="py-2 pr-4 text-stone-600">{formatDate(d.delivery_date)}</td>
                          <td className="py-2 pr-4 text-stone-600">{v?.name ?? 'General'}</td>
                          <td className="py-2 pr-4"><StatusBadge tone="neutral">{MATERIAL_TYPE_LABELS[d.material_type]}</StatusBadge></td>
                          <td className="py-2 pr-4 text-right text-stone-600">{d.quantity.toLocaleString('en-IN')} {d.unit}</td>
                          <td className="py-2 pr-4 text-right text-stone-600">{formatTaka(d.unit_rate_bdt)}</td>
                          <td className="py-2 pr-4 text-right font-semibold text-stone-900">{formatTaka(d.total_amount_bdt)}</td>
                          <td className="py-2 pr-4 text-right">
                            <div className="inline-flex gap-1">
                              <span role="button" tabIndex={0} onClick={() => setEditingDelivery(d)} onKeyDown={(e) => { if (e.key === 'Enter') setEditingDelivery(d); }} className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"><Pencil className="h-4 w-4" aria-hidden /></span>
                              <span role="button" tabIndex={0} onClick={() => { setDeleteError(null); setDeletingDelivery(d); }} onKeyDown={(e) => { if (e.key === 'Enter') { setDeleteError(null); setDeletingDelivery(d); } }} className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-700"><Trash2 className="h-4 w-4" aria-hidden /></span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'ledger' && <LedgerSection ledger={ledger} />}

      {creatingOwner && <OwnerDepositFormModal project={project} deposit={null} onClose={() => setCreatingOwner(false)} onSaved={() => { setCreatingOwner(false); reload(); }} />}
      {editingOwner && <OwnerDepositFormModal project={project} deposit={editingOwner} onClose={() => setEditingOwner(null)} onSaved={() => { setEditingOwner(null); reload(); }} />}
      {creatingVendorDep && <VendorDepositFormModal project={project} deposit={null} vendors={vendors} onClose={() => setCreatingVendorDep(false)} onSaved={() => { setCreatingVendorDep(false); reload(); }} />}
      {editingVendorDep && <VendorDepositFormModal project={project} deposit={editingVendorDep} vendors={vendors} onClose={() => setEditingVendorDep(null)} onSaved={() => { setEditingVendorDep(null); reload(); }} />}
      {creatingDelivery && <DeliveryFormModal project={project} delivery={null} vendors={vendors} onClose={() => setCreatingDelivery(false)} onSaved={() => { setCreatingDelivery(false); reload(); }} />}
      {editingDelivery && <DeliveryFormModal project={project} delivery={editingDelivery} vendors={vendors} onClose={() => setEditingDelivery(null)} onSaved={() => { setEditingDelivery(null); reload(); }} />}
      <ConfirmDialog open={deleteTarget !== null} title={`Delete ${deleteTarget?.label ?? ''}`} message="This cannot be undone." confirmLabel="Delete" busy={deleteBusy} error={deleteError} onConfirm={confirmDelete} onCancel={() => { setDeletingOwner(null); setDeletingVendorDep(null); setDeletingDelivery(null); }} />
    </div>
  );

  function renderActionButton() {
    if (activeTab === 'owner') return <Button onClick={() => setCreatingOwner(true)}><Plus className="h-4 w-4" aria-hidden /> Add deposit</Button>;
    if (activeTab === 'vendor') return <Button onClick={() => setCreatingVendorDep(true)}><Plus className="h-4 w-4" aria-hidden /> Add deposit</Button>;
    if (activeTab === 'deliveries') return <Button onClick={() => setCreatingDelivery(true)}><Plus className="h-4 w-4" aria-hidden /> Add delivery</Button>;
    return null;
  }
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'shrink-0 border-b-2 border-primary-700 px-4 py-2.5 text-sm font-medium text-primary-800'
          : 'shrink-0 border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-stone-500 transition-colors hover:text-stone-800'
      }
    >
      {label}
    </button>
  );
}

function OverviewSection({ balance, deliveries }: { balance: FinancingBalanceRow | null; deliveries: MaterialDeliveryRow[] }) {
  const totalOwner = balance ? Number(balance.total_owner_deposits) : 0;
  const totalVendor = balance ? Number(balance.total_vendor_deposits) : 0;
  const totalDeliveries = balance ? Number(balance.total_delivery_cost) : 0;
  const available = balance ? Number(balance.available_funds) : 0;

  const byMaterial = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of deliveries) {
      map[d.material_type] = (map[d.material_type] ?? 0) + Number(d.total_amount_bdt);
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [deliveries]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Available funds" value={formatTaka(available)} hint="Owner deposits minus deliveries" icon={Wallet} tone="primary" />
        <StatCard label="Owner deposits" value={formatTaka(totalOwner)} icon={ArrowDownCircle} tone="accent" />
        <StatCard label="Vendor deposits" value={formatTaka(totalVendor)} icon={ArrowDownCircle} tone="primary" />
        <StatCard label="Total delivery cost" value={formatTaka(totalDeliveries)} icon={ArrowUpCircle} tone="accent" />
      </div>

      <Card>
        <CardHeader title="Running balance" description="Real-time balance calculated by the database from all transactions." />
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <BalanceRow label="Total owner deposits" value={formatTaka(totalOwner)} />
          <BalanceRow label="Total vendor deposits" value={formatTaka(totalVendor)} />
          <BalanceRow label="Total deliveries" value={formatTaka(totalDeliveries)} negative />
          <BalanceRow label="Net vendor balance" value={formatTaka(totalVendor - totalDeliveries)} />
          <BalanceRow label="Available project funds" value={formatTaka(available)} highlight />
        </div>
      </Card>

      {byMaterial.length > 0 && (
        <Card>
          <CardHeader title="Cost by material type" description="Total delivery cost per material" />
          <div className="mt-4 space-y-3">
            {byMaterial.map(([material, cost]) => (
              <div key={material} className="flex items-center justify-between rounded-lg bg-stone-50 px-4 py-2.5">
                <span className="text-sm font-medium text-stone-700">{MATERIAL_TYPE_LABELS[material as keyof typeof MATERIAL_TYPE_LABELS]}</span>
                <span className="text-sm font-semibold text-stone-900">{formatTaka(cost)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function BalanceRow({ label, value, negative, highlight }: { label: string; value: string; negative?: boolean; highlight?: boolean }) {
  return (
    <div className={
      highlight ? 'rounded-xl bg-primary-50 px-4 py-3' : 'rounded-xl border border-stone-200 px-4 py-3'
    }>
      <p className="text-xs text-stone-500">{label}</p>
      <p className={
        highlight ? 'mt-1 text-lg font-bold text-primary-900' :
        negative ? 'mt-1 text-base font-semibold text-rose-700' :
        'mt-1 text-base font-semibold text-stone-900'
      }>{negative && value !== formatTaka(0) ? '-' : ''}{value}</p>
    </div>
  );
}

function LedgerSection({ ledger }: { ledger: LedgerEntry[] }) {
  if (ledger.length === 0) {
    return <EmptyState icon={Wallet} title="Ledger is empty" description="Add deposits or deliveries to build the ledger." />;
  }

  let runningBalance = 0;
  const rows = [...ledger].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Card>
      <CardHeader title="Vendor ledger" description="All transactions in chronological order with running balance." />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
              <th className="py-2 pr-4 font-medium">Date</th>
              <th className="py-2 pr-4 font-medium">Description</th>
              <th className="py-2 pr-4 font-medium">Vendor</th>
              <th className="py-2 pr-4 text-right font-medium">Credit</th>
              <th className="py-2 pr-4 text-right font-medium">Debit</th>
              <th className="py-2 pr-4 text-right font-medium">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map((entry) => {
              runningBalance += entry.credit - entry.debit;
              const tone: BadgeTone = entry.type === 'owner_deposit' ? 'primary' : entry.type === 'vendor_deposit' ? 'accent' : 'warning';
              return (
                <tr key={`${entry.type}-${entry.id}`} className="hover:bg-stone-50">
                  <td className="py-2 pr-4 text-stone-600">{formatDate(entry.date)}</td>
                  <td className="py-2 pr-4">
                    <StatusBadge tone={tone}>{entry.description}</StatusBadge>
                  </td>
                  <td className="py-2 pr-4 text-stone-600">{entry.vendorName ?? '-'}</td>
                  <td className="py-2 pr-4 text-right text-emerald-700">{entry.credit > 0 ? formatTaka(entry.credit) : '-'}</td>
                  <td className="py-2 pr-4 text-right text-rose-700">{entry.debit > 0 ? formatTaka(entry.debit) : '-'}</td>
                  <td className="py-2 pr-4 text-right font-semibold text-stone-900">{formatTaka(runningBalance)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-stone-300 font-semibold text-stone-900">
              <td colSpan={3} className="py-3 pr-4 text-right">Final running balance</td>
              <td className="py-3 pr-4 text-right text-emerald-700">{formatTaka(rows.reduce((s, r) => s + r.credit, 0))}</td>
              <td className="py-3 pr-4 text-right text-rose-700">{formatTaka(rows.reduce((s, r) => s + r.debit, 0))}</td>
              <td className="py-3 pr-4 text-right">{formatTaka(runningBalance)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}
