import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePipelineStats } from '../hooks/usePipelineStats';
import { PIPELINE_STAGES } from '../types';
import {
  LayoutDashboard, Map, Building2, Users, Bell, ShieldAlert, FileText, Settings, LogOut, Menu, X, Activity, Bot, Plane, Globe2
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { path: '/crisiswatch', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/crisiswatch/map', label: 'Map', icon: Map },
  { path: '/crisiswatch/sam-ai', label: 'GIO AI', icon: Bot },
  { path: '/crisiswatch/country-risk', label: 'Country Risk', icon: Globe2 },
  { path: '/crisiswatch/itineraries', label: 'Itineraries', icon: Plane },
  { path: '/crisiswatch/travel-alerts', label: 'Travel Alerts', icon: Bell },
  { path: '/crisiswatch/assets', label: 'Assets', icon: Building2 },
  { path: '/crisiswatch/analyst-queue', label: 'Analyst Queue', icon: Users },
  { path: '/crisiswatch/alerts', label: 'Alert History', icon: Bell },
  { path: '/crisiswatch/alert-rules', label: 'Alert Rules', icon: ShieldAlert },
  { path: '/crisiswatch/api-docs', label: 'API Docs', icon: FileText },
  { path: '/crisiswatch/settings', label: 'Settings', icon: Settings },
];

const STAGE_LABELS: Record<string, string> = { ingestion: 'Ingestion', classified: 'NLP Classifier', geotagged: 'Geo-Tagger', verified: 'Verified' };
const STAGE_COLORS: Record<string, string> = { ingestion: 'bg-blue-500', classified: 'bg-purple-500', geotagged: 'bg-teal-500', verified: 'bg-green-500' };

export function CrisisLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const { signOut } = useAuth();
  const { stats } = usePipelineStats();

  return (
    <div className="h-screen flex flex-col" style={{ background: '#0a0c0f' }}>
      {/* Pipeline Status Bar */}
      <div className="h-10 flex items-center px-4 gap-6 border-b" style={{ background: '#111318', borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-[#00d4ff]" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">Pipeline</span>
        </div>
        <div className="flex items-center gap-4 flex-1">
          {PIPELINE_STAGES.map((stage, i) => (
            <div key={stage} className="flex items-center gap-2">
              {i > 0 && <div className="w-6 h-px bg-white/10" />}
              <div className={cn('w-2 h-2 rounded-full', STAGE_COLORS[stage])} />
              <span className="text-[11px] font-mono text-white/60">{STAGE_LABELS[stage]}</span>
              <span className="text-[11px] font-mono font-semibold text-white">{stats[stage as keyof typeof stats]}</span>
            </div>
          ))}
        </div>
        <span className="text-[10px] font-mono text-white/30">{stats.throughput} events/hr</span>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className={cn('flex flex-col border-r transition-all duration-200', sidebarOpen ? 'w-56' : 'w-14')} style={{ background: '#111318', borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="p-3 flex items-center gap-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 rounded hover:bg-white/5">
              {sidebarOpen ? <X className="w-4 h-4 text-white/60" /> : <Menu className="w-4 h-4 text-white/60" />}
            </button>
            {sidebarOpen && <span className="text-sm font-semibold text-[#00d4ff] font-mono tracking-wide">CrisisWatch</span>}
          </div>
          <nav className="flex-1 py-2 space-y-0.5 overflow-y-auto">
            {NAV_ITEMS.map(item => {
              const active = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path} className={cn('flex items-center gap-3 px-3 py-2 mx-1 rounded text-sm transition-colors', active ? 'bg-[#00d4ff]/10 text-[#00d4ff]' : 'text-white/50 hover:text-white/80 hover:bg-white/5')}>
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  {sidebarOpen && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </nav>
          <div className="p-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <Link to="/" className={cn('flex items-center gap-3 px-3 py-2 mx-1 rounded text-sm text-white/40 hover:text-white/70 hover:bg-white/5')}>
              <LayoutDashboard className="w-4 h-4" />
              {sidebarOpen && <span>Intel Desk</span>}
            </Link>
            <button onClick={() => signOut()} className={cn('flex items-center gap-3 px-3 py-2 mx-1 rounded text-sm text-white/40 hover:text-red-400 hover:bg-white/5 w-full')}>
              <LogOut className="w-4 h-4" />
              {sidebarOpen && <span>Sign Out</span>}
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto" style={{ background: '#0a0c0f' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
