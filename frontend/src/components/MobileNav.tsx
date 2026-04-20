import { Map, Newspaper, MessageSquare, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

type MobileTab = 'feed' | 'map' | 'chat';

interface MobileNavProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  unreadCount?: number;
}

const tabs = [
  { id: 'feed' as MobileTab,  label: 'Intel',  Icon: Newspaper },
  { id: 'map'  as MobileTab,  label: 'Map',    Icon: Map },
  { id: 'chat' as MobileTab,  label: 'Chat',   Icon: MessageSquare },
];

export function MobileNav({ activeTab, onTabChange, unreadCount = 0 }: MobileNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[hsl(210,100%,20%)] border-t border-white/10 flex lg:hidden">
      {tabs.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => onTabChange(id)}
          className={cn(
            'flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors relative',
            activeTab === id
              ? 'text-white bg-white/10'
              : 'text-white/50 hover:text-white/80'
          )}
        >
          <div className="relative">
            <Icon className="w-5 h-5" />
            {id === 'chat' && unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
          {activeTab === id && (
            <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-white rounded-full" />
          )}
        </button>
      ))}
    </nav>
  );
}
