import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import maplibregl, { Map as MLMap, Marker as MLMarker, Popup as MLPopup, LngLatBounds } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import Supercluster from 'supercluster';
import { NewsItem, ThreatLevel } from '@/types/news';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { getBestSourceUrl } from '@/utils/urlUtils';

interface IntelMapProps {
  newsItems: NewsItem[];
  onSelectItem: (item: NewsItem) => void;
  selectedItem: NewsItem | null;
  showPopups?: boolean;
}

const threatColors: Record<ThreatLevel, string> = {
  low: '#22c55e',
  elevated: '#eab308',
  high: '#f97316',
  critical: '#ef4444',
};

const categoryConfig: Record<string, { color: string; icon: string }> = {
  security: {
    color: '#14b8a6',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>'
  },
  diplomacy: {
    color: '#3b82f6',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>'
  },
  economy: {
    color: '#22c55e',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>'
  },
  conflict: {
    color: '#ef4444',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>'
  },
  humanitarian: {
    color: '#f59e0b',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>'
  },
  technology: {
    color: '#8b5cf6',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="8" x="5" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/><path d="M6 18h2"/><path d="M12 18h6"/></svg>'
  },
};

const getSeverityWeight = (threatLevel: ThreatLevel): number => {
  switch (threatLevel) {
    case 'critical': return 1.0;
    case 'high': return 0.75;
    case 'elevated': return 0.5;
    case 'low': return 0.25;
    default: return 0.25;
  }
};

const getRecencyWeight = (publishedAt: string): number => {
  const hours = (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60);
  if (hours < 1) return 1.0;
  if (hours < 6) return 0.8;
  if (hours < 24) return 0.6;
  if (hours < 48) return 0.4;
  return 0.2;
};

function createCategoryMarkerEl(item: NewsItem): HTMLElement {
  const config = categoryConfig[item.category] || categoryConfig.security;
  const size = item.threatLevel === 'critical' ? 32 : item.threatLevel === 'high' ? 28 : 24;
  const isCritical = item.threatLevel === 'critical';
  const el = document.createElement('div');
  el.className = 'custom-marker-container';
  el.style.cursor = 'pointer';
  el.innerHTML = `
    <div style="
      width:${size}px;height:${size}px;background:${config.color};
      border-radius:50%;border:2px solid rgba(255,255,255,0.9);
      box-shadow:0 0 ${isCritical ? '20px' : '10px'} ${config.color}80, 0 2px 6px rgba(0,0,0,0.3);
      display:flex;align-items:center;justify-content:center;color:white;
      ${isCritical ? 'animation: critical-pulse 1.5s infinite;' : ''}
    ">${config.icon}</div>`;
  return el;
}

function createClusterMarkerEl(count: number, dominantColor: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'custom-cluster-icon';
  el.style.cursor = 'pointer';
  el.innerHTML = `<div style="
    background:${dominantColor};width:40px;height:40px;border-radius:50%;
    display:flex;align-items:center;justify-content:center;color:white;
    font-weight:bold;font-size:14px;border:3px solid white;
    box-shadow:0 0 15px ${dominantColor}80;
  ">${count}</div>`;
  return el;
}

function buildPopupHtml(item: NewsItem): string {
  const categoryColor = categoryConfig[item.category]?.color || '#14b8a6';
  const categoryIcon = categoryConfig[item.category]?.icon || categoryConfig.security.icon;
  const categoryLabel = item.category.charAt(0).toUpperCase() + item.category.slice(1);
  const threatColor = threatColors[item.threatLevel] || threatColors.low;
  const threatLabel = item.threatLevel.charAt(0).toUpperCase() + item.threatLevel.slice(1);
  const rawConf = (item as any).confidenceScore ?? 0;
  const confidencePct = Math.round(rawConf > 1 ? rawConf : rawConf * 100);
  const confColor = confidencePct >= 80 ? '#22c55e' : confidencePct >= 50 ? '#eab308' : '#ef4444';
  const publishedDate = new Date(item.publishedAt);
  const seconds = Math.floor((Date.now() - publishedDate.getTime()) / 1000);
  const timeAgo = seconds < 60 ? 'Just now'
    : seconds < 3600 ? `${Math.floor(seconds / 60)}m ago`
    : seconds < 86400 ? `${Math.floor(seconds / 3600)}h ago`
    : `${Math.floor(seconds / 86400)}d ago`;
  const credibility = ((item as any).sourceCredibility || 'medium').toString();
  const credColor = credibility === 'high' ? '#22c55e' : credibility === 'low' ? '#ef4444' : '#eab308';
  const sevIcon = item.threatLevel === 'critical' || item.threatLevel === 'high'
    ? '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>'
    : '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>';

  return `
    <div style="font-family:'IBM Plex Sans',system-ui,sans-serif;width:320px;border-radius:8px;overflow:hidden;background:#0d1017;border:1px solid rgba(255,255,255,0.08);">
      <div style="background:${threatColor};padding:8px 12px;display:flex;align-items:center;justify-content:space-between;">
        <span style="display:flex;align-items:center;gap:6px;color:white;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;font-family:'IBM Plex Mono',monospace;">
          <span style="display:flex;">${sevIcon}</span>
          ${threatLabel} Threat
        </span>
        <span style="color:rgba(255,255,255,0.9);font-size:10px;font-family:'IBM Plex Mono',monospace;">${timeAgo}</span>
      </div>
      <div style="padding:12px;">
        <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;align-items:center;">
          ${item.token ? `<span style="display:inline-flex;align-items:center;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:600;font-family:'IBM Plex Mono',monospace;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.75);border:1px solid rgba(255,255,255,0.1);">${item.token}</span>` : ''}
          <span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:600;font-family:'IBM Plex Mono',monospace;background:${categoryColor}22;color:${categoryColor};border:1px solid ${categoryColor}33;">
            <span style="display:flex;">${categoryIcon}</span>${categoryLabel}
          </span>
        </div>
        <h3 style="font-size:13px;font-weight:600;margin:0 0 6px 0;line-height:1.4;color:#2dd4bf;">${item.title}</h3>
        <p style="font-size:11px;color:rgba(255,255,255,0.6);margin:0 0 10px 0;line-height:1.5;">
          ${(item.summary || '').replace(/<[^>]*>/g,'').replace(/&apos;/g,"'").replace(/&quot;/g,'"').slice(0, 160)}${(item.summary || '').length > 160 ? '…' : ''}
        </p>
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;padding:5px 8px;border-radius:4px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);">
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          <span style="font-size:10px;color:rgba(255,255,255,0.75);font-family:'IBM Plex Mono',monospace;">${item.country}</span>
          <span style="margin-left:auto;font-size:9px;color:rgba(255,255,255,0.45);font-family:'IBM Plex Mono',monospace;">${item.region}</span>
        </div>
        <div style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
            <span style="font-size:9px;color:rgba(255,255,255,0.4);font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:0.5px;">Confidence</span>
            <span style="font-size:10px;color:${confColor};font-weight:600;font-family:'IBM Plex Mono',monospace;">${confidencePct}%</span>
          </div>
          <div style="height:4px;border-radius:2px;background:rgba(255,255,255,0.08);overflow:hidden;">
            <div style="height:100%;width:${confidencePct}%;border-radius:2px;background:${confColor};"></div>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);">
          <span style="display:flex;align-items:center;gap:5px;font-size:10px;color:rgba(255,255,255,0.5);font-family:'IBM Plex Mono',monospace;">
            <span style="width:6px;height:6px;border-radius:50%;background:${credColor};display:inline-block;box-shadow:0 0 6px ${credColor};"></span>
            ${item.source}
          </span>
          <a href="${getBestSourceUrl(item.url, item.title, item.source, item.tags)}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:600;color:#2dd4bf;text-decoration:none;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:0.5px;">
            Source
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>
          </a>
        </div>
      </div>
    </div>`;
}

// CartoDB Dark Matter raster style — dark basemap with subtle white country borders
const DARK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'carto-dark': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors © CARTO',
      maxzoom: 19,
    },
  },
  layers: [
    { id: 'carto-dark-layer', type: 'raster', source: 'carto-dark', minzoom: 0, maxzoom: 22 },
  ],
};

export function IntelMap({ newsItems, onSelectItem, selectedItem, showPopups = true }: IntelMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markersRef = useRef<MLMarker[]>([]);
  const popupRef = useRef<MLPopup | null>(null);
  const clusterIndexRef = useRef<Supercluster<{ item: NewsItem }> | null>(null);
  const itemsRef = useRef<NewsItem[]>([]);
  const onSelectItemRef = useRef(onSelectItem);
  const showPopupsRef = useRef(showPopups);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const hasFitBoundsRef = useRef(false);
  const lastItemsKeyRef = useRef<string>('');

  useEffect(() => { onSelectItemRef.current = onSelectItem; }, [onSelectItem]);
  useEffect(() => { showPopupsRef.current = showPopups; }, [showPopups]);

  // Filter valid items
  const validItems = useMemo(
    () => newsItems.filter((item) => {
      const isValidLat = item.lat !== 0 && item.lat >= -90 && item.lat <= 90;
      const isValidLon = item.lon !== 0 && item.lon >= -180 && item.lon <= 180;
      return (isValidLat || isValidLon) && !(item.lat === 0 && item.lon === 0);
    }),
    [newsItems]
  );

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: DARK_STYLE,
      center: [0, 20],
      zoom: 1.5,
      minZoom: 1,
      maxZoom: 18,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;

    map.on('load', () => {
      // Heatmap source + layer (initially hidden)
      map.addSource('intel-heat', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'intel-heat-layer',
        type: 'heatmap',
        source: 'intel-heat',
        layout: { visibility: 'none' },
        paint: {
          'heatmap-weight': ['get', 'intensity'],
          'heatmap-intensity': 1.2,
          'heatmap-radius': 30,
          'heatmap-opacity': 0.75,
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(0,0,0,0)',
            0.2, '#22c55e',
            0.4, '#eab308',
            0.6, '#f97316',
            0.8, '#ef4444',
            1.0, '#dc2626',
          ],
        },
      });
      setMapReady(true);
    });

    map.on('moveend', () => renderClusters());
    map.on('zoomend', () => renderClusters());

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render clusters/markers for current viewport using supercluster
  const renderClusters = useCallback(() => {
    const map = mapRef.current;
    const cluster = clusterIndexRef.current;
    if (!map || !cluster || showHeatmap) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const bounds = map.getBounds();
    const bbox: [number, number, number, number] = [
      bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth(),
    ];
    const zoom = Math.floor(map.getZoom());
    const features = cluster.getClusters(bbox, zoom);

    features.forEach((feature) => {
      const [lng, lat] = feature.geometry.coordinates as [number, number];
      const props = feature.properties as any;

      if (props.cluster) {
        // Cluster marker
        const childMarkers = cluster.getLeaves(props.cluster_id, Infinity, 0);
        let critical = 0, high = 0;
        childMarkers.forEach((c) => {
          const it = (c.properties as any).item as NewsItem;
          if (it?.threatLevel === 'critical') critical++;
          else if (it?.threatLevel === 'high') high++;
        });
        let color = '#22c55e';
        if (critical > 0) color = '#ef4444';
        else if (high > 0) color = '#f97316';
        else if (props.point_count > 5) color = '#eab308';

        const el = createClusterMarkerEl(props.point_count, color);
        el.addEventListener('click', () => {
          const expansionZoom = Math.min(cluster.getClusterExpansionZoom(props.cluster_id), 18);
          map.flyTo({ center: [lng, lat], zoom: expansionZoom, duration: 600 });
        });
        const marker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
        markersRef.current.push(marker);
      } else {
        // Individual point
        const item = props.item as NewsItem;
        const el = createCategoryMarkerEl(item);
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectItemRef.current(item);
          if (showPopupsRef.current) {
            popupRef.current?.remove();
            popupRef.current = new maplibregl.Popup({
              maxWidth: '340px',
              className: 'intel-popup crisis-intel-popup',
              offset: 18,
              closeButton: true,
            })
              .setLngLat([lng, lat])
              .setHTML(buildPopupHtml(item))
              .addTo(map);
          }
        });
        const marker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
        markersRef.current.push(marker);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHeatmap]);

  // Build cluster index when items change
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    itemsRef.current = validItems;

    const points = validItems.map((item) => ({
      type: 'Feature' as const,
      properties: { item },
      geometry: { type: 'Point' as const, coordinates: [item.lon, item.lat] as [number, number] },
    }));

    const index = new Supercluster<{ item: NewsItem }>({
      radius: 60,
      maxZoom: 16,
    });
    index.load(points);
    clusterIndexRef.current = index;

    // Update heatmap source
    const heatSource = mapRef.current.getSource('intel-heat') as maplibregl.GeoJSONSource | undefined;
    if (heatSource) {
      const heatFeatures = validItems.map((item) => {
        const intensity = (getSeverityWeight(item.threatLevel) + getRecencyWeight(item.publishedAt)) / 2;
        return {
          type: 'Feature' as const,
          properties: { intensity },
          geometry: { type: 'Point' as const, coordinates: [item.lon, item.lat] as [number, number] },
        };
      });
      heatSource.setData({ type: 'FeatureCollection', features: heatFeatures });
    }

    console.log(`[IntelMap] Plotting ${validItems.length} of ${newsItems.length} items`);

    renderClusters();

    // Auto-fit only on initial load or dataset change
    const itemsKey = validItems.map((i) => i.id).sort().join('|');
    const datasetChanged = itemsKey !== lastItemsKeyRef.current;
    lastItemsKeyRef.current = itemsKey;
    if (validItems.length > 0 && (!hasFitBoundsRef.current || datasetChanged)) {
      const bounds = new LngLatBounds();
      validItems.forEach((it) => bounds.extend([it.lon, it.lat]));
      if (!bounds.isEmpty()) {
        mapRef.current.fitBounds(bounds, { padding: 50, maxZoom: 6, duration: 800 });
        hasFitBoundsRef.current = true;
      }
    }
  }, [validItems, mapReady, renderClusters, newsItems.length]);

  // Toggle heatmap visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (map.getLayer('intel-heat-layer')) {
      map.setLayoutProperty('intel-heat-layer', 'visibility', showHeatmap ? 'visible' : 'none');
    }
    if (showHeatmap) {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      popupRef.current?.remove();
      popupRef.current = null;
    } else {
      renderClusters();
    }
  }, [showHeatmap, mapReady, renderClusters]);

  // Fly to selected item
  useEffect(() => {
    if (!mapRef.current || !selectedItem) return;
    const currentZoom = mapRef.current.getZoom();
    const targetZoom = Math.max(currentZoom, 6);
    mapRef.current.flyTo({
      center: [selectedItem.lon, selectedItem.lat],
      zoom: targetZoom,
      duration: 1200,
    });
  }, [selectedItem]);

  // Export functions
  const handleExportImage = useCallback(async () => {
    if (!mapContainerRef.current) return;
    try {
      const canvas = await html2canvas(mapContainerRef.current, { useCORS: true, allowTaint: true });
      const link = document.createElement('a');
      link.download = `intel-map-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Export failed:', error);
    }
  }, []);

  const handleExportPDF = useCallback(async () => {
    if (!mapContainerRef.current) return;
    try {
      const canvas = await html2canvas(mapContainerRef.current, { useCORS: true, allowTaint: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const imgWidth = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`intel-map-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      console.error('PDF export failed:', error);
    }
  }, []);

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainerRef} className="h-full w-full" style={{ background: '#f5f5f5' }} />
    </div>
  );
}
