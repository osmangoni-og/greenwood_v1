import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import { AppShell } from '@/components/AppShell';
import { LoadingState } from '@/components/StatePanel';
import { useHashRoute } from '@/hooks/useHashRoute';
import type { ModuleId } from '@/lib/modules';

const PAGES: Record<ModuleId, LazyExoticComponent<ComponentType>> = {
  dashboard: lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage }))),
  executive: lazy(() => import('@/pages/ExecutiveDashboardPage').then((m) => ({ default: m.ExecutiveDashboardPage }))),
  budget_management: lazy(() => import('@/pages/BudgetManagementPage').then((m) => ({ default: m.BudgetManagementPage }))),
  decision_log: lazy(() => import('@/pages/DecisionLogPage').then((m) => ({ default: m.DecisionLogPage }))),
  project: lazy(() => import('@/pages/ProjectProfilePage').then((m) => ({ default: m.ProjectProfilePage }))),
  design: lazy(() => import('@/pages/DesignPage').then((m) => ({ default: m.DesignPage }))),
  boq: lazy(() => import('@/pages/BoqPage').then((m) => ({ default: m.BoqPage }))),
  contractors: lazy(() => import('@/pages/ContractorsPage').then((m) => ({ default: m.ContractorsPage }))),
  vendors: lazy(() => import('@/pages/VendorsPage').then((m) => ({ default: m.VendorsPage }))),
  construction_finance: lazy(() => import('@/pages/ConstructionFinancePage').then((m) => ({ default: m.ConstructionFinancePage }))),
  asset_monetization: lazy(() => import('@/pages/AssetMonetizationPage').then((m) => ({ default: m.AssetMonetizationPage }))),
  contracts: lazy(() => import('@/pages/ContractsPage').then((m) => ({ default: m.ContractsPage }))),
  construction_tracking: lazy(() => import('@/pages/ConstructionTrackingPage').then((m) => ({ default: m.ConstructionTrackingPage }))),
  site_diary: lazy(() => import('@/pages/SiteDiaryPage').then((m) => ({ default: m.SiteDiaryPage }))),
  quality_control: lazy(() => import('@/pages/QualityControlPage').then((m) => ({ default: m.QualityControlPage }))),
  house_archive: lazy(() => import('@/pages/HouseArchivePage').then((m) => ({ default: m.HouseArchivePage }))),
  settings: lazy(() => import('@/pages/UserSettingsPage').then((m) => ({ default: m.UserSettingsPage }))),
  activity: lazy(() => import('@/pages/ActivityLogPage').then((m) => ({ default: m.ActivityLogPage }))),
  notifications: lazy(() => import('@/pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage }))),
  documents: lazy(() => import('@/pages/DocumentsPage').then((m) => ({ default: m.DocumentsPage }))),
};

function App() {
  const route = useHashRoute();
  const Page = PAGES[route];

  return (
    <AppShell route={route}>
      <Suspense fallback={<LoadingState />}>
        <Page />
      </Suspense>
    </AppShell>
  );
}

export default App;
