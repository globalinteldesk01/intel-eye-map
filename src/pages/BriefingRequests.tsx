import { useEffect, useMemo, useState } from 'react';
import { Header } from '@/components/Header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { FileText, Calendar, Search, Plus, Inbox, Clock, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface Req {
  id: string;
  client_user_id: string;
  title: string;
  scope: string;
  countries: string[];
  regions: string[];
  deadline: string | null;
  priority: string;
  status: string;
  response_notes: string | null;
  created_at: string;
}

const STATUSES = ['pending', 'in_progress', 'delivered', 'closed'];
const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-destructive text-destructive-foreground',
  high: 'bg-orange-500 text-white',
  normal: 'bg-secondary',
  low: 'bg-muted text-muted-foreground',
};
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  in_progress: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  delivered: 'bg-green-500/15 text-green-400 border-green-500/30',
  closed: 'bg-muted text-muted-foreground border-border',
};

export default function BriefingRequests() {
  const { isAnalyst, role } = useUserRole();
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  // create form state (clients only)
  const [cTitle, setCTitle] = useState('');
  const [cScope, setCScope] = useState('');
  const [cCountries, setCCountries] = useState('');
  const [cRegions, setCRegions] = useState('');
  const [cDeadline, setCDeadline] = useState('');
  const [cPriority, setCPriority] = useState('normal');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from('briefing_requests')
      .select('*')
      .order('created_at', { ascending: false });
    setRows((data ?? []) as Req[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('briefing-requests-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'briefing_requests' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const stats = useMemo(() => ({
    total: rows.length,
    pending: rows.filter(r => r.status === 'pending').length,
    in_progress: rows.filter(r => r.status === 'in_progress').length,
    delivered: rows.filter(r => r.status === 'delivered').length,
    urgent: rows.filter(r => r.priority === 'urgent' && r.status !== 'closed' && r.status !== 'delivered').length,
  }), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.scope.toLowerCase().includes(q) ||
        r.countries.some(c => c.toLowerCase().includes(q)) ||
        r.regions.some(c => c.toLowerCase().includes(q))
      );
    });
  }, [rows, statusFilter, search]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('briefing_requests').update({ status }).eq('id', id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else toast({ title: 'Status updated' });
  };

  const saveNotes = async (id: string) => {
    const { error } = await supabase.from('briefing_requests')
      .update({ response_notes: notes[id] ?? '' }).eq('id', id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else toast({ title: 'Notes saved' });
  };

  const submitCreate = async () => {
    if (!user || !cTitle.trim() || !cScope.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from('briefing_requests').insert({
      client_user_id: user.id,
      title: cTitle.trim(),
      scope: cScope.trim(),
      countries: cCountries.split(',').map(s => s.trim()).filter(Boolean),
      regions: cRegions.split(',').map(s => s.trim()).filter(Boolean),
      deadline: cDeadline || null,
      priority: cPriority,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Briefing request submitted', description: 'An analyst will respond shortly.' });
    setCreateOpen(false);
    setCTitle(''); setCScope(''); setCCountries(''); setCRegions(''); setCDeadline(''); setCPriority('normal');
  };

  const canCreate = role === 'client';

  return (
    <div className="min-h-screen bg-background">
      <Header onToggleSidebar={() => {}} />
      <main className="p-6 max-w-6xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-bold">
                {isAnalyst ? 'Client Briefing Requests' : 'My Briefing Requests'}
              </h1>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isAnalyst
                ? 'Bespoke briefing jobs submitted by clients. Triage, assign status, and deliver analyst notes.'
                : 'Submit and track bespoke intelligence briefing requests handled by our analyst desk.'}
            </p>
          </div>
          {canCreate && (
            <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="w-4 h-4" /> New Briefing Request
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={<Inbox className="w-4 h-4" />} label="Total" value={stats.total} tone="default" />
          <StatCard icon={<Clock className="w-4 h-4" />} label="Pending" value={stats.pending} tone="yellow" />
          <StatCard icon={<Loader2 className="w-4 h-4" />} label="In Progress" value={stats.in_progress} tone="blue" />
          <StatCard icon={<CheckCircle2 className="w-4 h-4" />} label="Delivered" value={stats.delivered} tone="green" />
        </div>

        {stats.urgent > 0 && (
          <Card className="p-3 border-destructive/40 bg-destructive/10 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-destructive" />
            <span className="text-sm">
              <strong>{stats.urgent}</strong> urgent request{stats.urgent === 1 ? '' : 's'} awaiting action.
            </span>
          </Card>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              {STATUSES.map(s => (
                <TabsTrigger key={s} value={s} className="capitalize">{s.replace('_', ' ')}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search title, scope, country..."
              className="pl-8 h-9"
            />
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <Card className="p-8 text-center">
            <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="p-10 text-center space-y-3">
            <Inbox className="w-10 h-10 mx-auto text-muted-foreground/50" />
            {rows.length === 0 ? (
              <>
                <p className="text-sm font-medium">No briefing requests yet</p>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  {canCreate
                    ? 'Submit your first bespoke briefing request and our analyst desk will deliver a tailored intelligence report.'
                    : 'When clients submit bespoke briefing requests, they will appear here for triage and response.'}
                </p>
                {canCreate && (
                  <Button onClick={() => setCreateOpen(true)} className="gap-1.5 mt-2">
                    <Plus className="w-4 h-4" /> Submit First Request
                  </Button>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No requests match the current filter.</p>
            )}
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(r => (
              <Card key={r.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge className={PRIORITY_COLORS[r.priority] || ''}>{r.priority.toUpperCase()}</Badge>
                      <Badge variant="outline" className={STATUS_COLORS[r.status]}>{r.status.replace('_', ' ')}</Badge>
                      {r.deadline && (
                        <Badge variant="outline" className="gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(r.deadline), 'd MMM yyyy')}
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-semibold">{r.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{r.scope}</p>
                    <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                      {r.countries.length > 0 && <span>Countries: {r.countries.join(', ')}</span>}
                      {r.regions.length > 0 && <span>Regions: {r.regions.join(', ')}</span>}
                    </div>
                  </div>
                  {isAnalyst && (
                    <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v)}>
                      <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {isAnalyst && (
                  <div className="space-y-2 pt-2 border-t">
                    <Textarea
                      placeholder="Response notes for the client..."
                      defaultValue={r.response_notes ?? ''}
                      onChange={(e) => setNotes(n => ({ ...n, [r.id]: e.target.value }))}
                      rows={2}
                    />
                    <Button size="sm" onClick={() => saveNotes(r.id)}>Save Notes</Button>
                  </div>
                )}

                {!isAnalyst && r.response_notes && (
                  <div className="pt-2 border-t">
                    <p className="text-[10px] uppercase text-muted-foreground mb-1">Analyst Response</p>
                    <p className="text-sm whitespace-pre-wrap">{r.response_notes}</p>
                  </div>
                )}

                <p className="text-[10px] text-muted-foreground">
                  Submitted {format(new Date(r.created_at), 'd MMM yyyy HH:mm')}
                </p>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Create dialog (clients only) */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Briefing Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Briefing title</Label>
              <Input value={cTitle} onChange={e => setCTitle(e.target.value)} placeholder="e.g. Q2 Thailand political risk outlook" />
            </div>
            <div className="space-y-1.5">
              <Label>Scope & objectives</Label>
              <Textarea value={cScope} onChange={e => setCScope(e.target.value)} rows={4} placeholder="What questions should this briefing answer?" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Countries</Label>
                <Input value={cCountries} onChange={e => setCCountries(e.target.value)} placeholder="Thailand, Vietnam" />
              </div>
              <div className="space-y-1.5">
                <Label>Regions</Label>
                <Input value={cRegions} onChange={e => setCRegions(e.target.value)} placeholder="Southeast Asia" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Deadline</Label>
                <Input type="date" value={cDeadline} onChange={e => setCDeadline(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={cPriority} onValueChange={setCPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={submitCreate} disabled={submitting || !cTitle.trim() || !cScope.trim()}>
              {submitting ? 'Submitting…' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: 'default' | 'yellow' | 'blue' | 'green' }) {
  const toneClass = {
    default: 'text-foreground',
    yellow: 'text-yellow-400',
    blue: 'text-blue-400',
    green: 'text-green-400',
  }[tone];
  return (
    <Card className="p-3 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-md bg-muted/40 flex items-center justify-center ${toneClass}`}>{icon}</div>
      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className="text-xl font-semibold leading-tight">{value}</div>
      </div>
    </Card>
  );
}
