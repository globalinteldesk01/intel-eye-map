import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CrisisLayout } from '../components/CrisisLayout';
import { EventCard } from '../components/EventCard';
import { EventDetail } from '../components/EventDetail';
import { useCrisisEvents } from '../hooks/useCrisisEvents';
import { useCrisisAssets } from '../hooks/useCrisisAssets';
import { CrisisEvent } from '../types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Layers, Flame, ChevronDown, Search, Globe, X, MapPin, ExternalLink } from 'lucide-react';
import { COUNTRY_BOUNDS } from '../data/countryBounds';
import { extractCityFromText, extractCityWithCountry, CITY_AUTOCOMPLETE, lookupCity, City } from '../data/worldCities';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';

interface ResolvedEvent extends CrisisEvent {
  cityKey: string;
  cityName: string;
  cityCountry: string;
  cityLat: number;
  cityLng: number;
  cityExact: boolean; // true if extracted from text, false if country fallback
}

interface CityGroup {
  key: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  exact: boolean;
  events: ResolvedEvent[];
  topSeverity: CrisisEvent['severity'];
}

const SEVERITY_RANK: Record<CrisisEvent['severity'], number> = {
  low: 1, medium: 2, high: 3, critical: 4,
};

function colorForGroup(g: CityGroup): string {
  const n = g.events.length;
  if (n >= 10) return '#ff4757';
  if (n >= 4) return '#ffa502';
  if (n === 1 && g.topSeverity === 'low') return '#14b8a6';
  return '#2ed573';
}

function buildGroupIcon(g: CityGroup): L.DivIcon {
  const color = colorForGroup(g);
  const n = g.events.length;
  const size = n >= 10 ? 44 : n >= 4 ? 38 : 32;
  const ring = g.exact ? `border:2px solid rgba(255,255,255,0.85);background:${color};`
                       : `border:2px dashed ${color};background:rgba(255,255,255,0.04);color:${color};`;
  const textColor = g.exact ? 'white' : color;
  return L.divIcon({
    className: 'custom-marker-container',
    html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;overflow:visible;">
      <div style="
        width:${size}px;height:${size}px;border-radius:50%;
        ${ring}
        box-shadow:0 0 ${n>=10?'18px':'10px'} ${color}80, 0 2px 6px rgba(0,0,0,0.4);
        display:flex;align-items:center;justify-content:center;
        color:${textColor};font-weight:700;font-size:13px;font-family:'IBM Plex Mono',monospace;
      ">${n}</div>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function tooltipHtml(g: CityGroup): string {
  const top = [...g.events].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])[0];
  return `<div style="font-family:'IBM Plex Sans',system-ui;max-width:240px;">
    <div style="display:flex;align-items:center;gap:4px;color:#00d4ff;font-size:11px;font-weight:600;font-family:'IBM Plex Mono',monospace;">
      ${g.name}${g.country ? ` · ${g.country}` : ''}
    </div>
    <div style="font-size:10px;color:rgba(255,255,255,0.55);margin:2px 0 4px;font-family:'IBM Plex Mono',monospace;">
      ${g.events.length} report${g.events.length>1?'s':''}${g.exact ? '' : ' (country fallback)'}
    </div>
    <div style="font-size:11px;color:rgba(255,255,255,0.85);line-height:1.35;">
      ${(top.title || '').slice(0, 110)}${(top.title||'').length>110?'…':''}
    </div>
  </div>`;
}

export default function CrisisMap() {
  const { events } = useCrisisEvents();
  const { assets } = useCrisisAssets();
  const [selectedEvent, setSelectedEvent] = useState<CrisisEvent | null>(null);
  const [drawerCity, setDrawerCity] = useState<CityGroup | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [countrySearch, setCountrySearch] = useState('');
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersClusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const [zoomHint, setZoomHint] = useState(false);
  const zoomHintTimer = useRef<number | null>(null);

  const selectedCountry = searchParams.get('country') || 'all';

  const setSelectedCountry = useCallback((country: string) => {
    if (country === 'all') searchParams.delete('country');
    else searchParams.set('country', country);
    setSearchParams(searchParams, { replace: true });
    setCountryDropdownOpen(false);
    setCountrySearch('');
  }, [searchParams, setSearchParams]);

  // Resolve every event to a city (exact via NER, or fallback to its existing coords)
  const resolvedEvents = useMemo<ResolvedEvent[]>(() => {
    return events
      .filter(e => e.latitude || e.longitude)
      .map(e => {
        const text = `${e.title || ''}. ${e.summary || ''}`;
        // Prefer country from event location ("United Kingdom, Europe" -> "United Kingdom")
        const countryHint = e.location?.split(',')[0]?.trim();
        const city = extractCityWithCountry(text, countryHint) || extractCityFromText(text);
        if (city) {
          return {
            ...e,
            latitude: city.lat,
            longitude: city.lng,
            cityKey: `${city.name}|${city.country}`,
            cityName: city.name,
            cityCountry: city.country,
            cityLat: city.lat,
            cityLng: city.lng,
            cityExact: true,
          };
        }
        // Fallback: keep existing centroid
        if (!e.latitude && !e.longitude) return null as any;
        const fallbackName = (e.location?.split(',').pop()?.trim() || e.location || 'Unknown');
        return {
          ...e,
          cityKey: `~${fallbackName}|${e.latitude.toFixed(2)},${e.longitude.toFixed(2)}`,
          cityName: fallbackName,
          cityCountry: '',
          cityLat: e.latitude,
          cityLng: e.longitude,
          cityExact: false,
        };
      })
      .filter(Boolean) as ResolvedEvent[];
  }, [events]);

  // Country list with counts (use cityCountry when present, else parsed from location)
  const countryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    resolvedEvents.forEach(e => {
      const loc = e.location?.split(',').pop()?.trim() || e.location || 'Unknown';
      counts[loc] = (counts[loc] || 0) + 1;
    });
    return Object.entries(counts).sort(([a],[b]) => a.localeCompare(b)).map(([name, count]) => ({ name, count }));
  }, [resolvedEvents]);

  // Filter by country selection
  const visibleEvents = useMemo(() => {
    if (selectedCountry === 'all') return resolvedEvents;
    return resolvedEvents.filter(e => {
      const loc = e.location?.split(',').pop()?.trim() || e.location || 'Unknown';
      return loc === selectedCountry;
    });
  }, [resolvedEvents, selectedCountry]);

  // Group by city
  const cityGroups = useMemo<CityGroup[]>(() => {
    const map = new Map<string, CityGroup>();
    for (const e of visibleEvents) {
      let g = map.get(e.cityKey);
      if (!g) {
        g = {
          key: e.cityKey,
          name: e.cityName,
          country: e.cityCountry,
          lat: e.cityLat,
          lng: e.cityLng,
          exact: e.cityExact,
          events: [],
          topSeverity: e.severity,
        };
        map.set(e.cityKey, g);
      }
      g.events.push(e);
      if (SEVERITY_RANK[e.severity] > SEVERITY_RANK[g.topSeverity]) g.topSeverity = e.severity;
    }
    return Array.from(map.values()).sort((a, b) => b.events.length - a.events.length);
  }, [visibleEvents]);

  const filteredCountries = useMemo(() => {
    if (!countrySearch) return countryCounts;
    return countryCounts.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase()));
  }, [countryCounts, countrySearch]);

  // City autocomplete suggestions
  const citySuggestions = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (q.length < 2) return [] as City[];
    return CITY_AUTOCOMPLETE.filter(c => c.name.toLowerCase().startsWith(q)).slice(0, 8);
  }, [globalSearch]);

  // Init map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      worldCopyJump: true,
      minZoom: 2,
      maxBounds: [[-85, -180], [85, 180]],
      maxBoundsViscosity: 1.0,
      scrollWheelZoom: false,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      wheelDebounceTime: 20,
      wheelPxPerZoomLevel: 100,
    }).setView([20, 20], 3);
    const container = mapContainerRef.current;
    const handleMapWheel = (e: WheelEvent) => {
      if (mapRef.current && mapRef.current !== map) return;
      if (!map.getPane('mapPane')) return;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        map.stop();
        const rect = container.getBoundingClientRect();
        const point = L.point(e.clientX - rect.left, e.clientY - rect.top);
        const maxZoom = Number.isFinite(map.getMaxZoom()) ? map.getMaxZoom() : 19;
        const delta = -e.deltaY * (e.deltaMode === 1 ? 0.12 : 0.0035);
        const targetZoom = Math.max(map.getMinZoom(), Math.min(maxZoom, map.getZoom() + delta));
        map.setZoomAround(point, targetZoom, { animate: false });
      } else {
        setZoomHint(true);
        if (zoomHintTimer.current) window.clearTimeout(zoomHintTimer.current);
        zoomHintTimer.current = window.setTimeout(() => setZoomHint(false), 1200);
      }
    };
    container.addEventListener('wheel', handleMapWheel, { passive: false });
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 19, subdomains: 'abcd',
    }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 19, pane: 'shadowPane',
    }).addTo(map);
    mapRef.current = map;

    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(mapContainerRef.current);
    requestAnimationFrame(() => map.invalidateSize());
    setTimeout(() => map.invalidateSize(), 250);

    markersClusterRef.current = L.markerClusterGroup({
      maxClusterRadius: (zoom: number) => zoom < 4 ? 80 : zoom < 7 ? 30 : 0,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        let color = '#2ed573';
        if (count >= 10) color = '#ff4757';
        else if (count >= 4) color = '#ffa502';
        return L.divIcon({
          html: `<div style="background:${color};width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:13px;font-family:'IBM Plex Mono',monospace;border:3px solid ${color}44;box-shadow:0 0 12px ${color}88;">${count}</div>`,
          className: 'custom-cluster-icon',
          iconSize: L.point(42, 42),
        });
      },
    } as any);
    map.addLayer(markersClusterRef.current);

    return () => { container.removeEventListener('wheel', handleMapWheel); ro.disconnect(); map.remove(); mapRef.current = null; };
  }, []);

  // Render city-group markers
  useEffect(() => {
    if (!mapRef.current || !markersClusterRef.current) return;
    markersClusterRef.current.clearLayers();

    cityGroups.forEach(g => {
      const marker = L.marker([g.lat, g.lng], { icon: buildGroupIcon(g) });
      marker.bindTooltip(tooltipHtml(g), {
        direction: 'top', offset: [0, -8], className: 'crisis-city-tooltip', opacity: 1,
      });
      marker.on('click', () => setDrawerCity(g));
      markersClusterRef.current!.addLayer(marker);
    });

    assets.forEach(asset => {
      if (!asset.latitude || !asset.longitude) return;
      const icon = L.divIcon({
        className: 'custom-marker-container',
        html: `<div style="width:12px;height:12px;background:#00d4ff;border:2px solid #00d4ff44;transform:rotate(45deg);box-shadow:0 0 6px #00d4ff88"></div>`,
        iconSize: [12, 12], iconAnchor: [6, 6],
      });
      L.marker([asset.latitude, asset.longitude], { icon })
        .bindPopup(`<div style="padding:8px"><strong style="color:#00d4ff;font-size:12px">${asset.name}</strong><br/><span style="color:#aaa;font-size:11px">${asset.type} • ${asset.radius_km}km radius</span></div>`)
        .addTo(markersClusterRef.current!);
    });
  }, [cityGroups, assets]);

  // Fly to country / world
  useEffect(() => {
    if (!mapRef.current) return;
    const isValid = (e: { latitude: any; longitude: any }) =>
      typeof e.latitude === 'number' && typeof e.longitude === 'number' &&
      !isNaN(e.latitude) && !isNaN(e.longitude);
    if (selectedCountry === 'all') {
      const valid = resolvedEvents.filter(isValid);
      if (valid.length > 0) {
        const bounds = L.latLngBounds(valid.map(e => [e.latitude, e.longitude] as [number, number]));
        if (bounds.isValid()) {
          mapRef.current.flyToBounds(bounds, { padding: [40, 40], maxZoom: 4, duration: 1 });
        } else {
          mapRef.current.flyTo([20, 20], 3, { duration: 1 });
        }
      } else {
        mapRef.current.flyTo([20, 20], 3, { duration: 1 });
      }
      return;
    }
    const staticBounds = COUNTRY_BOUNDS[selectedCountry];
    if (staticBounds) {
      mapRef.current.flyToBounds(staticBounds, { padding: [50, 50], maxZoom: 8, duration: 1.2 });
      return;
    }
    const validVisible = visibleEvents.filter(isValid);
    if (validVisible.length === 1) {
      mapRef.current.flyTo([validVisible[0].latitude, validVisible[0].longitude], 6, { duration: 1.2 });
    } else if (validVisible.length > 1) {
      const bounds = L.latLngBounds(validVisible.map(e => [e.latitude, e.longitude] as [number, number]));
      if (bounds.isValid()) {
        mapRef.current.flyToBounds(bounds, { padding: [50, 50], maxZoom: 8, duration: 1.2 });
      }
    }
  }, [selectedCountry, visibleEvents, resolvedEvents]);

  useEffect(() => {
    if (!mapRef.current || !selectedEvent) return;
    if (selectedEvent.latitude && selectedEvent.longitude) {
      mapRef.current.flyTo([selectedEvent.latitude, selectedEvent.longitude], 8, { duration: 1 });
    }
  }, [selectedEvent]);

  const handleCitySearchSelect = (c: City) => {
    setGlobalSearch('');
    setSearchOpen(false);
    if (mapRef.current) mapRef.current.flyTo([c.lat, c.lng], 9, { duration: 1.2 });
    // Try to surface a drawer if we already have a group at this city
    const key = `${c.name}|${c.country}`;
    const existing = cityGroups.find(g => g.key === key);
    if (existing) setDrawerCity(existing);
  };

  return (
    <CrisisLayout>
      <div className="flex h-full overflow-hidden">
        {/* Left event list */}
        <div className="w-[360px] border-r flex-shrink-0 flex flex-col" style={{ background: '#111318', borderColor: 'rgba(255,255,255,0.07)' }}>
          {/* City + country search */}
          <div className="px-3 py-2 border-b space-y-2" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <Popover open={searchOpen && citySuggestions.length > 0} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <div className="relative" onClick={() => setSearchOpen(true)}>
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30" />
                  <Input
                    value={globalSearch}
                    onChange={e => { setGlobalSearch(e.target.value); setSearchOpen(true); }}
                    placeholder="Search cities…"
                    className="h-8 text-xs pl-7 bg-white/5 border-white/10 text-white placeholder:text-white/30 font-mono"
                  />
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-[336px] p-1 border-white/10" style={{ background: '#181c22' }} align="start">
                {citySuggestions.map(c => (
                  <button
                    key={`${c.name}-${c.country}-${c.lat}`}
                    onClick={() => handleCitySearchSelect(c)}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded text-xs font-mono text-white/70 hover:bg-white/10"
                  >
                    <span className="truncate flex items-center gap-1.5"><MapPin className="w-3 h-3 text-[#00d4ff]" />{c.name}</span>
                    <span className="text-white/30">{c.country}</span>
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            <Popover open={countryDropdownOpen} onOpenChange={setCountryDropdownOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="w-full justify-between h-8 text-xs font-mono bg-white/5 hover:bg-white/10 text-white/80 border border-white/[0.07]">
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
                    <Input value={countrySearch} onChange={e => setCountrySearch(e.target.value)} placeholder="Search countries..." className="h-7 text-xs pl-7 bg-white/5 border-white/10 text-white placeholder:text-white/30" />
                  </div>
                </div>
                <ScrollArea className="max-h-60">
                  <div className="p-1">
                    <button onClick={() => setSelectedCountry('all')} className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs font-mono ${selectedCountry === 'all' ? 'bg-[#00d4ff]/10 text-[#00d4ff]' : 'text-white/70 hover:bg-white/5'}`}>
                      <span>All Countries</span><span className="text-white/30">{resolvedEvents.length}</span>
                    </button>
                    {filteredCountries.map(c => (
                      <button key={c.name} onClick={() => setSelectedCountry(c.name)} className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs font-mono ${selectedCountry === c.name ? 'bg-[#00d4ff]/10 text-[#00d4ff]' : 'text-white/70 hover:bg-white/5'}`}>
                        <span className="truncate">{c.name}</span><span className="text-white/30 flex-shrink-0 ml-2">{c.count}</span>
                      </button>
                    ))}
                    {filteredCountries.length === 0 && <div className="px-2 py-4 text-center text-xs text-white/30 font-mono">No countries found</div>}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          </div>

          <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <span className="text-xs font-mono text-white/40 uppercase">
              Events ({visibleEvents.length}) · {cityGroups.length} cities
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
              {visibleEvents.length === 0 && <div className="px-2 py-8 text-center text-xs text-white/30 font-mono">No events for this country</div>}
            </div>
          </ScrollArea>
        </div>

        {/* Map */}
        <div className="flex-1 relative crisiswatch-map">
          <div ref={mapContainerRef} className="absolute inset-0" />
          <div
            className={`pointer-events-none absolute inset-0 z-[500] flex items-center justify-center transition-opacity duration-200 ${zoomHint ? 'opacity-100' : 'opacity-0'}`}
          >
            <div className="px-4 py-2 rounded-md bg-black/70 text-white text-xs font-mono border border-white/10 backdrop-blur-sm">
              Use <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/20 mx-1">Ctrl</kbd> + scroll to zoom the map
            </div>
          </div>
        </div>

        {/* Detail */}
        {selectedEvent && (
          <div className="w-80 border-l flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />
          </div>
        )}

        {/* City drawer: rendered above Leaflet panes without dimming the global feed */}
        {drawerCity && (
          <aside className="fixed right-0 top-10 bottom-0 z-[1200] w-[420px] max-w-[calc(100vw-56px)] border-l border-border bg-card text-card-foreground shadow-2xl animate-in slide-in-from-right duration-200 flex flex-col">
            <div className="px-4 py-3 border-b border-border flex items-start justify-between gap-3 flex-shrink-0">
              <div>
                <div className="text-sm font-mono flex items-center gap-2 font-semibold">
                  <MapPin className="w-4 h-4 text-intel-cyan" />
                  {drawerCity.name}{drawerCity.country ? ` · ${drawerCity.country}` : ''}
                </div>
                <div className="text-[11px] font-mono text-muted-foreground mt-1">
                  {drawerCity.events.length} report{drawerCity.events.length>1?'s':''}
                  {!drawerCity.exact && ' · country fallback'}
                </div>
              </div>
              <button onClick={() => setDrawerCity(null)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" aria-label="Close city reports">
                <X className="w-4 h-4" />
              </button>
            </div>
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-3 space-y-2">
                {drawerCity.events.map(ev => {
                  const sev = ev.severity;
                  const sevColor = sev === 'critical' ? '#ff4757' : sev === 'high' ? '#ffa502' : sev === 'medium' ? '#ffd166' : '#2ed573';
                  return (
                    <button
                      key={ev.id}
                      onClick={() => { setSelectedEvent(ev); setDrawerCity(null); }}
                      className="w-full text-left rounded border border-border bg-secondary/20 hover:bg-secondary/40 p-3 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded" style={{ background: `${sevColor}22`, color: sevColor, border: `1px solid ${sevColor}33` }}>
                          {sev}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">{new Date(ev.created_at).toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}</span>
                      </div>
                      <div className="text-[13px] font-medium leading-snug mb-1">{ev.title}</div>
                      <div className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed mb-2">{ev.summary}</div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                        <span className="flex items-center gap-1"><ExternalLink className="w-3 h-3" />{ev.source_type}</span>
                        <span>conf {ev.confidence}%</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </aside>
        )}
      </div>
    </CrisisLayout>
  );
}
