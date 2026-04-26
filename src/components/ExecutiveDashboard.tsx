import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NewsItem } from '@/types/news';
import { 
  AlertTriangle, 
  Shield, 
  TrendingUp, 
  Globe, 
  Activity,
  FileText,
  MapPin,
  Clock
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ExecutiveDashboardProps {
  newsItems: NewsItem[];
  loading?: boolean;
}

const threatLevelColors: Record<string, string> = {
  critical: 'bg-intel-red text-white',
  high: 'bg-orange-500 text-white',
  elevated: 'bg-intel-amber text-black',
  low: 'bg-intel-emerald text-white',
};

export function ExecutiveDashboard({ newsItems, loading }: ExecutiveDashboardProps) {
  const stats = useMemo(() => {
    const now = new Date();
    const last24h = newsItems.filter(item => {
      const itemDate = new Date(item.publishedAt);
      return (now.getTime() - itemDate.getTime()) < 24 * 60 * 60 * 1000;
    });

    const criticalItems = newsItems.filter(i => i.threatLevel === 'critical');
    const highItems = newsItems.filter(i => i.threatLevel === 'high');
    const verifiedCount = newsItems.filter(i => i.confidenceLevel === 'verified').length;

    // Regional breakdown
    const regions = newsItems.reduce((acc, item) => {
      acc[item.region] = (acc[item.region] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Category breakdown
    const categories = newsItems.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalReports: newsItems.length,
      last24h: last24h.length,
      criticalItems,
      highItems,
      verifiedCount,
      avgConfidence: newsItems.reduce((acc, i) => acc + i.confidenceScore, 0) / newsItems.length || 0,
      regions: Object.entries(regions).sort((a, b) => b[1] - a[1]).slice(0, 5),
      categories: Object.entries(categories).sort((a, b) => b[1] - a[1]),
    };
  }, [newsItems]);

  const priorityAlerts = useMemo(() => {
    return [...stats.criticalItems, ...stats.highItems]
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 5);
  }, [stats.criticalItems, stats.highItems]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="h-28 animate-pulse bg-muted/50" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      {/* Executive Summary Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Executive Briefing</h2>
          <p className="text-sm text-muted-foreground">
            High-level intelligence summary • Updated {formatDistanceToNow(new Date(), { addSuffix: true })}
          </p>
        </div>
        <Badge variant="outline" className="text-xs font-mono">
          <Activity className="w-3 h-3 mr-1" />
          LIVE
        </Badge>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase">Total Reports</p>
                <p className="text-3xl font-bold">{stats.totalReports}</p>
                <p className="text-xs text-intel-emerald">+{stats.last24h} today</p>
              </div>
              <div className="p-3 rounded-xl bg-primary/10">
                <FileText className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-intel-red/10 to-transparent border-intel-red/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase">Critical Alerts</p>
                <p className="text-3xl font-bold text-intel-red">{stats.criticalItems.length}</p>
                <p className="text-xs text-muted-foreground">Requires immediate attention</p>
              </div>
              <div className="p-3 rounded-xl bg-intel-red/20">
                <AlertTriangle className="w-6 h-6 text-intel-red" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-intel-emerald/10 to-transparent border-intel-emerald/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase">Verified Intel</p>
                <p className="text-3xl font-bold text-intel-emerald">{stats.verifiedCount}</p>
                <p className="text-xs text-muted-foreground">
                  {Math.round((stats.verifiedCount / stats.totalReports) * 100) || 0}% verified rate
                </p>
              </div>
              <div className="p-3 rounded-xl bg-intel-emerald/20">
                <Shield className="w-6 h-6 text-intel-emerald" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-intel-amber/10 to-transparent border-intel-amber/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase">Confidence Score</p>
                <p className="text-3xl font-bold text-intel-amber">{Math.round(stats.avgConfidence * 100)}%</p>
                <p className="text-xs text-muted-foreground">Average across sources</p>
              </div>
              <div className="p-3 rounded-xl bg-intel-amber/20">
                <TrendingUp className="w-6 h-6 text-intel-amber" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Priority Alerts */}
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-intel-red" />
              Priority Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {priorityAlerts.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No critical or high priority alerts</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {priorityAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="p-3 rounded-lg bg-secondary/30 border border-border/50 hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <Badge className={`${threatLevelColors[alert.threatLevel]} text-[10px] uppercase`}>
                          {alert.threatLevel}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(alert.publishedAt), { addSuffix: true })}
                        </span>
                      </div>
                      <h4 className="font-medium text-sm mb-1 line-clamp-2">{alert.title}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-2">{alert.summary}</p>
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        {alert.country} • {alert.region}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Regional Overview */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              Regional Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.regions.map(([region, count]) => (
                <div key={region} className="flex items-center justify-between">
                  <span className="text-sm">{region}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${(count / stats.totalReports) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-border/50">
              <h4 className="text-sm font-medium mb-3">By Category</h4>
              <div className="flex flex-wrap gap-2">
                {stats.categories.map(([category, count]) => (
                  <Badge key={category} variant="secondary" className="text-xs">
                    {category}: {count}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Insights */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Key Takeaways</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
              <h4 className="font-medium text-sm mb-2">Threat Landscape</h4>
              <p className="text-xs text-muted-foreground">
                {stats.criticalItems.length + stats.highItems.length} high-priority situations require monitoring.
                {stats.criticalItems.length > 0 && ` ${stats.criticalItems.length} critical alerts need immediate review.`}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
              <h4 className="font-medium text-sm mb-2">Intelligence Quality</h4>
              <p className="text-xs text-muted-foreground">
                {Math.round((stats.verifiedCount / stats.totalReports) * 100) || 0}% of reports are verified.
                Average confidence across all sources is {Math.round(stats.avgConfidence * 100)}%.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
              <h4 className="font-medium text-sm mb-2">Activity Trend</h4>
              <p className="text-xs text-muted-foreground">
                {stats.last24h} new reports in the last 24 hours.
                Most active region: {stats.regions[0]?.[0] || 'N/A'}.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
