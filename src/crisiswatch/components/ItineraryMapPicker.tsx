import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Plane, Trash2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export type PickedDestination = {
  id: string; // local id
  label: string; // "06:20:Aviation Handling Serv..."
  city: string | null;
  country: string;
  lat: number;
  lon: number;
};

type Props = {
  destinations: PickedDestination[];
  onChange: (next: PickedDestination[]) => void;
};

// Simple plane SVG icon (mimics Google My Maps style)
const planeIcon = L.divIcon({
  className: 'itin-plane-marker',
  html: `<div style="width:32px;height:32px;border-radius:50%;background:#b3261e;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.5);border:2px solid #fff;">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

export function ItineraryMapPicker({ destinations, onChange }: Props) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const lineRef = useRef<L.Polyline | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [searching, setSearching] = useState(false);

  // Init map once
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, {
      center: [25, 45],
      zoom: 4,
      zoomControl: true,
      attributionControl: false,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;

    map.on('click', async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      const place = await reverseGeocode(lat, lng);
      const dest: PickedDestination = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        label: place.label,
        city: place.city,
        country: place.country,
        lat,
        lon: lng,
      };
      onChange([...currentRef.current, dest]);
    });

    // Force resize after dialog opens
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Keep latest destinations available inside map click handler
  const currentRef = useRef<PickedDestination[]>(destinations);
  useEffect(() => {
    currentRef.current = destinations;
  }, [destinations]);

  // Sync markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const existing = markersRef.current;
    const seen = new Set<string>();
    destinations.forEach((d) => {
      seen.add(d.id);
      if (existing[d.id]) {
        existing[d.id].setLatLng([d.lat, d.lon]);
      } else {
        const m = L.marker([d.lat, d.lon], { icon: planeIcon }).addTo(map);
        m.bindPopup(`<div style="font-family:monospace;font-size:11px;color:#111;"><b>${escapeHtml(d.label)}</b><br/>${escapeHtml([d.city, d.country].filter(Boolean).join(', '))}</div>`);
        existing[d.id] = m;
      }
    });
    Object.keys(existing).forEach((id) => {
      if (!seen.has(id)) {
        map.removeLayer(existing[id]);
        delete existing[id];
      }
    });

    if (lineRef.current) {
      map.removeLayer(lineRef.current);
      lineRef.current = null;
    }
    if (destinations.length >= 2) {
      lineRef.current = L.polyline(
        destinations.map((d) => [d.lat, d.lon]),
        { color: '#00d4ff', weight: 2, opacity: 0.7, dashArray: '4 6' }
      ).addTo(map);
    }

    if (destinations.length > 0) {
      const bounds = L.latLngBounds(destinations.map((d) => [d.lat, d.lon] as [number, number]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 6 });
    }
  }, [destinations]);

  const removeDest = (id: string) => onChange(destinations.filter((d) => d.id !== id));

  const runSearch = async () => {
    if (!searchQ.trim() || !mapRef.current) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(searchQ)}`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      if (data?.[0]) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        mapRef.current.setView([lat, lon], 8);
      }
    } catch (e) {
      console.error('Search failed', e);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="rounded-md overflow-hidden border" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
      {/* Search bar */}
      <div className="flex items-center gap-2 p-2 bg-[#0a0c0f] border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <Search className="w-3.5 h-3.5 text-white/40 ml-1" />
        <Input
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), runSearch())}
          placeholder="Search a place to fly to (e.g. Amman, Jordan)…"
          className="h-8 text-xs bg-transparent border-white/10 text-white"
        />
        <Button size="sm" onClick={runSearch} disabled={searching} className="h-8 bg-[#00d4ff] text-black hover:bg-[#00d4ff]/80 font-mono text-[11px]">
          {searching ? '…' : 'Find'}
        </Button>
      </div>

      {/* Map */}
      <div ref={mapEl} style={{ height: 320, width: '100%', background: '#0f1115' }} />

      {/* Destinations list (Google My Maps style) */}
      <div className="bg-[#0a0c0f] border-t max-h-40 overflow-y-auto" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        {destinations.length === 0 ? (
          <div className="p-3 text-[11px] text-white/40 font-mono text-center">
            Click anywhere on the map to drop a destination pin
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            {destinations.map((d, i) => (
              <li key={d.id} className="flex items-center gap-2 px-3 py-2 hover:bg-white/5">
                <div className="w-6 h-6 rounded-full bg-[#b3261e] flex items-center justify-center flex-shrink-0">
                  <Plane className="w-3 h-3 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white truncate">
                    <span className="text-white/40 font-mono mr-1">{String(i + 1).padStart(2, '0')}</span>
                    {d.label}
                  </div>
                  <div className="text-[10px] text-white/40 font-mono truncate">
                    {[d.city, d.country].filter(Boolean).join(' · ')} — {d.lat.toFixed(3)}, {d.lon.toFixed(3)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeDest(d.id)}
                  className="text-white/30 hover:text-red-400 p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

async function reverseGeocode(lat: number, lon: number): Promise<{ label: string; city: string | null; country: string }> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    const a = data?.address || {};
    const city = a.city || a.town || a.village || a.municipality || a.county || null;
    const country = a.country || 'Unknown';
    const label = city ? `${city}, ${country}` : country;
    return { label, city, country };
  } catch {
    return { label: `${lat.toFixed(3)}, ${lon.toFixed(3)}`, city: null, country: 'Unknown' };
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}