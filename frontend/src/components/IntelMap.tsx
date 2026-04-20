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
  const hasInitialFitRef = useRef(false); // Only fit bounds ONCE on first load

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

    // Dark map tiles — matches the screenshot style
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_matter/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
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
        else if (highCount > 0) clusterColor = '#ef4444';
        else if (childCount > 5) clusterColor = '#f97316';

        const size = childCount > 99 ? 48 : childCount > 9 ? 44 : 40;
        const fontSize = childCount > 99 ? 13 : childCount > 9 ? 14 : 15;

        return L.divIcon({
          html: `<div style="
            background: ${clusterColor};
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 800;
            font-size: ${fontSize}px;
            border: 2.5px solid rgba(255,255,255,0.9);
            box-shadow: 0 2px 8px rgba(0,0,0,0.4), 0 0 0 3px ${clusterColor}40;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          ">${childCount}</div>`,
          className: 'custom-cluster-icon',
          iconSize: L.point(size, size),
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

      const threatColor = item.threatLevel === 'critical' ? '#ef4444' : 
                         item.threatLevel === 'high' ? '#f97316' : 
                         item.threatLevel === 'elevated' ? '#eab308' : '#22c55e';
      const threatLabel = item.threatLevel.charAt(0).toUpperCase() + item.threatLevel.slice(1);

      const popupContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; width: 300px;">
          
          <!-- Threat Level Header -->
          <div style="background: ${threatColor}; padding: 10px 16px; display: flex; align-items: center; justify-content: space-between;">
            <span style="color: white; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
              ⚠ ${threatLabel} Threat
            </span>
            <span style="color: rgba(255,255,255,0.9); font-size: 10px;">
              ${new Date(item.publishedAt).toLocaleDateString()}
            </span>
          </div>
          
          <!-- Content -->
          <div style="padding: 16px;">
            <!-- Token Badge -->
            ${item.token ? `<span style="display: inline-block; background: hsl(217, 33%, 17%); color: hsl(210, 40%, 80%); padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; margin-bottom: 8px; border: 1px solid hsl(217, 33%, 25%);">${item.token}</span>` : ''}
            
            <!-- Title -->
            <h3 style="font-size: 14px; font-weight: 600; margin: 0 0 8px 0; line-height: 1.4; color: hsl(173, 80%, 50%);">
              ${item.title}
            </h3>
            
            <!-- Summary -->
            <p style="font-size: 12px; color: hsl(210, 20%, 75%); margin: 0 0 12px 0; line-height: 1.5;">
              ${item.summary.length > 150 ? item.summary.slice(0, 150) + '...' : item.summary}
            </p>
            
            <!-- Location & Category -->
            <div style="display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap;">
              <span style="
                display: inline-flex; align-items: center; gap: 4px;
                padding: 4px 8px; border-radius: 4px;
                font-size: 10px; font-weight: 500;
                background: hsl(217, 33%, 17%); color: hsl(210, 40%, 80%);
                border: 1px solid hsl(217, 33%, 25%);
              ">📍 ${item.country} • ${item.region}</span>
              <span style="
                display: inline-flex; align-items: center;
                padding: 4px 8px; border-radius: 4px;
                font-size: 10px; font-weight: 600; text-transform: capitalize;
                background: ${categoryColor}20; color: ${categoryColor};
              ">${item.category}</span>
            </div>
            
            <!-- Footer -->
            <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px solid hsl(217, 33%, 20%);">
              <span style="font-size: 10px; color: hsl(210, 20%, 55%);">
                ${item.source}
              </span>
              <a href="${getBestSourceUrl(item.url, item.title, item.source, item.tags)}" target="_blank" rel="noopener" style="
                display: inline-flex; align-items: center; gap: 4px;
                font-size: 11px; font-weight: 600;
                color: hsl(173, 80%, 50%); text-decoration: none;
              ">View Source →</a>
            </div>
          </div>
        </div>
      `;

      if (showPopups) {
        marker.bindPopup(popupContent, { 
          maxWidth: 320,
          className: 'intel-popup'
        });
      }
      marker.on('click', () => onSelectItem(item));
      markersClusterRef.current!.addLayer(marker);
    });

    // Auto-fit bounds ONLY on the very first load (not on every update)
    if (!hasInitialFitRef.current && validItems.length > 0 && mapRef.current) {
      const bounds = L.latLngBounds(validItems.map(item => [item.lat, item.lon]));
      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 5 });
        hasInitialFitRef.current = true; // Never auto-fit again
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
      <div ref={mapContainerRef} className="h-full w-full" style={{ background: '#1a1a2e' }} />
    </div>
  );
}
