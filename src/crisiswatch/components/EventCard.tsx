import { CrisisEvent, SEVERITY_COLORS, CATEGORY_BG } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { MapPin, Clock, BarChart3, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EventCardProps {
  event: CrisisEvent;
  isSelected?: boolean;
  onClick: () => void;
}

export function EventCard({ event, isSelected, onClick }: EventCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'p-3 rounded-lg border cursor-pointer transition-all duration-200 group',
        'hover:border-white/20',
        isSelected ? 'border-[#00d4ff]/50 bg-[#00d4ff]/5' : 'border-white/[0.07] bg-[#181c22]'
      )}
      style={{ animation: 'fadeSlideIn 0.3s ease-out' }}
    >
      <div className="flex items-start gap-3">
        {/* Severity indicator */}
        <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: SEVERITY_COLORS[event.severity] }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={cn('text-[11px] font-mono uppercase px-1.5 py-0.5 rounded border', CATEGORY_BG[event.category])}>
              {event.category}
            </span>
            <span className="text-[11px] font-mono uppercase px-1.5 py-0.5 rounded" style={{ background: SEVERITY_COLORS[event.severity] + '22', color: SEVERITY_COLORS[event.severity] }}>
              {event.severity}
            </span>
            <span className="text-[11px] font-mono text-white/40 uppercase">{event.pipeline_stage}</span>
          </div>
          <h3 className="text-[15px] font-semibold text-white leading-snug mb-1.5 line-clamp-2">{event.title}</h3>
          <div className="flex items-center gap-x-3 gap-y-1 text-[12px] text-white/55 font-mono flex-wrap">
            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{event.location || 'Unknown'}</span>
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}</span>
            <span className="flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" />{event.confidence}%</span>
            <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{event.sources_count}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
