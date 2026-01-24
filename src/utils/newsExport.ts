import { jsPDF } from 'jspdf';
import { NewsItem } from '@/types/news';
import { format } from 'date-fns';

// Generate unique report ID
const generateReportId = (): string => {
  const date = format(new Date(), 'yyyyMMdd');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `IR-${date}-${random}`;
};

// Map threat level to classification
const getClassification = (threatLevel: string): string => {
  switch (threatLevel) {
    case 'critical': return 'CONFIDENTIAL';
    case 'high': return 'RESTRICTED';
    case 'elevated': return 'INTERNAL';
    default: return 'PUBLIC';
  }
};

// Get threat domain from category
const getThreatDomain = (category: string): string => {
  const domains: Record<string, string> = {
    security: 'Physical Security',
    conflict: 'Armed Conflict / Terror',
    technology: 'Cyber / Technology',
    diplomacy: 'Geopolitical',
    economy: 'Economic / Infrastructure',
    humanitarian: 'Humanitarian / Travel Risk',
  };
  return domains[category] || 'Multi-Domain';
};

// Get actor description
const getActorDescription = (actorType: string): { type: string; profile: string } => {
  const actors: Record<string, { type: string; profile: string }> = {
    state: {
      type: 'State Actor',
      profile: 'Government-affiliated entity with institutional resources and strategic objectives. Likely possesses advanced capabilities and operates within defined geopolitical interests.',
    },
    'non-state': {
      type: 'Non-State Actor',
      profile: 'Independent group operating outside formal government structures. May include militant organizations, activist groups, or autonomous threat actors with varied capabilities.',
    },
    organization: {
      type: 'Organizational / Criminal',
      profile: 'Structured criminal or organizational entity. Motivations likely include financial gain, territorial control, or operational disruption.',
    },
  };
  return actors[actorType] || actors.organization;
};

// Generate threat assessment scores
const generateThreatAssessment = (item: NewsItem) => {
  const baseScore = item.confidenceScore;
  const threatMultiplier = item.threatLevel === 'critical' ? 1 : item.threatLevel === 'high' ? 0.8 : item.threatLevel === 'elevated' ? 0.6 : 0.4;
  
  return {
    targetSensitivity: threatMultiplier > 0.7 ? 'High' : threatMultiplier > 0.5 ? 'Medium' : 'Low',
    attackSophistication: item.actorType === 'state' ? 'High' : item.actorType === 'non-state' ? 'Medium' : 'Low',
    actorCapability: item.actorType === 'state' ? 'High' : 'Medium',
    geographicImpact: item.category === 'conflict' || item.category === 'security' ? 'High' : 'Medium',
    escalationRisk: threatMultiplier > 0.7 ? 'High' : threatMultiplier > 0.5 ? 'Medium' : 'Low',
  };
};

// Generate recommended actions based on threat level
const generateRecommendations = (item: NewsItem) => {
  const immediate = [
    'Monitor situation through verified intelligence channels',
    'Alert relevant stakeholders and security personnel',
    'Review and validate current security protocols',
  ];
  
  const shortTerm = [
    'Conduct vulnerability assessment of affected operations',
    'Establish enhanced monitoring for related indicators',
    'Coordinate with regional security partners',
  ];
  
  const strategic = [
    'Review long-term security posture in affected region',
    'Update risk assessment models with new threat data',
    'Evaluate contingency and business continuity plans',
  ];

  if (item.threatLevel === 'critical' || item.threatLevel === 'high') {
    immediate.unshift('Activate emergency response protocols immediately');
    shortTerm.unshift('Conduct comprehensive threat briefing for leadership');
  }

  return { immediate, shortTerm, strategic };
};

// Fetch static map image via edge function (avoids CORS)
const fetchStaticMapImage = async (
  lat: number, 
  lon: number, 
  zoom: number, 
  mapType: 'standard' | 'satellite' = 'standard'
): Promise<string | null> => {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    const response = await fetch(
      `${supabaseUrl}/functions/v1/fetch-static-map?lat=${lat}&lon=${lon}&zoom=${zoom}&width=600&height=300&maptype=${mapType}`,
      {
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      console.error('Map fetch failed:', response.status, await response.text());
      return null;
    }
    
    const data = await response.json();
    return data.image || null;
  } catch (error) {
    console.error('Error fetching map:', error);
    return null;
  }
};

// Calculate appropriate zoom level based on incident category
const calculateMapZoom = (category: string, threatLevel: string): number => {
  // City-level incidents (security, conflict) -> higher zoom
  if (category === 'security' || category === 'conflict') {
    return threatLevel === 'critical' ? 10 : 8;
  }
  // Regional infrastructure events
  if (category === 'economy' || category === 'technology') {
    return 6;
  }
  // Country-level threats (diplomacy, humanitarian)
  return 5;
};

export const exportNewsItemToPDF = async (item: NewsItem): Promise<void> => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  let yPos = margin;

  // Fetch both map types in parallel while preparing report
  const mapZoom = calculateMapZoom(item.category, item.threatLevel);
  const [standardMapImage, satelliteMapImage] = await Promise.all([
    fetchStaticMapImage(item.lat, item.lon, mapZoom, 'standard'),
    fetchStaticMapImage(item.lat, item.lon, mapZoom, 'satellite'),
  ]);

  const reportId = generateReportId();
  const classification = getClassification(item.threatLevel);
  const threatDomain = getThreatDomain(item.category);
  const actorInfo = getActorDescription(item.actorType);
  const threatAssessment = generateThreatAssessment(item);
  const recommendations = generateRecommendations(item);

  // Helper function to check page break
  const checkPageBreak = (requiredSpace: number) => {
    if (yPos + requiredSpace > pageHeight - 20) {
      pdf.addPage();
      yPos = margin;
      // Add header on new page
      pdf.setFillColor(15, 23, 42);
      pdf.rect(0, 0, pageWidth, 12, 'F');
      pdf.setTextColor(96, 165, 250);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text('GLOBAL INTEL DESK', margin, 7);
      pdf.setTextColor(239, 68, 68);
      pdf.setFontSize(7);
      pdf.text(classification, pageWidth - margin, 7, { align: 'right' });
      yPos = 18;
    }
  };

  // Helper for section headers
  const addSectionHeader = (title: string) => {
    checkPageBreak(15);
    pdf.setFillColor(30, 41, 59);
    pdf.roundedRect(margin, yPos, contentWidth, 8, 1, 1, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.text(title, margin + 4, yPos + 5.5);
    yPos += 12;
  };

  // Helper for content text
  const addContent = (text: string, indent: number = 0) => {
    pdf.setTextColor(51, 65, 85);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    const lines = pdf.splitTextToSize(text, contentWidth - indent);
    checkPageBreak(lines.length * 4 + 2);
    pdf.text(lines, margin + indent, yPos);
    yPos += lines.length * 4 + 2;
  };

  // Helper for labeled content
  const addLabeledContent = (label: string, value: string) => {
    checkPageBreak(6);
    pdf.setTextColor(100, 116, 139);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text(label + ':', margin, yPos);
    pdf.setTextColor(15, 23, 42);
    pdf.setFont('helvetica', 'normal');
    pdf.text(value, margin + 35, yPos);
    yPos += 5;
  };

  // ========== PAGE 1: HEADER & EXECUTIVE SUMMARY ==========

  // Classification Banner
  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, 0, pageWidth, 16, 'F');
  
  // Global Intel Desk branding
  pdf.setTextColor(96, 165, 250);
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('GLOBAL INTEL DESK', margin, 8);
  
  pdf.setTextColor(148, 163, 184);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Intelligence & Security Operations', margin, 13);
  
  // Classification badge
  pdf.setFillColor(239, 68, 68);
  pdf.roundedRect(pageWidth - margin - 35, 4, 35, 8, 2, 2, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.text(classification, pageWidth - margin - 32, 9.5);

  yPos = 22;

  // Report Identity Box
  pdf.setFillColor(241, 245, 249);
  pdf.roundedRect(margin, yPos, contentWidth, 32, 2, 2, 'F');
  pdf.setDrawColor(203, 213, 225);
  pdf.roundedRect(margin, yPos, contentWidth, 32, 2, 2, 'S');

  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('INTELLIGENCE REPORT', margin + 5, yPos + 8);

  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Report ID: ${reportId}`, margin + 5, yPos + 14);
  pdf.text(`Date/Time: ${format(new Date(), 'yyyy-MM-dd HH:mm')} UTC`, margin + 5, yPos + 19);
  pdf.text(`Region: ${item.region} | Country: ${item.country}`, margin + 5, yPos + 24);
  pdf.text(`Primary Threat Domain: ${threatDomain}`, margin + 5, yPos + 29);

  // Threat Level Badge
  const threatColors: Record<string, [number, number, number]> = {
    critical: [239, 68, 68],
    high: [234, 88, 12],
    elevated: [245, 158, 11],
    low: [34, 197, 94],
  };
  const threatColor = threatColors[item.threatLevel] || threatColors.low;
  pdf.setFillColor(...threatColor);
  pdf.roundedRect(pageWidth - margin - 45, yPos + 5, 40, 12, 2, 2, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`THREAT: ${item.threatLevel.toUpperCase()}`, pageWidth - margin - 42, yPos + 12.5);

  // Confidence Badge
  const confColor = item.confidenceScore >= 0.8 ? [34, 197, 94] : item.confidenceScore >= 0.6 ? [245, 158, 11] : [239, 68, 68];
  pdf.setFillColor(...(confColor as [number, number, number]));
  pdf.roundedRect(pageWidth - margin - 45, yPos + 20, 40, 8, 2, 2, 'F');
  pdf.setFontSize(7);
  pdf.text(`CONFIDENCE: ${Math.round(item.confidenceScore * 100)}%`, pageWidth - margin - 42, yPos + 25.5);

  yPos += 40;

  // Token reference
  if (item.token) {
    pdf.setFillColor(59, 130, 246);
    pdf.roundedRect(margin, yPos, 50, 7, 2, 2, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`REF: ${item.token}`, margin + 3, yPos + 5);
    yPos += 12;
  }

  // ========== EXECUTIVE SNAPSHOT ==========
  addSectionHeader('EXECUTIVE SNAPSHOT');
  
  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  const execSummary = pdf.splitTextToSize(item.summary, contentWidth);
  pdf.text(execSummary, margin, yPos);
  yPos += execSummary.length * 5 + 4;

  // Risk outlook
  pdf.setFillColor(254, 243, 199);
  pdf.roundedRect(margin, yPos, contentWidth, 10, 2, 2, 'F');
  pdf.setTextColor(146, 64, 14);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.text('RISK OUTLOOK:', margin + 4, yPos + 6.5);
  pdf.setFont('helvetica', 'normal');
  const outlook = item.threatLevel === 'critical' || item.threatLevel === 'high' 
    ? 'Elevated situational awareness recommended. Monitor for escalation indicators.'
    : 'Standard monitoring protocols advised. Situation remains within manageable parameters.';
  pdf.text(outlook, margin + 32, yPos + 6.5);
  yPos += 16;

  // ========== INCIDENT OVERVIEW ==========
  addSectionHeader('INCIDENT OVERVIEW');
  addLabeledContent('Nature', `${item.category.charAt(0).toUpperCase() + item.category.slice(1)} incident`);
  addLabeledContent('Status', item.confidenceLevel === 'breaking' ? 'Developing' : item.confidenceLevel === 'developing' ? 'Ongoing' : 'Verified');
  addLabeledContent('Source', `${item.source} (${item.sourceCredibility} credibility)`);
  addLabeledContent('Published', format(new Date(item.publishedAt), 'yyyy-MM-dd HH:mm') + ' UTC');
  yPos += 4;

  // ========== LOCATION & GEO CONTEXT ==========
  addSectionHeader('LOCATION & GEO CONTEXT');
  
  addLabeledContent('Country', item.country);
  addLabeledContent('Region', item.region);
  addLabeledContent('Coordinates', `LAT ${item.lat.toFixed(4)} | LON ${item.lon.toFixed(4)}`);
  
  // Strategic relevance
  const strategicRelevance = item.category === 'security' || item.category === 'conflict' 
    ? 'High-priority security zone with active threat indicators'
    : item.category === 'economy' || item.category === 'technology'
    ? 'Critical infrastructure and economic significance'
    : 'Geopolitical or humanitarian significance';
  addLabeledContent('Strategic Note', strategicRelevance);
  yPos += 4;

  // Map visualization - Dual Map View (Standard + Satellite)
  checkPageBreak(120);
  
  // Section sub-header for maps
  pdf.setTextColor(100, 116, 139);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.text('GEOGRAPHIC VISUALIZATION', margin, yPos);
  yPos += 5;
  
  const singleMapHeight = 45;
  const mapWidth = (contentWidth - 4) / 2; // Two maps side by side with gap
  
  // Helper function to render a map
  const renderMap = (mapImage: string | null, xPos: number, label: string, isStandard: boolean) => {
    if (mapImage) {
      try {
        pdf.addImage(mapImage, 'PNG', xPos, yPos, mapWidth, singleMapHeight);
        pdf.setDrawColor(30, 41, 59);
        pdf.setLineWidth(0.5);
        pdf.roundedRect(xPos, yPos, mapWidth, singleMapHeight, 2, 2, 'S');
      } catch {
        pdf.setFillColor(226, 232, 240);
        pdf.roundedRect(xPos, yPos, mapWidth, singleMapHeight, 2, 2, 'F');
        pdf.setTextColor(100, 116, 139);
        pdf.setFontSize(9);
        pdf.text('Map unavailable', xPos + mapWidth / 2, yPos + singleMapHeight / 2, { align: 'center' });
      }
    } else {
      // Fallback placeholder
      pdf.setFillColor(isStandard ? 226 : 45, isStandard ? 232 : 55, isStandard ? 240 : 72);
      pdf.roundedRect(xPos, yPos, mapWidth, singleMapHeight, 2, 2, 'F');
      
      if (isStandard) {
        // Grid for standard map placeholder
        pdf.setDrawColor(203, 213, 225);
        pdf.setLineWidth(0.1);
        for (let i = 1; i < 8; i++) {
          pdf.line(xPos + (mapWidth / 8) * i, yPos, xPos + (mapWidth / 8) * i, yPos + singleMapHeight);
        }
        for (let i = 1; i < 5; i++) {
          pdf.line(xPos, yPos + (singleMapHeight / 5) * i, xPos + mapWidth, yPos + (singleMapHeight / 5) * i);
        }
      }
      
      // Center pin
      const pinX = xPos + mapWidth / 2;
      const pinY = yPos + singleMapHeight / 2;
      pdf.setFillColor(100, 116, 139);
      pdf.ellipse(pinX, pinY + 5, 4, 1.2, 'F');
      pdf.setFillColor(...threatColor);
      pdf.circle(pinX, pinY - 2, 5, 'F');
      pdf.triangle(pinX - 3.5, pinY + 1, pinX + 3.5, pinY + 1, pinX, pinY + 5, 'F');
      pdf.setFillColor(255, 255, 255);
      pdf.circle(pinX, pinY - 2, 2.5, 'F');
      pdf.setFillColor(...threatColor);
      pdf.circle(pinX, pinY - 2, 1.2, 'F');
    }
    
    // Map type label
    const labelBg = isStandard ? [59, 130, 246] : [34, 197, 94];
    pdf.setFillColor(...(labelBg as [number, number, number]));
    pdf.roundedRect(xPos + 2, yPos + 2, 28, 6, 1, 1, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(5);
    pdf.setFont('helvetica', 'bold');
    pdf.text(label.toUpperCase(), xPos + 4, yPos + 6);
  };
  
  // Render both maps side by side
  renderMap(standardMapImage, margin, 'Standard', true);
  renderMap(satelliteMapImage, margin + mapWidth + 4, 'Satellite', false);
  
  // Location overlay on standard map
  pdf.setFillColor(15, 23, 42);
  pdf.roundedRect(margin + 2, yPos + singleMapHeight - 12, 70, 10, 2, 2, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`${item.country}`, margin + 4, yPos + singleMapHeight - 6);
  pdf.setFontSize(5);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`${item.lat.toFixed(4)}°, ${item.lon.toFixed(4)}°`, margin + 4, yPos + singleMapHeight - 3);
  
  // Zoom indicator on satellite map
  pdf.setFillColor(15, 23, 42);
  pdf.roundedRect(margin + mapWidth + 4 + mapWidth - 30, yPos + 2, 28, 6, 1, 1, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(5);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`ZOOM: ${mapZoom}`, margin + mapWidth + 4 + mapWidth - 28, yPos + 6);
  
  // Scale indicator
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(margin + mapWidth + 4 + 2, yPos + singleMapHeight - 10, 32, 8, 2, 2, 'F');
  pdf.setTextColor(30, 41, 59);
  pdf.setFontSize(5);
  const scaleText = mapZoom >= 10 ? '~5 km' : mapZoom >= 8 ? '~20 km' : mapZoom >= 6 ? '~100 km' : '~500 km';
  pdf.text(`Scale: ${scaleText}`, margin + mapWidth + 6, yPos + singleMapHeight - 5);
  
  yPos += singleMapHeight + 8;

  // ========== THREAT ASSESSMENT ==========
  addSectionHeader('THREAT ASSESSMENT & SCORING');
  
  const assessmentItems = [
    { label: 'Target Sensitivity', value: threatAssessment.targetSensitivity },
    { label: 'Attack Sophistication', value: threatAssessment.attackSophistication },
    { label: 'Actor Capability', value: threatAssessment.actorCapability },
    { label: 'Geographic Impact', value: threatAssessment.geographicImpact },
    { label: 'Escalation Risk', value: threatAssessment.escalationRisk },
  ];

  checkPageBreak(30);
  assessmentItems.forEach((item, index) => {
    const boxX = margin + (index % 3) * (contentWidth / 3 + 2);
    const boxY = yPos + Math.floor(index / 3) * 12;
    const boxWidth = contentWidth / 3 - 4;
    
    const levelColor = item.value === 'High' ? [254, 226, 226] : item.value === 'Medium' ? [254, 243, 199] : [220, 252, 231];
    const textColor = item.value === 'High' ? [153, 27, 27] : item.value === 'Medium' ? [146, 64, 14] : [22, 101, 52];
    
    pdf.setFillColor(...(levelColor as [number, number, number]));
    pdf.roundedRect(boxX, boxY, boxWidth, 10, 1, 1, 'F');
    pdf.setTextColor(...(textColor as [number, number, number]));
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.text(item.label, boxX + 2, boxY + 4);
    pdf.setFont('helvetica', 'bold');
    pdf.text(item.value, boxX + 2, boxY + 8);
  });
  yPos += 28;

  // Final assessment
  pdf.setFillColor(...threatColor);
  pdf.roundedRect(margin, yPos, contentWidth, 10, 2, 2, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`FINAL THREAT LEVEL: ${item.threatLevel.toUpperCase()}`, margin + 4, yPos + 6.5);
  yPos += 16;

  // ========== ATTRIBUTION & ACTOR PROFILE ==========
  addSectionHeader('ATTRIBUTION & ACTOR PROFILE');
  addLabeledContent('Actor Type', actorInfo.type);
  addLabeledContent('Attribution Conf.', item.sourceCredibility === 'high' ? 'Medium-High' : item.sourceCredibility === 'medium' ? 'Medium' : 'Low');
  yPos += 2;
  addContent(actorInfo.profile);
  yPos += 4;

  // ========== IMPACT ANALYSIS ==========
  addSectionHeader('IMPACT ANALYSIS');
  
  const impacts = [
    { domain: 'Operational', assessment: item.threatLevel === 'critical' || item.threatLevel === 'high' ? 'Potential disruption to regional operations. Enhanced monitoring required.' : 'Limited direct operational impact anticipated.' },
    { domain: 'Security', assessment: `${item.category === 'security' || item.category === 'conflict' ? 'Elevated' : 'Standard'} security posture recommended for personnel in region.` },
    { domain: 'Economic', assessment: item.category === 'economy' ? 'Direct economic implications possible. Monitor market indicators.' : 'Indirect economic effects may manifest over medium term.' },
    { domain: 'Strategic', assessment: 'Situation may influence regional stability and stakeholder relationships.' },
  ];

  impacts.forEach(impact => {
    checkPageBreak(12);
    pdf.setTextColor(15, 23, 42);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text(impact.domain + ' Impact:', margin, yPos);
    yPos += 4;
    addContent(impact.assessment, 2);
  });

  // ========== ANALYST ASSESSMENT ==========
  addSectionHeader('ANALYST ASSESSMENT');
  
  const assessmentText = `This incident aligns with observed patterns in the ${item.region} region. ${
    item.threatLevel === 'critical' || item.threatLevel === 'high' 
      ? 'Short-term outlook (72 hours) suggests heightened risk of follow-on activity or escalation. Close monitoring of related indicators is advised.'
      : 'Short-term outlook (72 hours) indicates stable conditions with limited escalation potential. Standard monitoring protocols should suffice.'
  } The ${item.sourceCredibility} credibility rating of source material supports the ${Math.round(item.confidenceScore * 100)}% confidence assessment.`;
  
  addContent(assessmentText);
  yPos += 4;

  // ========== RECOMMENDED ACTIONS ==========
  addSectionHeader('RECOMMENDED ACTIONS');

  // Immediate
  checkPageBreak(25);
  pdf.setFillColor(254, 226, 226);
  pdf.roundedRect(margin, yPos, contentWidth, 6, 1, 1, 'F');
  pdf.setTextColor(153, 27, 27);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.text('IMMEDIATE (0-24 HOURS)', margin + 3, yPos + 4);
  yPos += 8;
  recommendations.immediate.forEach(rec => {
    checkPageBreak(5);
    pdf.setTextColor(51, 65, 85);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text('• ' + rec, margin + 2, yPos);
    yPos += 4;
  });
  yPos += 2;

  // Short-term
  checkPageBreak(20);
  pdf.setFillColor(254, 243, 199);
  pdf.roundedRect(margin, yPos, contentWidth, 6, 1, 1, 'F');
  pdf.setTextColor(146, 64, 14);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.text('SHORT-TERM (1-7 DAYS)', margin + 3, yPos + 4);
  yPos += 8;
  recommendations.shortTerm.forEach(rec => {
    checkPageBreak(5);
    pdf.setTextColor(51, 65, 85);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text('• ' + rec, margin + 2, yPos);
    yPos += 4;
  });
  yPos += 2;

  // Strategic
  checkPageBreak(20);
  pdf.setFillColor(220, 252, 231);
  pdf.roundedRect(margin, yPos, contentWidth, 6, 1, 1, 'F');
  pdf.setTextColor(22, 101, 52);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.text('STRATEGIC (30-90 DAYS)', margin + 3, yPos + 4);
  yPos += 8;
  recommendations.strategic.forEach(rec => {
    checkPageBreak(5);
    pdf.setTextColor(51, 65, 85);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text('• ' + rec, margin + 2, yPos);
    yPos += 4;
  });
  yPos += 6;

  // ========== SOURCE CREDENTIALS ==========
  addSectionHeader('SOURCE CREDENTIALS');
  
  checkPageBreak(35);
  pdf.setFillColor(241, 245, 249);
  pdf.roundedRect(margin, yPos, contentWidth, 28, 2, 2, 'F');
  pdf.setDrawColor(203, 213, 225);
  pdf.roundedRect(margin, yPos, contentWidth, 28, 2, 2, 'S');
  
  // Source name
  pdf.setTextColor(100, 116, 139);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.text('SOURCE NAME:', margin + 4, yPos + 5);
  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text(item.source, margin + 35, yPos + 5);
  
  // Credibility rating
  pdf.setTextColor(100, 116, 139);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.text('CREDIBILITY:', margin + 4, yPos + 11);
  
  const credColors: Record<string, { bg: [number, number, number]; text: [number, number, number] }> = {
    high: { bg: [220, 252, 231], text: [22, 101, 52] },
    medium: { bg: [254, 243, 199], text: [146, 64, 14] },
    low: { bg: [254, 226, 226], text: [153, 27, 27] },
  };
  const credStyle = credColors[item.sourceCredibility] || credColors.medium;
  pdf.setFillColor(...credStyle.bg);
  pdf.roundedRect(margin + 35, yPos + 7, 20, 6, 1, 1, 'F');
  pdf.setTextColor(...credStyle.text);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.text(item.sourceCredibility.toUpperCase(), margin + 37, yPos + 11.5);
  
  // Source URL
  pdf.setTextColor(100, 116, 139);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.text('SOURCE LINK:', margin + 4, yPos + 17);
  pdf.setTextColor(59, 130, 246);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  const displayUrl = item.url.length > 70 ? item.url.substring(0, 67) + '...' : item.url;
  pdf.textWithLink(displayUrl, margin + 35, yPos + 17, { url: item.url });
  
  // Published date
  pdf.setTextColor(100, 116, 139);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.text('PUBLISHED:', margin + 4, yPos + 23);
  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.text(format(new Date(item.publishedAt), 'yyyy-MM-dd HH:mm') + ' UTC', margin + 35, yPos + 23);
  
  yPos += 34;

  // ========== CONFIDENCE & SOURCE NOTES ==========
  addSectionHeader('CONFIDENCE & SOURCE NOTES');
  
  const confidenceExplanation = `Confidence score of ${Math.round(item.confidenceScore * 100)}% derived from: source credibility rating (${item.sourceCredibility}), corroboration level, and temporal proximity to event. Primary source type: OSINT / Media Intelligence. Information subject to revision as additional data becomes available.`;
  addContent(confidenceExplanation);
  yPos += 4;

  // ========== KEYWORDS & TAGS ==========
  addSectionHeader('KEYWORDS & TAGS');
  
  checkPageBreak(15);
  let tagX = margin;
  const allTags = [...item.tags, item.category, item.region, item.threatLevel];
  allTags.forEach((tag) => {
    const tagWidth = pdf.getTextWidth(tag.toUpperCase()) * 0.8 + 8;
    if (tagX + tagWidth > pageWidth - margin) {
      tagX = margin;
      yPos += 8;
    }
    pdf.setFillColor(226, 232, 240);
    pdf.roundedRect(tagX, yPos, tagWidth, 6, 1, 1, 'F');
    pdf.setTextColor(71, 85, 105);
    pdf.setFontSize(6);
    pdf.setFont('helvetica', 'bold');
    pdf.text(tag.toUpperCase(), tagX + 4, yPos + 4);
    tagX += tagWidth + 3;
  });
  yPos += 14;

  // ========== TRANSPARENCY & DISCLAIMER ==========
  addSectionHeader('TRANSPARENCY & DISCLAIMER');
  
  checkPageBreak(25);
  pdf.setFillColor(241, 245, 249);
  pdf.roundedRect(margin, yPos, contentWidth, 22, 2, 2, 'F');
  pdf.setDrawColor(203, 213, 225);
  pdf.roundedRect(margin, yPos, contentWidth, 22, 2, 2, 'S');
  
  pdf.setTextColor(71, 85, 105);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Report Type: AUTO-GENERATED | Analyst Review: PENDING', margin + 4, yPos + 5);
  pdf.text('Update Window: Intelligence will be updated as new information becomes available.', margin + 4, yPos + 10);
  pdf.text('Limitation Notice: This assessment is based on available open-source information and may not reflect', margin + 4, yPos + 15);
  pdf.text('the complete operational picture. Users should validate critical decisions with additional sources.', margin + 4, yPos + 20);

  // ========== FOOTER ON ALL PAGES ==========
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    
    // Bottom footer
    pdf.setFillColor(15, 23, 42);
    pdf.rect(0, pageHeight - 14, pageWidth, 14, 'F');
    
    // Global Intel Desk branding
    pdf.setTextColor(96, 165, 250);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text('GLOBAL INTEL DESK', margin, pageHeight - 7);
    
    pdf.setTextColor(148, 163, 184);
    pdf.setFontSize(6);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Report ID: ${reportId}`, margin, pageHeight - 3);
    
    pdf.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
    
    pdf.setTextColor(148, 163, 184);
    pdf.text(`Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')} UTC`, pageWidth - margin, pageHeight - 7, { align: 'right' });
    
    pdf.setTextColor(239, 68, 68);
    pdf.setFont('helvetica', 'bold');
    pdf.text(classification, pageWidth - margin, pageHeight - 3, { align: 'right' });
  }

  // Save
  const filename = `intel-report-${reportId}.pdf`;
  pdf.save(filename);
};
