import { useEffect, useState } from 'react';
import { CrisisLayout } from '../components/CrisisLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plane, Plus, Trash2, MapPin, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ItineraryMapPicker, PickedDestination } from '../components/ItineraryMapPicker';

type Itinerary = {
  id: string;
  name: string;
  traveler_name: string | null;
  start_date: string;
  end_date: string;
  status: string;
  destinations?: Destination[];
};
type Destination = {
  id: string;
  itinerary_id: string;
  country: string;
  city: string | null;
  arrival_date: string;
  departure_date: string;
  lat?: number | null;
  lon?: number | null;
};

export default function TravelItinerary() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Itinerary[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', traveler: '', start: '', end: '' });
  const [picked, setPicked] = useState<PickedDestination[]>([]);

  const load = async () => {
    const { data: trips } = await supabase
      .from('travel_itineraries')
      .select('*')
      .order('start_date', { ascending: true });
    if (!trips) return setItems([]);
    const ids = trips.map((t: any) => t.id);
    const { data: dests } = ids.length
      ? await supabase.from('itinerary_destinations').select('*').in('itinerary_id', ids)
      : { data: [] as any[] };
    setItems(
      trips.map((t: any) => ({
        ...t,
        destinations: (dests ?? []).filter((d: any) => d.itinerary_id === t.id),
      }))
    );
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!user) return;
    if (!form.name || !form.start || !form.end || picked.length === 0) {
      toast({ title: 'Missing fields', description: 'Name, dates and at least one map pin are required.', variant: 'destructive' });
      return;
    }
    const { data: trip, error } = await supabase
      .from('travel_itineraries')
      .insert({
        user_id: user.id,
        name: form.name,
        traveler_name: form.traveler || null,
        start_date: form.start,
        end_date: form.end,
      })
      .select()
      .single();
    if (error || !trip) {
      toast({ title: 'Error', description: error?.message ?? 'Failed', variant: 'destructive' });
      return;
    }
    const rows = picked.map((p, i) => ({
      itinerary_id: trip.id,
      user_id: user.id,
      country: p.country,
      city: p.city,
      lat: p.lat,
      lon: p.lon,
      sequence: i,
      arrival_date: form.start,
      departure_date: form.end,
    }));
    await supabase.from('itinerary_destinations').insert(rows);
    toast({ title: 'Itinerary created', description: trip.name });
    setOpen(false);
    setForm({ name: '', traveler: '', start: '', end: '' });
    setPicked([]);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from('travel_itineraries').delete().eq('id', id);
    load();
  };

  return (
    <CrisisLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Plane className="w-5 h-5 text-[#00d4ff]" />
              <h1 className="text-xl font-bold text-white">Travel Itineraries</h1>
            </div>
            <p className="text-xs text-white/40 font-mono uppercase tracking-widest">
              Trips matched against live intel for travel alerts
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-[#00d4ff] text-black hover:bg-[#00d4ff]/80 font-mono text-xs gap-2">
                <Plus className="w-3.5 h-3.5" /> New Itinerary
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#111318] border-white/10 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Itinerary</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Trip Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="CEO's Travel to Jordan" />
                </div>
                <div>
                  <Label className="text-xs">Traveler Name</Label>
                  <Input value={form.traveler} onChange={(e) => setForm({ ...form, traveler: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Start</Label>
                    <Input type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">End</Label>
                    <Input type="date" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Destinations — click the map or search to pin</Label>
                  {open && <ItineraryMapPicker destinations={picked} onChange={setPicked} />}
                </div>
                <Button onClick={create} className="w-full bg-[#00d4ff] text-black hover:bg-[#00d4ff]/80 font-mono">Create</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {items.length === 0 ? (
          <div className="rounded-lg border p-12 text-center text-white/40 text-sm" style={{ background: '#111318', borderColor: 'rgba(255,255,255,0.07)' }}>
            No itineraries yet. Create one to start receiving travel alerts.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((t) => (
              <div key={t.id} className="rounded-lg border p-4" style={{ background: '#111318', borderColor: 'rgba(255,255,255,0.07)' }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">{t.name}</div>
                    {t.traveler_name && <div className="text-xs text-white/50 mt-0.5">{t.traveler_name}</div>}
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-white/50 font-mono">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{t.start_date} → {t.end_date}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {(t.destinations ?? []).map((d) => (
                        <span key={d.id} className="text-[11px] font-mono px-2 py-0.5 rounded flex items-center gap-1" style={{ background: 'rgba(0,212,255,0.08)', color: '#00d4ff' }}>
                          <MapPin className="w-3 h-3" />{d.city ? `${d.city}, ` : ''}{d.country}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => remove(t.id)} className="text-white/30 hover:text-red-400 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </CrisisLayout>
  );
}