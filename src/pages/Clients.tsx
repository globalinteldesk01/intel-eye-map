import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useToast } from '@/hooks/use-toast';
import { Users, Plus, Trash2, Pencil, Shield } from 'lucide-react';
import { Navigate } from 'react-router-dom';

const ALL_SERVICES = [
  { key: 'intel_feed', label: 'Intel feed & map' },
  { key: 'alerts', label: 'Alerts & notifications' },
  { key: 'briefings', label: 'PDF briefings' },
  { key: 'travel', label: 'Travel risk module' },
  { key: 'bespoke', label: 'Bespoke briefing requests' },
];

interface AssignmentRow {
  id: string;
  client_user_id: string;
  countries: string[];
  regions: string[];
  services: string[];
  is_active: boolean;
  created_at: string;
  email?: string;
  display_name?: string;
}

export default function Clients() {
  const { user } = useAuth();
  const { isAnalyst, loading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AssignmentRow | null>(null);
  const [email, setEmail] = useState('');
  const [countries, setCountries] = useState('');
  const [regions, setRegions] = useState('');
  const [services, setServices] = useState<string[]>(ALL_SERVICES.map(s => s.key));
  const [busy, setBusy] = useState(false);

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

  const resetForm = () => {
    setEditing(null);
    setEmail(''); setCountries(''); setRegions('');
    setServices(ALL_SERVICES.map(s => s.key));
  };

  const openEdit = (row: AssignmentRow) => {
    setEditing(row);
    setEmail('');
    setCountries(row.countries.join(', '));
    setRegions(row.regions.join(', '));
    setServices(row.services);
    setOpen(true);
  };

  const save = async () => {
    if (!user) return;
    setBusy(true);

    const payloadCommon = {
      countries: countries.split(',').map(s => s.trim()).filter(Boolean),
      regions: regions.split(',').map(s => s.trim()).filter(Boolean),
      services,
    };

    if (editing) {
      const { error } = await supabase
        .from('client_assignments')
        .update(payloadCommon)
        .eq('id', editing.id);
      setBusy(false);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Client updated' });
    } else {
      // Look up user by email via profiles → display_name not unique; use a function-less fallback:
      // Since we cannot query auth.users, we rely on the client signing up first, then admin assigns.
      // We accept either an existing user_id (UUID) or display_name search via profiles.
      let clientUserId: string | null = null;
      // Try to find profile by display_name match OR direct UUID
      const trimmed = email.trim();
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
        clientUserId = trimmed;
      } else {
        const { data: prof } = await supabase
          .from('profiles').select('user_id').eq('display_name', trimmed).maybeSingle();
        clientUserId = prof?.user_id ?? null;
      }
      if (!clientUserId) {
        setBusy(false);
        toast({
          title: 'Client not found',
          description: 'Ask the client to sign up first, then enter their User ID or display name.',
          variant: 'destructive',
        });
        return;
      }
      // Assign client role
      await supabase.from('user_roles').insert({ user_id: clientUserId, role: 'client' as any });
      const { error } = await supabase.from('client_assignments').insert({
        client_user_id: clientUserId,
        analyst_user_id: user.id,
        ...payloadCommon,
      });
      setBusy(false);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Client assigned' });
    }
    setOpen(false); resetForm(); load();
  };

  const remove = async (row: AssignmentRow) => {
    if (!confirm('Remove this client assignment?')) return;
    const { error } = await supabase.from('client_assignments').delete().eq('id', row.id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Removed' }); load(); }
  };

  const toggleService = (key: string) => {
    setServices(s => s.includes(key) ? s.filter(x => x !== key) : [...s, key]);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onToggleSidebar={() => {}} />
      <main className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-bold">Client Management</h1>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Assign clients to specific countries, regions, and services. Clients only see intel that you publish to them.
            </p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" />Assign Client</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editing ? 'Edit Client Assignment' : 'Assign New Client'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                {!editing && (
                  <div className="space-y-1.5">
                    <Label>Client User ID or display name</Label>
                    <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="UUID or display name" />
                    <p className="text-[11px] text-muted-foreground">
                      The client must sign up first. Paste their User ID (from their profile) or exact display name.
                    </p>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>Countries (comma-separated)</Label>
                  <Input value={countries} onChange={e => setCountries(e.target.value)} placeholder="Thailand, Vietnam, Cambodia" />
                </div>
                <div className="space-y-1.5">
                  <Label>Regions (comma-separated)</Label>
                  <Input value={regions} onChange={e => setRegions(e.target.value)} placeholder="Southeast Asia, Middle East" />
                </div>
                <div className="space-y-1.5">
                  <Label>Services</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_SERVICES.map(s => {
                      const active = services.includes(s.key);
                      return (
                        <Badge
                          key={s.key}
                          variant={active ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => toggleService(s.key)}
                        >
                          {s.label}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={save} disabled={busy}>{editing ? 'Save Changes' : 'Assign Client'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <Card className="p-8 text-center">
            <Shield className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No clients assigned yet.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {rows.map(row => (
              <Card key={row.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-sm">{row.display_name || 'Unnamed client'}</p>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {row.client_user_id.slice(0, 8)}
                      </Badge>
                      {row.is_active && <Badge className="text-[10px]">Active</Badge>}
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs mt-2">
                      <div>
                        <p className="text-muted-foreground uppercase text-[10px] mb-1">Countries</p>
                        <p>{row.countries.length ? row.countries.join(', ') : '—'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground uppercase text-[10px] mb-1">Regions</p>
                        <p>{row.regions.length ? row.regions.join(', ') : '—'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground uppercase text-[10px] mb-1">Services</p>
                        <p>{row.services.length}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {row.services.map(s => (
                        <Badge key={s} variant="secondary" className="text-[10px]">
                          {ALL_SERVICES.find(x => x.key === s)?.label || s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(row)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(row)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
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
