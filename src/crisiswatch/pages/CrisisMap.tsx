import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CrisisLayout } from '../components/CrisisLayout';
import { EventCard } from '../components/EventCard';
import { EventDetail } from '../components/EventDetail';
import { useCrisisEvents } from '../hooks/useCrisisEvents';
import { useCrisisAssets } from '../hooks/useCrisisAssets';
import { CrisisEvent, SEVERITY_COLORS, CATEGORY_COLORS } from '../types';
import { createCrisisMarkerIcon, createCrisisPopupContent } from '../utils/mapMarkers';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Layers, Flame, ChevronDown, Search, Globe, X } from 'lucide-react';
import { COUNTRY_BOUNDS } from '../data/countryBounds';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';

export default function CrisisMap() {
  const { events } = useCrisisEvents();
  const { assets } = useCrisisAssets();
  const [selectedEvent, setSelectedEvent] = useState<CrisisEvent | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [countrySearch, setCountrySearch] = useState('');
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersClusterRef = useRef<L.MarkerClusterGroup | null>(null);

  const selectedCountry = searchParams.get('country') || 'all';

  const setSelectedCountry = useCallback((country: string) => {
    if (country === 'all') {
      searchParams.delete('country');
    } else {
      searchParams.set('country', country);
    }
    setSearchParams(searchParams, { replace: true });
    setCountryDropdownOpen(false);
    setCountrySearch('');
  }, [searchParams, setSearchParams]);

  // All events with valid coordinates
  const allValidEvents = useMemo(
    () => events.filter(e => e.latitude && e.longitude && !(e.latitude === 0 && e.longitude === 0)),
    [events]
  );

  // Country list with counts
  const countryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allValidEvents.forEach(e => {
      const loc = e.location?.split(',').pop()?.trim() || e.location || 'Unknown';
      counts[loc] = (counts[loc] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, count }));
  }, [allValidEvents]);

  // Filtered events based on selected country
  const visibleEvents = useMemo(() => {
    if (selectedCountry === 'all') return allValidEvents;
    return allValidEvents.filter(e => {
      const loc = e.location?.split(',').pop()?.trim() || e.location || 'Unknown';
      return loc === selectedCountry;
    });
  }, [allValidEvents, selectedCountry]);

  // Filtered country list for search
  const filteredCountries = useMemo(() => {
    if (!countrySearch) return countryCounts;
    return countryCounts.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase()));
  }, [countryCounts, countrySearch]);

  // Init map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, { zoomControl: false }).setView([15, 105], 2);
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);
    mapRef.current = map;

    // Ensure tiles render correctly once the flex container has its final size.
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(mapContainerRef.current);
    requestAnimationFrame(() => map.invalidateSize());
    setTimeout(() => map.invalidateSize(), 250);

    markersClusterRef.current = L.markerClusterGroup({
      maxClusterRadius: 50,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        let color = '#2ed573';
        if (count >= 10) color = '#ff4757';
        else if (count >= 5) color = '#ffa502';

        return L.divIcon({
          html: `<div style="
            background:${color};width:40px;height:40px;border-radius:50%;
            display:flex;align-items:center;justify-content:center;
            color:white;font-weight:bold;font-size:13px;font-family:'IBM Plex Mono',monospace;
            border:3px solid ${color}44;box-shadow:0 0 12px ${color}88;
          ">${count}</div>`,
          className: 'custom-cluster-icon',
          iconSize: L.point(40, 40),
        });
      },
    });
    map.addLayer(markersClusterRef.current);

    return () => { ro.disconnect(); map.remove(); mapRef.current = null; };
  }, []);

  // Update markers when visibleEvents change
  useEffect(() => {
    if (!mapRef.current || !markersClusterRef.current) return;
    markersClusterRef.current.clearLayers();

    const isFiltered = selectedCountry !== 'all';

    visibleEvents.forEach(event => {
      const marker = L.marker([event.latitude, event.longitude], {
        icon: createCrisisMarkerIcon(event),
      });

      // Only bind popup when a specific country is selected
      if (isFiltered) {
        marker.bindPopup(createCrisisPopupContent(event), {
          maxWidth: 320,
          className: 'crisis-intel-popup',
        });
      }

      marker.on('click', () => setSelectedEvent(event));
      markersClusterRef.current!.addLayer(marker);
    });

    // Asset markers
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
        .addTo(markersClusterRef.current!);
    });
  }, [visibleEvents, assets]);

  // Fly to country or world view when selection changes
  useEffect(() => {
    if (!mapRef.current) return;

    if (selectedCountry === 'all') {
      if (allValidEvents.length > 0) {
        const bounds = L.latLngBounds(allValidEvents.map(e => [e.latitude, e.longitude]));
        mapRef.current.flyToBounds(bounds, { padding: [40, 40], maxZoom: 8, duration: 1 });
      } else {
        mapRef.current.flyTo([15, 105], 2, { duration: 1 });
      }
      return;
    }

    // Try static bounds first
    const staticBounds = COUNTRY_BOUNDS[selectedCountry];
    if (staticBounds) {
      mapRef.current.flyToBounds(staticBounds, { padding: [50, 50], maxZoom: 8, duration: 1.2 });
      return;
    }

    // Fallback: fit to marker bounds
    if (visibleEvents.length === 1) {
      mapRef.current.flyTo([visibleEvents[0].latitude, visibleEvents[0].longitude], 6, { duration: 1.2 });
    } else if (visibleEvents.length > 1) {
      const bounds = L.latLngBounds(visibleEvents.map(e => [e.latitude, e.longitude]));
      mapRef.current.flyToBounds(bounds, { padding: [50, 50], maxZoom: 8, duration: 1.2 });
    }
  }, [selectedCountry, visibleEvents, allValidEvents]);

  // Fly to selected event
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
          {/* Country dropdown */}
          <div className="px-3 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <Popover open={countryDropdownOpen} onOpenChange={setCountryDropdownOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between h-8 text-xs font-mono bg-white/5 hover:bg-white/10 text-white/80 border border-white/[0.07]"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <Globe className="w-3 h-3 text-[#00d4ff]" />
                    {selectedCountry === 'all' ? 'All Countries' : selectedCountry}
                  </span>
                  <ChevronDown className="w-3 h-3 text-white/40" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0 border-white/10" style={{ background: '#181c22' }} align="start">
                <div className="p-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30" />
                    <Input
                      value={countrySearch}
                      onChange={e => setCountrySearch(e.target.value)}
                      placeholder="Search countries..."
                      className="h-7 text-xs pl-7 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                  </div>
                </div>
                <ScrollArea className="max-h-60">
                  <div className="p-1">
                    <button
                      onClick={() => setSelectedCountry('all')}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs font-mono transition-colors ${
                        selectedCountry === 'all' ? 'bg-[#00d4ff]/10 text-[#00d4ff]' : 'text-white/70 hover:bg-white/5'
                      }`}
                    >
                      <span>All Countries</span>
                      <span className="text-white/30">{allValidEvents.length}</span>
                    </button>
                    {filteredCountries.map(c => (
                      <button
                        key={c.name}
                        onClick={() => setSelectedCountry(c.name)}
                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs font-mono transition-colors ${
                          selectedCountry === c.name ? 'bg-[#00d4ff]/10 text-[#00d4ff]' : 'text-white/70 hover:bg-white/5'
                        }`}
                      >
                        <span className="truncate">{c.name}</span>
                        <span className="text-white/30 flex-shrink-0 ml-2">{c.count}</span>
                      </button>
                    ))}
                    {filteredCountries.length === 0 && (
                      <div className="px-2 py-4 text-center text-xs text-white/30 font-mono">No countries found</div>
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          </div>

          <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <span className="text-xs font-mono text-white/40 uppercase">
              Events ({visibleEvents.length})
              {selectedCountry !== 'all' && (
                <button onClick={() => setSelectedCountry('all')} className="ml-2 inline-flex items-center gap-0.5 text-[#00d4ff] hover:text-[#00d4ff]/80">
                  <X className="w-3 h-3" /> reset
                </button>
              )}
            </span>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-white/50" onClick={() => setShowHeatmap(!showHeatmap)}>
              {showHeatmap ? <Layers className="w-3 h-3" /> : <Flame className="w-3 h-3" />}
              {showHeatmap ? 'Markers' : 'Heatmap'}
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1.5">
              {visibleEvents.map(event => (
                <EventCard key={event.id} event={event} isSelected={selectedEvent?.id === event.id} onClick={() => setSelectedEvent(event)} />
              ))}
              {visibleEvents.length === 0 && (
                <div className="px-2 py-8 text-center text-xs text-white/30 font-mono">No events for this country</div>
              )}
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
