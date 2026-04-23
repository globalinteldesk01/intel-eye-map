import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Map, BarChart3, Bell, CalendarClock, FileText,
  Shield, List, Radio, BookOpen, Users, Search, Zap, MessageSquare,
  ChevronDown, ChevronRight, Settings, LogOut, Activity
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import globalIntelLogo from '@/assets/global-intel-desk-logo.png';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  onToggleChat: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
  badgeColor?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: '',
    items: [
      { id: 'map',       label: 'Map',          icon: Map },
      { id: 'dashboard', label: 'Dashboard',     icon: LayoutDashboard },
      { id: 'analytics', label: 'Analytics',     icon: BarChart3 },
    ],
  },
  {
    title: 'Communication',
    items: [
      { id: 'notifications',  label: 'Notifications',  icon: Bell },
      { id: 'alerts',         label: 'Alert History',  icon: CalendarClock },
      { id: 'chat',           label: 'Intel Chat',     icon: MessageSquare },
    ],
  },
  {
    title: 'Threat Intelligence',
    items: [
      { id: 'threat-list',   label: 'Threat List',       icon: List },
      { id: 'live-feed',     label: 'Live Feed',          icon: Radio, badge: 'LIVE', badgeColor: 'bg-green-500' },
      { id: 'situation',     label: 'Situation Reports',  icon: BookOpen },
      { id: 'analyst',       label: 'Analyst Access',     icon: Users, badge: '●', badgeColor: 'text-red-500' },
    ],
  },
  {
    title: 'Intelligence Sources',
    items: [
      { id: 'osint',    label: 'OSINT Monitor',  icon: Search },
      { id: 'activity', label: 'Activity Log',   icon: Activity },
    ],
  },
];

export function Sidebar({ activeView, onViewChange, onToggleChat }: SidebarProps) {
  const { user, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleSection = (title: string) => {
    setCollapsed(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const handleItemClick = (id: string) => {
    if (id === 'chat') { onToggleChat(); return; }
    onViewChange(id);
  };

  return (
    <aside className="w-[220px] min-w-[220px] h-full flex flex-col bg-[#1a2538] border-r border-[#2a3a52] select-none">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-[#2a3a52]">
        <img src={globalIntelLogo} alt="GID" className="h-8 w-8 rounded" />
        <div>
          <p className="text-white font-bold text-[13px] leading-tight tracking-wide uppercase">Global</p>
          <p className="text-[#06b6d4] font-bold text-[13px] leading-tight tracking-wide uppercase">Intel Desk</p>
        </div>
      </div>

      {/* New Notification button */}
      <div className="px-3 py-3 border-b border-[#2a3a52]">
        <button
          onClick={() => handleItemClick('live-feed')}
          className="w-full flex items-center justify-center gap-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-bold py-2 px-3 rounded transition-colors uppercase tracking-wide"
        >
          <Zap className="w-3.5 h-3.5" />
          Live Intel Feed
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 scrollbar-none">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title || 'main'} className="mb-1">
            {section.title && (
              <button
                onClick={() => toggleSection(section.title)}
                className="w-full flex items-center justify-between px-4 py-1.5 text-[10px] font-bold text-[#64748b] uppercase tracking-widest hover:text-[#94a3b8] transition-colors"
              >
                <span>{section.title}</span>
                {collapsed[section.title]
                  ? <ChevronRight className="w-3 h-3" />
                  : <ChevronDown className="w-3 h-3" />
                }
              </button>
            )}

            {!collapsed[section.title] && section.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2 text-[13px] transition-all relative group',
                    isActive
                      ? 'bg-[#2563eb]/20 text-white font-semibold border-r-2 border-[#2563eb]'
                      : 'text-[#94a3b8] hover:bg-white/5 hover:text-white'
                  )}
                >
                  <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-[#2563eb]' : 'text-[#64748b] group-hover:text-[#94a3b8]')} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge && (
                    <span className={cn('text-[9px] font-bold', item.badgeColor || 'text-white')}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom — user & settings */}
      <div className="border-t border-[#2a3a52] p-3 space-y-1">
        <button className="w-full flex items-center gap-3 px-3 py-2 text-[12px] text-[#94a3b8] hover:text-white hover:bg-white/5 rounded transition-colors">
          <Settings className="w-3.5 h-3.5" />
          Settings
        </button>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2 text-[12px] text-[#94a3b8] hover:text-red-400 hover:bg-red-500/5 rounded transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
        <div className="px-3 py-1">
          <p className="text-[10px] text-[#475569] truncate">{user?.email}</p>
        </div>
      </div>
    </aside>
  );
}
