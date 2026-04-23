export type ThreatLevel = 'low' | 'elevated' | 'high' | 'critical';
export type ConfidenceLevel = 'verified' | 'developing' | 'breaking';
export type ActorType = 'state' | 'non-state' | 'organization';
export type SourceCredibility = 'high' | 'medium' | 'low';

export interface NewsItem {
  id: string;
  token: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  sourceCredibility: SourceCredibility;
  publishedAt: string;
  lat: number;
  lon: number;
  country: string;
  region: string;
  city?: string;
  tags: string[];
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  threatLevel: ThreatLevel;
  actorType: ActorType;
  subCategory?: string;
  category: 'security' | 'diplomacy' | 'economy' | 'conflict' | 'humanitarian' | 'technology';
  actionableInsights?: string[];
  keyActors?: string[];
  severitySummary?: string;
  precisionLevel?: 'city' | 'district' | 'region' | 'country' | 'manual';
}

export interface FilterState {
  dateRange: { from: Date | null; to: Date | null };
  regions: string[];
  countries: string[];
  tags: string[];
  sources: string[];
  searchQuery: string;
  categories: string[];
  threatLevels: ThreatLevel[];
  confidenceLevels: ConfidenceLevel[];
  actorTypes: ActorType[];
  timeRange: '1h' | '24h' | '7d' | 'custom';
}

export type ViewMode = 'map' | 'list' | 'timeline';
