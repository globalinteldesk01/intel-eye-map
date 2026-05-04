import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import { CrisisLayout } from '../components/CrisisLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Search, Save, FolderOpen, Trash2, Download, Plus, MapPin, Map as MapIcon, X, Layers } from 'lucide-react';

// ============================================================
// Manual Travel Itinerary Mapping Module — Leaflet + OSM
// ============================================================

type RiskLevel = 'high' | 'medium' | 'safe';
type Category = 'hotel' | 'airport' | 'office' | 'meeting' | 'checkpoint' | 'other';

interface FeatureProps {
  name: string;
  description?: string;
  risk: RiskLevel;
  category?: Category;
  kind: 'marker' | 'polyline' | 'polygon';
}

interface SavedMap {
  id: string;
  name: string;
  city: string | null;
  updated_at: string;
}

const RISK_COLOR: Record<RiskLevel, string> = {
  high: '#dc2626',
  medium: '#eab308',
  safe: '#16a34a',
};

// Custom div icon based on risk level
const makeIcon = (risk: RiskLevel, category: Category = 'other') => {
  const color = RISK_COLOR[risk];
  const letter = category[0].toUpperCase();
  return L.divIcon({
    className: 'itin-builder-marker',
    html: `<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.5);">
      <span style="transform:rotate(45deg);color:#fff;font-weight:700;font-size:12px;font-family:monospace;">${letter}</span>
    </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 28],
    popupAnchor: [0, -26],
  });
};

const popupHtml = (p: FeatureProps) => `
  <div style="font-family:system-ui;min-width:200px;color:#0f172a;">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
      <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${RISK_COLOR[p.risk]};"></span>
      <strong style="font-size:13px;">${escapeHtml(p.name || 'Untitled')}</strong>
    </div>
    ${p.category ? `<div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:4px;">${p.category}</div>` : ''}
    ${p.description ? `<div style="font-size:12px;color:#334155;line-height:1.4;">${escapeHtml(p.description)}</div>` : ''}
    <div style="margin-top:6px;font-size:10px;color:${RISK_COLOR[p.risk]};font-weight:600;text-transform:uppercase;">${p.risk} risk</div>
  </div>`;

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export default function ItineraryMapBuilder() {
  const { user } = useAuth();
  const { toast } = useToast();
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const drawnRef = useRef<L.FeatureGroup | null>(null);

  const [savedMaps, setSavedMaps] = useState<SavedMap[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [name, setName] = useState('Untitled Itinerary');
  const [city, setCity] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [pendingLayer, setPendingLayer] = useState<{ layer: L.Layer; kind: FeatureProps['kind'] } | null>(null);
  const [propsDialog, setPropsDialog] = useState<FeatureProps>({ name: '', description: '', risk: 'medium', category: 'other', kind: 'marker' });
  const [showLayers, setShowLayers] = useState({ markers: true, routes: true, zones: true });

  // ───── Init map ─────
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, { center: [20, 0], zoom: 2, zoomControl: true, attributionControl: false });
    mapRef.current = map;
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);
    L.control.attribution({ position: 'bottomright', prefix: '© OSM' }).addTo(map);

    const drawn = new L.FeatureGroup();
    map.addLayer(drawn);
    drawnRef.current = drawn;

    const drawControl = new (L.Control as any).Draw({
      position: 'topleft',
      edit: { featureGroup: drawn },
      draw: {
        marker: { icon: makeIcon('medium') },
        polyline: { shapeOptions: { color: '#00d4ff', weight: 3 } },
        polygon: { allowIntersection: false, shapeOptions: { color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.2 } },
        rectangle: false as any,
        circle: false as any,
        circlemarker: false as any,
      },
    });
    map.addControl(drawControl);

    map.on((L as any).Draw.Event.CREATED, (e: any) => {
      const layerType: string = e.layerType;
      const kind: FeatureProps['kind'] = layerType === 'marker' ? 'marker' : layerType === 'polyline' ? 'polyline' : 'polygon';
      setPendingLayer({ layer: e.layer, kind });
      setPropsDialog({ name: '', description: '', risk: kind === 'polygon' ? 'high' : 'medium', category: 'other', kind });
    });

    setTimeout(() => map.invalidateSize(), 80);

    return () => {
      map.remove();
      mapRef.current = null;
      drawnRef.current = null;
    };
  }, []);

  // ───── Load saved maps list ─────
  const loadList = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('itinerary_maps')
      .select('id,name,city,updated_at')
      .order('updated_at', { ascending: false });
    setSavedMaps((data ?? []) as SavedMap[]);
  }, [user]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  // ───── Helpers ─────
  const applyStyleToLayer = (layer: L.Layer, p: FeatureProps) => {
    if (layer instanceof L.Marker) {
      layer.setIcon(makeIcon(p.risk, p.category));
    } else if (layer instanceof L.Polygon) {
      (layer as L.Polygon).setStyle({ color: RISK_COLOR[p.risk], fillColor: RISK_COLOR[p.risk], fillOpacity: 0.25, weight: 2 });
    } else if (layer instanceof L.Polyline) {
      (layer as L.Polyline).setStyle({ color: RISK_COLOR[p.risk], weight: 3, opacity: 0.9 });
    }
    (layer as any).feature = (layer as any).feature || { type: 'Feature', properties: {} };
    (layer as any).feature.properties = p;
    layer.bindPopup(popupHtml(p));
  };

  const confirmProps = () => {
    if (!pendingLayer || !drawnRef.current) return;
    applyStyleToLayer(pendingLayer.layer, propsDialog);
    drawnRef.current.addLayer(pendingLayer.layer);
    setPendingLayer(null);
  };

  const cancelProps = () => setPendingLayer(null);

  // ───── Search via Nominatim ─────
  const runSearch = async (asMarker = false) => {
    if (!searchQ.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(searchQ)}`, {
        headers: { 'Accept-Language': 'en' },
      });
      const data = await res.json();
      if (!data?.[0]) {
        toast({ title: 'Not found', description: searchQ, variant: 'destructive' });
        return;
      }
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      mapRef.current?.setView([lat, lon], 13);
      if (asMarker && drawnRef.current) {
        const m = L.marker([lat, lon], { icon: makeIcon('safe') });
        applyStyleToLayer(m, { name: data[0].display_name?.split(',')[0] ?? searchQ, description: data[0].display_name, risk: 'safe', category: 'other', kind: 'marker' });
        drawnRef.current.addLayer(m);
      }
    } catch (e) {
      toast({ title: 'Search failed', variant: 'destructive' });
    } finally {
      setSearching(false);
    }
  };

  // ───── GeoJSON ─────
  const toGeoJSON = () => (drawnRef.current ? drawnRef.current.toGeoJSON() : { type: 'FeatureCollection', features: [] });

  const exportGeoJSON = () => {
    const blob = new Blob([JSON.stringify(toGeoJSON(), null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/\s+/g, '_')}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearMap = () => {
    drawnRef.current?.clearLayers();
    setCurrentId(null);
    toast({ title: 'Map cleared' });
  };

  const loadFeatures = (geojson: any) => {
    if (!drawnRef.current || !mapRef.current) return;
    drawnRef.current.clearLayers();
    L.geoJSON(geojson, {
      pointToLayer: (feature, latlng) => {
        const p: FeatureProps = feature.properties || { name: '', risk: 'medium', kind: 'marker' };
        const m = L.marker(latlng, { icon: makeIcon(p.risk, p.category) });
        return m;
      },
      onEachFeature: (feature, layer) => {
        const p: FeatureProps = (feature.properties as any) || { name: '', risk: 'medium', kind: 'marker' };
        applyStyleToLayer(layer, p);
        drawnRef.current!.addLayer(layer);
      },
    });
    try {
      const b = drawnRef.current.getBounds();
      if (b.isValid()) mapRef.current.fitBounds(b, { padding: [40, 40], maxZoom: 14 });
    } catch {}
  };

  const saveMap = async () => {
    if (!user) return;
    const features = toGeoJSON();
    const center = mapRef.current?.getCenter();
    const zoom = mapRef.current?.getZoom() ?? 5;
    const payload = {
      user_id: user.id,
      name,
      city: city || null,
      center_lat: center?.lat ?? null,
      center_lon: center?.lng ?? null,
      zoom,
      features: features as any,
    };
    if (currentId) {
      const { error } = await supabase.from('itinerary_maps').update(payload).eq('id', currentId);
      if (error) return toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      toast({ title: 'Itinerary updated' });
    } else {
      const { data, error } = await supabase.from('itinerary_maps').insert(payload).select().single();
      if (error) return toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      setCurrentId(data.id);
      toast({ title: 'Itinerary saved' });
    }
    loadList();
  };

  const loadMap = async (id: string) => {
    const { data, error } = await supabase.from('itinerary_maps').select('*').eq('id', id).single();
    if (error || !data) return toast({ title: 'Load failed', variant: 'destructive' });
    setCurrentId(data.id);
    setName(data.name);
    setCity(data.city ?? '');
    if (data.center_lat != null && data.center_lon != null) {
      mapRef.current?.setView([data.center_lat, data.center_lon], data.zoom ?? 5);
    }
    loadFeatures(data.features);
  };

  const deleteMap = async (id: string) => {
    if (!confirm('Delete this itinerary?')) return;
    await supabase.from('itinerary_maps').delete().eq('id', id);
    if (currentId === id) {
      setCurrentId(null);
      drawnRef.current?.clearLayers();
    }
    loadList();
  };

  // ───── Layer toggles ─────
  useEffect(() => {
    if (!drawnRef.current) return;
    drawnRef.current.eachLayer((layer: any) => {
      const kind: FeatureProps['kind'] = layer.feature?.properties?.kind ?? (layer instanceof L.Marker ? 'marker' : layer instanceof L.Polygon ? 'polygon' : 'polyline');
      const visible = (kind === 'marker' && showLayers.markers) || (kind === 'polyline' && showLayers.routes) || (kind === 'polygon' && showLayers.zones);
      const el = layer.getElement?.() || (layer as any)._icon;
      if (el) el.style.display = visible ? '' : 'none';
    });
  }, [showLayers, currentId]);

  return (
    <CrisisLayout>
      <div className="flex bg-[#0a0c0f]" style={{ height: 'calc(100vh - 40px)' }}>
        {/* Sidebar */}
        <aside className="w-80 border-r flex flex-col" style={{ borderColor: 'rgba(255,255,255,0.07)', background: '#0f1115' }}>
          <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-2 mb-1">
              <MapIcon className="w-4 h-4 text-[#00d4ff]" />
              <h1 className="text-sm font-bold text-white uppercase tracking-wider">Itinerary Builder</h1>
            </div>
            <p className="text-[10px] text-white/40 font-mono uppercase tracking-widest">Manual travel risk mapping</p>
          </div>

          {/* Itinerary meta */}
          <div className="p-4 space-y-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <div>
              <Label className="text-[10px] text-white/50 uppercase tracking-wider">Itinerary Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 mt-1 bg-black/40 border-white/10 text-white text-xs" />
            </div>
            <div>
              <Label className="text-[10px] text-white/50 uppercase tracking-wider">City / Region</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Mumbai" className="h-8 mt-1 bg-black/40 border-white/10 text-white text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" onClick={saveMap} className="h-8 bg-[#00d4ff] text-black hover:bg-[#00d4ff]/80 text-[11px] font-mono">
                <Save className="w-3 h-3 mr-1" />Save
              </Button>
              <Button size="sm" variant="outline" onClick={exportGeoJSON} className="h-8 border-white/10 text-white hover:bg-white/5 text-[11px] font-mono">
                <Download className="w-3 h-3 mr-1" />GeoJSON
              </Button>
            </div>
            <Button size="sm" variant="ghost" onClick={clearMap} className="w-full h-7 text-red-400 hover:bg-red-500/10 text-[11px]">
              <Trash2 className="w-3 h-3 mr-1" />Clear Map
            </Button>
          </div>

          {/* Search */}
          <div className="p-4 space-y-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <Label className="text-[10px] text-white/50 uppercase tracking-wider flex items-center gap-1"><Search className="w-3 h-3" />Search Place</Label>
            <Input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), runSearch(false))}
              placeholder="City, hotel, address…"
              className="h-8 bg-black/40 border-white/10 text-white text-xs"
            />
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" onClick={() => runSearch(false)} disabled={searching} className="h-7 bg-white/10 text-white hover:bg-white/20 text-[10px] font-mono">Zoom</Button>
              <Button size="sm" onClick={() => runSearch(true)} disabled={searching} className="h-7 bg-[#16a34a] text-white hover:bg-[#16a34a]/80 text-[10px] font-mono">
                <Plus className="w-3 h-3 mr-1" />Pin
              </Button>
            </div>
          </div>

          {/* Layer toggles */}
          <div className="p-4 space-y-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <Label className="text-[10px] text-white/50 uppercase tracking-wider flex items-center gap-1"><Layers className="w-3 h-3" />Layers</Label>
            {(['markers', 'routes', 'zones'] as const).map((k) => (
              <label key={k} className="flex items-center gap-2 text-xs text-white/80 cursor-pointer">
                <input type="checkbox" checked={showLayers[k]} onChange={(e) => setShowLayers({ ...showLayers, [k]: e.target.checked })} className="accent-[#00d4ff]" />
                <span className="capitalize">{k}</span>
              </label>
            ))}
          </div>

          {/* Saved itineraries */}
          <div className="flex-1 overflow-y-auto p-4">
            <Label className="text-[10px] text-white/50 uppercase tracking-wider flex items-center gap-1 mb-2">
              <FolderOpen className="w-3 h-3" />Saved Itineraries ({savedMaps.length})
            </Label>
            {savedMaps.length === 0 ? (
              <div className="text-[11px] text-white/30 font-mono">No itineraries saved yet.</div>
            ) : (
              <ul className="space-y-1.5">
                {savedMaps.map((m) => (
                  <li key={m.id} className={`group rounded border p-2 cursor-pointer hover:bg-white/5 ${currentId === m.id ? 'border-[#00d4ff]/40 bg-[#00d4ff]/5' : 'border-white/5'}`} onClick={() => loadMap(m.id)}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-white truncate">{m.name}</div>
                        {m.city && <div className="text-[10px] text-white/40 font-mono flex items-center gap-1"><MapPin className="w-2.5 h-2.5" />{m.city}</div>}
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); deleteMap(m.id); }} className="opacity-0 group-hover:opacity-100 text-white/40 hover:text-red-400">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Map */}
        <div className="flex-1 relative">
          <div ref={mapEl} className="absolute inset-0" />
        </div>
      </div>

      {/* Properties dialog */}
      <Dialog open={!!pendingLayer} onOpenChange={(o) => { if (!o) cancelProps(); }}>
        <DialogContent className="bg-[#111318] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: RISK_COLOR[propsDialog.risk] }} />
              New {propsDialog.kind}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={propsDialog.name} onChange={(e) => setPropsDialog({ ...propsDialog, name: e.target.value })} placeholder="e.g. Hotel Taj, Airport Terminal 2" className="h-8 bg-black/40 border-white/10 text-white text-xs" />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea value={propsDialog.description ?? ''} onChange={(e) => setPropsDialog({ ...propsDialog, description: e.target.value })} className="bg-black/40 border-white/10 text-white text-xs min-h-[60px]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Risk Level</Label>
                <Select value={propsDialog.risk} onValueChange={(v: RiskLevel) => setPropsDialog({ ...propsDialog, risk: v })}>
                  <SelectTrigger className="h-8 bg-black/40 border-white/10 text-white text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High Risk</SelectItem>
                    <SelectItem value="medium">Medium Risk</SelectItem>
                    <SelectItem value="safe">Safe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {propsDialog.kind === 'marker' && (
                <div>
                  <Label className="text-xs">Category</Label>
                  <Select value={propsDialog.category} onValueChange={(v: Category) => setPropsDialog({ ...propsDialog, category: v })}>
                    <SelectTrigger className="h-8 bg-black/40 border-white/10 text-white text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hotel">Hotel</SelectItem>
                      <SelectItem value="airport">Airport</SelectItem>
                      <SelectItem value="office">Office</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="checkpoint">Checkpoint</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={cancelProps} className="text-white/60"><X className="w-3 h-3 mr-1" />Cancel</Button>
            <Button onClick={confirmProps} className="bg-[#00d4ff] text-black hover:bg-[#00d4ff]/80">Add to Map</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CrisisLayout>
  );
}
