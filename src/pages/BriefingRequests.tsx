import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { useToast } from '@/hooks/use-toast';
import { FileText, Calendar } from 'lucide-react';
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

export default function BriefingRequests() {
  const { isAnalyst, role } = useUserRole();
  const { toast } = useToast();
  const [rows, setRows] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('briefing_requests')
      .select('*')
      .order('created_at', { ascending: false });
    setRows((data ?? []) as Req[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('briefing_requests').update({ status }).eq('id', id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Updated' }); load(); }
  };

  const saveNotes = async (id: string) => {
    const { error } = await supabase.from('briefing_requests')
      .update({ response_notes: notes[id] ?? '' }).eq('id', id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else toast({ title: 'Notes saved' });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onToggleSidebar={() => {}} />
      <main className="p-6 max-w-5xl mx-auto space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold">
              {isAnalyst ? 'Client Briefing Requests' : 'My Briefing Requests'}
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {isAnalyst
              ? 'Bespoke briefing jobs submitted by clients.'
              : 'Track the status of your bespoke briefing requests.'}
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-sm text-muted-foreground">No briefing requests yet.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {rows.map(r => (
              <Card key={r.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge className={PRIORITY_COLORS[r.priority] || ''}>{r.priority.toUpperCase()}</Badge>
                      <Badge variant="outline">{r.status.replace('_', ' ')}</Badge>
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
    </div>
  );
}
