import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import { NewsItem } from '@/types/news';
import { getBestSourceUrl } from '@/utils/urlUtils';
import { formatDistanceToNow } from 'date-fns';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface IntelMapProps {
  newsItems: NewsItem[];
  onSelectItem: (item: NewsItem) => void;
  selectedItem: NewsItem | null;
  showPopups?: boolean;
}

// Samdesk-style colors: green=low, yellow=elevated, orange=high, red=critical
const getThreatColor = (threatLevel: string): string => {
  switch (threatLevel) {
    case 'critical': return '#ef4444';
    case 'high': return '#f97316';
    case 'elevated': return '#eab308';
    default: return '#22c55e';
  }
};

// Category accent color for the inner ring
const getCategoryColor = (category: string): string => {
  switch (category) {
    case 'conflict': return '#ef4444';
    case 'security': return '#14b8a6';
    case 'diplomacy': return '#3b82f6';
    case 'economy': return '#22c55e';
    case 'humanitarian': return '#f59e0b';
    case 'technology': return '#8b5cf6';
    default: return '#14b8a6';
  }
};

// Create Samdesk-style individual marker (glowing circle)
const createSamdeskMarker = (item: NewsItem) => {
  const color = getThreatColor(item.threatLevel);
  const isCritical = item.threatLevel === 'critical';
  const isHigh = item.threatLevel === 'high';
  const size = isCritical ? 20 : isHigh ? 16 : 12;

  return L.divIcon({
    className: '',
    html: `
      <div style="
        position: relative;
        width: ${size + 12}px;
        height: ${size + 12}px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        ${isCritical ? `
          <div style="
            position: absolute;
            width: ${size + 12}px;
            height: ${size + 12}px;
            border-radius: 50%;
            background: ${color}20;
            animation: samdesk-pulse 1.5s ease-in-out infinite;
          "></div>
        ` : ''}
        <div style="
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          background: ${color};
          border: 2px solid rgba(255,255,255,0.8);
          box-shadow: 0 0 ${isCritical ? 16 : 8}px ${color}, 0 0 4px rgba(0,0,0,0.5);
          cursor: pointer;
        "></div>
      </div>
    `,
    iconSize: [size + 12, size + 12],
    iconAnchor: [(size + 12) / 2, (size + 12) / 2],
    popupAnchor: [0, -(size + 12) / 2],
  });
};

// Create Samdesk-style cluster icon
const createClusterIcon = (cluster: any): L.DivIcon => {
  const count = cluster.getChildCount();
  const markers = cluster.getAllChildMarkers();

  let criticalCount = 0, highCount = 0, elevatedCount = 0;
  markers.forEach((m: any) => {
    const item = m.options.newsItem as NewsItem;
    if (item?.threatLevel === 'critical') criticalCount++;
    else if (item?.threatLevel === 'high') highCount++;
    else if (item?.threatLevel === 'elevated') elevatedCount++;
  });

  let color = '#22c55e';
  if (criticalCount > 0) color = '#ef4444';
  else if (highCount > 0) color = '#f97316';
  else if (elevatedCount > 0 || count > 5) color = '#eab308';

  // Size scales with count
  const size = count >= 50 ? 60 : count >= 20 ? 52 : count >= 10 ? 44 : count >= 5 ? 38 : 32;
  const fontSize = size >= 52 ? 16 : size >= 44 ? 14 : 12;

  return L.divIcon({
    html: `
      <div style="
        position: relative;
        width: ${size}px;
        height: ${size}px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          position: absolute;
          width: ${size + 8}px;
          height: ${size + 8}px;
          border-radius: 50%;
          background: ${color}15;
          border: 1px solid ${color}40;
        "></div>
        <div style="
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          background: ${color};
          border: 2.5px solid rgba(255,255,255,0.9);
          box-shadow: 0 0 20px ${color}80, 0 0 8px ${color}40, inset 0 0 10px rgba(0,0,0,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-weight: 800;
          font-size: ${fontSize}px;
          font-family: 'JetBrains Mono', monospace;
          text-shadow: 0 1px 2px rgba(0,0,0,0.5);
          cursor: pointer;
          position: relative;
          z-index: 1;
        ">${count}</div>
      </div>
    `,
    className: 'samdesk-cluster',
    iconSize: L.point(size + 8, size + 8),
    iconAnchor: L.point((size + 8) / 2, (size + 8) / 2),
  });
};

export function IntelMap({ newsItems, onSelectItem, selectedItem, showPopups = true }: IntelMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
  const [coordDisplay, setCoordDisplay] = useState('');

  // Initialize map with dark Samdesk-style tiles
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current, {
      center: [20, 10],
      zoom: 3,
      minZoom: 2,
      maxZoom: 18,
      zoomControl: false,
      scrollWheelZoom: true,
      attributionControl: false,
    });

    // Dark map tiles (Samdesk-style)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© CartoDB',
      maxZoom: 19,
    }).addTo(mapRef.current);

    // Custom attribution
    L.control.attribution({ position: 'bottomright', prefix: '' }).addTo(mapRef.current);

    // Track mouse coordinates
    mapRef.current.on('mousemove', (e: L.LeafletMouseEvent) => {
      const lat = e.latlng.lat.toFixed(4);
      const lon = e.latlng.lng.toFixed(4);
      const latDeg = Math.abs(e.latlng.lat).toFixed(2);
      const lonDeg = Math.abs(e.latlng.lng).toFixed(2);
      const latDir = e.latlng.lat >= 0 ? 'N' : 'S';
      const lonDir = e.latlng.lng >= 0 ? 'E' : 'W';
      setCoordDisplay(`${latDeg}° ${latDir}  ${lonDeg}° ${lonDir}`);
    });

    // Cluster group
    clusterGroupRef.current = L.markerClusterGroup({
      maxClusterRadius: 60,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: createClusterIcon,
      chunkedLoading: true,
    });

    mapRef.current.addLayer(clusterGroupRef.current);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update markers when newsItems change
  useEffect(() => {
    if (!mapRef.current || !clusterGroupRef.current) return;
    clusterGroupRef.current.clearLayers();

    const validItems = newsItems.filter(item =>
      !(item.lat === 0 && item.lon === 0) &&
      item.lat >= -90 && item.lat <= 90 &&
      item.lon >= -180 && item.lon <= 180
    );

    validItems.forEach(item => {
      const marker = L.marker([item.lat, item.lon], {
        icon: createSamdeskMarker(item),
        ...(item as any),
        newsItem: item,
      } as any);

      const color = getThreatColor(item.threatLevel);
      const catColor = getCategoryColor(item.category);
      const timeAgo = (() => {
        try { return formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true }); }
        catch { return item.publishedAt?.slice(0, 10) || ''; }
      })();

      const locationStr = [(item as any).city, item.country].filter(Boolean).join(', ') || item.country;

      if (showPopups) {
        marker.bindPopup(`
          <div style="
            font-family: 'JetBrains Mono', monospace;
            width: 320px;
            background: #0d1117;
            border: 1px solid #21262d;
            border-radius: 6px;
            overflow: hidden;
          ">
            <div style="
              background: ${color}22;
              border-bottom: 2px solid ${color};
              padding: 10px 14px;
              display: flex;
              align-items: center;
              gap: 10px;
            ">
              <div style="
                width: 10px; height: 10px;
                border-radius: 50%;
                background: ${color};
                box-shadow: 0 0 8px ${color};
                flex-shrink: 0;
              "></div>
              <span style="color: ${color}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
                ${item.threatLevel} THREAT
              </span>
              <span style="color: #8b949e; font-size: 10px; margin-left: auto;">${timeAgo}</span>
            </div>
            <div style="padding: 14px;">
              ${item.token ? `<div style="margin-bottom: 8px;"><span style="background: #161b22; border: 1px solid #30363d; color: #7ee787; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;">${item.token}</span></div>` : ''}
              <h3 style="font-size: 13px; font-weight: 600; color: #e6edf3; margin: 0 0 10px 0; line-height: 1.5;">${item.title}</h3>
              <p style="font-size: 11px; color: #8b949e; margin: 0 0 12px 0; line-height: 1.6;">${item.summary.length > 160 ? item.summary.slice(0, 160) + '…' : item.summary}</p>
              <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px;">
                <span style="background: ${catColor}22; color: ${catColor}; border: 1px solid ${catColor}44; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase;">${item.category}</span>
                <span style="background: #161b22; color: #c9d1d9; border: 1px solid #30363d; padding: 3px 8px; border-radius: 4px; font-size: 10px;">📍 ${locationStr}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px solid #21262d;">
                <span style="font-size: 10px; color: #8b949e;">${item.source}</span>
                <a href="${getBestSourceUrl(item.url, item.title, item.source, item.tags)}" target="_blank" rel="noopener" style="color: #58a6ff; font-size: 11px; font-weight: 600; text-decoration: none;">View →</a>
              </div>
            </div>
          </div>
        `, {
          maxWidth: 340,
          className: 'samdesk-popup',
        });
      }

      marker.on('click', () => onSelectItem(item));
      clusterGroupRef.current!.addLayer(marker);
    });
  }, [newsItems, onSelectItem, showPopups]);

  // Fly to selected item
  useEffect(() => {
    if (!mapRef.current || !selectedItem) return;
    if (selectedItem.lat !== 0 || selectedItem.lon !== 0) {
      mapRef.current.flyTo([selectedItem.lat, selectedItem.lon], 8, { duration: 1.2 });
    }
  }, [selectedItem]);

  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();
  const handleReset = () => mapRef.current?.setView([20, 10], 3);

  // Count stats
  const criticalCount = newsItems.filter(i => i.threatLevel === 'critical').length;
  const highCount = newsItems.filter(i => i.threatLevel === 'high').length;

  return (
    <div className="relative h-full w-full" style={{ background: '#0d1117' }}>
      {/* Map container */}
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Top-right controls (Samdesk-style) */}
      <div className="absolute top-3 right-3 flex flex-col gap-1 z-[1000]">
        <button onClick={handleZoomIn}
          className="w-8 h-8 bg-black/80 border border-white/20 text-green-400 text-lg font-bold rounded flex items-center justify-center hover:bg-white/10 transition-colors">
          +
        </button>
        <button onClick={handleZoomOut}
          className="w-8 h-8 bg-black/80 border border-white/20 text-green-400 text-lg font-bold rounded flex items-center justify-center hover:bg-white/10 transition-colors">
          −
        </button>
        <button onClick={handleReset}
          className="w-8 h-8 bg-black/80 border border-white/20 text-green-400 text-xs font-bold rounded flex items-center justify-center hover:bg-white/10 transition-colors"
          title="Reset view">
          ⟳
        </button>
      </div>

      {/* Bottom-left coordinate display (Samdesk-style) */}
      {coordDisplay && (
        <div className="absolute bottom-3 left-3 z-[1000] bg-black/80 border border-white/20 rounded px-2 py-1">
          <span className="text-green-400 font-mono text-xs">{coordDisplay}</span>
        </div>
      )}

      {/* Threat legend - bottom right */}
      <div className="absolute bottom-3 right-3 z-[1000] bg-black/80 border border-white/20 rounded px-2 py-1.5 flex gap-3">
        {[{label: 'CRIT', color: '#ef4444'}, {label: 'HIGH', color: '#f97316'}, {label: 'ELEV', color: '#eab308'}, {label: 'LOW', color: '#22c55e'}].map(({label, color}) => (
          <div key={label} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{background: color, boxShadow: `0 0 6px ${color}`}} />
            <span className="text-white/60 font-mono text-[10px]">{label}</span>
          </div>
        ))}
      </div>

      {/* Counts overlay - top left */}
      <div className="absolute top-3 left-3 z-[1000] flex gap-2">
        {criticalCount > 0 && (
          <div className="bg-red-500/20 border border-red-500/50 rounded px-2 py-0.5">
            <span className="text-red-400 font-mono text-xs font-bold">{criticalCount} CRIT</span>
          </div>
        )}
        {highCount > 0 && (
          <div className="bg-orange-500/20 border border-orange-500/50 rounded px-2 py-0.5">
            <span className="text-orange-400 font-mono text-xs font-bold">{highCount} HIGH</span>
          </div>
        )}
        <div className="bg-black/60 border border-white/10 rounded px-2 py-0.5">
          <span className="text-white/50 font-mono text-xs">{newsItems.filter(i => i.lat !== 0 || i.lon !== 0).length} PLOTTED</span>
        </div>
      </div>
    </div>
  );
}
