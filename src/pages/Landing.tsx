import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Globe2, ShieldAlert, Radar, Map, Bell, Network, ArrowRight, Check,
  Activity, Lock, Zap, Eye, BarChart3, Users,
} from 'lucide-react';
import logo from '@/assets/global-intel-desk-logo.png';

const FEATURES = [
  { icon: Radar, title: 'Real-Time OSINT Ingestion', desc: '55+ vetted RSS feeds, Telegram channels, GDELT and licensed APIs streamed continuously into a single intelligence desk.' },
  { icon: Map, title: 'Geospatial Intel Map', desc: 'City-level pinpointing across 700+ cities with severity-coded markers and live regional clustering.' },
  { icon: ShieldAlert, title: 'Country & Travel Risk', desc: 'Auto-scored country risk and per-traveler itinerary monitoring with pre-travel and in-travel alerting.' },
  { icon: Bell, title: 'Push Notifications', desc: 'Watchlist-driven alerts delivered via Realtime — no manual refreshing, no missed events.' },
  { icon: Network, title: 'Analyst Workflow', desc: 'Verification queues, briefing requests and client publishing built for professional intelligence teams.' },
  { icon: Lock, title: 'Hardened Architecture', desc: 'Row-level security, JWT validation and SHA-256 deduplication across the entire ingestion pipeline.' },
];

const STATS = [
  { value: '55+', label: 'OSINT Sources' },
  { value: '700+', label: 'Cities Tracked' },
  { value: '<1m', label: 'Ingest Latency' },
  { value: '24/7', label: 'Live Monitoring' },
];

const PIPELINE = [
  { icon: Globe2, title: 'Collect', desc: 'RSS, Telegram, GDELT, licensed APIs' },
  { icon: Activity, title: 'Classify', desc: 'NLP filtering & severity scoring' },
  { icon: Eye, title: 'Verify', desc: 'Analyst queue & deduplication' },
  { icon: Zap, title: 'Deliver', desc: 'Realtime push to dashboard & clients' },
];

const PRICING = [
  { name: 'Analyst', price: '$0', period: '/mo', features: ['Live global feed', 'Standard map view', 'Watchlist alerts', '7-day history'], cta: 'Start Free' },
  { name: 'Professional', price: '$499', period: '/mo', features: ['Everything in Analyst', 'Country risk scoring', 'Travel itinerary monitoring', 'PDF intel reports', 'Priority sources'], cta: 'Start Trial', highlight: true },
  { name: 'Enterprise', price: 'Custom', period: '', features: ['Unlimited analysts', 'Dedicated client desk', 'Custom OSINT sources', 'SSO / SAML', 'SLA & on-prem option'], cta: 'Contact Sales' },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#0a0c0f] text-white/90 font-sans antialiased">
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-white/5 bg-[#0a0c0f]/80 backdrop-blur">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/landing" className="flex items-center gap-2.5">
            <img src={logo} alt="Global Intel Desk" className="h-8 w-auto" />
            <span className="text-sm font-semibold tracking-wider uppercase">Global Intel Desk</span>
          </Link>
          <div className="hidden md:flex items-center gap-7 text-sm text-white/60">
            <a href="#features" className="hover:text-white transition">Platform</a>
            <a href="#pipeline" className="hover:text-white transition">Pipeline</a>
            <a href="#pricing" className="hover:text-white transition">Pricing</a>
            <Link to="/crisiswatch/landing" className="hover:text-white transition">CrisisWatch</Link>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/auth"><Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/5">Sign In</Button></Link>
            <Link to="/auth"><Button size="sm" className="bg-[hsl(210,100%,45%)] hover:bg-[hsl(210,100%,40%)] text-white">Request Access</Button></Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(210,100%,30%)/0.25,_transparent_60%)]" />
        <div className="relative max-w-6xl mx-auto px-6 py-24 md:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-mono tracking-widest text-white/60 uppercase">Live Intelligence Desk</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight mb-6">
              Global situational awareness, <span className="text-[hsl(210,100%,65%)]">delivered in real time.</span>
            </h1>
            <p className="text-lg md:text-xl text-white/55 leading-relaxed mb-10 max-w-2xl">
              An open-source intelligence desk built for security teams, risk analysts and corporate
              travel programs. Ingest, verify and act on global events as they happen.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/auth">
                <Button size="lg" className="bg-[hsl(210,100%,45%)] hover:bg-[hsl(210,100%,40%)] text-white gap-2">
                  Launch Desk <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <a href="#features">
                <Button size="lg" variant="outline" className="border-white/15 bg-transparent text-white hover:bg-white/5">
                  See Capabilities
                </Button>
              </a>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-px bg-white/5 border border-white/10 rounded-lg overflow-hidden">
            {STATS.map(s => (
              <div key={s.label} className="bg-[#0a0c0f] px-6 py-5">
                <div className="text-3xl font-bold font-mono text-[hsl(210,100%,65%)]">{s.value}</div>
                <div className="text-xs uppercase tracking-widest text-white/40 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="max-w-2xl mb-14">
            <p className="text-xs font-mono uppercase tracking-widest text-[hsl(210,100%,65%)] mb-3">Platform</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Built for professional intelligence work.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/5 border border-white/10 rounded-lg overflow-hidden">
            {FEATURES.map(f => (
              <div key={f.title} className="bg-[#0a0c0f] p-7 hover:bg-white/[0.02] transition">
                <f.icon className="w-6 h-6 text-[hsl(210,100%,65%)] mb-5" />
                <h3 className="text-base font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pipeline */}
      <section id="pipeline" className="border-t border-white/5 bg-white/[0.015]">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="max-w-2xl mb-14">
            <p className="text-xs font-mono uppercase tracking-widest text-[hsl(210,100%,65%)] mb-3">Pipeline</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">From signal to decision in under a minute.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {PIPELINE.map((p, i) => (
              <div key={p.title} className="relative rounded-lg border border-white/10 bg-[#0a0c0f] p-6">
                <div className="text-xs font-mono text-white/30 mb-4">0{i + 1}</div>
                <p.icon className="w-6 h-6 text-[hsl(210,100%,65%)] mb-4" />
                <h3 className="text-base font-semibold mb-1.5">{p.title}</h3>
                <p className="text-sm text-white/50">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-24 grid md:grid-cols-3 gap-8">
          {[
            { icon: Users, title: 'Corporate Security', desc: 'Protect employees, assets and facilities with proximity alerts and country risk monitoring.' },
            { icon: BarChart3, title: 'Risk Analysts', desc: 'Verified intelligence streams, trend timelines and exportable PDF reports for executive briefings.' },
            { icon: ShieldAlert, title: 'Travel Programs', desc: 'Itinerary-aware intelligence with pre-travel briefings and in-travel push warnings.' },
          ].map(u => (
            <div key={u.title} className="border-l border-[hsl(210,100%,45%)]/40 pl-5">
              <u.icon className="w-5 h-5 text-[hsl(210,100%,65%)] mb-3" />
              <h3 className="text-lg font-semibold mb-2">{u.title}</h3>
              <p className="text-sm text-white/55 leading-relaxed">{u.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-white/5 bg-white/[0.015]">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-xs font-mono uppercase tracking-widest text-[hsl(210,100%,65%)] mb-3">Pricing</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Transparent plans for every team.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PRICING.map(p => (
              <div
                key={p.name}
                className={`rounded-lg border p-7 flex flex-col ${
                  p.highlight
                    ? 'border-[hsl(210,100%,45%)]/50 bg-[hsl(210,100%,30%)]/10 ring-1 ring-[hsl(210,100%,45%)]/30'
                    : 'border-white/10 bg-[#0a0c0f]'
                }`}
              >
                <h3 className="text-sm font-mono uppercase tracking-widest text-white/60 mb-3">{p.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold font-mono">{p.price}</span>
                  <span className="text-sm text-white/40">{p.period}</span>
                </div>
                <ul className="space-y-2.5 mb-8 flex-1">
                  {p.features.map(f => (
                    <li key={f} className="text-sm text-white/65 flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/auth">
                  <Button
                    className={`w-full ${
                      p.highlight
                        ? 'bg-[hsl(210,100%,45%)] hover:bg-[hsl(210,100%,40%)] text-white'
                        : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
                    }`}
                  >
                    {p.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/5">
        <div className="max-w-4xl mx-auto px-6 py-24 text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-5">
            Ready to operate your own intelligence desk?
          </h2>
          <p className="text-white/55 mb-8 max-w-xl mx-auto">
            Join analysts, security teams and risk leaders using Global Intel Desk to stay ahead of global events.
          </p>
          <Link to="/auth">
            <Button size="lg" className="bg-[hsl(210,100%,45%)] hover:bg-[hsl(210,100%,40%)] text-white gap-2">
              Request Access <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="Global Intel Desk" className="h-6 w-auto opacity-80" />
            <span className="text-xs font-mono uppercase tracking-widest text-white/40">Global Intel Desk</span>
          </div>
          <p className="text-xs text-white/30 font-mono">© 2026 Global Intel Desk · OSINT Intelligence Platform</p>
        </div>
      </footer>
    </div>
  );
}