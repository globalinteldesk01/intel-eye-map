import { NewsItem } from '@/types/news';
import { 
  IntelligenceEvent, 
  ThreatCategory, 
  SeverityLevel, 
  EventState, 
  MomentumScore, 
  ConfidenceLevel as TimelineConfidenceLevel,
  ImpactTag,
  ActorType as TimelineActorType
} from '@/types/timeline';

// Map news category to timeline threat category
const mapCategory = (category: NewsItem['category']): ThreatCategory => {
  const mapping: Record<NewsItem['category'], ThreatCategory> = {
    security: 'cyber',
    diplomacy: 'geopolitical',
    economy: 'economic',
    conflict: 'military',
    humanitarian: 'natural_disaster',
    technology: 'cyber',
  };
  return mapping[category] || 'geopolitical';
};

// Map threat level to severity
const mapSeverity = (threatLevel: NewsItem['threatLevel']): SeverityLevel => {
  const mapping: Record<NewsItem['threatLevel'], SeverityLevel> = {
    critical: 'critical',
    high: 'high',
    elevated: 'medium',
    low: 'low',
  };
  return mapping[threatLevel] || 'low';
};

// Map confidence level
const mapConfidenceLevel = (level: NewsItem['confidenceLevel']): TimelineConfidenceLevel => {
  const mapping: Record<NewsItem['confidenceLevel'], TimelineConfidenceLevel> = {
    verified: 'high',
    developing: 'medium',
    breaking: 'low',
  };
  return mapping[level] || 'medium';
};

// Map actor type
const mapActorType = (actorType: NewsItem['actorType']): TimelineActorType => {
  const mapping: Record<NewsItem['actorType'], TimelineActorType> = {
    state: 'state',
    'non-state': 'non-state',
    organization: 'criminal',
  };
  return mapping[actorType] || 'unknown';
};

// Derive event state based on recency and threat level
const deriveEventState = (publishedAt: string, threatLevel: NewsItem['threatLevel']): EventState => {
  const now = new Date();
  const published = new Date(publishedAt);
  const hoursAgo = (now.getTime() - published.getTime()) / (1000 * 60 * 60);
  
  if (hoursAgo < 6) {
    if (threatLevel === 'critical' || threatLevel === 'high') return 'escalating';
    return 'new';
  }
  if (hoursAgo < 24) {
    return 'developing';
  }
  if (hoursAgo < 72) {
    return 'stabilized';
  }
  return 'resolved';
};

// Derive momentum based on recency and threat level
const deriveMomentum = (publishedAt: string, threatLevel: NewsItem['threatLevel']): MomentumScore => {
  const now = new Date();
  const published = new Date(publishedAt);
  const hoursAgo = (now.getTime() - published.getTime()) / (1000 * 60 * 60);
  
  if (hoursAgo < 12 && (threatLevel === 'critical' || threatLevel === 'high')) {
    return 'escalating';
  }
  if (hoursAgo > 48) {
    return 'de-escalating';
  }
  return 'stable';
};

// Derive impact tags from category and tags
const deriveImpactTags = (category: NewsItem['category'], tags: string[]): ImpactTag[] => {
  const impactTags: ImpactTag[] = [];
  
  // Category-based impacts
  switch (category) {
    case 'security':
    case 'technology':
      impactTags.push('infrastructure', 'corporate_ops');
      break;
    case 'conflict':
      impactTags.push('travel', 'personnel', 'infrastructure');
      break;
    case 'economy':
      impactTags.push('markets', 'supply_chain');
      break;
    case 'diplomacy':
      impactTags.push('travel', 'corporate_ops');
      break;
    case 'humanitarian':
      impactTags.push('personnel', 'travel');
      break;
  }
  
  // Tag-based impacts
  const tagLower = tags.map(t => t.toLowerCase()).join(' ');
  if (tagLower.includes('supply') || tagLower.includes('trade')) impactTags.push('supply_chain');
  if (tagLower.includes('market') || tagLower.includes('stock') || tagLower.includes('economic')) impactTags.push('markets');
  if (tagLower.includes('travel') || tagLower.includes('transport')) impactTags.push('travel');
  if (tagLower.includes('cyber') || tagLower.includes('infrastructure')) impactTags.push('infrastructure');
  
  // Remove duplicates and return max 4
  return [...new Set(impactTags)].slice(0, 4);
};

// Generate a contextual "why this matters" statement
const generateWhyThisMatters = (item: NewsItem): string => {
  const severityImpact = {
    critical: 'Immediate action required.',
    high: 'Close monitoring recommended.',
    elevated: 'Potential impact on operations.',
    low: 'Situation worth tracking.',
  };
  
  const categoryContext = {
    security: 'Security posture may need adjustment.',
    diplomacy: 'May affect international business relations.',
    economy: 'Could impact financial planning and markets.',
    conflict: 'Travel and personnel safety should be reviewed.',
    humanitarian: 'Emergency response protocols may be needed.',
    technology: 'IT systems and infrastructure may be affected.',
  };
  
  return `${severityImpact[item.threatLevel]} ${categoryContext[item.category]}`;
};

/**
 * Transform a NewsItem from the database to an IntelligenceEvent for the timeline
 */
export function newsItemToTimelineEvent(item: NewsItem): IntelligenceEvent {
  const severity = mapSeverity(item.threatLevel);
  const eventState = deriveEventState(item.publishedAt, item.threatLevel);
  const momentum = deriveMomentum(item.publishedAt, item.threatLevel);
  const confidenceLevel = mapConfidenceLevel(item.confidenceLevel);
  
  return {
    id: item.id,
    token: item.token || undefined,
    title: item.title,
    short_description: item.summary,
    full_description: item.summary,
    
    // Classification
    category: mapCategory(item.category),
    severity,
    event_state: eventState,
    momentum,
    
    // Location
    region: item.region,
    country: item.country,
    lat: item.lat,
    lon: item.lon,
    affected_radius_km: severity === 'critical' ? 500 : severity === 'high' ? 200 : 100,
    
    // Timing
    timestamp: item.publishedAt,
    last_updated: item.publishedAt,
    
    // Assessment
    confidence_level: confidenceLevel,
    trust_score: Math.round(item.confidenceScore * 100),
    impact_tags: deriveImpactTags(item.category, item.tags),
    
    // Intelligence Analysis
    why_this_matters: generateWhyThisMatters(item),
    recommended_actions: [
      'Monitor situation for updates',
      'Review relevant security protocols',
      'Brief stakeholders as appropriate',
    ],
    
    // Threat DNA (derived)
    threat_dna: {
      actor_type: mapActorType(item.actorType),
      capability: severity === 'critical' || severity === 'high' ? 'high' : 'medium',
      intent: severity === 'critical' ? 'hostile' : 'opportunistic',
      historical_pattern_similarity: Math.round(50 + item.confidenceScore * 40),
    },
    
    // Sources
    source_count: 1 + Math.floor(item.confidenceScore * 10),
    source_reliability: item.sourceCredibility === 'high' ? 'verified' : 
                        item.sourceCredibility === 'medium' ? 'credible' : 'unverified',
    primary_source: item.source,
    
    // Updates
    update_history: [],
    
    // Premium
    is_premium: false,
    
    // View Mode
    media_narrative: item.summary,
    intelligence_assessment: `${item.category.charAt(0).toUpperCase() + item.category.slice(1)} event in ${item.region}. ${item.summary}`,
    gaps_and_uncertainties: [
      'Full scope of impact yet to be determined',
      'Ongoing situation - updates expected',
    ],
  };
}

/**
 * Transform an array of NewsItems to IntelligenceEvents
 */
export function newsItemsToTimelineEvents(items: NewsItem[]): IntelligenceEvent[] {
  return items.map(newsItemToTimelineEvent);
}
