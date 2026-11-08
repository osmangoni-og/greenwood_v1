import { useState, type ReactNode } from 'react';
import { Building2, CheckCircle2, AlertTriangle, XCircle, Pencil } from 'lucide-react';
import { Button } from '@/components/Button';
import { Card, CardHeader } from '@/components/Card';
import { EmptyState, ErrorState, LoadingState } from '@/components/StatePanel';
import { PageHeader } from '@/components/PageHeader';
import { ProgressBar } from '@/components/ProgressBar';
import { StatusBadge, type BadgeTone } from '@/components/StatusBadge';
import { Tabs } from '@/components/Tabs';
import { ProjectEditModal } from '@/pages/project/ProjectEditModal';
import { DataEntryReadinessPage } from '@/pages/DataEntryReadinessPage';
import { useAsyncData } from '@/hooks/useAsyncData';
import { loadProjectProfile, type ProjectProfileSummary } from '@/lib/projectProfile';
import { computeLineageWarnings } from '@/lib/lineage';
import { formatDate, formatLabel, formatTaka } from '@/lib/format';

const PROFILE_TABS = [
  { id: 'profile', label: 'Project Information' },
  { id: 'health', label: 'Project Health' },
  { id: 'data_entry', label: 'Data Entry Readiness' },
  { id: 'linked', label: 'Linked Modules' },
] as const;
type ProfileTab = (typeof PROFILE_TABS)[number]['id'];

type HealthLevel = 'pass' | 'warning' | 'critical';
const HEALTH_TONE: Record<HealthLevel, BadgeTone> = { pass: 'success', warning: 'warning', critical: 'error' };
const HEALTH_LABEL: Record<HealthLevel, string> = { pass: 'Pass', warning: 'Warning', critical: 'Critical' };

interface HealthCheck {
  label: string;
  level: HealthLevel;
  detail: string;
}

function computeHealthChecks(s: ProjectProfileSummary): HealthCheck[] {
  const checks: HealthCheck[] = [
    {
      label: 'Active budget version',
      level: s.budget.activeVersionLabel ? 'pass' : 'critical',
      detail: s.budget.activeVersionLabel ? `${s.budget.activeVersionLabel} is active` : 'No active budget version',
    },
    {
      label: 'Funding plan',
      level: s.funding.fundingReceived > 0 || s.funding.fundingExpected > 0 ? 'pass' : s.funding.riskAdjustedFunding > 0 ? 'warning' : 'critical',
      detail: s.funding.fundingReceived > 0 ? `${formatTaka(s.funding.fundingReceived)} received` : 'No funding sources recorded',
    },
    {
      label: 'Contractor selected',
      level: s.contractor.name ? 'pass' : 'warning',
      detail: s.contractor.name ? s.contractor.name : 'No contractor selected',
    },
    {
      label: 'Vendor assigned',
      level: s.vendor.vendorCount > 0 ? 'pass' : 'warning',
      detail: s.vendor.vendorCount > 0 ? `${s.vendor.vendorCount} vendors on record` : 'No vendors assigned',
    },
    {
      label: 'Design uploaded',
      level: s.design.drawingCount > 0 ? 'pass' : 'warning',
      detail: s.design.drawingCount > 0 ? `${s.design.drawingCount} drawings` : 'No designs uploaded',
    },
    {
      label: 'BOQ loaded',
      level: s.design.boqSheetCount > 0 ? 'pass' : 'warning',
      detail: s.design.boqSheetCount > 0 ? `${s.design.boqSheetCount} BOQ sheets` : 'No BOQ loaded',
    },
    {
      label: 'Funding gap',
      level: s.funding.fundingGap <= 0 ? 'pass' : s.funding.fundingGap < s.budget.activeVersionBudget * 0.2 ? 'warning' : 'critical',
      detail: s.funding.fundingGap <= 0 ? 'No funding gap' : `Gap of ${formatTaka(s.funding.fundingGap)}`,
    },
  ];
  if (s.lineage) {
    const lin = s.lineage;
    const warnings = computeLineageWarnings(lin);
    for (const w of warnings) {
      checks.push({ label: w.label, level: w.active ? 'warning' : 'pass', detail: w.active ? w.label : 'Assigned' });
    }
  }
  return checks;
}

export function ProjectProfilePage() {
  const { data, error, loading, reload } = useAsyncData(loadProjectProfile);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<ProfileTab>('profile');

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) {
    return <EmptyState icon={Building2} title="No project yet" description="There is no project record to show. Add the project details to get started." />;
  }

  const s = data;
  const checks = computeHealthChecks(s);
  const passCount = checks.filter((c) => c.level === 'pass').length;
  const warnCount = checks.filter((c) => c.level === 'warning').length;
  const critCount = checks.filter((c) => c.level === 'critical').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={s.project.name}
        description="Master project record with auto-calculated summary from all linked modules."
        action={
          <Button onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" aria-hidden />
            Edit master data
          </Button>
        }
      />

      <Tabs items={PROFILE_TABS} activeId={tab} onChange={(id) => setTab(id as ProfileTab)} />

      {tab === 'profile' && (
        <>
      {/* A. Basic Project Information */}
      <Card>
        <CardHeader title="Basic project information" description="Owner-editable master data." />
        <dl className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Project code" value={s.project.project_code ?? 'Not set'} />
          <Detail label="Project type" value={s.project.project_type} />
          <Detail label="Owner" value={s.project.owner_name ?? 'Not set'} />
          <Detail label="Location" value={s.project.location} />
          <Detail label="Village" value={s.project.village ?? 'Not set'} />
          <Detail label="Union" value={s.project.union ?? 'Not set'} />
          <Detail label="Upazila" value={s.project.upazila ?? 'Not set'} />
          <Detail label="District" value={s.project.district ?? 'Not set'} />
          <Detail label="Country" value={s.project.country ?? 'Not set'} />
          <Detail label="Latitude" value={s.project.latitude === null ? 'Not set' : String(s.project.latitude)} />
          <Detail label="Longitude" value={s.project.longitude === null ? 'Not set' : String(s.project.longitude)} />
          <Detail label="Status" value={<StatusBadge tone="primary">{formatLabel(s.project.phase)}</StatusBadge>} />
          <Detail label="Target start date" value={s.project.start_date ?? 'Not set'} />
          <Detail label="Target completion" value={s.project.target_completion_date ?? 'Not set'} />
        </dl>
        {s.project.description && (
          <div className="mt-6 rounded-xl bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-800">Description</p>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-stone-600">{s.project.description}</p>
          </div>
        )}
        {s.project.notes && (
          <div className="mt-4 rounded-xl bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-800">Notes</p>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-stone-600">{s.project.notes}</p>
          </div>
        )}
      </Card>

      {/* B. Budget & Finance Summary */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Budget & finance summary" description="Source: Budget Management + Construction Finance" />
          <dl className="mt-6 grid grid-cols-2 gap-6">
            <Detail label="Active budget version" value={s.budget.activeVersionLabel ?? 'None'} source="Budget Management" />
            <Detail label="Approved budget" value={formatTaka(s.budget.activeVersionBudget)} source="Budget Management" />
            <Detail label="Revision count" value={String(s.budget.revisionCount)} source="Budget Management" />
            <Detail label="Actual cost" value={formatTaka(s.budget.actual)} source="Budget Management" />
            <Detail label="Committed cost" value={formatTaka(s.budget.committed)} source="Budget Management" />
            <Detail label="Forecast final cost" value={formatTaka(s.budget.forecastFinal)} source="Budget Management" />
            <Detail label="Forecast basis" value={s.budget.forecastBasis} source="Budget Management" />
            <Detail label="Funding received" value={formatTaka(s.funding.fundingReceived)} source="Construction Finance" />
            <Detail label="Funding expected" value={formatTaka(s.funding.fundingExpected)} source="Construction Finance" />
            <Detail label="Risk-adjusted funding" value={formatTaka(s.funding.riskAdjustedFunding)} source="Construction Finance" />
            <Detail label="Funding gap" value={formatTaka(s.funding.fundingGap)} source="Construction Finance" />
          </dl>
        </Card>

        {/* C. Asset Funding Summary */}
        <Card>
          <CardHeader title="Asset funding summary" description="Source: Asset Monetization" />
          <div className="mt-6 space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Land sales</p>
              <dl className="mt-3 grid grid-cols-2 gap-4">
                <Detail label="No. of lands" value={String(s.landSales.landCount)} source="Asset Monetization" />
                <Detail label="Total estimated value" value={formatTaka(s.landSales.totalEstimatedValue)} source="Asset Monetization" />
                <Detail label="Sale proceeds" value={formatTaka(s.landSales.saleProceeds)} source="Asset Monetization" />
                <Detail label="Highest active offer" value={s.landSales.highestOffer !== null ? formatTaka(s.landSales.highestOffer) : 'None'} source="Asset Monetization" />
              </dl>
            </div>
            <div className="border-t border-stone-100 pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500">House sale</p>
              <dl className="mt-3 grid grid-cols-2 gap-4">
                <Detail label="Current valuation" value={s.houseSale.valuation !== null ? formatTaka(s.houseSale.valuation) : 'Not set'} source="Asset Monetization" />
                <Detail label="Highest offer" value={s.houseSale.highestOffer !== null ? formatTaka(s.houseSale.highestOffer) : 'None'} source="Asset Monetization" />
                <Detail label="Expected net proceeds" value={s.houseSale.expectedNetProceeds !== null ? formatTaka(s.houseSale.expectedNetProceeds) : 'Not set'} source="Asset Monetization" />
              </dl>
            </div>
          </div>
        </Card>
      </div>

      {/* D. Construction Summary + E. Contractor & Vendor Summary */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Construction summary" description="Source: Construction Tracking" />
          <dl className="mt-6 grid grid-cols-2 gap-6">
            <Detail label="Current phase" value={s.construction.currentPhase ?? 'Not started'} source="Construction Tracking" />
            <Detail label="Overall progress" value={`${s.construction.progressPct}%`} source="Construction Tracking" />
            <Detail label="Days elapsed" value={s.construction.daysElapsed !== null ? `${s.construction.daysElapsed} days` : 'Not started'} source="Construction Tracking" />
            <Detail label="Days remaining" value={s.construction.daysRemaining !== null ? `${s.construction.daysRemaining} days` : 'Not set'} source="Construction Tracking" />
          </dl>
          <div className="mt-6">
            <ProgressBar value={s.construction.progressPct} label="Construction progress" />
          </div>
        </Card>

        <Card>
          <CardHeader title="Contractor & vendor summary" description="Source: Contractors + Vendors" />
          <dl className="mt-6 grid grid-cols-2 gap-6">
            <Detail label="Selected contractor" value={s.contractor.name ?? 'Not selected'} source="Contractors" />
            <Detail label="Selection date" value={s.contractor.selectionDate ? formatDate(s.contractor.selectionDate) : 'Not set'} source="Contractors" />
            <Detail label="Average contractor rate" value={s.contractor.averageRate !== null ? formatTaka(s.contractor.averageRate) : 'No rate schedule'} source="Contractors" />
            <Detail label="Contract value" value={s.contractor.contractValue !== null ? formatTaka(s.contractor.contractValue) : 'Not set'} source="Contractors" />
            <Detail label="Lowest competing bid" value={s.contractor.lowestCompetingBid !== null ? formatTaka(s.contractor.lowestCompetingBid) : 'No other bids'} source="Contractor Bids" />
            <Detail label="Potential saving" value={s.contractor.potentialSaving !== null ? formatTaka(s.contractor.potentialSaving) : 'Not available'} source="Contractor Bids" />
            <Detail label="Contract status" value={s.contractor.contractStatus ? formatLabel(s.contractor.contractStatus) : 'Not set'} source="Contractors" />
            <Detail label="Primary supplier" value={s.vendor.primaryName ?? 'Not set'} source="Vendors" />
            <Detail label="Current vendor balance" value={formatTaka(s.vendor.vendorBalance)} source="Vendors" />
            <Detail label="Monthly deposit" value={formatTaka(s.vendor.monthlyDeposit)} source="Vendors" />
            <Detail label="Opening deposit" value={formatTaka(s.vendor.openingDeposit)} source="Vendors" />
            <Detail label="Vendor count" value={String(s.vendor.vendorCount)} source="Vendors" />
          </dl>
        </Card>
      </div>

      {/* F. Design & BOQ Summary + G. Document Summary */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Design & BOQ summary" description="Source: Design Management + BOQ" />
          <dl className="mt-6 grid grid-cols-2 gap-6">
            <Detail label="Design versions" value={String(s.design.versionCount)} source="Design Management" />
            <Detail label="Approved versions" value={String(s.design.approvedCount)} source="Design Management" />
            <Detail label="Drawing count" value={String(s.design.drawingCount)} source="Design Management" />
            <Detail label="BOQ sheets" value={String(s.design.boqSheetCount)} source="BOQ Management" />
          </dl>
        </Card>

        <Card>
          <CardHeader title="Document summary" description="Source: Document Repository" />
          <dl className="mt-6 grid grid-cols-2 gap-6">
            <Detail label="Total documents" value={String(s.documents.total)} source="Document Repository" />
            <Detail label="Legal / contracts" value={String(s.documents.contracts)} source="Document Repository" />
            <Detail label="Design / drawings" value={String(s.documents.drawings)} source="Document Repository" />
            <Detail label="Certificates / permits" value={String(s.documents.certificates)} source="Document Repository" />
            <Detail label="Finance / invoices" value={String(s.documents.invoices)} source="Document Repository" />
          </dl>
        </Card>
      </div>

      <Card>
        <CardHeader title="Structural summary" description="Auto-calculated from the column and footing registers" />
        <dl className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Column quantity" value={String(s.structure.totalColumns)} source="Column Register" />
          <Detail
            label="Distinct column types"
            value={s.structure.columnTypes.length > 0 ? `${s.structure.columnTypes.length} (${s.structure.columnTypes.join(', ')})` : 'None'}
            source="Column Register"
          />
          <Detail label="Concrete volume" value={`${s.structure.totalConcreteCum.toFixed(3)} cum`} source="Column Register" />
          <Detail label="Steel weight" value={`${s.structure.totalSteelKg.toFixed(0)} kg`} source="Column Register" />
          <Detail
            label="Steel per SFT"
            value={s.structure.floorAreaSft > 0 ? `${(s.structure.totalSteelKg / s.structure.floorAreaSft).toFixed(3)} kg` : 'Not available'}
            source="Column Register and BOQ"
          />
          <Detail
            label="Concrete per SFT"
            value={s.structure.floorAreaSft > 0 ? `${(s.structure.totalConcreteCum / s.structure.floorAreaSft).toFixed(4)} cum` : 'Not available'}
            source="Column Register and BOQ"
          />
          <Detail label="Total footings" value={String(s.structure.totalFootings)} source="Footing Register" />
          <Detail
            label="Footing types"
            value={s.structure.footingTypes.length > 0 ? `${s.structure.footingTypes.length} (${s.structure.footingTypes.join(', ')})` : 'None'}
            source="Footing Register"
          />
          <Detail label="Excavation volume" value={`${s.structure.totalExcavationCum.toFixed(3)} cum`} source="Footing Register" />
          <Detail label="Footing concrete" value={`${s.structure.footingConcreteCum.toFixed(3)} cum`} source="Footing Register" />
          <Detail label="Footing steel" value={`${s.structure.footingSteelKg.toFixed(0)} kg`} source="Footing Register" />
          <Detail label="Total slabs" value={String(s.structure.totalSlabs)} source="Slab Register" />
          <Detail label="Total slab area" value={`${s.structure.slabAreaSqm.toFixed(2)} sqm`} source="Slab Register" />
          <Detail label="Slab concrete" value={`${s.structure.slabConcreteCum.toFixed(3)} cum`} source="Slab Register" />
          <Detail label="Slab steel" value={`${s.structure.slabSteelKg.toFixed(0)} kg`} source="Slab Register" />
          <Detail label="Total beams" value={String(s.structure.totalBeams)} source="Beam Register" />
          <Detail label="Beam concrete" value={`${s.structure.beamConcreteCum.toFixed(3)} cum`} source="Beam Register" />
          <Detail label="Beam steel" value={`${s.structure.beamSteelKg.toFixed(0)} kg`} source="Beam Register" />
          <Detail label="Rebar items" value={String(s.structure.totalRebarItems)} source="Rebar Register" />
          <Detail label="Rebar weight" value={`${s.structure.rebarWeightKg.toFixed(0)} kg`} source="Rebar Register" />
          <Detail label="Excavation volume" value={`${s.structure.totalExcavationCum.toFixed(3)} cum`} source="Footing Register" />
          <Detail label="Structural cost" value={formatTaka(s.structure.structuralCostBdt)} source="Cost Engine" />
          <Detail label="Cost per SFT" value={s.structure.costPerSft > 0 ? formatTaka(s.structure.costPerSft) : 'Not available'} source="Cost Engine" />
          <Detail label="Current engineer" value={s.structure.currentEngineer ?? 'Not assigned'} source="Budget Lineage" />
          <Detail label="Current design package" value={s.structure.currentPackage ?? 'Not assigned'} source="Budget Lineage" />
        </dl>
      </Card>

      {/* G2. Design & Budget Lineage */}
      {s.lineage && (
        <Card>
          <CardHeader title="Design & budget lineage" description="Read-only chain: Engineer → Design Package → BOQ → Budget Version → Contractor → Vendor" />
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Selected engineer" value={s.lineage.engineerName ?? 'Not assigned'} source="Budget Lineage" />
            <Detail label="Design package" value={s.lineage.packageName ? `${s.lineage.packageName}${s.lineage.revisionLabel ? ` (${s.lineage.revisionLabel})` : ''}` : 'Not assigned'} source="Budget Lineage" />
            <Detail label="BOQ" value={s.lineage.boqName ?? 'Not assigned'} source="Budget Lineage" />
            <Detail label="Current budget version" value={s.budget.activeVersionLabel ?? 'None'} source="Budget Management" />
            <Detail label="Budget contractor" value={s.lineage.contractorName ?? 'Not linked'} source="Budget Lineage" />
            <Detail label="Selected contractor" value={s.lineage.selectedContractorName ?? 'Not selected'} source="Contractors" />
            <Detail label="Selection date" value={s.lineage.selectionDate ? formatDate(s.lineage.selectionDate) : 'Not set'} source="Contractors" />
            <Detail label="Contract value" value={s.contractor.contractValue !== null ? formatTaka(s.contractor.contractValue) : 'Not set'} source="Contracts" />
            <Detail label="Lowest competing bid" value={s.contractor.lowestCompetingBid !== null ? formatTaka(s.contractor.lowestCompetingBid) : 'No other bids'} source="Contractor Bids" />
            <Detail label="Potential saving" value={s.contractor.potentialSaving !== null ? formatTaka(s.contractor.potentialSaving) : 'Not available'} source="Contractor Bids" />
            <Detail label="Average contractor rate" value={s.contractor.averageRate !== null ? formatTaka(s.contractor.averageRate) : 'No rate schedule'} source="Contractors" />
            <Detail label="Primary vendor" value={s.lineage.vendorName ?? 'Not set'} source="Budget Lineage" />
            <Detail label="Budget lineage status" value={<StatusBadge tone={s.lineage.status === 'COMPLETE' ? 'success' : s.lineage.status === 'PARTIAL' ? 'warning' : 'error'}>{s.lineage.status}</StatusBadge>} source="Budget Lineage" />
          </div>
        </Card>
      )}

      {/* G3. Revision History Summary */}
      <Card>
        <CardHeader title="Revision history summary" description="Budget revision trends, trigger types, and growth." />
        <dl className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="Total revisions" value={String(s.revisions.count)} source="Budget Revisions" />
          <Detail label="Last revision trigger" value={s.revisions.lastTrigger ?? 'None'} source="Budget Revisions" />
          <Detail label="Last revision date" value={s.revisions.lastDate ?? 'None'} source="Budget Revisions" />
          <Detail label="Budget growth %" value={`${s.revisions.budgetGrowthPct > 0 ? '+' : ''}${s.revisions.budgetGrowthPct.toFixed(1)}%`} source="Budget Revisions" />
        </dl>
      </Card>

      {/* H. Quality Summary */}
      <Card>
        <CardHeader title="Quality summary" description="Source: Quality Control" />
        <dl className="mt-6 grid gap-6 sm:grid-cols-3">
          <Detail label="Open issues" value={String(s.quality.openIssues)} source="Quality Control" />
          <Detail label="Closed issues" value={String(s.quality.closedIssues)} source="Quality Control" />
          <Detail label="Quality score" value={`${s.quality.qualityScore}%`} source="Quality Control" />
        </dl>
      </Card>

      {/* I. Project Health Check */}
      </>
      )}

      {tab === 'health' && (
        <Card>
        <CardHeader title="Project health check" description="Validation of critical setup items across all modules." />
        <div className="mt-4 flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden /><span className="text-sm font-semibold text-emerald-700">{passCount} Pass</span></div>
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2"><AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden /><span className="text-sm font-semibold text-amber-700">{warnCount} Warning</span></div>
          <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2"><XCircle className="h-5 w-5 text-rose-600" aria-hidden /><span className="text-sm font-semibold text-rose-700">{critCount} Critical</span></div>
        </div>
        <div className="mt-4 divide-y divide-stone-100">
          {checks.map((check) => (
            <div key={check.label} className="flex items-center justify-between gap-4 py-3 text-sm">
              <div>
                <p className="font-medium text-stone-800">{check.label}</p>
                <p className="text-xs text-stone-500">{check.detail}</p>
              </div>
              <StatusBadge tone={HEALTH_TONE[check.level]}>{HEALTH_LABEL[check.level]}</StatusBadge>
            </div>
          ))}
        </div>
        </Card>
      )}

      {tab === 'data_entry' && <DataEntryReadinessPage />}

      {tab === 'linked' && (
        <Card>
          <CardHeader title="Linked modules" description="Every value in the Project Information tab is auto-calculated from these linked modules. No data is duplicated — the profile reads directly from each source." />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
                  <th className="py-2 pr-4 font-medium">Module</th>
                  <th className="py-2 pr-4 font-medium">Source table</th>
                  <th className="py-2 pr-4 font-medium">Key metric</th>
                  <th className="py-2 pr-4 text-right font-medium">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                <tr><td className="py-3 pr-4 font-medium text-stone-800">Budget Management</td><td className="py-3 pr-4 text-stone-500">budget_versions</td><td className="py-3 pr-4 text-stone-600">Approved budget</td><td className="py-3 pr-4 text-right font-semibold text-stone-900">{formatTaka(s.budget.activeVersionBudget)}</td></tr>
                <tr><td className="py-3 pr-4 font-medium text-stone-800">Construction Finance</td><td className="py-3 pr-4 text-stone-500">construction_funding_sources</td><td className="py-3 pr-4 text-stone-600">Funding received</td><td className="py-3 pr-4 text-right font-semibold text-stone-900">{formatTaka(s.funding.fundingReceived)}</td></tr>
                <tr><td className="py-3 pr-4 font-medium text-stone-800">Construction Finance</td><td className="py-3 pr-4 text-stone-500">construction_funding_sources</td><td className="py-3 pr-4 text-stone-600">Funding gap</td><td className="py-3 pr-4 text-right font-semibold text-stone-900">{formatTaka(s.funding.fundingGap)}</td></tr>
                <tr><td className="py-3 pr-4 font-medium text-stone-800">Construction Tracking</td><td className="py-3 pr-4 text-stone-500">construction_phases</td><td className="py-3 pr-4 text-stone-600">Progress</td><td className="py-3 pr-4 text-right font-semibold text-stone-900">{s.construction.progressPct}%</td></tr>
                <tr><td className="py-3 pr-4 font-medium text-stone-800">Contractors</td><td className="py-3 pr-4 text-stone-500">contractor_bids + contracts</td><td className="py-3 pr-4 text-stone-600">Contractor</td><td className="py-3 pr-4 text-right font-semibold text-stone-900">{s.contractor.name ?? 'Not set'}</td></tr>
                <tr><td className="py-3 pr-4 font-medium text-stone-800">Vendors</td><td className="py-3 pr-4 text-stone-500">vendors + owner_deposits</td><td className="py-3 pr-4 text-stone-600">Vendor balance</td><td className="py-3 pr-4 text-right font-semibold text-stone-900">{formatTaka(s.vendor.vendorBalance)}</td></tr>
                <tr><td className="py-3 pr-4 font-medium text-stone-800">Asset Monetization</td><td className="py-3 pr-4 text-stone-500">monetizable_assets</td><td className="py-3 pr-4 text-stone-600">Estimated value</td><td className="py-3 pr-4 text-right font-semibold text-stone-900">{formatTaka(s.landSales.totalEstimatedValue)}</td></tr>
                <tr><td className="py-3 pr-4 font-medium text-stone-800">Design Management</td><td className="py-3 pr-4 text-stone-500">drawings + drawing_versions</td><td className="py-3 pr-4 text-stone-600">Drawings</td><td className="py-3 pr-4 text-right font-semibold text-stone-900">{s.design.drawingCount}</td></tr>
                <tr><td className="py-3 pr-4 font-medium text-stone-800">BOQ Management</td><td className="py-3 pr-4 text-stone-500">boq_sheets</td><td className="py-3 pr-4 text-stone-600">BOQ sheets</td><td className="py-3 pr-4 text-right font-semibold text-stone-900">{s.design.boqSheetCount}</td></tr>
                <tr><td className="py-3 pr-4 font-medium text-stone-800">Quality Control</td><td className="py-3 pr-4 text-stone-500">quality_defects</td><td className="py-3 pr-4 text-stone-600">Quality score</td><td className="py-3 pr-4 text-right font-semibold text-stone-900">{s.quality.qualityScore}%</td></tr>
                <tr><td className="py-3 pr-4 font-medium text-stone-800">Document Repository</td><td className="py-3 pr-4 text-stone-500">documents</td><td className="py-3 pr-4 text-stone-600">Total documents</td><td className="py-3 pr-4 text-right font-semibold text-stone-900">{s.documents.total}</td></tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {editing && (
        <ProjectEditModal
          project={s.project}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

function Detail({ label, value, source }: { label: string; value: ReactNode; source?: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-stone-500">
        {label}
        {source && <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-normal normal-case tracking-normal text-stone-400">{source}</span>}
      </dt>
      <dd className="mt-1.5 text-sm font-medium text-stone-900">{value}</dd>
    </div>
  );
}
