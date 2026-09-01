import { clsx } from 'clsx';
import {
  LayoutDashboard, Megaphone, Users, Image, GitBranch, LineChart, DollarSign,
  Zap, Bell, FileText, ChevronRight, TrendingUp, Activity, Brain, Sigma,
  Layers, Globe2, LayoutGrid, Clock, Trophy, AlertTriangle, Sparkles,
} from 'lucide-react';
import { alerts } from '../../data/mockData';
import type { NavPage } from '../../types';

interface SidebarProps {
  activePage: NavPage;
  onNavigate: (page: NavPage) => void;
  collapsed: boolean;
}

interface NavItem {
  id: NavPage;
  label: string;
  icon: React.ElementType;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const openAlerts = alerts.filter(a => a.type === 'danger' || a.type === 'warning').length;

/**
 * Navigation grouped by the question each section answers, rather than one flat
 * list — 20 views is past the point where a flat list stays scannable.
 */
const NAV: NavSection[] = [
  {
    title: 'Performance',
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'trends', label: 'Trends', icon: LineChart },
      { id: 'funnel', label: 'Funnel', icon: GitBranch },
      { id: 'profitability', label: 'Profitability', icon: DollarSign },
    ],
  },
  {
    title: 'Structure',
    items: [
      { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
      { id: 'adsets', label: 'Ad Sets', icon: Users },
      { id: 'ads', label: 'Ads', icon: Image },
      { id: 'creative', label: 'Creative Insights', icon: Sparkles },
    ],
  },
  {
    title: 'Analysis',
    items: [
      { id: 'breakdowns', label: 'Breakdowns', icon: Layers },
      { id: 'geography', label: 'Geography', icon: Globe2 },
      { id: 'placements', label: 'Placements', icon: LayoutGrid },
      { id: 'time', label: 'Time Analysis', icon: Clock },
      { id: 'ratios', label: 'KPI Ratios', icon: Sigma },
    ],
  },
  {
    title: 'Optimization',
    items: [
      { id: 'top', label: 'Top Performers', icon: Trophy },
      { id: 'worst', label: 'Waste & Worst', icon: AlertTriangle },
      { id: 'scaling', label: 'Scaling', icon: TrendingUp },
      { id: 'engine', label: 'Budget Engine', icon: Zap, badge: 'AI' },
      { id: 'insights', label: 'AI Insights', icon: Brain, badge: 'AI' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { id: 'alerts', label: 'Alerts', icon: Bell, badge: openAlerts > 0 ? String(openAlerts) : undefined },
      { id: 'reports', label: 'Reports', icon: FileText },
    ],
  },
];

export function Sidebar({ activePage, onNavigate, collapsed }: SidebarProps) {
  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 h-full z-30 flex flex-col bg-bg-surface border-r border-bg-border transition-all duration-300 print:hidden',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Logo */}
      <div
        className={clsx(
          'flex items-center border-b border-bg-border transition-all duration-300 shrink-0',
          collapsed ? 'px-4 py-5 justify-center' : 'px-5 py-5 gap-3',
        )}
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center shrink-0 shadow-glow">
          <Activity size={16} className="text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-white leading-tight truncate">Pharmescence</p>
            <p className="text-xs text-slate-500 truncate">Meta Ads Dashboard</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 no-scrollbar">
        {NAV.map((section, si) => (
          <div key={section.title} className={clsx(si > 0 && 'mt-4')}>
            {!collapsed && (
              <p className="px-3 mb-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                {section.title}
              </p>
            )}
            {collapsed && si > 0 && <div className="mx-3 mb-2 border-t border-bg-border" />}

            <div className="space-y-0.5">
              {section.items.map(item => {
                const Icon = item.icon;
                const isActive = activePage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    title={collapsed ? item.label : undefined}
                    aria-current={isActive ? 'page' : undefined}
                    className={clsx(
                      'w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150 group relative',
                      isActive
                        ? 'bg-brand-600/15 text-brand-400 border border-brand-600/30'
                        : 'text-slate-400 hover:text-white hover:bg-bg-hover border border-transparent',
                    )}
                  >
                    <Icon size={16} className={clsx('shrink-0', isActive ? 'text-brand-400' : 'group-hover:text-white')} />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left truncate">{item.label}</span>
                        {item.badge && (
                          <span
                            className={clsx(
                              'text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none',
                              item.badge === 'AI' ? 'bg-brand-600 text-white' : 'bg-rose-500 text-white',
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
                        {isActive && <ChevronRight size={14} className="text-brand-400 shrink-0" />}
                      </>
                    )}
                    {collapsed && item.badge && (
                      <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="p-4 border-t border-bg-border shrink-0">
          <div className="bg-bg-elevated rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-soft" />
              <span className="text-xs text-slate-400 font-medium">Live Data</span>
            </div>
            <p className="text-xs text-slate-500">Last synced: 2 min ago</p>
            <p className="text-xs text-slate-600 mt-0.5">Account ID: act_6182940</p>
          </div>
        </div>
      )}
    </aside>
  );
}
