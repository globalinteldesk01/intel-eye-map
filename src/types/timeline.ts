// Intelligence Timeline Types - Enterprise Grade GSOC System

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';
export type EventState = 'new' | 'developing' | 'escalating' | 'stabilized' | 'resolved';
export type MomentumScore = 'de-escalating' | 'stable' | 'escalating';
export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type ThreatCategory = 'geopolitical' | 'cyber' | 'military' | 'natural_disaster' | 'economic';
export type ImpactTag = 'travel' | 'infrastructure' | 'corporate_ops' | 'personnel' | 'supply_chain' | 'markets';
export type ClientSector = 'aviation' | 'it' | 'energy' | 'manufacturing' | 'finance' | 'healthcare';
export type ActorType = 'state' | 'non-state' | 'criminal' | 'terrorist' | 'unknown';

export interface TimelineUpdate {
  id: string;
  timestamp: string;
  content: string;
  severity_change?: SeverityLevel;
  analyst_id?: string;
}

export interface CascadeImpact {
  order: 1 | 2 | 3;
  category: string;
  description: string;
  probability: number;
  timeframe: string;
}

export interface ThreatDNA {
  actor_type: ActorType;
  capability: 'low' | 'medium' | 'high';
  intent: 'unknown' | 'hostile' | 'opportunistic' | 'defensive';
  historical_pattern_similarity: number;
  similar_events?: string[];
}

export interface PreEventSignal {
  id: string;
  type: string;
  description: string;
  detected_at: string;
  relevance_score: number;
}

export interface IntelligenceEvent {
  id: string;
  token?: string;
  title: string;
  short_description: string;
  full_description?: string;
  
  // Classification
  category: ThreatCategory;
  severity: SeverityLevel;
  event_state: EventState;
  momentum: MomentumScore;
  
  // Location
  region: string;
  country: string;
  lat: number;
  lon: number;
  affected_radius_km?: number;
  
  // Timing
  timestamp: string;
  local_time?: string;
  decision_deadline?: string;
  
  // Assessment
  confidence_level: ConfidenceLevel;
  trust_score: number; // 0-100
  impact_tags: ImpactTag[];
  
  // Intelligence Analysis
  why_this_matters: string;
  recommended_actions?: string[];
  threat_dna?: ThreatDNA;
  cascade_impacts?: CascadeImpact[];
  pre_event_signals?: PreEventSignal[];
  
  // Sources
  source_count: number;
  source_reliability: 'verified' | 'credible' | 'unverified';
  primary_source?: string;
  
  // Updates
  update_history: TimelineUpdate[];
  last_updated: string;
  update_frequency_hours?: number;
  
  // Client Impact
  client_assets_affected?: number;
  proximity_alert?: boolean;
  
  // Premium Features
  is_premium?: boolean;
  analyst_notes?: string;
  
  // View Mode
  media_narrative?: string;
  intelligence_assessment?: string;
  gaps_and_uncertainties?: string[];
}

export interface TimelineFilters {
  regions: string[];
  categories: ThreatCategory[];
  severities: SeverityLevel[];
  event_states: EventState[];
  impact_tags: ImpactTag[];
  time_window: '6h' | '12h' | '24h' | '7d' | '30d' | 'all';
  client_sector?: ClientSector;
  momentum?: MomentumScore;
  confidence?: ConfidenceLevel;
  search?: string;
}

export interface ClientProfile {
  sector: ClientSector;
  priority_categories: ThreatCategory[];
  priority_regions: string[];
  assets?: {
    id: string;
    name: string;
    lat: number;
    lon: number;
    type: string;
  }[];
}

export const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  critical: 'hsl(0 72% 51%)',
  high: 'hsl(38 92% 50%)',
  medium: 'hsl(45 93% 47%)',
  low: 'hsl(160 84% 39%)',
};

export const EVENT_STATE_COLORS: Record<EventState, string> = {
  new: 'hsl(263 70% 50%)',
  developing: 'hsl(217 91% 60%)',
  escalating: 'hsl(0 72% 51%)',
  stabilized: 'hsl(45 93% 47%)',
  resolved: 'hsl(160 84% 39%)',
};

export const MOMENTUM_CONFIG: Record<MomentumScore, { icon: string; color: string; label: string }> = {
  'de-escalating': { icon: '↓', color: 'hsl(160 84% 39%)', label: 'De-escalating' },
  'stable': { icon: '→', color: 'hsl(45 93% 47%)', label: 'Stable' },
  'escalating': { icon: '↑', color: 'hsl(0 72% 51%)', label: 'Escalating' },
};

export const CATEGORY_ICONS: Record<ThreatCategory, string> = {
  geopolitical: '🌐',
  cyber: '💻',
  military: '⚔️',
  natural_disaster: '🌪️',
  economic: '📈',
};

export const IMPACT_TAG_LABELS: Record<ImpactTag, string> = {
  travel: 'Travel',
  infrastructure: 'Infrastructure',
  corporate_ops: 'Corporate Ops',
  personnel: 'Personnel',
  supply_chain: 'Supply Chain',
  markets: 'Markets',
};

export const CLIENT_SECTOR_PRIORITIES: Record<ClientSector, ThreatCategory[]> = {
  aviation: ['military', 'natural_disaster', 'geopolitical'],
  it: ['cyber', 'economic', 'geopolitical'],
  energy: ['geopolitical', 'military', 'natural_disaster'],
  manufacturing: ['economic', 'natural_disaster', 'geopolitical'],
  finance: ['cyber', 'economic', 'geopolitical'],
  healthcare: ['cyber', 'natural_disaster', 'economic'],
};
