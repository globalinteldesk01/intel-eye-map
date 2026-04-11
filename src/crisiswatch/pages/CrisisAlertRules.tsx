import { useState } from 'react';
import { CrisisLayout } from '../components/CrisisLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, X } from 'lucide-react';

interface RuleForm {
  minSeverity: string;
  keywords: string[];
  excludeKeywords: string[];
  notifyEmail: boolean;
  notifySms: boolean;
  notifySlack: boolean;
  escalationContacts: string[];
}

const DEFAULT_RULE: RuleForm = { minSeverity: 'medium', keywords: [], excludeKeywords: [], notifyEmail: true, notifySms: false, notifySlack: false, escalationContacts: [] };

export default function CrisisAlertRules() {
  const [rules, setRules] = useState<RuleForm[]>([{ ...DEFAULT_RULE }]);
  const [newKeyword, setNewKeyword] = useState('');
  const [newContact, setNewContact] = useState('');

  const updateRule = (i: number, updates: Partial<RuleForm>) => {
    setRules(prev => prev.map((r, idx) => idx === i ? { ...r, ...updates } : r));
  };

  const addKeyword = (i: number, type: 'keywords' | 'excludeKeywords') => {
    if (!newKeyword) return;
    updateRule(i, { [type]: [...rules[i][type], newKeyword] });
    setNewKeyword('');
  };

  return (
    <CrisisLayout>
      <div className="p-6 space-y-4 max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Alert Rules</h1>
            <p className="text-xs text-white/40 font-mono">Configure severity thresholds, keyword filters, and escalation paths</p>
          </div>
          <Button size="sm" className="gap-1 text-xs bg-[#00d4ff] text-black hover:bg-[#00d4ff]/80" onClick={() => setRules(prev => [...prev, { ...DEFAULT_RULE }])}>
            <Plus className="w-3.5 h-3.5" />Add Rule
          </Button>
        </div>

        {rules.map((rule, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-4" style={{ background: '#181c22', borderColor: 'rgba(255,255,255,0.07)' }}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-mono text-white/60">Rule {i + 1}</span>
              {rules.length > 1 && <Button variant="ghost" size="sm" className="h-6 text-white/30 hover:text-[#ff4757]" onClick={() => setRules(prev => prev.filter((_, idx) => idx !== i))}><Trash2 className="w-3.5 h-3.5" /></Button>}
            </div>

            {/* Min severity */}
            <div>
              <span className="text-[10px] font-mono text-white/40 uppercase block mb-1">Minimum Severity</span>
              <Select value={rule.minSeverity} onValueChange={v => updateRule(i, { minSeverity: v })}>
                <SelectTrigger className="w-40 bg-white/5 border-white/10 text-white text-xs"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="critical">Critical</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent>
              </Select>
            </div>

            {/* Keywords */}
            <div>
              <span className="text-[10px] font-mono text-white/40 uppercase block mb-1">Include Keywords</span>
              <div className="flex gap-1 flex-wrap mb-2">
                {rule.keywords.map(k => <Badge key={k} variant="outline" className="text-xs border-[#00d4ff]/30 text-[#00d4ff] gap-1">{k}<X className="w-2.5 h-2.5 cursor-pointer" onClick={() => updateRule(i, { keywords: rule.keywords.filter(x => x !== k) })} /></Badge>)}
              </div>
              <div className="flex gap-2">
                <Input value={newKeyword} onChange={e => setNewKeyword(e.target.value)} placeholder="Add keyword" className="bg-white/5 border-white/10 text-white text-xs h-7" onKeyDown={e => e.key === 'Enter' && addKeyword(i, 'keywords')} />
                <Button size="sm" className="h-7 text-xs" onClick={() => addKeyword(i, 'keywords')}>Add</Button>
              </div>
            </div>

            {/* Channel toggles */}
            <div>
              <span className="text-[10px] font-mono text-white/40 uppercase block mb-2">Notification Channels</span>
              <div className="flex gap-6">
                {[
                  { label: 'Email', key: 'notifyEmail' as const },
                  { label: 'SMS', key: 'notifySms' as const },
                  { label: 'Slack', key: 'notifySlack' as const },
                ].map(ch => (
                  <label key={ch.key} className="flex items-center gap-2 cursor-pointer">
                    <Switch checked={rule[ch.key]} onCheckedChange={v => updateRule(i, { [ch.key]: v })} className="scale-75" />
                    <span className="text-xs text-white/60">{ch.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Escalation */}
            <div>
              <span className="text-[10px] font-mono text-white/40 uppercase block mb-1">Escalation Chain</span>
              <div className="space-y-1 mb-2">
                {rule.escalationContacts.map((c, ci) => (
                  <div key={ci} className="flex items-center gap-2 text-xs text-white/60">
                    <span className="font-mono text-[#00d4ff]">{ci + 1}.</span>{c}
                    <X className="w-3 h-3 cursor-pointer text-white/30 hover:text-[#ff4757]" onClick={() => updateRule(i, { escalationContacts: rule.escalationContacts.filter((_, x) => x !== ci) })} />
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={newContact} onChange={e => setNewContact(e.target.value)} placeholder="email@example.com" className="bg-white/5 border-white/10 text-white text-xs h-7" onKeyDown={e => { if (e.key === 'Enter' && newContact) { updateRule(i, { escalationContacts: [...rule.escalationContacts, newContact] }); setNewContact(''); }}} />
                <Button size="sm" className="h-7 text-xs" onClick={() => { if (newContact) { updateRule(i, { escalationContacts: [...rule.escalationContacts, newContact] }); setNewContact(''); }}}>Add</Button>
              </div>
            </div>
          </div>
        ))}

        <Button className="w-full bg-[#00d4ff] text-black hover:bg-[#00d4ff]/80 font-mono text-xs">Save All Rules</Button>
      </div>
    </CrisisLayout>
  );
}
