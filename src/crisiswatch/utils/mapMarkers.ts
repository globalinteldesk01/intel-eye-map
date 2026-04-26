import { CrisisCategory, CrisisSeverity, SEVERITY_COLORS, CATEGORY_COLORS } from '../types';

// SVG icon paths for each category
const CATEGORY_ICONS: Record<CrisisCategory, string> = {
  Social: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>`,
  News: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>`,
  GovAlert: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>`,
  Weather: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/><path d="M22 10a3 3 0 0 0-3-3h-2.207a5.502 5.502 0 0 0-10.702.5"/></svg>`,
  Traffic: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2"/><circle cx="12" cy="6" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="18" r="2"/></svg>`,
};

const CATEGORY_LABELS: Record<CrisisCategory, string> = {
  Social: 'Social Media',
  News: 'News Feed',
  GovAlert: 'Gov Alert',
  Weather: 'Weather Alert',
  Traffic: 'Traffic / IoT',
};

// Severity icons
const SEVERITY_ICONS: Record<CrisisSeverity, string> = {
  critical: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`,
  high: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>`,
  medium: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`,
  low: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>`,
};

const STATUS_ICONS: Record<string, string> = {
  new: `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="16"/><line x1="8" x2="16" y1="12" y2="12"/></svg>`,
  verified: `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>`,
  active: `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
  resolved: `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
};

import L from 'leaflet';
import type { CrisisEvent } from '../types';

export function createCrisisMarkerIcon(event: CrisisEvent): L.DivIcon {
  const sevColor = SEVERITY_COLORS[event.severity];
  const catColor = CATEGORY_COLORS[event.category];
  const catIcon = CATEGORY_ICONS[event.category] || CATEGORY_ICONS.News;
  const size = event.severity === 'critical' ? 32 : event.severity === 'high' ? 28 : 24;
  const pulse = event.severity === 'critical' ? 'animation:critical-pulse 1.5s infinite;' : '';

  return L.divIcon({
    className: 'custom-marker-container',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${catColor};
      border:2px solid rgba(255,255,255,0.85);
      box-shadow:0 0 ${event.severity === 'critical' ? '18px' : '10px'} ${catColor}80, 0 2px 6px rgba(0,0,0,0.3);
      display:flex;align-items:center;justify-content:center;
      color:white;${pulse}
    ">${catIcon}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

export function createCrisisPopupContent(event: CrisisEvent): string {
  const sevColor = SEVERITY_COLORS[event.severity];
  const catColor = CATEGORY_COLORS[event.category];
  const catIcon = CATEGORY_ICONS[event.category] || CATEGORY_ICONS.News;
  const catLabel = CATEGORY_LABELS[event.category] || event.category;
  const sevIcon = SEVERITY_ICONS[event.severity];
  const statusIcon = STATUS_ICONS[event.status] || STATUS_ICONS.new;
  const sevLabel = event.severity.charAt(0).toUpperCase() + event.severity.slice(1);
  const date = new Date(event.created_at);
  const timeAgo = getTimeAgo(date);
  const confidencePct = event.confidence;

  const impactsHtml = event.impacts?.length
    ? event.impacts.slice(0, 3).map(i =>
      `<div style="display:flex;align-items:flex-start;gap:4px;font-size:10px;color:#ccc;line-height:1.3;">
        <span style="color:${sevColor};flex-shrink:0;margin-top:1px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="${sevColor}" stroke="none"><circle cx="12" cy="12" r="5"/></svg>
        </span>
        ${i}
      </div>`
    ).join('')
    : '';

  return `
    <div style="font-family:'IBM Plex Sans',system-ui,sans-serif;width:300px;border-radius:8px;overflow:hidden;background:#0d1017;border:1px solid rgba(255,255,255,0.08);">
      <!-- Severity header -->
      <div style="background:${sevColor};padding:8px 12px;display:flex;align-items:center;justify-content:space-between;">
        <span style="display:flex;align-items:center;gap:5px;color:white;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;font-family:'IBM Plex Mono',monospace;">
          <span style="display:flex;">${sevIcon}</span>
          ${sevLabel} Threat
        </span>
        <span style="color:rgba(255,255,255,0.85);font-size:10px;font-family:'IBM Plex Mono',monospace;">
          ${timeAgo}
        </span>
      </div>

      <!-- Content -->
      <div style="padding:12px;">
        <!-- Category + Status badges -->
        <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;">
          <span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:600;font-family:'IBM Plex Mono',monospace;background:${catColor}22;color:${catColor};border:1px solid ${catColor}33;">
            <span style="display:flex;">${catIcon}</span>
            ${catLabel}
          </span>
          <span style="display:inline-flex;align-items:center;gap:3px;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:500;font-family:'IBM Plex Mono',monospace;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.6);border:1px solid rgba(255,255,255,0.08);text-transform:capitalize;">
            <span style="display:flex;color:${event.status === 'resolved' ? '#2ed573' : event.status === 'active' ? '#00d4ff' : '#ffa502'};">${statusIcon}</span>
            ${event.status}
          </span>
        </div>

        <!-- Title -->
        <h3 style="font-size:13px;font-weight:600;margin:0 0 6px 0;line-height:1.4;color:#00d4ff;">
          ${event.title}
        </h3>

        <!-- Summary -->
        <p style="font-size:11px;color:rgba(255,255,255,0.6);margin:0 0 10px 0;line-height:1.5;">
          ${event.summary.length > 140 ? event.summary.slice(0, 140) + '…' : event.summary}
        </p>

        <!-- Location -->
        <div style="display:flex;align-items:center;gap:4px;margin-bottom:8px;padding:4px 8px;border-radius:4px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);">
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          <span style="font-size:10px;color:rgba(255,255,255,0.7);font-family:'IBM Plex Mono',monospace;">${event.location || 'Unknown'}</span>
          ${event.affected_area ? `<span style="margin-left:auto;font-size:9px;color:rgba(255,255,255,0.4);font-family:'IBM Plex Mono',monospace;">Area: ${event.affected_area}</span>` : ''}
        </div>

        <!-- Confidence bar -->
        <div style="margin-bottom:${impactsHtml ? '8' : '0'}px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
            <span style="font-size:9px;color:rgba(255,255,255,0.4);font-family:'IBM Plex Mono',monospace;text-transform:uppercase;">Confidence</span>
            <span style="font-size:10px;color:${confidencePct >= 80 ? '#2ed573' : confidencePct >= 50 ? '#ffa502' : '#ff4757'};font-weight:600;font-family:'IBM Plex Mono',monospace;">${confidencePct}%</span>
          </div>
          <div style="height:4px;border-radius:2px;background:rgba(255,255,255,0.08);overflow:hidden;">
            <div style="height:100%;width:${confidencePct}%;border-radius:2px;background:${confidencePct >= 80 ? '#2ed573' : confidencePct >= 50 ? '#ffa502' : '#ff4757'};transition:width 0.3s;"></div>
          </div>
        </div>

        <!-- Impacts -->
        ${impactsHtml ? `
        <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);">
          <span style="font-size:9px;color:rgba(255,255,255,0.35);font-family:'IBM Plex Mono',monospace;text-transform:uppercase;display:block;margin-bottom:4px;">Key Impacts</span>
          <div style="display:flex;flex-direction:column;gap:3px;">
            ${impactsHtml}
          </div>
        </div>` : ''}

        <!-- Footer -->
        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;margin-top:8px;border-top:1px solid rgba(255,255,255,0.06);">
          <span style="display:flex;align-items:center;gap:3px;font-size:10px;color:rgba(255,255,255,0.35);font-family:'IBM Plex Mono',monospace;">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            ${event.sources_count} source${event.sources_count !== 1 ? 's' : ''}
          </span>
          <span style="font-size:10px;color:rgba(255,255,255,0.35);font-family:'IBM Plex Mono',monospace;">
            ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  `;
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
