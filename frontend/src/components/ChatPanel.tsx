import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { Send, X, Users, Hash } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const BACKEND_URL = import.meta.env.REACT_APP_BACKEND_URL || 'https://instant-news-board.preview.emergentagent.com';
const WS_URL = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');

interface ChatMessage { id: string; channel: string; username: string; text: string; timestamp: string; type: 'message' | 'system'; }
interface Channel { key: string; name: string; description: string; online: number; }

function hashCode(s: string) { let h=0; for(let i=0;i<s.length;i++) h=s.charCodeAt(i)+((h<<5)-h); return Math.abs(h); }
function getUsername(email?: string) { const stored=localStorage.getItem('intel_chat_username'); if(stored) return stored; const name=email?email.split('@')[0].substring(0,16):`Analyst_${Math.floor(Math.random()*900000+100000)}`; localStorage.setItem('intel_chat_username',name); return name; }

export function ChatPanel({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState('general');
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [inputText, setInputText] = useState('');
  const [onlineCount, setOnlineCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const username = getUsername(user?.email);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/chat/channels`).then(r=>r.json()).then(d=>setChannels(d.channels||[])).catch(()=>{});
  }, []);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/chat/messages/${activeChannel}`).then(r=>r.json()).then(msgs=>setMessages(prev=>({...prev,[activeChannel]:msgs}))).catch(()=>{});
  }, [activeChannel]);

  const connectWS = useCallback(() => {
    wsRef.current?.close();
    try {
      const ws = new WebSocket(`${WS_URL}/api/chat/ws/${activeChannel}?username=${encodeURIComponent(username)}&user_id=${user?.id||'anon'}`);
      wsRef.current = ws;
      ws.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data);
          if (d.type==='online_count') setOnlineCount(d.count||0);
          else if (d.type==='message'||d.type==='system') setMessages(prev=>({...prev,[d.channel||activeChannel]:[...(prev[d.channel||activeChannel]||[]),d]}));
        } catch {}
      };
      ws.onerror = () => ws.close();
      ws.onclose = () => setTimeout(connectWS, 3000);
    } catch {}
  }, [activeChannel, username, user?.id]);

  useEffect(() => { connectWS(); return () => { wsRef.current?.close(); }; }, [connectWS]);

  useEffect(() => {
    if (scrollRef.current) { const v=scrollRef.current.querySelector('[data-radix-scroll-area-viewport]'); if(v) v.scrollTop=v.scrollHeight; }
  }, [messages[activeChannel]]);

  const send = () => {
    const text=inputText.trim(); if(!text) return;
    if (wsRef.current?.readyState===WebSocket.OPEN) { wsRef.current.send(JSON.stringify({type:'message',text})); setInputText(''); }
  };

  const msgs = messages[activeChannel]||[];

  return (
    <div className="flex flex-col h-full bg-[#0f1724]">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#1e2d44]">
        <div className="flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"/><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"/></span>
          <span className="text-green-400 font-bold text-xs uppercase tracking-widest">Intel Chat</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[#64748b] text-[10px]"><Users className="w-3 h-3"/>{onlineCount} online</span>
          <button onClick={onClose} className="text-[#475569] hover:text-white"><X className="w-4 h-4"/></button>
        </div>
      </div>

      <div className="flex overflow-x-auto border-b border-[#1e2d44]" style={{scrollbarWidth:'none'}}>
        {channels.map(ch=>(
          <button key={ch.key} onClick={()=>setActiveChannel(ch.key)}
            className={cn('shrink-0 px-3 py-2 text-[10px] font-bold uppercase tracking-wide border-b-2 transition-all',
              activeChannel===ch.key?'text-green-400 border-green-400 bg-green-400/5':'text-[#475569] border-transparent hover:text-[#94a3b8]')}>
            {ch.name}
          </button>
        ))}
      </div>

      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="px-3 py-2 space-y-2">
          {msgs.length===0&&<div className="text-center text-[#475569] text-[11px] py-8"><Hash className="w-6 h-6 mx-auto mb-2 opacity-30"/>Start the discussion</div>}
          {msgs.map(msg=>{
            if(msg.type==='system') return <div key={msg.id} className="text-center text-[#475569] text-[9px] py-0.5">— {msg.text} —</div>;
            const isOwn=msg.username===username;
            return (
              <div key={msg.id} className="group">
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] font-bold" style={{color:isOwn?'#22c55e':`hsl(${hashCode(msg.username)%360},70%,60%)`}}>{msg.username}</span>
                  <span className="text-[9px] text-[#475569]">{formatDistanceToNow(new Date(msg.timestamp),{addSuffix:true})}</span>
                </div>
                <p className="text-[12px] text-[#cbd5e1] leading-relaxed">{msg.text}</p>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="px-3 py-1 text-[10px] text-[#475569] border-t border-[#1e2d44]">Chatting as <span className="text-green-400 font-bold">{username}</span></div>
      <div className="px-3 pb-3 pt-1 flex gap-2">
        <Input value={inputText} onChange={e=>setInputText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}}
          placeholder="Message..." maxLength={500}
          className="flex-1 h-8 bg-[#1a2538] border-[#2a3a52] text-white text-xs placeholder:text-[#475569] focus:border-green-500"/>
        <Button size="sm" onClick={send} disabled={!inputText.trim()} className="h-8 w-8 p-0 bg-green-600 hover:bg-green-500 text-black">
          <Send className="w-3.5 h-3.5"/>
        </Button>
      </div>
    </div>
  );
}
