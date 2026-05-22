import { CrisisEvent, SEVERITY_COLORS, CATEGORY_BG } from '../types';
import { X, MapPin, Clock, BarChart3, Eye, Shield, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { formatLocalForViewer } from '@/utils/countryTimezone';

interface EventDetailProps {
  event: CrisisEvent;
  onClose: () => void;
}

const STATUS_ICONS: Record<string, any> = {
  new: AlertTriangle,
  verified: CheckCircle,
  active: Shield,
  resolved: CheckCircle,
};

export function EventDetail({ event, onClose }: EventDetailProps) {
  const StatusIcon = STATUS_ICONS[event.status] || AlertTriangle;

  return (
    <div className="h-full flex flex-col" style={{ background: '#111318' }}>
      <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <span className="text-xs font-mono text-white/40 uppercase tracking-wider">Event Detail</span>
        <button onClick={onClose} className="p-1 rounded hover:bg-white/10"><X className="w-4 h-4 text-white/50" /></button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Severity + Status */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase px-2 py-1 rounded font-bold" style={{ background: SEVERITY_COLORS[event.severity] + '22', color: SEVERITY_COLORS[event.severity] }}>
              {event.severity}
            </span>
            <span className={`text-xs font-mono uppercase px-2 py-1 rounded ${CATEGORY_BG[event.category]}`}>
              {event.category}
            </span>
            <div className="flex items-center gap-1 ml-auto">
              <StatusIcon className="w-3.5 h-3.5" style={{ color: event.status === 'resolved' ? '#2ed573' : '#00d4ff' }} />
              <span className="text-xs font-mono text-white/50 uppercase">{event.status}</span>
            </div>
          </div>

          <h2 className="text-lg font-semibold text-white leading-snug">{event.title}</h2>

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: MapPin, label: 'Location', value: event.location },
              { icon: Clock, label: 'Local Time', value: formatLocalForViewer(event.created_at) },
              { icon: Eye, label: 'Sources', value: `${event.sources_count} sources` },
              { icon: BarChart3, label: 'Stage', value: event.pipeline_stage },
            ].map(m => (
              <div key={m.label} className="p-2 rounded" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <m.icon className="w-3 h-3 text-[#00d4ff]" />
                  <span className="text-[10px] font-mono text-white/30 uppercase">{m.label}</span>
                </div>
                <span className="text-xs text-white/80 font-mono">{m.value || '—'}</span>
              </div>
            ))}
          </div>

          {/* Confidence */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono text-white/40 uppercase">Confidence</span>
              <span className="text-xs font-mono text-[#00d4ff]">{event.confidence}%</span>
            </div>
            <Progress value={event.confidence} className="h-1.5" />
          </div>

          {/* Summary */}
          <div>
            <span className="text-[10px] font-mono text-white/40 uppercase block mb-1">Summary</span>
            <p className="text-sm text-white/70 leading-relaxed">{event.summary}</p>
          </div>

          {/* Impacts */}
          {event.impacts.length > 0 && (
            <div>
              <span className="text-[10px] font-mono text-white/40 uppercase block mb-1">Impacts</span>
              <ul className="space-y-1">
                {event.impacts.map((imp, i) => (
                  <li key={i} className="text-xs text-white/60 flex items-start gap-2">
                    <span className="text-[#ff4757] mt-0.5">•</span>{imp}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommended Actions */}
          {event.actions.length > 0 && (
            <div>
              <span className="text-[10px] font-mono text-white/40 uppercase block mb-1">Recommended Actions</span>
              <ul className="space-y-1">
                {event.actions.map((act, i) => (
                  <li key={i} className="text-xs text-white/60 flex items-start gap-2">
                    <span className="text-[#2ed573] mt-0.5">→</span>{act}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Affected Area */}
          {event.affected_area && (
            <div>
              <span className="text-[10px] font-mono text-white/40 uppercase block mb-1">Affected Area</span>
              <p className="text-xs text-white/60 font-mono">{event.affected_area}</p>
            </div>
          )}

          {/* Original Source */}
          {event.url && (
            <div>
              <span className="text-[10px] font-mono text-white/40 uppercase block mb-1">Original Source</span>
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 rounded border border-[#00d4ff]/30 bg-[#00d4ff]/5 text-xs font-mono text-[#00d4ff] hover:bg-[#00d4ff]/10 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {event.source ? `View on ${event.source}` : 'View original article'}
              </a>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
