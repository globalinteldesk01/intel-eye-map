import { useState, useMemo } from 'react';
import { CrisisLayout } from '../components/CrisisLayout';
import { EventCard } from '../components/EventCard';
import { EventDetail } from '../components/EventDetail';
import { useCrisisEvents } from '../hooks/useCrisisEvents';
import { CrisisEvent, SEVERITY_COLORS, CATEGORY_COLORS } from '../types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, TrendingUp, Shield, BarChart3 } from 'lucide-react';

export default function CrisisDashboard() {
  const { events, loading } = useCrisisEvents();
  const [selectedEvent, setSelectedEvent] = useState<CrisisEvent | null>(null);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEvents = events.filter(e => new Date(e.created_at) >= today);
    return {
      total: todayEvents.length,
      critical: events.filter(e => e.severity === 'critical').length,
      high: events.filter(e => e.severity === 'high').length,
      bySource: events.reduce((acc, e) => { acc[e.category] = (acc[e.category] || 0) + 1; return acc; }, {} as Record<string, number>),
    };
  }, [events]);

  return (
    <CrisisLayout>
      <div className="flex flex-col h-full">
        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-3 p-4">
          {[
            { label: 'Alerts Today', value: stats.total, icon: TrendingUp, color: '#00d4ff' },
            { label: 'Critical', value: stats.critical, icon: AlertTriangle, color: '#ff4757' },
            { label: 'High', value: stats.high, icon: Shield, color: '#ffa502' },
            { label: 'Total Events', value: events.length, icon: BarChart3, color: '#2ed573' },
          ].map(s => (
            <div key={s.label} className="rounded-lg border p-3" style={{ background: '#181c22', borderColor: 'rgba(255,255,255,0.07)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">{s.label}</span>
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
              </div>
              <span className="text-2xl font-bold font-mono" style={{ color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Source type badges */}
        <div className="px-4 pb-2 flex gap-2 flex-wrap">
          {Object.entries(stats.bySource).map(([cat, count]) => (
            <span key={cat} className="text-[10px] font-mono px-2 py-1 rounded" style={{ background: (CATEGORY_COLORS[cat as keyof typeof CATEGORY_COLORS] || '#666') + '22', color: CATEGORY_COLORS[cat as keyof typeof CATEGORY_COLORS] || '#999' }}>
              {cat}: {count}
            </span>
          ))}
        </div>

        {/* Event Feed + Detail */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <div className="px-4 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <span className="text-xs font-mono text-white/40 uppercase tracking-wider">Live Event Feed</span>
            </div>
            <ScrollArea className="h-[calc(100%-32px)]">
              <div className="p-3 space-y-2">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="p-3 rounded-lg" style={{ background: '#181c22' }}>
                      <Skeleton className="h-4 w-1/3 mb-2" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-2/3 mt-1" />
                    </div>
                  ))
                ) : events.length === 0 ? (
                  <div className="text-center py-12 text-white/30 font-mono text-sm">No events yet</div>
                ) : (
                  events.map(event => (
                    <EventCard key={event.id} event={event} isSelected={selectedEvent?.id === event.id} onClick={() => setSelectedEvent(event)} />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Detail Panel */}
          {selectedEvent && (
            <div className="w-80 border-l flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />
            </div>
          )}
        </div>
      </div>
    </CrisisLayout>
  );
}
