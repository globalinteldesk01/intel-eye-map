import { useState, useEffect, useRef, useMemo } from 'react';
import { CrisisLayout } from '../components/CrisisLayout';
import { EventCard } from '../components/EventCard';
import { EventDetail } from '../components/EventDetail';
import { useCrisisEvents } from '../hooks/useCrisisEvents';
import { useCrisisAssets } from '../hooks/useCrisisAssets';
import { CrisisEvent, SEVERITY_COLORS } from '../types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Layers, Flame } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function CrisisMap() {
  const { events } = useCrisisEvents();
  const { assets } = useCrisisAssets();
  const [selectedEvent, setSelectedEvent] = useState<CrisisEvent | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  const validEvents = useMemo(() => events.filter(e => e.latitude && e.longitude && !(e.latitude === 0 && e.longitude === 0)), [events]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, { zoomControl: false }).setView([15, 105], 4);
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    markersRef.current = L.layerGroup().addTo(map);
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markersRef.current) return;
    markersRef.current.clearLayers();

    validEvents.forEach(event => {
      const color = SEVERITY_COLORS[event.severity];
      const icon = L.divIcon({
        className: 'custom-marker-container',
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid ${color}44;box-shadow:0 0 8px ${color}88;${event.severity === 'critical' ? 'animation:critical-pulse 2s infinite;' : ''}"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      const marker = L.marker([event.latitude, event.longitude], { icon });
      marker.bindPopup(`<div style="padding:8px;min-width:180px"><strong style="color:#00d4ff;font-size:12px">${event.title}</strong><br/><span style="color:#aaa;font-size:11px">${event.location} • ${event.severity.toUpperCase()}</span></div>`);
      marker.on('click', () => setSelectedEvent(event));
      markersRef.current!.addLayer(marker);
    });

    // Asset markers (squares)
    assets.forEach(asset => {
      if (!asset.latitude || !asset.longitude) return;
      const icon = L.divIcon({
        className: 'custom-marker-container',
        html: `<div style="width:12px;height:12px;background:#00d4ff;border:2px solid #00d4ff44;transform:rotate(45deg);box-shadow:0 0 6px #00d4ff88"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });
      L.marker([asset.latitude, asset.longitude], { icon })
        .bindPopup(`<div style="padding:8px"><strong style="color:#00d4ff;font-size:12px">${asset.name}</strong><br/><span style="color:#aaa;font-size:11px">${asset.type} • ${asset.radius_km}km radius</span></div>`)
        .addTo(markersRef.current!);
    });

    if (validEvents.length > 0) {
      const bounds = L.latLngBounds(validEvents.map(e => [e.latitude, e.longitude]));
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 8 });
    }
  }, [validEvents, assets]);

  useEffect(() => {
    if (!mapRef.current || !selectedEvent) return;
    if (selectedEvent.latitude && selectedEvent.longitude) {
      mapRef.current.flyTo([selectedEvent.latitude, selectedEvent.longitude], 8, { duration: 1 });
    }
  }, [selectedEvent]);

  return (
    <CrisisLayout>
      <div className="flex h-full overflow-hidden">
        {/* Left event list */}
        <div className="w-72 border-r flex-shrink-0 flex flex-col" style={{ background: '#111318', borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <span className="text-xs font-mono text-white/40 uppercase">Events ({validEvents.length})</span>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-white/50" onClick={() => setShowHeatmap(!showHeatmap)}>
              {showHeatmap ? <Layers className="w-3 h-3" /> : <Flame className="w-3 h-3" />}
              {showHeatmap ? 'Markers' : 'Heatmap'}
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1.5">
              {validEvents.map(event => (
                <EventCard key={event.id} event={event} isSelected={selectedEvent?.id === event.id} onClick={() => setSelectedEvent(event)} />
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <div ref={mapContainerRef} className="absolute inset-0" />
        </div>

        {/* Detail */}
        {selectedEvent && (
          <div className="w-80 border-l flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />
          </div>
        )}
      </div>
    </CrisisLayout>
  );
}
