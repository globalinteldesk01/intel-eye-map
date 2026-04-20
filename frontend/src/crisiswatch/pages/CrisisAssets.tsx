import { useState } from 'react';
import { CrisisLayout } from '../components/CrisisLayout';
import { useCrisisAssets } from '../hooks/useCrisisAssets';
import { useCrisisEvents } from '../hooks/useCrisisEvents';
import { CrisisAsset } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Upload, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function CrisisAssets() {
  const { assets, loading, addAsset, deleteAsset } = useCrisisAssets();
  const { events } = useCrisisEvents();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', latitude: '', longitude: '', radius_km: '5', type: 'office' as CrisisAsset['type'] });

  const nearbyAlerts = (asset: CrisisAsset) => events.filter(e =>
    (e.severity === 'critical' || e.severity === 'high') &&
    e.latitude && e.longitude &&
    haversineKm(asset.latitude, asset.longitude, e.latitude, e.longitude) <= asset.radius_km
  ).length;

  const handleAdd = async () => {
    if (!form.name || !form.latitude || !form.longitude) { toast({ title: 'Error', description: 'Name and coordinates required', variant: 'destructive' }); return; }
    await addAsset({ name: form.name, address: form.address, latitude: parseFloat(form.latitude), longitude: parseFloat(form.longitude), radius_km: parseFloat(form.radius_km), type: form.type });
    setForm({ name: '', address: '', latitude: '', longitude: '', radius_km: '5', type: 'office' });
    setOpen(false);
    toast({ title: 'Asset Added' });
  };

  return (
    <CrisisLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Asset Manager</h1>
            <p className="text-xs text-white/40 font-mono">Manage organization locations, employees, and watchlist zones</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 text-xs border-white/10 text-white/50 hover:bg-white/5">
              <Upload className="w-3.5 h-3.5" />CSV Import
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 text-xs bg-[#00d4ff] text-black hover:bg-[#00d4ff]/80"><Plus className="w-3.5 h-3.5" />Add Asset</Button>
              </DialogTrigger>
              <DialogContent style={{ background: '#181c22', borderColor: 'rgba(255,255,255,0.1)' }} className="text-white">
                <DialogHeader><DialogTitle>Add Asset</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Input placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
                  <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as any }))}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="office">Office</SelectItem><SelectItem value="warehouse">Warehouse</SelectItem><SelectItem value="employee">Employee</SelectItem><SelectItem value="supplier">Supplier</SelectItem></SelectContent>
                  </Select>
                  <Input placeholder="Address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Latitude" type="number" value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
                    <Input placeholder="Longitude" type="number" value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
                  </div>
                  <Input placeholder="Radius (km)" type="number" value={form.radius_km} onChange={e => setForm(f => ({ ...f, radius_km: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
                  <Button onClick={handleAdd} className="w-full bg-[#00d4ff] text-black hover:bg-[#00d4ff]/80">Add Asset</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.07] hover:bg-transparent">
                <TableHead className="text-white/40 font-mono text-xs">Name</TableHead>
                <TableHead className="text-white/40 font-mono text-xs">Type</TableHead>
                <TableHead className="text-white/40 font-mono text-xs">Address</TableHead>
                <TableHead className="text-white/40 font-mono text-xs">Radius</TableHead>
                <TableHead className="text-white/40 font-mono text-xs">Nearby Alerts</TableHead>
                <TableHead className="text-white/40 font-mono text-xs w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-white/30 py-8 font-mono">Loading...</TableCell></TableRow>
              ) : assets.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-white/30 py-8 font-mono">No assets yet. Add your first asset above.</TableCell></TableRow>
              ) : assets.map(asset => {
                const nearby = nearbyAlerts(asset);
                return (
                  <TableRow key={asset.id} className="border-white/[0.07]" style={{ background: '#181c22' }}>
                    <TableCell className="text-white/80 text-sm">{asset.name}</TableCell>
                    <TableCell><span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white/5 text-white/50">{asset.type}</span></TableCell>
                    <TableCell className="text-white/50 text-xs">{asset.address || '—'}</TableCell>
                    <TableCell className="text-white/50 text-xs font-mono">{asset.radius_km} km</TableCell>
                    <TableCell>{nearby > 0 ? <span className="flex items-center gap-1 text-[#ff4757] text-xs font-mono"><AlertTriangle className="w-3 h-3" />{nearby}</span> : <span className="text-white/30 text-xs">0</span>}</TableCell>
                    <TableCell><Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-white/30 hover:text-[#ff4757]" onClick={() => deleteAsset(asset.id)}><Trash2 className="w-3.5 h-3.5" /></Button></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </CrisisLayout>
  );
}
