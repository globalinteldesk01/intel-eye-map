import { IntelligenceEvent, SEVERITY_COLORS, CATEGORY_ICONS } from '@/types/timeline';
import jsPDF from 'jspdf';
import { format, parseISO } from 'date-fns';

// Fetch static map via edge function (avoids CORS issues)
async function fetchStaticMapImage(
  lat: number, 
  lon: number, 
  zoom: number = 8
): Promise<string | null> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    const response = await fetch(
      `${supabaseUrl}/functions/v1/fetch-static-map?lat=${lat}&lon=${lon}&zoom=${zoom}&width=600&height=300&maptype=standard`,
      {
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      console.error('Map fetch failed:', response.status);
      return null;
    }
    
    const data = await response.json();
    return data.image || null;
  } catch (error) {
    console.error('Error fetching map:', error);
    return null;
  }
}

export async function exportSingleIntelToPDF(event: IntelligenceEvent): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;

  // Helper for adding sections
  const addSectionTitle = (title: string) => {
    doc.setFontSize(11);
    doc.setTextColor(20, 184, 166); // Teal accent
    doc.text(title.toUpperCase(), margin, yPos);
    yPos += 6;
    doc.setDrawColor(20, 184, 166);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;
  };

  const addText = (text: string, fontSize: number = 10, color: number[] = [60, 60, 60]) => {
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, pageWidth - 2 * margin);
    lines.forEach((line: string) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(line, margin, yPos);
      yPos += 5;
    });
  };

  const addLabelValue = (label: string, value: string) => {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(label + ':', margin, yPos);
    doc.setTextColor(40, 40, 40);
    doc.text(value, margin + 40, yPos);
    yPos += 5;
  };

  // ===== HEADER =====
  doc.setFillColor(15, 23, 42); // Dark header background
  doc.rect(0, 0, pageWidth, 45, 'F');

  // Title
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('INTELLIGENCE REPORT', pageWidth / 2, 15, { align: 'center' });

  // Token/ID
  doc.setFontSize(8);
  doc.setTextColor(20, 184, 166);
  doc.text(event.token || `EVENT-${event.id.slice(0, 8).toUpperCase()}`, pageWidth / 2, 22, { align: 'center' });

  // Timestamp
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text(`Generated: ${format(new Date(), 'MMMM d, yyyy HH:mm')} UTC`, pageWidth / 2, 30, { align: 'center' });
  doc.text('CLASSIFICATION: UNCLASSIFIED // FOR OFFICIAL USE ONLY', pageWidth / 2, 38, { align: 'center' });

  yPos = 55;

  // ===== EVENT TITLE =====
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  const categoryIcon = CATEGORY_ICONS[event.category] || '📋';
  const titleLines = doc.splitTextToSize(`${categoryIcon} ${event.title}`, pageWidth - 2 * margin);
  titleLines.forEach((line: string) => {
    doc.text(line, margin, yPos);
    yPos += 7;
  });
  yPos += 5;

  // ===== CLASSIFICATION BADGES =====
  const severityColor = SEVERITY_COLORS[event.severity];
  // Draw severity badge
  doc.setFillColor(parseInt(severityColor.slice(1, 3), 16) || 200, parseInt(severityColor.slice(3, 5), 16) || 100, parseInt(severityColor.slice(5, 7), 16) || 100);
  doc.roundedRect(margin, yPos - 4, 25, 8, 2, 2, 'F');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(event.severity.toUpperCase(), margin + 2, yPos + 1);

  // Event state badge
  doc.setFillColor(100, 100, 100);
  doc.roundedRect(margin + 28, yPos - 4, 30, 8, 2, 2, 'F');
  doc.text(event.event_state.replace('_', ' ').toUpperCase(), margin + 30, yPos + 1);

  // Momentum badge
  doc.setFillColor(150, 150, 150);
  doc.roundedRect(margin + 61, yPos - 4, 28, 8, 2, 2, 'F');
  doc.text(event.momentum.toUpperCase(), margin + 63, yPos + 1);

  yPos += 15;

  // ===== KEY DETAILS =====
  addSectionTitle('Key Details');
  addLabelValue('Category', event.category.replace('_', ' ').toUpperCase());
  addLabelValue('Region', `${event.region} • ${event.country}`);
  addLabelValue('Coordinates', `${event.lat.toFixed(4)}°, ${event.lon.toFixed(4)}°`);
  addLabelValue('Timestamp', format(parseISO(event.timestamp), 'MMMM d, yyyy HH:mm') + ' UTC');
  addLabelValue('Confidence', `${event.confidence_level.toUpperCase()} (Trust Score: ${event.trust_score}%)`);
  addLabelValue('Source Count', `${event.source_count} sources (${event.source_reliability})`);
  if (event.primary_source) {
    addLabelValue('Primary Source', event.primary_source);
  }
  yPos += 5;

  // ===== DESCRIPTION =====
  addSectionTitle('Intelligence Assessment');
  addText(event.intelligence_assessment || event.full_description || event.short_description);
  yPos += 5;

  // ===== WHY THIS MATTERS =====
  addSectionTitle('Why This Matters');
  doc.setFillColor(240, 253, 250); // Light teal background
  doc.roundedRect(margin, yPos - 4, pageWidth - 2 * margin, 15, 2, 2, 'F');
  addText(event.why_this_matters, 10, [15, 118, 110]);
  yPos += 5;

  // ===== RECOMMENDED ACTIONS =====
  if (event.recommended_actions && event.recommended_actions.length > 0) {
    addSectionTitle('Recommended Actions');
    event.recommended_actions.forEach((action, i) => {
      if (yPos > 260) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      const actionLines = doc.splitTextToSize(`${i + 1}. ${action}`, pageWidth - 2 * margin - 10);
      actionLines.forEach((line: string) => {
        doc.text(line, margin + 5, yPos);
        yPos += 5;
      });
    });
    yPos += 5;
  }

  // ===== CASCADE IMPACTS =====
  if (event.cascade_impacts && event.cascade_impacts.length > 0) {
    addSectionTitle('Cascade Impact Analysis');
    event.cascade_impacts.forEach((impact) => {
      if (yPos > 255) {
        doc.addPage();
        yPos = 20;
      }
      const orderLabel = impact.order === 1 ? '1st Order' : impact.order === 2 ? '2nd Order' : '3rd Order';
      doc.setFontSize(9);
      doc.setTextColor(20, 184, 166);
      doc.text(`${orderLabel} • ${impact.category} (${Math.round(impact.probability * 100)}% probability)`, margin, yPos);
      yPos += 5;
      doc.setTextColor(80, 80, 80);
      const impactLines = doc.splitTextToSize(impact.description, pageWidth - 2 * margin - 10);
      impactLines.forEach((line: string) => {
        doc.text(line, margin + 5, yPos);
        yPos += 4;
      });
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(`Timeframe: ${impact.timeframe}`, margin + 5, yPos);
      yPos += 7;
    });
  }

  // ===== THREAT DNA =====
  if (event.threat_dna) {
    addSectionTitle('Threat DNA Profile');
    addLabelValue('Actor Type', event.threat_dna.actor_type);
    addLabelValue('Capability', event.threat_dna.capability);
    addLabelValue('Intent', event.threat_dna.intent);
    addLabelValue('Pattern Match', `${event.threat_dna.historical_pattern_similarity}%`);
    if (event.threat_dna.similar_events && event.threat_dna.similar_events.length > 0) {
      addLabelValue('Similar Events', event.threat_dna.similar_events.join(', '));
    }
    yPos += 5;
  }

  // ===== INTELLIGENCE GAPS =====
  if (event.gaps_and_uncertainties && event.gaps_and_uncertainties.length > 0) {
    addSectionTitle('Intelligence Gaps & Uncertainties');
    event.gaps_and_uncertainties.forEach((gap) => {
      if (yPos > 265) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(9);
      doc.setTextColor(180, 130, 50);
      doc.text('•', margin, yPos);
      doc.setTextColor(80, 80, 80);
      const gapLines = doc.splitTextToSize(gap, pageWidth - 2 * margin - 10);
      gapLines.forEach((line: string, i: number) => {
        doc.text(line, margin + 5, yPos);
        yPos += 4;
      });
      yPos += 2;
    });
    yPos += 3;
  }

  // ===== MAP SECTION =====
  if (yPos > 200) {
    doc.addPage();
    yPos = 20;
  }
  addSectionTitle('Location Map');

  // Try to load the static map image via edge function
  const mapImage = await fetchStaticMapImage(event.lat, event.lon, 8);
  
  if (mapImage) {
    try {
      const mapWidth = pageWidth - 2 * margin;
      const mapHeight = (mapWidth / 600) * 300; // Maintain aspect ratio
      
      // Add map border
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.rect(margin, yPos, mapWidth, mapHeight);
      
      doc.addImage(mapImage, 'PNG', margin, yPos, mapWidth, mapHeight);
      yPos += mapHeight + 5;
      
      // Add coordinates label below map
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`${event.lat.toFixed(4)}°N, ${event.lon.toFixed(4)}°E — ${event.region}, ${event.country}`, margin, yPos);
      yPos += 10;
    } catch (err) {
      console.warn('Could not render map image:', err);
      // Fall through to placeholder
      const mapHeight = 50;
      doc.setFillColor(240, 240, 240);
      doc.roundedRect(margin, yPos, pageWidth - 2 * margin, mapHeight, 3, 3, 'F');
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text('Map Preview Unavailable', pageWidth / 2, yPos + 20, { align: 'center' });
      doc.setFontSize(10);
      doc.text(`Coordinates: ${event.lat.toFixed(4)}°N, ${event.lon.toFixed(4)}°E`, pageWidth / 2, yPos + 30, { align: 'center' });
      doc.text(`${event.region}, ${event.country}`, pageWidth / 2, yPos + 40, { align: 'center' });
      yPos += mapHeight + 10;
    }
  } else {
    // Fallback: Draw a placeholder box with coordinates
    const mapHeight = 50;
    doc.setFillColor(240, 240, 240);
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, mapHeight, 3, 3, 'F');
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text('Map Preview Unavailable', pageWidth / 2, yPos + 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Coordinates: ${event.lat.toFixed(4)}°N, ${event.lon.toFixed(4)}°E`, pageWidth / 2, yPos + 30, { align: 'center' });
    doc.text(`${event.region}, ${event.country}`, pageWidth / 2, yPos + 40, { align: 'center' });
    yPos += mapHeight + 10;
  }

  // ===== FOOTER =====
  const addFooter = (pageNum: number, totalPages: number) => {
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, 290, { align: 'center' });
    doc.text('Global Intel Desk — Intelligence Report', margin, 290);
    doc.text(format(new Date(), 'yyyy-MM-dd'), pageWidth - margin, 290, { align: 'right' });
  };

  // Add footers to all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    addFooter(i, pageCount);
  }

  // Generate filename
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  const tokenStr = event.token || `EVT-${event.id.slice(0, 6)}`;
  const filename = `Intel-Report-${tokenStr}-${dateStr}.pdf`;

  doc.save(filename);
}
