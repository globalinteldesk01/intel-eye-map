export type CrisisSeverity = 'critical' | 'high' | 'medium' | 'low';
export type CrisisStatus = 'new' | 'verified' | 'active' | 'resolved';
export type CrisisCategory = 'Social' | 'News' | 'GovAlert' | 'Weather' | 'Traffic';
export type CrisisPipelineStage = 'ingestion' | 'classified' | 'geotagged' | 'verified';
export type CrisisAssetType = 'office' | 'warehouse' | 'employee' | 'supplier';

export interface CrisisEvent {
  id: string;
  title: string;
  summary: string;
  location: string;
  latitude: number;
  longitude: number;
  category: CrisisCategory;
  source_type: string;
  severity: CrisisSeverity;
  status: CrisisStatus;
  confidence: number;
  sources_count: number;
  affected_area: string;
  impacts: string[];
  actions: string[];
  pipeline_stage: CrisisPipelineStage;
  created_at: string;
  updated_at: string;
}

export interface CrisisAsset {
  id: string;
  user_id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radius_km: number;
  type: CrisisAssetType;
  created_at: string;
}

export interface CrisisAlertHistory {
  id: string;
  event_id: string;
  user_id: string;
  channels: string[];
  status: string;
  sent_at: string;
  crisis_events?: CrisisEvent;
}

export interface CrisisUserSettings {
  user_id: string;
  email: string;
  slack_webhook: string;
  sms_number: string;
  regions: string[];
  min_severity: CrisisSeverity;
  notify_email: boolean;
  notify_sms: boolean;
  notify_slack: boolean;
}

export const SEVERITY_COLORS: Record<CrisisSeverity, string> = {
  critical: '#ff4757',
  high: '#ffa502',
  medium: '#00d4ff',
  low: '#2ed573',
};

export const SEVERITY_BG: Record<CrisisSeverity, string> = {
  critical: 'bg-[#ff4757]',
  high: 'bg-[#ffa502]',
  medium: 'bg-[#00d4ff]',
  low: 'bg-[#2ed573]',
};

export const SEVERITY_TEXT: Record<CrisisSeverity, string> = {
  critical: 'text-[#ff4757]',
  high: 'text-[#ffa502]',
  medium: 'text-[#00d4ff]',
  low: 'text-[#2ed573]',
};

export const CATEGORY_COLORS: Record<CrisisCategory, string> = {
  Social: '#a855f7',
  News: '#3b82f6',
  GovAlert: '#ef4444',
  Weather: '#f59e0b',
  Traffic: '#14b8a6',
};

export const CATEGORY_BG: Record<CrisisCategory, string> = {
  Social: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  News: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  GovAlert: 'bg-red-500/20 text-red-400 border-red-500/30',
  Weather: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  Traffic: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
};

export const PIPELINE_STAGES: CrisisPipelineStage[] = ['ingestion', 'classified', 'geotagged', 'verified'];
