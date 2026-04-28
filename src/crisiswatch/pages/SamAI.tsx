import { useState, useRef, useEffect } from 'react';
import { CrisisLayout } from '../components/CrisisLayout';
import { supabase } from '@/integrations/supabase/client';
import { Bot, Send, Loader2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type Msg = { role: 'user' | 'assistant'; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sam-ai-chat`;

export default function SamAI() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      content:
        "I'm GIO AI. Ask me about country risk, recent intel, or travel safety. I'm grounded on the live CrisisWatch feed.",
    },
  ]);
  const [input, setInput] = useState('');
  const [country, setCountry] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next: Msg[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not signed in');

      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: next.filter((m) => m.role !== 'assistant' || m !== next[0]).map((m) => ({ role: m.role, content: m.content })),
          country: country || undefined,
        }),
      });

      if (resp.status === 429) {
        toast({ title: 'Rate limited', description: 'Try again shortly.', variant: 'destructive' });
        setLoading(false);
        return;
      }
      if (resp.status === 402) {
        toast({ title: 'AI credits exhausted', description: 'Add funds in Lovable workspace.', variant: 'destructive' });
        setLoading(false);
        return;
      }
      if (!resp.ok || !resp.body) {
        toast({ title: 'AI error', description: `Status ${resp.status}`, variant: 'destructive' });
        setLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let assistantSoFar = '';
      setMessages((p) => [...p, { role: 'assistant', content: '' }]);

      const flush = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages((p) => p.map((m, i) => (i === p.length - 1 ? { ...m, content: assistantSoFar } : m)));
      };

      let done = false;
      while (!done) {
        const { done: rd, value } = await reader.read();
        if (rd) break;
        textBuffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, idx);
          textBuffer = textBuffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || !line.trim()) continue;
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') { done = true; break; }
          try {
            const p = JSON.parse(json);
            const c = p.choices?.[0]?.delta?.content as string | undefined;
            if (c) flush(c);
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <CrisisLayout>
      <div className="h-full flex flex-col max-w-4xl mx-auto w-full p-6">
        <div className="flex items-center gap-2 mb-1">
          <Bot className="w-5 h-5 text-[#00d4ff]" />
          <h1 className="text-xl font-bold text-white">GIO AI</h1>
        </div>
        <p className="text-xs text-white/40 font-mono uppercase tracking-widest mb-4">
          Conversational analyst grounded on live intel
        </p>

        <div className="flex items-center gap-2 mb-3">
          <Input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Optional: focus country (e.g. Philippines)"
            className="max-w-xs text-xs"
          />
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto rounded-lg border p-4 space-y-3" style={{ background: '#0d1117', borderColor: 'rgba(255,255,255,0.07)' }}>
          {messages.map((m, i) => (
            <div key={i} className={cn('flex gap-3', m.role === 'user' && 'flex-row-reverse')}>
              <div className={cn('w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0', m.role === 'user' ? 'bg-white/10' : 'bg-[#00d4ff]/15')}>
                {m.role === 'user' ? <User className="w-3.5 h-3.5 text-white" /> : <Bot className="w-3.5 h-3.5 text-[#00d4ff]" />}
              </div>
              <div
                className={cn(
                  'rounded-lg px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed max-w-[80%]',
                  m.role === 'user' ? 'bg-[#00d4ff] text-black' : 'bg-white/5 text-white/90'
                )}
              >
                {m.content || (loading && i === messages.length - 1 ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '')}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
            placeholder="Ask GIO about a country, threat, or travel risk…"
            disabled={loading}
          />
          <Button onClick={send} disabled={loading || !input.trim()} className="bg-[#00d4ff] text-black hover:bg-[#00d4ff]/80 gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send
          </Button>
        </div>
      </div>
    </CrisisLayout>
  );
}