import { useCallback, useEffect, useState } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { FilterBar } from './components/filters/FilterBar';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { FiltersProvider, useFilters } from './context/FiltersContext';
import { DataProvider, useData } from './context/DataContext';
import { PageSkeleton } from './components/ui/Skeleton';

import { Overview } from './pages/Overview';
import { Trends } from './pages/Trends';
import { Funnel } from './pages/Funnel';
import { Campaigns } from './pages/Campaigns';
import { AdSets } from './pages/AdSets';
import { Ads } from './pages/Ads';
import { CreativeInsights } from './pages/CreativeInsights';
import { Breakdowns } from './pages/Breakdowns';
import { Geography } from './pages/Geography';
import { Placements } from './pages/Placements';
import { TimeAnalysis } from './pages/TimeAnalysis';
import { TopPerformers } from './pages/TopPerformers';
import { WorstPerformers } from './pages/WorstPerformers';
import { Scaling } from './pages/Scaling';
import { BudgetEngine } from './pages/BudgetEngine';
import { AIInsights } from './pages/AIInsights';
import { Ratios } from './pages/Ratios';
import { Profitability } from './pages/Profitability';
import { Alerts } from './pages/Alerts';
import { Reports } from './pages/Reports';
import { Connection } from './pages/Connection';

import type { NavPage } from './types';
import { DEFAULT_RANGE } from './lib/dateRanges';
import type { DateRange } from './lib/dateRanges';

/** Pages that show the global filter bar — breakdown-only views drive their own. */
const FILTERED_PAGES: NavPage[] = [
  'overview', 'trends', 'funnel', 'campaigns', 'adsets', 'ads', 'creative',
  'breakdowns', 'geography', 'placements', 'top', 'worst', 'scaling', 'engine',
  'insights', 'profitability', 'reports',
];

function Dashboard() {
  const { filters } = useFilters();
  const [activePage, setActivePage] = useState<NavPage>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Tailwind's class strategy reads the theme off <html>, so the toggle has to
  // write there — a class on a wrapper div would leave portals and the body
  // background on the old theme.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    document.documentElement.classList.toggle('light', !darkMode);
  }, [darkMode]);

  // Stand-in for the Insights API round trip, so skeletons are exercised by the
  // same code path a live fetch would use.
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 420);
    return () => clearTimeout(t);
  }, [activePage]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setLoading(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setLoading(false);
    }, 900);
  }, []);

  const sidebarWidth = sidebarCollapsed ? 64 : 240;

  const renderPage = () => {
    switch (activePage) {
      case 'overview': return <Overview selectedDays={filters.days} />;
      case 'trends': return <Trends />;
      case 'funnel': return <Funnel selectedDays={filters.days} />;
      case 'campaigns': return <Campaigns />;
      case 'adsets': return <AdSets />;
      case 'ads': return <Ads />;
      case 'creative': return <CreativeInsights />;
      case 'breakdowns': return <Breakdowns />;
      case 'geography': return <Geography />;
      case 'placements': return <Placements />;
      case 'time': return <TimeAnalysis />;
      case 'top': return <TopPerformers />;
      case 'worst': return <WorstPerformers />;
      case 'scaling': return <Scaling />;
      case 'engine': return <BudgetEngine />;
      case 'insights': return <AIInsights />;
      case 'ratios': return <Ratios selectedDays={filters.days} />;
      case 'profitability': return <Profitability selectedDays={filters.days} />;
      case 'alerts': return <Alerts />;
      case 'reports': return <Reports selectedDays={filters.days} />;
      case 'connection': return <Connection />;
      default: return <Overview selectedDays={filters.days} />;
    }
  };

  return (
    <div className="min-h-screen bg-bg-base">
      <Sidebar activePage={activePage} onNavigate={setActivePage} collapsed={sidebarCollapsed} />

      <div
        className="transition-all duration-300 min-h-screen print:!ml-0"
        style={{ marginLeft: sidebarWidth }}
      >
        <Header
          activePage={activePage}
          onToggleSidebar={() => setSidebarCollapsed(c => !c)}
          onNavigate={setActivePage}
          darkMode={darkMode}
          onToggleDark={() => setDarkMode(d => !d)}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          offsetLeft={sidebarWidth}
        />

        <main className="pt-16 print:pt-0">
          <div className="p-5 md:p-6 max-w-[1920px] space-y-5">
            {FILTERED_PAGES.includes(activePage) && <FilterBar />}

            {/* Keyed so a failure on one page does not persist onto the next. */}
            <ErrorBoundary key={activePage} section={activePage} onReset={handleRefresh}>
              {loading ? <PageSkeleton /> : renderPage()}
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  // Owned here because DataProvider and FiltersProvider both need it, and
  // DataProvider sits above the filter store.
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);

  return (
    <DataProvider range={range}>
      <FiltersProvider range={range} onRangeChange={setRange}>
        <Dashboard />
      </FiltersProvider>
    </DataProvider>
  );
}
