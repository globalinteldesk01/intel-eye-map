import { useMemo, useState } from 'react';
import { CrisisLayout } from '../components/CrisisLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShieldAlert, Plus, Trash2, MapPin, Building2, Plane, Hexagon, CheckCircle2, X } from 'lucide-react';
import { useProtectiveAlerts, ProtectiveAlert } from '../hooks/useProtectiveAlerts';
import { useProtectiveGeofences } from '../hooks/useProtectiveGeofences';
import { useCrisisAssets } from '../hooks/useCrisisAssets';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import { SEVERITY_COLORS, SEVERITY_TEXT } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

const SOURCE_ICON = { asset: Building2, traveler: Plane, geofence: Hexagon };

function AlertRow({ a, onRead, onDismiss }: { a: ProtectiveAlert; onRead: (id: string) => void; onDismiss: (id: string) => void }) {
  const Icon = SOURCE_ICON[a.source_kind];
  return (
    <div className={`flex items-start gap-3 p-3 rounded border ${a.is_read ? 'opacity-50' : ''}`} style={{ background: '#181c22', borderColor: 'rgba(255,255,255,0.07)', borderLeftWidth: 3, borderLeftColor: SEVERITY_COLORS[a.severity] }}>
      <div className="mt-0.5"><Icon className="w-4 h-4 text-white/50" /></div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-mono uppercase font-bold ${SEVERITY_TEXT[a.severity]}`}>{a.severity}</span>
          <span className="text-[10px] font-mono uppercase text-white/40">{a.source_kind}</span>
          <span className="text-sm text-white/85 truncate">{a.source_name}</span>
        </div>
        <div className="text-[11px] font-mono text-white/40 mt-1">
          {a.distance_km !== null && <span>{a.distance_km.toFixed(1)} km away · </span>}
          {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {!a.is_read && (
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-white/40 hover:text-[#00d4ff]" onClick={() => onRead(a.id)}>
            <CheckCircle2 className="w-3.5 h-3.5" />
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-white/40 hover:text-[#ff4757]" onClick={() => onDismiss(a.id)}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

function GeofencesTab() {
  const { geofences, create, update, remove } = useProtectiveGeofences();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', center_lat: '', center_lon: '', radius_km: '10', min_severity: 'medium' as 'critical' | 'high' | 'medium' | 'low' });

  const handleAdd = async () => {
    if (!form.name || !form.center_lat || !form.center_lon) {
      toast({ title: 'Missing fields', description: 'Name and coordinates required', variant: 'destructive' });
      return;
    }
    await create({
      name: form.name,
      shape: 'circle',
      center_lat: parseFloat(form.center_lat),
      center_lon: parseFloat(form.center_lon),
      radius_km: parseFloat(form.radius_km),
      polygon: null,
      min_severity: form.min_severity,
      is_active: true,
    });
    setForm({ name: '', center_lat: '', center_lon: '', radius_km: '10', min_severity: 'medium' });
    setOpen(false);
    toast({ title: 'Geofence created' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-white/40 font-mono">Custom watch zones — get alerts when events occur inside.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 text-xs bg-[#00d4ff] text-black hover:bg-[#00d4ff]/80"><Plus className="w-3.5 h-3.5" />Add Geofence</Button>
          </DialogTrigger>
          <DialogContent style={{ background: '#181c22', borderColor: 'rgba(255,255,255,0.1)' }} className="text-white">
            <DialogHeader><DialogTitle>New Geofence (Circle)</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Name (e.g., Jakarta CBD)" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Latitude" type="number" value={form.center_lat} onChange={e => setForm(f => ({ ...f, center_lat: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
                <Input placeholder="Longitude" type="number" value={form.center_lon} onChange={e => setForm(f => ({ ...f, center_lon: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
              </div>
              <Input placeholder="Radius (km)" type="number" value={form.radius_km} onChange={e => setForm(f => ({ ...f, radius_km: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
              <Select value={form.min_severity} onValueChange={v => setForm(f => ({ ...f, min_severity: v as typeof f.min_severity }))}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="critical">Critical only</SelectItem><SelectItem value="high">High +</SelectItem><SelectItem value="medium">Medium +</SelectItem><SelectItem value="low">All</SelectItem></SelectContent>
              </Select>
              <Button onClick={handleAdd} className="w-full bg-[#00d4ff] text-black hover:bg-[#00d4ff]/80">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.07] hover:bg-transparent">
              <TableHead className="text-white/40 font-mono text-xs">Name</TableHead>
              <TableHead className="text-white/40 font-mono text-xs">Center</TableHead>
              <TableHead className="text-white/40 font-mono text-xs">Radius</TableHead>
              <TableHead className="text-white/40 font-mono text-xs">Min Severity</TableHead>
              <TableHead className="text-white/40 font-mono text-xs">Active</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {geofences.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-white/30 py-8 font-mono">No geofences yet.</TableCell></TableRow>
            ) : geofences.map(g => (
              <TableRow key={g.id} className="border-white/[0.07]" style={{ background: '#181c22' }}>
                <TableCell className="text-white/80 text-sm">{g.name}</TableCell>
                <TableCell className="text-white/50 text-xs font-mono">{g.center_lat?.toFixed(3)}, {g.center_lon?.toFixed(3)}</TableCell>
                <TableCell className="text-white/50 text-xs font-mono">{g.radius_km} km</TableCell>
                <TableCell><span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white/5 ${SEVERITY_TEXT[g.min_severity]}`}>{g.min_severity}</span></TableCell>
                <TableCell><Switch checked={g.is_active} onCheckedChange={v => update(g.id, { is_active: v })} /></TableCell>
                <TableCell><Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-white/30 hover:text-[#ff4757]" onClick={() => remove(g.id)}><Trash2 className="w-3.5 h-3.5" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function AssetsTab() {
  const { assets, deleteAsset } = useCrisisAssets();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-white/40 font-mono">Your saved offices, warehouses, employees and suppliers.</p>
        <Link to="/crisiswatch/assets"><Button variant="outline" className="text-xs border-white/10 text-white/70 hover:bg-white/5">Manage Assets</Button></Link>
      </div>
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.07] hover:bg-transparent">
              <TableHead className="text-white/40 font-mono text-xs">Name</TableHead>
              <TableHead className="text-white/40 font-mono text-xs">Type</TableHead>
              <TableHead className="text-white/40 font-mono text-xs">Location</TableHead>
              <TableHead className="text-white/40 font-mono text-xs">Radius</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-white/30 py-8 font-mono">No assets yet.</TableCell></TableRow>
            ) : assets.map(a => (
              <TableRow key={a.id} className="border-white/[0.07]" style={{ background: '#181c22' }}>
                <TableCell className="text-white/80 text-sm">{a.name}</TableCell>
                <TableCell><span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white/5 text-white/50">{a.type}</span></TableCell>
                <TableCell className="text-white/50 text-xs font-mono">{Number(a.latitude).toFixed(3)}, {Number(a.longitude).toFixed(3)}</TableCell>
                <TableCell className="text-white/50 text-xs font-mono">{a.radius_km} km</TableCell>
                <TableCell><Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-white/30 hover:text-[#ff4757]" onClick={() => deleteAsset(a.id)}><Trash2 className="w-3.5 h-3.5" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

interface TravelMonitorRow {
  id: string;
  name: string;
  countries: string[];
  cities: string[];
  severity_threshold: string;
  status: string;
  started_at: string;
}

function TravelersTab() {
  const { user } = useAuth();
  const [monitors, setMonitors] = useState<TravelMonitorRow[]>([]);
  useEffect(() => {
    if (!user) return;
    supabase.from('travel_monitors').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setMonitors(data as TravelMonitorRow[]); });
  }, [user]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-white/40 font-mono">Active itinerary monitors generating proximity alerts.</p>
        <Link to="/crisiswatch/itinerary-map"><Button variant="outline" className="text-xs border-white/10 text-white/70 hover:bg-white/5">Manage Itineraries</Button></Link>
      </div>
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.07] hover:bg-transparent">
              <TableHead className="text-white/40 font-mono text-xs">Name</TableHead>
              <TableHead className="text-white/40 font-mono text-xs">Countries</TableHead>
              <TableHead className="text-white/40 font-mono text-xs">Threshold</TableHead>
              <TableHead className="text-white/40 font-mono text-xs">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {monitors.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-white/30 py-8 font-mono">No active travel monitors.</TableCell></TableRow>
            ) : monitors.map(m => (
              <TableRow key={m.id} className="border-white/[0.07]" style={{ background: '#181c22' }}>
                <TableCell className="text-white/80 text-sm">{m.name}</TableCell>
                <TableCell className="text-white/50 text-xs">{m.countries?.join(', ') || '—'}</TableCell>
                <TableCell><span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white/5 text-white/60">{m.severity_threshold}</span></TableCell>
                <TableCell><Badge variant="outline" className={`text-[10px] font-mono ${m.status === 'active' ? 'border-[#2ed573]/40 text-[#2ed573]' : 'border-white/10 text-white/40'}`}>{m.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function ProtectiveMonitoring() {
  const { alerts, loading, markRead, dismiss } = useProtectiveAlerts();
  const stats = useMemo(() => ({
    total: alerts.length,
    unread: alerts.filter(a => !a.is_read).length,
    critical: alerts.filter(a => a.severity === 'critical').length,
    asset: alerts.filter(a => a.source_kind === 'asset').length,
    traveler: alerts.filter(a => a.source_kind === 'traveler').length,
    geofence: alerts.filter(a => a.source_kind === 'geofence').length,
  }), [alerts]);

  return (
    <CrisisLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-[#00d4ff]" />
          <div>
            <h1 className="text-xl font-bold text-white">Protective Monitoring</h1>
            <p className="text-xs text-white/40 font-mono">Unified watch surface — assets, travelers, geofences.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          {[
            { label: 'Total', value: stats.total, color: 'text-white' },
            { label: 'Unread', value: stats.unread, color: 'text-[#00d4ff]' },
            { label: 'Critical', value: stats.critical, color: 'text-[#ff4757]' },
            { label: 'Assets', value: stats.asset, color: 'text-white/70' },
            { label: 'Travelers', value: stats.traveler, color: 'text-white/70' },
            { label: 'Geofences', value: stats.geofence, color: 'text-white/70' },
          ].map(s => (
            <div key={s.label} className="rounded-lg border p-3" style={{ background: '#181c22', borderColor: 'rgba(255,255,255,0.07)' }}>
              <div className="text-[10px] font-mono uppercase text-white/40">{s.label}</div>
              <div className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        <Tabs defaultValue="alerts" className="space-y-4">
          <TabsList style={{ background: '#181c22' }} className="border border-white/[0.07]">
            <TabsTrigger value="alerts" className="data-[state=active]:bg-[#00d4ff]/10 data-[state=active]:text-[#00d4ff]">Live Alerts</TabsTrigger>
            <TabsTrigger value="assets" className="data-[state=active]:bg-[#00d4ff]/10 data-[state=active]:text-[#00d4ff]">Assets</TabsTrigger>
            <TabsTrigger value="travelers" className="data-[state=active]:bg-[#00d4ff]/10 data-[state=active]:text-[#00d4ff]">Travelers</TabsTrigger>
            <TabsTrigger value="geofences" className="data-[state=active]:bg-[#00d4ff]/10 data-[state=active]:text-[#00d4ff]">Geofences</TabsTrigger>
          </TabsList>

          <TabsContent value="alerts">
            <ScrollArea className="h-[calc(100vh-380px)]">
              <div className="space-y-2 pr-2">
                {loading ? (
                  <div className="text-center text-white/30 py-12 font-mono text-sm">Loading…</div>
                ) : alerts.length === 0 ? (
                  <div className="text-center text-white/30 py-12 font-mono text-sm">
                    <MapPin className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    No alerts yet — add an asset, traveler, or geofence to start monitoring.
                  </div>
                ) : alerts.map(a => <AlertRow key={a.id} a={a} onRead={markRead} onDismiss={dismiss} />)}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="assets"><AssetsTab /></TabsContent>
          <TabsContent value="travelers"><TravelersTab /></TabsContent>
          <TabsContent value="geofences"><GeofencesTab /></TabsContent>
        </Tabs>
      </div>
    </CrisisLayout>
  );
}