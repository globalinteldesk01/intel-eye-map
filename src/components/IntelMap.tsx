import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import 'leaflet.heat';
import { NewsItem, ThreatLevel } from '@/types/news';
import { formatDistanceToNow } from 'date-fns';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { getBestSourceUrl } from '@/utils/urlUtils';

// Fix for default marker icons
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

// Threat level colors
const threatColors: Record<ThreatLevel, string> = {
  low: '#22c55e',      // Green
  elevated: '#eab308', // Yellow
  high: '#f97316',     // Orange
  critical: '#ef4444', // Red
};

// Category colors and icons
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

// Get severity weight for heatmap
const getSeverityWeight = (threatLevel: ThreatLevel): number => {
  switch (threatLevel) {
    case 'critical': return 1.0;
    case 'high': return 0.75;
    case 'elevated': return 0.5;
    case 'low': return 0.25;
    default: return 0.25;
  }
};

// Get recency weight (more recent = higher weight)
const getRecencyWeight = (publishedAt: string): number => {
  const hours = (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60);
  if (hours < 1) return 1.0;
  if (hours < 6) return 0.8;
  if (hours < 24) return 0.6;
  if (hours < 48) return 0.4;
  return 0.2;
};

// Create custom icon based on category
const createCategoryIcon = (category: string, threatLevel: ThreatLevel) => {
  const config = categoryConfig[category] || categoryConfig.security;
  const size = threatLevel === 'critical' ? 32 : threatLevel === 'high' ? 28 : 24;
  const isCritical = threatLevel === 'critical';
  
  return L.divIcon({
    className: 'custom-marker-container',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: ${config.color};
        border-radius: 50%;
        border: 2px solid rgba(255,255,255,0.9);
        box-shadow: 0 0 ${isCritical ? '20px' : '10px'} ${config.color}80, 0 2px 6px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        ${isCritical ? 'animation: critical-pulse 1.5s infinite;' : ''}
      ">
        ${config.icon}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
};



export function IntelMap({ newsItems, onSelectItem, selectedItem, showPopups = true }: IntelMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersClusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const heatLayerRef = useRef<any>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current, {
      center: [20, 0],
      zoom: 2,
      minZoom: 2,
      maxZoom: 18,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    // Dark map tiles to match OSINT theme (dark_matter has more visible landmasses)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
      className: 'intel-map-tiles',
    }).addTo(mapRef.current);

    // Initialize marker cluster group
    markersClusterRef.current = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (cluster) => {
        const childCount = cluster.getChildCount();
        const markers = cluster.getAllChildMarkers();
        
        // Calculate dominant threat level
        let criticalCount = 0;
        let highCount = 0;
        markers.forEach((m: any) => {
          const item = m.options.newsItem as NewsItem;
          if (item?.threatLevel === 'critical') criticalCount++;
          else if (item?.threatLevel === 'high') highCount++;
        });

        let clusterColor = '#22c55e';
        if (criticalCount > 0) clusterColor = '#ef4444';
        else if (highCount > 0) clusterColor = '#f97316';
        else if (childCount > 5) clusterColor = '#eab308';

        return L.divIcon({
          html: `<div style="
            background: ${clusterColor};
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 14px;
            border: 3px solid white;
            box-shadow: 0 0 15px ${clusterColor}80;
          ">${childCount}</div>`,
          className: 'custom-cluster-icon',
          iconSize: L.point(40, 40),
        });
      },
    });

    mapRef.current.addLayer(markersClusterRef.current);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update markers when newsItems change
  useEffect(() => {
    if (!mapRef.current || !markersClusterRef.current) return;

    // Clear existing markers
    markersClusterRef.current.clearLayers();

    // Filter out items with invalid coordinates (0,0 or null island)
    const validItems = newsItems.filter((item) => {
      // Check for valid coordinates (not null island at 0,0)
      const isValidLat = item.lat !== 0 && item.lat >= -90 && item.lat <= 90;
      const isValidLon = item.lon !== 0 && item.lon >= -180 && item.lon <= 180;
      // Allow items that have both valid lat and lon, or at least one non-zero
      return (isValidLat || isValidLon) && !(item.lat === 0 && item.lon === 0);
    });

    console.log(`[IntelMap] Plotting ${validItems.length} of ${newsItems.length} items (${newsItems.length - validItems.length} filtered due to invalid coordinates)`);

    // Add new markers
    validItems.forEach((item) => {
      const marker = L.marker([item.lat, item.lon], {
        icon: createCategoryIcon(item.category, item.threatLevel),
        newsItem: item,
      } as any);

      const categoryColor = categoryConfig[item.category]?.color || '#14b8a6';
      const categoryIcon = categoryConfig[item.category]?.icon || categoryConfig.security.icon;
      const categoryLabel = item.category.charAt(0).toUpperCase() + item.category.slice(1);

      const threatColor = item.threatLevel === 'critical' ? '#ef4444' : 
                         item.threatLevel === 'high' ? '#f97316' : 
                         item.threatLevel === 'elevated' ? '#eab308' : '#22c55e';
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

      const popupContent = `
        <div style="font-family:'IBM Plex Sans',system-ui,sans-serif;width:320px;border-radius:8px;overflow:hidden;background:#0d1017;border:1px solid rgba(255,255,255,0.08);">
          <!-- Severity header -->
          <div style="background:${threatColor};padding:8px 12px;display:flex;align-items:center;justify-content:space-between;">
            <span style="display:flex;align-items:center;gap:6px;color:white;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;font-family:'IBM Plex Mono',monospace;">
              <span style="display:flex;">${sevIcon}</span>
              ${threatLabel} Threat
            </span>
            <span style="color:rgba(255,255,255,0.9);font-size:10px;font-family:'IBM Plex Mono',monospace;">
              ${timeAgo}
            </span>
          </div>

          <!-- Content -->
          <div style="padding:12px;">
            <!-- Token + Category badges -->
            <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;align-items:center;">
              ${item.token ? `<span style="display:inline-flex;align-items:center;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:600;font-family:'IBM Plex Mono',monospace;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.75);border:1px solid rgba(255,255,255,0.1);">${item.token}</span>` : ''}
              <span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:600;font-family:'IBM Plex Mono',monospace;background:${categoryColor}22;color:${categoryColor};border:1px solid ${categoryColor}33;">
                <span style="display:flex;">${categoryIcon}</span>
                ${categoryLabel}
              </span>
            </div>

            <!-- Title -->
            <h3 style="font-size:13px;font-weight:600;margin:0 0 6px 0;line-height:1.4;color:#2dd4bf;">
              ${item.title}
            </h3>

            <!-- Summary -->
            <p style="font-size:11px;color:rgba(255,255,255,0.6);margin:0 0 10px 0;line-height:1.5;">
              ${(item.summary || '').replace(/<[^>]*>/g,'').replace(/&apos;/g,"'").replace(/&quot;/g,'"').slice(0, 160)}${(item.summary || '').length > 160 ? '…' : ''}
            </p>

            <!-- Location -->
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;padding:5px 8px;border-radius:4px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);">
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              <span style="font-size:10px;color:rgba(255,255,255,0.75);font-family:'IBM Plex Mono',monospace;">${item.country}</span>
              <span style="margin-left:auto;font-size:9px;color:rgba(255,255,255,0.45);font-family:'IBM Plex Mono',monospace;">${item.region}</span>
            </div>

            <!-- Confidence bar -->
            <div style="margin-bottom:10px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
                <span style="font-size:9px;color:rgba(255,255,255,0.4);font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:0.5px;">Confidence</span>
                <span style="font-size:10px;color:${confColor};font-weight:600;font-family:'IBM Plex Mono',monospace;">${confidencePct}%</span>
              </div>
              <div style="height:4px;border-radius:2px;background:rgba(255,255,255,0.08);overflow:hidden;">
                <div style="height:100%;width:${confidencePct}%;border-radius:2px;background:${confColor};"></div>
              </div>
            </div>

            <!-- Source meta -->
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
        </div>
      `;

      if (showPopups) {
        marker.bindPopup(popupContent, { 
          maxWidth: 320,
          className: 'intel-popup crisis-intel-popup'
        });
      }
      marker.on('click', () => onSelectItem(item));
      markersClusterRef.current!.addLayer(marker);
    });

    // Auto-fit bounds if we have valid items
    if (validItems.length > 0 && mapRef.current) {
      const bounds = L.latLngBounds(validItems.map(item => [item.lat, item.lon]));
      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 6 });
      }
    }
  }, [newsItems, onSelectItem]);

  // Toggle heatmap
  useEffect(() => {
    if (!mapRef.current) return;

    // Filter out invalid coordinates for heatmap too
    const validItems = newsItems.filter((item) => {
      const isValidLat = item.lat !== 0 && item.lat >= -90 && item.lat <= 90;
      const isValidLon = item.lon !== 0 && item.lon >= -180 && item.lon <= 180;
      return (isValidLat || isValidLon) && !(item.lat === 0 && item.lon === 0);
    });

    if (showHeatmap) {
      // Hide markers
      if (markersClusterRef.current) {
        mapRef.current.removeLayer(markersClusterRef.current);
      }

      // Create heatmap data
      const heatData = validItems.map((item) => {
        const severityWeight = getSeverityWeight(item.threatLevel);
        const recencyWeight = getRecencyWeight(item.publishedAt);
        const intensity = (severityWeight + recencyWeight) / 2;
        return [item.lat, item.lon, intensity] as [number, number, number];
      });

      // Add heatmap layer
      heatLayerRef.current = (L as any).heatLayer(heatData, {
        radius: 30,
        blur: 20,
        maxZoom: 10,
        max: 1.0,
        gradient: {
          0.2: '#22c55e',
          0.4: '#eab308',
          0.6: '#f97316',
          0.8: '#ef4444',
          1.0: '#dc2626',
        },
      }).addTo(mapRef.current);
    } else {
      // Remove heatmap
      if (heatLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }

      // Show markers
      if (markersClusterRef.current && mapRef.current) {
        mapRef.current.addLayer(markersClusterRef.current);
      }
    }
  }, [showHeatmap, newsItems]);

  // Fly to selected item
  useEffect(() => {
    if (!mapRef.current || !selectedItem) return;
    mapRef.current.flyTo([selectedItem.lat, selectedItem.lon], 6, { duration: 1.5 });
  }, [selectedItem]);

  // Export functions
  const handleExportImage = useCallback(async () => {
    if (!mapContainerRef.current) return;
    
    try {
      const canvas = await html2canvas(mapContainerRef.current, {
        useCORS: true,
        allowTaint: true,
      });
      
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
      const canvas = await html2canvas(mapContainerRef.current, {
        useCORS: true,
        allowTaint: true,
      });
      
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
      <div ref={mapContainerRef} className="h-full w-full" style={{ background: 'hsl(222, 47%, 6%)' }} />
    </div>
  );
}
