import { useState, useEffect } from 'react';
import { CrisisLayout } from '../components/CrisisLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Save, X } from 'lucide-react';

const REGIONS = ['Southeast Asia', 'East Asia', 'South Asia', 'Middle East', 'Africa', 'Europe', 'North America', 'South America', 'Oceania'];

export default function CrisisSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    email: '', slack_webhook: '', sms_number: '', regions: [] as string[],
    min_severity: 'medium', notify_email: true, notify_sms: false, notify_slack: false,
  });

  useEffect(() => {
    if (!user) return;
    supabase.from('crisis_user_settings').select('*').eq('user_id', user.id).single().then(({ data }) => {
      if (data) setSettings(data as any);
      else setSettings(s => ({ ...s, email: user.email || '' }));
    });
  }, [user]);

  const save = async () => {
    if (!user) return;
    const payload = { ...settings, user_id: user.id };
    const { error } = await supabase.from('crisis_user_settings').upsert(payload as any, { onConflict: 'user_id' });
    toast({ title: error ? 'Error' : 'Saved', description: error ? error.message : 'Settings updated', variant: error ? 'destructive' : 'default' });
  };

  return (
    <CrisisLayout>
      <div className="p-6 space-y-6 max-w-2xl">
        <div>
          <h1 className="text-xl font-bold text-white">Settings</h1>
          <p className="text-xs text-white/40 font-mono">Configure notification channels, regions, and preferences</p>
        </div>

        {/* Account */}
        <section className="rounded-lg border p-4 space-y-3" style={{ background: '#181c22', borderColor: 'rgba(255,255,255,0.07)' }}>
          <span className="text-xs font-mono text-white/40 uppercase">Account</span>
          <div>
            <label className="text-[10px] font-mono text-white/30 uppercase block mb-1">Email</label>
            <Input value={settings.email} onChange={e => setSettings(s => ({ ...s, email: e.target.value }))} className="bg-white/5 border-white/10 text-white" />
          </div>
          <div>
            <label className="text-[10px] font-mono text-white/30 uppercase block mb-1">SMS Number</label>
            <Input value={settings.sms_number} onChange={e => setSettings(s => ({ ...s, sms_number: e.target.value }))} placeholder="+1234567890" className="bg-white/5 border-white/10 text-white" />
          </div>
          <div>
            <label className="text-[10px] font-mono text-white/30 uppercase block mb-1">Slack Webhook URL</label>
            <Input value={settings.slack_webhook} onChange={e => setSettings(s => ({ ...s, slack_webhook: e.target.value }))} placeholder="https://hooks.slack.com/..." className="bg-white/5 border-white/10 text-white" />
          </div>
        </section>

        {/* Channels */}
        <section className="rounded-lg border p-4 space-y-3" style={{ background: '#181c22', borderColor: 'rgba(255,255,255,0.07)' }}>
          <span className="text-xs font-mono text-white/40 uppercase">Notification Channels</span>
          {[
            { label: 'Email', key: 'notify_email' as const },
            { label: 'SMS', key: 'notify_sms' as const },
            { label: 'Slack', key: 'notify_slack' as const },
          ].map(ch => (
            <label key={ch.key} className="flex items-center justify-between">
              <span className="text-sm text-white/60">{ch.label}</span>
              <Switch checked={settings[ch.key]} onCheckedChange={v => setSettings(s => ({ ...s, [ch.key]: v }))} />
            </label>
          ))}
        </section>

        {/* Min severity */}
        <section className="rounded-lg border p-4 space-y-3" style={{ background: '#181c22', borderColor: 'rgba(255,255,255,0.07)' }}>
          <span className="text-xs font-mono text-white/40 uppercase">Minimum Severity</span>
          <Select value={settings.min_severity} onValueChange={v => setSettings(s => ({ ...s, min_severity: v }))}>
            <SelectTrigger className="w-40 bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="critical">Critical</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent>
          </Select>
        </section>

        {/* Regions */}
        <section className="rounded-lg border p-4 space-y-3" style={{ background: '#181c22', borderColor: 'rgba(255,255,255,0.07)' }}>
          <span className="text-xs font-mono text-white/40 uppercase">Region Subscriptions</span>
          <div className="flex flex-wrap gap-1.5">
            {REGIONS.map(r => {
              const active = settings.regions.includes(r);
              return (
                <Badge key={r} variant="outline" className={`cursor-pointer text-xs ${active ? 'border-[#00d4ff]/40 text-[#00d4ff] bg-[#00d4ff]/10' : 'border-white/10 text-white/40'}`} onClick={() => setSettings(s => ({ ...s, regions: active ? s.regions.filter(x => x !== r) : [...s.regions, r] }))}>
                  {r}{active && <X className="w-2.5 h-2.5 ml-1" />}
                </Badge>
              );
            })}
          </div>
        </section>

        <Button onClick={save} className="gap-2 bg-[#00d4ff] text-black hover:bg-[#00d4ff]/80 font-mono"><Save className="w-4 h-4" />Save Settings</Button>
      </div>
    </CrisisLayout>
  );
}
