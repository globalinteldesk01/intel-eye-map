import { Link } from 'react-router-dom';
import { Shield, Brain, Map, Building2, Zap, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

const FEATURES = [
  { icon: Brain, title: 'AI Detection', desc: 'NLP classification, de-duplication, and confidence scoring across 5 data sources in real time.' },
  { icon: Map, title: 'Geo-Mapping', desc: 'Dark-mode geospatial overlays with heatmaps, polygons, and proximity alerts for your assets.' },
  { icon: Building2, title: 'Asset Protection', desc: 'Define watchlist zones, track employee locations, and get instant proximity warnings.' },
  { icon: Zap, title: 'Integrations', desc: 'Push alerts via email, SMS, Slack, and Teams. Export GeoJSON. Full REST API.' },
];

const PRICING = [
  { name: 'Starter', price: '$499', period: '/mo', features: ['Up to 500 events/day', '5 users', 'Email alerts', 'Basic map', '10 assets'], cta: 'Start Free Trial' },
  { name: 'Pro', price: '$1,499', period: '/mo', features: ['Unlimited events', '25 users', 'All alert channels', 'Full map + heatmap', '100 assets', 'API access', 'Slack/Teams'], cta: 'Start Free Trial', highlight: true },
  { name: 'Enterprise', price: 'Custom', period: '', features: ['Unlimited everything', 'SSO/SAML', 'Dedicated support', 'Custom integrations', 'SLA guarantee', 'On-premise option'], cta: 'Contact Sales' },
];

const LAYERS = [
  { label: 'Layer 1 — Data Ingestion', items: ['Social', 'News feeds', 'Gov alerts', 'Weather', 'Traffic / IoT'] },
  { label: 'Layer 2 — AI Detection Pipeline', items: ['Ingestion', 'NLP classifier', 'Geo-tagger', 'Analyst'] },
  { label: 'Layer 3 — Platform Core', items: ['Event engine', 'Asset manager', 'Map engine', 'Alert rules'] },
  { label: 'Layer 4 — Delivery & Integrations', items: ['Dashboard', 'Push alerts', 'REST API', 'Slack/Teams', 'GIS export'] },
];

export default function CrisisLanding() {
  return (
    <div className="min-h-screen" style={{ background: '#0a0c0f', color: '#e2e8f0' }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-[#00d4ff]" />
          <span className="text-lg font-bold font-mono text-[#00d4ff]">CrisisWatch</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/crisiswatch" className="text-sm text-white/50 hover:text-white">Dashboard</Link>
          <Link to="/auth">
            <Button size="sm" className="bg-[#00d4ff] text-black hover:bg-[#00d4ff]/80 font-mono text-xs">Sign In</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-8 py-24 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#00d4ff]/20 bg-[#00d4ff]/5 mb-6">
          <div className="w-2 h-2 rounded-full bg-[#00d4ff] animate-pulse" />
          <span className="text-xs font-mono text-[#00d4ff]">LIVE MONITORING ACTIVE</span>
        </div>
        <h1 className="text-5xl font-bold leading-tight mb-6">
          Know about crises <span className="text-[#00d4ff]">45 minutes</span> before the news
        </h1>
        <p className="text-lg text-white/50 mb-8 max-w-2xl mx-auto">
          AI-powered crisis intelligence that ingests data from social media, news feeds, government alerts, weather systems, and IoT sensors — processed, classified, and delivered in real time.
        </p>
        <div className="flex justify-center gap-4">
          <Link to="/auth">
            <Button size="lg" className="bg-[#00d4ff] text-black hover:bg-[#00d4ff]/80 font-mono gap-2">
              Get Started <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Button size="lg" variant="outline" className="border-white/20 text-white/70 hover:bg-white/5 font-mono">
            Watch Demo
          </Button>
        </div>
      </section>

      {/* Architecture */}
      <section className="px-8 py-16 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-12">4-Layer Architecture</h2>
        <div className="space-y-4">
          {LAYERS.map((layer, i) => (
            <div key={i} className="rounded-lg border p-4" style={{ background: '#111318', borderColor: 'rgba(255,255,255,0.07)' }}>
              <h3 className="text-sm font-mono text-[#00d4ff] mb-3">{layer.label}</h3>
              <div className="flex flex-wrap gap-2">
                {layer.items.map(item => (
                  <span key={item} className="text-xs font-mono px-3 py-1.5 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)' }}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-8 py-16 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-12">Platform Capabilities</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {FEATURES.map(f => (
            <div key={f.title} className="rounded-lg border p-6" style={{ background: '#111318', borderColor: 'rgba(255,255,255,0.07)' }}>
              <f.icon className="w-8 h-8 text-[#00d4ff] mb-3" />
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-white/50">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="px-8 py-16 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-12">Pricing</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PRICING.map(p => (
            <div key={p.name} className={`rounded-lg border p-6 ${p.highlight ? 'border-[#00d4ff]/40 ring-1 ring-[#00d4ff]/20' : ''}`} style={{ background: '#111318', borderColor: p.highlight ? undefined : 'rgba(255,255,255,0.07)' }}>
              <h3 className="text-lg font-semibold mb-1">{p.name}</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-3xl font-bold font-mono">{p.price}</span>
                <span className="text-sm text-white/40">{p.period}</span>
              </div>
              <ul className="space-y-2 mb-6">
                {p.features.map(f => (
                  <li key={f} className="text-sm text-white/60 flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#2ed573]" />{f}
                  </li>
                ))}
              </ul>
              <Button className={`w-full font-mono text-xs ${p.highlight ? 'bg-[#00d4ff] text-black hover:bg-[#00d4ff]/80' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}>
                {p.cta}
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="px-8 py-8 border-t text-center" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <p className="text-xs text-white/30 font-mono">© 2026 CrisisWatch. AI-Powered Crisis Intelligence Platform.</p>
      </footer>
    </div>
  );
}
