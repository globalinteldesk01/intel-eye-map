import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';

export function BriefingRequestDialog() {
  const { user } = useAuth();
  const { role } = useUserRole();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [scope, setScope] = useState('');
  const [countries, setCountries] = useState('');
  const [regions, setRegions] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState('normal');
  const [busy, setBusy] = useState(false);

  if (role !== 'client') return null;

  const submit = async () => {
    if (!user || !title.trim() || !scope.trim()) return;
    setBusy(true);
    const { error } = await supabase.from('briefing_requests').insert({
      client_user_id: user.id,
      title: title.trim(),
      scope: scope.trim(),
      countries: countries.split(',').map(s => s.trim()).filter(Boolean),
      regions: regions.split(',').map(s => s.trim()).filter(Boolean),
      deadline: deadline || null,
      priority,
    });
    setBusy(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Request submitted', description: 'An analyst will respond shortly.' });
    setOpen(false);
    setTitle(''); setScope(''); setCountries(''); setRegions(''); setDeadline(''); setPriority('normal');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 text-white hover:bg-white/10 gap-1.5">
          <FileText className="w-4 h-4" />
          Request Briefing
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request Bespoke Briefing</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Briefing title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Q2 Thailand political risk outlook" />
          </div>
          <div className="space-y-1.5">
            <Label>Scope & objectives</Label>
            <Textarea value={scope} onChange={e => setScope(e.target.value)} rows={4} placeholder="What questions should this briefing answer?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Countries</Label>
              <Input value={countries} onChange={e => setCountries(e.target.value)} placeholder="Thailand, Vietnam" />
            </div>
            <div className="space-y-1.5">
              <Label>Regions</Label>
              <Input value={regions} onChange={e => setRegions(e.target.value)} placeholder="Southeast Asia" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Deadline</Label>
              <Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
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
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !title.trim() || !scope.trim()}>Submit Request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
