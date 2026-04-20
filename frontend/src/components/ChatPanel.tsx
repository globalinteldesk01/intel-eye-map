import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { Send, X, Users, Radio, Hash, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const BACKEND_URL = import.meta.env.REACT_APP_BACKEND_URL || 'https://instant-news-board.preview.emergentagent.com';
const WS_URL = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');

interface ChatMessage {
  id: string;
  channel: string;
  username: string;
  text: string;
  timestamp: string;
  type: 'message' | 'system';
  user_id?: string;
}

interface Channel {
  key: string;
  name: string;
  description: string;
  online: number;
}

const CHANNEL_COLORS: Record<string, string> = {
  general: '#22c55e',
  'middle-east': '#f97316',
  conflict: '#ef4444',
  security: '#3b82f6',
  geopolitics: '#8b5cf6',
  humanitarian: '#f59e0b',
  'asia-pacific': '#14b8a6',
  americas: '#06b6d4',
};

function getUsernameFromEmail(email: string): string {
  return email.split('@')[0].substring(0, 16);
}

function getStoredUsername(fallback: string): string {
  return localStorage.getItem('intel_chat_username') || fallback;
}

export function ChatPanel({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState('general');
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [inputText, setInputText] = useState('');
  const [onlineCount, setOnlineCount] = useState(0);
  const [totalOnline, setTotalOnline] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derive username
  const username = user?.email
    ? getStoredUsername(getUsernameFromEmail(user.email))
    : getStoredUsername(`Analyst_${Math.floor(Math.random() * 900000 + 100000)}`);

  // Store username
  useEffect(() => {
    if (!localStorage.getItem('intel_chat_username')) {
      localStorage.setItem('intel_chat_username', username);
    }
  }, [username]);

  // Fetch channels
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/chat/channels`)
      .then(r => r.json())
      .then(data => {
        setChannels(data.channels || []);
        setTotalOnline(data.total_online || 0);
      })
      .catch(() => {});
  }, []);

  // Fetch history for active channel
  const fetchHistory = useCallback(async (channel: string) => {
    try {
      const r = await fetch(`${BACKEND_URL}/api/chat/messages/${channel}`);
      if (r.ok) {
        const msgs: ChatMessage[] = await r.json();
        setMessages(prev => ({ ...prev, [channel]: msgs }));
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchHistory(activeChannel);
  }, [activeChannel, fetchHistory]);

  // WebSocket connection
  const connectWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }

    const wsEndpoint = `${WS_URL}/api/chat/ws/${activeChannel}?username=${encodeURIComponent(username)}&user_id=${user?.id || 'anon'}`;

    try {
      const ws = new WebSocket(wsEndpoint);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'online_count') {
            setOnlineCount(data.count || 0);
            setTotalOnline(data.total || 0);
          } else if (data.type === 'message' || data.type === 'system') {
            setMessages(prev => {
              const channel = data.channel || activeChannel;
              const existing = prev[channel] || [];
              if (existing.some((m: ChatMessage) => m.id === data.id)) return prev;
              return { ...prev, [channel]: [...existing, data] };
            });
          }
        } catch {}
      };

      ws.onclose = () => {
        // Reconnect after 3 seconds
        reconnectRef.current = setTimeout(connectWS, 3000);
      };

      ws.onerror = () => ws.close();

      // Ping every 25 seconds to keep alive
      const ping = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 25000);

      return () => {
        clearInterval(ping);
        ws.close();
      };
    } catch {}
  }, [activeChannel, username, user?.id]);

  useEffect(() => {
    const cleanup = connectWS();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      cleanup?.();
    };
  }, [connectWS]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages[activeChannel]]);

  const sendMessage = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'message', text }));
      setInputText('');
    } else {
      // Fallback: POST message
      fetch(`${BACKEND_URL}/api/chat/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: activeChannel, username, text, user_id: user?.id || 'anon' }),
      }).then(() => setInputText(''));
    }
  }, [inputText, activeChannel, username, user?.id]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const currentMessages = messages[activeChannel] || [];
  const channelColor = CHANNEL_COLORS[activeChannel] || '#22c55e';

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-white font-mono text-sm select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#0d1117] border-b border-[#22c55e]/30">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span className="text-green-400 font-bold tracking-widest text-xs uppercase">Intel Chat</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-green-400 text-[11px]">
            <Users className="w-3 h-3" />
            <span>{totalOnline} online</span>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Channel Tabs */}
      <div className="flex overflow-x-auto border-b border-[#22c55e]/20 bg-[#0d1117]" style={{ scrollbarWidth: 'none' }}>
        {channels.map(ch => (
          <button
            key={ch.key}
            onClick={() => setActiveChannel(ch.key)}
            className={cn(
              'shrink-0 px-3 py-2 text-[11px] font-bold uppercase tracking-wide transition-all border-b-2',
              activeChannel === ch.key
                ? 'text-green-400 border-green-400 bg-green-400/5'
                : 'text-gray-500 border-transparent hover:text-gray-300 hover:border-gray-500'
            )}
          >
            {ch.name}
          </button>
        ))}
      </div>

      {/* Online in this channel */}
      <div className="px-3 py-1 text-[10px] text-gray-600 border-b border-[#22c55e]/10 flex items-center gap-1">
        <Radio className="w-2.5 h-2.5 text-green-600" />
        <span>{onlineCount} in {channels.find(c => c.key === activeChannel)?.name || '#' + activeChannel}</span>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-2"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#22c55e20 transparent' }}
      >
        {currentMessages.length === 0 && (
          <div className="text-center text-gray-600 text-[11px] py-8">
            <Hash className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p>No messages yet. Start the discussion.</p>
          </div>
        )}
        {currentMessages.map((msg) => {
          const isOwn = msg.username === username;
          const isSystem = msg.type === 'system';
          if (isSystem) {
            return (
              <div key={msg.id} className="text-center text-[10px] text-gray-600 py-0.5">
                — {msg.text} —
              </div>
            );
          }
          return (
            <div key={msg.id} className={cn('group', isOwn && 'opacity-90')}>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span
                  className="text-[11px] font-bold"
                  style={{ color: isOwn ? channelColor : `hsl(${hashCode(msg.username) % 360}, 70%, 60%)` }}
                >
                  {msg.username}
                </span>
                <span className="text-[9px] text-gray-600">
                  {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}
                </span>
              </div>
              <p className="text-[12px] text-gray-200 leading-relaxed mt-0.5 pl-0">
                {msg.text}
              </p>
            </div>
          );
        })}
      </div>

      {/* Username display */}
      <div className="px-3 py-1 text-[10px] text-gray-600 border-t border-[#22c55e]/10">
        Chatting as <span className="text-green-400 font-bold">{username}</span>
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-1 flex gap-2">
        <Input
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${channels.find(c => c.key === activeChannel)?.name || '#' + activeChannel}...`}
          className="flex-1 h-8 bg-[#161b22] border-[#22c55e]/30 text-white text-xs placeholder:text-gray-600 focus:border-green-500"
          maxLength={500}
        />
        <Button
          size="sm"
          onClick={sendMessage}
          disabled={!inputText.trim()}
          className="h-8 w-8 p-0 bg-green-600 hover:bg-green-500 text-black"
        >
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}
