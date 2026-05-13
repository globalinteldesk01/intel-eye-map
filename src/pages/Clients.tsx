import { useEffect, useMemo, useState } from 'react';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useToast } from '@/hooks/use-toast';
import {
  Users, Plus, Trash2, Pencil, Shield, Search, Mail, Globe2, Plane,
  Copy, CheckCircle2, XCircle, Building2, Send, AlertCircle, MapPin,
} from 'lucide-react';
import { Navigate } from 'react-router-dom';

const ALL_SERVICES = [
  { key: 'intel_feed', label: 'Intel feed & map', icon: Globe2 },
  { key: 'alerts', label: 'Real-time alerts', icon: AlertCircle },
  { key: 'briefings', label: 'PDF briefings', icon: Shield },
  { key: 'travel', label: 'Travel security', icon: Plane },
  { key: 'bespoke', label: 'Bespoke requests', icon: Send },
];

const REGION_PRESETS: Record<string, string[]> = {
  'Southeast Asia': ['Thailand', 'Vietnam', 'Indonesia', 'Philippines', 'Malaysia', 'Singapore', 'Cambodia', 'Myanmar', 'Laos'],
  'Middle East': ['Saudi Arabia', 'UAE', 'Israel', 'Iran', 'Iraq', 'Jordan', 'Lebanon', 'Qatar', 'Yemen'],
  'Europe': ['United Kingdom', 'Germany', 'France', 'Italy', 'Spain', 'Poland', 'Ukraine', 'Netherlands'],
  'Africa': ['Nigeria', 'Kenya', 'South Africa', 'Egypt', 'Ethiopia', 'Morocco', 'Sudan', 'DRC'],
  'Americas': ['United States', 'Mexico', 'Brazil', 'Colombia', 'Argentina', 'Venezuela', 'Canada', 'Chile'],
  'East Asia': ['China', 'Japan', 'South Korea', 'Taiwan', 'North Korea', 'Mongolia'],
  'South Asia': ['India', 'Pakistan', 'Bangladesh', 'Sri Lanka', 'Afghanistan', 'Nepal'],
};

interface AssignmentRow {
  id: string;
  client_user_id: string;
  countries: string[];
  regions: string[];
  services: string[];
  is_active: boolean;
  created_at: string;
  display_name?: string;
}

export default function Clients() {
  const { user } = useAuth();
  const { isAnalyst, loading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'travel'>('all');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AssignmentRow | null>(null);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [organization, setOrganization] = useState('');
  const [welcomeNote, setWelcomeNote] = useState('');
  const [countriesInput, setCountriesInput] = useState('');
  const [regions, setRegions] = useState<string[]>([]);
  const [services, setServices] = useState<string[]>(ALL_SERVICES.map(s => s.key));
  const [travelFocus, setTravelFocus] = useState(true);
  const [busy, setBusy] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: assignments } = await supabase
      .from('client_assignments')
      .select('*')
      .order('created_at', { ascending: false });
    if (!assignments) { setRows([]); setLoading(false); return; }
    const ids = assignments.map(a => a.client_user_id);
    const { data: profiles } = await supabase
      .from('profiles').select('user_id, display_name').in('user_id', ids);
    const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p.display_name]));
    setRows(assignments.map(a => ({ ...a, display_name: profileMap.get(a.client_user_id) ?? undefined })));
    setLoading(false);
  };

  useEffect(() => {
    if (isAnalyst) load();
  }, [isAnalyst]);

  if (!roleLoading && !isAnalyst) return <Navigate to="/" replace />;

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter(r => r.is_active).length;
    const travel = rows.filter(r => r.services.includes('travel')).length;
    const countries = new Set(rows.flatMap(r => r.countries)).size;
    return { total, active, travel, countries };
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (statusFilter === 'active' && !r.is_active) return false;
      if (statusFilter === 'inactive' && r.is_active) return false;
      if (statusFilter === 'travel' && !r.services.includes('travel')) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = [
          r.display_name ?? '',
          ...r.countries,
          ...r.regions,
          ...r.services,
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter]);

  const resetForm = () => {
    setEditing(null);
    setEmail(''); setDisplayName(''); setOrganization(''); setWelcomeNote('');
    setCountriesInput(''); setRegions([]);
    setServices(ALL_SERVICES.map(s => s.key));
    setTravelFocus(true);
    setInviteLink(null);
  };

  const openEdit = (row: AssignmentRow) => {
    setEditing(row);
    setEmail(''); setDisplayName(row.display_name ?? ''); setOrganization('');
    setWelcomeNote('');
    setCountriesInput(row.countries.join(', '));
    setRegions(row.regions);
    setServices(row.services);
    setTravelFocus(row.services.includes('travel'));
    setInviteLink(null);
    setOpen(true);
  };

  const toggleRegion = (r: string) => {
    setRegions(s => s.includes(r) ? s.filter(x => x !== r) : [...s, r]);
    // Auto-add countries for the region
    const preset = REGION_PRESETS[r];
    if (preset && !regions.includes(r)) {
      const current = countriesInput.split(',').map(s => s.trim()).filter(Boolean);
      const merged = Array.from(new Set([...current, ...preset]));
      setCountriesInput(merged.join(', '));
    }
  };

  const toggleService = (key: string) => {
    setServices(s => s.includes(key) ? s.filter(x => x !== key) : [...s, key]);
    if (key === 'travel') setTravelFocus(!services.includes('travel'));
  };

  const buildServices = () => {
    const set = new Set(services);
    if (travelFocus) set.add('travel'); else set.delete('travel');
    return Array.from(set);
  };

  const save = async () => {
    if (!user) return;
    const parsedCountries = countriesInput.split(',').map(s => s.trim()).filter(Boolean);
    const finalServices = buildServices();

    setBusy(true);
    if (editing) {
      const { error } = await supabase
        .from('client_assignments')
        .update({ countries: parsedCountries, regions, services: finalServices })
        .eq('id', editing.id);
      setBusy(false);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Client updated' });
      setOpen(false); resetForm(); load();
      return;
    }

    if (!email.trim()) {
      setBusy(false);
      toast({ title: 'Email required', variant: 'destructive' });
      return;
    }

    const redirectTo = `${window.location.origin}/auth`;
    const { data, error } = await supabase.functions.invoke('analyst-invite-client', {
      body: {
        email: email.trim(),
        display_name: displayName.trim() || null,
        organization: organization.trim() || null,
        welcome_note: welcomeNote.trim() || null,
        countries: parsedCountries,
        regions,
        services: finalServices,
        redirect_to: redirectTo,
      },
    });
    setBusy(false);

    if (error || (data as any)?.error) {
      toast({
        title: 'Invite failed',
        description: (data as any)?.error || error?.message || 'Unknown error',
        variant: 'destructive',
      });
      return;
    }

    if ((data as any)?.invite_link) setInviteLink((data as any).invite_link);
    toast({
      title: (data as any)?.already_existed ? 'Client linked' : 'Invitation sent',
      description: (data as any)?.already_existed
        ? 'Existing user updated. A magic-link is available below.'
        : `Invitation email sent to ${email.trim()}.`,
    });
    load();
    if (!(data as any)?.invite_link) {
      setOpen(false); resetForm();
    }
  };

  const toggleActive = async (row: AssignmentRow) => {
    const { error } = await supabase
      .from('client_assignments')
      .update({ is_active: !row.is_active })
      .eq('id', row.id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: row.is_active ? 'Deactivated' : 'Reactivated' }); load(); }
  };

  const remove = async (row: AssignmentRow) => {
    if (!confirm('Remove this client assignment? Their account stays but loses access.')) return;
    const { error } = await supabase.from('client_assignments').delete().eq('id', row.id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Removed' }); load(); }
  };

  const copyLink = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    toast({ title: 'Link copied' });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onToggleSidebar={() => {}} />
      <main className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight">Client Operations</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Onboard international clients, scope their intelligence coverage, and deliver travel security analysis with one workflow.
            </p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" />Invite Client</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editing ? 'Edit Client Coverage' : 'Invite a New Client'}</DialogTitle>
                <DialogDescription>
                  {editing
                    ? 'Update countries, regions and services for this client.'
                    : 'Send a secure magic-link invite. The client signs in with email — no password setup needed.'}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-2">
                {!editing && (
                  <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Mail className="w-3.5 h-3.5" /> Contact
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Email <span className="text-destructive">*</span></Label>
                        <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="security@client.com" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Full name</Label>
                        <Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Jane Doe" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Organization</Label>
                      <Input value={organization} onChange={e => setOrganization(e.target.value)} placeholder="Acme Corp / Embassy / NGO" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Welcome note (optional)</Label>
                      <Textarea rows={2} value={welcomeNote} onChange={e => setWelcomeNote(e.target.value)} placeholder="Short intro shown on first sign-in." />
                    </div>
                  </div>
                )}

                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Globe2 className="w-3.5 h-3.5" /> Coverage scope
                  </div>
                  <div className="space-y-1.5">
                    <Label>Regions (click to add countries)</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.keys(REGION_PRESETS).map(r => {
                        const active = regions.includes(r);
                        return (
                          <Badge
                            key={r}
                            variant={active ? 'default' : 'outline'}
                            className="cursor-pointer"
                            onClick={() => toggleRegion(r)}
                          >
                            {active ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <MapPin className="w-3 h-3 mr-1" />}
                            {r}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Countries (comma-separated)</Label>
                    <Textarea
                      rows={2}
                      value={countriesInput}
                      onChange={e => setCountriesInput(e.target.value)}
                      placeholder="Thailand, Vietnam, Saudi Arabia"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Client will receive intel and alerts only for these countries / regions.
                    </p>
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Plane className="w-3.5 h-3.5" /> Travel security module
                    </div>
                    <Switch checked={travelFocus} onCheckedChange={setTravelFocus} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Enables itinerary risk assessments, in-trip alerts, country playbooks and emergency response briefings for this client.
                  </p>
                </div>

                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Shield className="w-3.5 h-3.5" /> Services
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_SERVICES.map(s => {
                      const active = services.includes(s.key);
                      const Icon = s.icon;
                      return (
                        <Badge
                          key={s.key}
                          variant={active ? 'default' : 'outline'}
                          className="cursor-pointer gap-1"
                          onClick={() => toggleService(s.key)}
                        >
                          <Icon className="w-3 h-3" />
                          {s.label}
                        </Badge>
                      );
                    })}
                  </div>
                </div>

                {inviteLink && (
                  <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2">
                    <p className="text-xs font-semibold">Magic-link sign-in</p>
                    <div className="flex gap-2">
                      <Input value={inviteLink} readOnly className="text-xs font-mono" />
                      <Button size="icon" variant="outline" onClick={copyLink}><Copy className="w-4 h-4" /></Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Share this single-use link with the client over a secure channel.</p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
                <Button onClick={save} disabled={busy}>
                  {busy ? 'Working…' : editing ? 'Save changes' : 'Send invitation'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total clients" value={stats.total} icon={Users} />
          <StatCard label="Active" value={stats.active} icon={CheckCircle2} accent="text-emerald-400" />
          <StatCard label="Travel security" value={stats.travel} icon={Plane} accent="text-sky-400" />
          <StatCard label="Countries covered" value={stats.countries} icon={Globe2} accent="text-amber-400" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, country, region, service…"
              className="pl-9"
            />
          </div>
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="travel">Travel</TabsTrigger>
              <TabsTrigger value="inactive">Inactive</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* List */}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <Card className="p-10 text-center">
            <Shield className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">
              {rows.length === 0 ? 'No clients yet' : 'No clients match your filters'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {rows.length === 0
                ? 'Invite your first international client to begin delivering intelligence.'
                : 'Try clearing the search or switching tabs.'}
            </p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filtered.map(row => (
              <Card key={row.id} className="p-4 hover:border-primary/50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{row.display_name || 'Unnamed client'}</p>
                      {row.is_active ? (
                        <Badge className="text-[10px] gap-1 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/15 border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
                          <XCircle className="w-3 h-3" /> Inactive
                        </Badge>
                      )}
                      {row.services.includes('travel') && (
                        <Badge className="text-[10px] gap-1 bg-sky-500/15 text-sky-300 hover:bg-sky-500/15 border-sky-500/30">
                          <Plane className="w-3 h-3" /> Travel security
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
                        {row.client_user_id.slice(0, 8)}
                      </Badge>
                    </div>

                    <div className="grid sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <p className="text-muted-foreground uppercase text-[10px] mb-1">Countries ({row.countries.length})</p>
                        <p className="line-clamp-2">{row.countries.length ? row.countries.join(', ') : '—'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground uppercase text-[10px] mb-1">Regions ({row.regions.length})</p>
                        <p className="line-clamp-2">{row.regions.length ? row.regions.join(', ') : '—'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground uppercase text-[10px] mb-1">Onboarded</p>
                        <p>{new Date(row.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {row.services.map(s => {
                        const meta = ALL_SERVICES.find(x => x.key === s);
                        const Icon = meta?.icon ?? Shield;
                        return (
                          <Badge key={s} variant="secondary" className="text-[10px] gap-1">
                            <Icon className="w-3 h-3" />
                            {meta?.label || s}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <Button variant="ghost" size="icon" title="Edit" onClick={() => openEdit(row)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      title={row.is_active ? 'Deactivate' : 'Reactivate'}
                      onClick={() => toggleActive(row)}
                    >
                      {row.is_active ? <XCircle className="w-4 h-4 text-amber-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    </Button>
                    <Button variant="ghost" size="icon" title="Remove" onClick={() => remove(row)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, accent = 'text-primary',
}: { label: string; value: number; icon: any; accent?: string }) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className={`p-2 rounded-md bg-muted/40 ${accent}`}><Icon className="w-5 h-5" /></div>
      <div>
        <p className="text-2xl font-bold leading-none">{value}</p>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1">{label}</p>
      </div>
    </Card>
  );
}
