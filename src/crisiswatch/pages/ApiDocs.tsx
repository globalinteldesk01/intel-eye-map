import { useState } from 'react';
import { CrisisLayout } from '../components/CrisisLayout';
import { Button } from '@/components/ui/button';
import { Copy, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const ENDPOINTS = [
  {
    method: 'GET', path: '/api/events', desc: 'List all events with optional filters',
    example: { request: 'GET /api/events?severity=critical&limit=10', response: JSON.stringify({ data: [{ id: 'evt_1', title: '7.2 Earthquake in Indonesia', severity: 'critical', latitude: -6.2, longitude: 106.8, status: 'verified', confidence: 92 }], total: 1 }, null, 2) },
  },
  {
    method: 'GET', path: '/api/events/:id', desc: 'Get a single event by ID',
    example: { request: 'GET /api/events/evt_1', response: JSON.stringify({ id: 'evt_1', title: '7.2 Earthquake in Indonesia', summary: 'Major earthquake detected...', severity: 'critical', impacts: ['Infrastructure damage', 'Tsunami warning'], actions: ['Activate emergency protocols'] }, null, 2) },
  },
  {
    method: 'POST', path: '/api/alerts/subscribe', desc: 'Subscribe to alerts for a specific severity or region',
    example: { request: JSON.stringify({ severity: 'high', regions: ['Southeast Asia'], channels: ['email', 'slack'] }, null, 2), response: JSON.stringify({ success: true, subscription_id: 'sub_abc123' }, null, 2) },
  },
  {
    method: 'GET', path: '/api/assets', desc: 'List all organization assets',
    example: { request: 'GET /api/assets', response: JSON.stringify({ data: [{ id: 'ast_1', name: 'Jakarta Office', type: 'office', latitude: -6.2, longitude: 106.8, radius_km: 5 }] }, null, 2) },
  },
  {
    method: 'POST', path: '/api/assets', desc: 'Create a new asset',
    example: { request: JSON.stringify({ name: 'Singapore HQ', type: 'office', latitude: 1.35, longitude: 103.82, radius_km: 10 }, null, 2), response: JSON.stringify({ id: 'ast_2', name: 'Singapore HQ', created: true }, null, 2) },
  },
];

const METHOD_COLORS: Record<string, string> = { GET: '#2ed573', POST: '#00d4ff', PUT: '#ffa502', DELETE: '#ff4757' };

export default function ApiDocs() {
  const { toast } = useToast();
  const [apiKey] = useState('cw_live_' + Math.random().toString(36).slice(2, 18));

  return (
    <CrisisLayout>
      <div className="p-6 space-y-6 max-w-4xl">
        <div>
          <h1 className="text-xl font-bold text-white">API Documentation</h1>
          <p className="text-xs text-white/40 font-mono">REST API for programmatic access to CrisisWatch data</p>
        </div>

        {/* API Key */}
        <div className="rounded-lg border p-4" style={{ background: '#181c22', borderColor: 'rgba(255,255,255,0.07)' }}>
          <span className="text-[10px] font-mono text-white/40 uppercase block mb-2">Your API Key</span>
          <div className="flex items-center gap-3">
            <code className="flex-1 text-sm font-mono text-[#00d4ff] bg-white/5 px-3 py-2 rounded">{apiKey}</code>
            <Button variant="ghost" size="sm" className="h-8 text-xs text-white/40 hover:text-white gap-1" onClick={() => { navigator.clipboard.writeText(apiKey); toast({ title: 'Copied' }); }}>
              <Copy className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs text-white/40 hover:text-white gap-1">
              <RefreshCw className="w-3.5 h-3.5" />Regenerate
            </Button>
          </div>
        </div>

        {/* Endpoints */}
        {ENDPOINTS.map((ep, i) => (
          <div key={i} className="rounded-lg border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <div className="px-4 py-3 flex items-center gap-3" style={{ background: '#181c22' }}>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded" style={{ background: METHOD_COLORS[ep.method] + '22', color: METHOD_COLORS[ep.method] }}>{ep.method}</span>
              <code className="text-sm font-mono text-white/80">{ep.path}</code>
              <span className="text-xs text-white/40 ml-auto">{ep.desc}</span>
            </div>
            <div className="grid grid-cols-2 divide-x" style={{ background: '#0d0f13', borderColor: 'rgba(255,255,255,0.07)' }}>
              <div className="p-3">
                <span className="text-[10px] font-mono text-white/30 uppercase block mb-1">Request</span>
                <pre className="text-xs text-white/60 font-mono whitespace-pre-wrap">{ep.example.request}</pre>
              </div>
              <div className="p-3" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                <span className="text-[10px] font-mono text-white/30 uppercase block mb-1">Response</span>
                <pre className="text-xs text-[#2ed573]/70 font-mono whitespace-pre-wrap">{ep.example.response}</pre>
              </div>
            </div>
          </div>
        ))}
      </div>
    </CrisisLayout>
  );
}
