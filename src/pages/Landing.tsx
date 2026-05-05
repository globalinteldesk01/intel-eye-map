import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  ArrowRight, Check, X, Plane, Shield, CloudRain, Wifi, Crosshair, Activity,
  Radar, MapPin, Bell, Globe2, Twitter, Linkedin, Youtube,
} from 'lucide-react';
import logo from '@/assets/global-intel-desk-logo.png';

const ACCENT = 'hsl(210,100%,55%)';
const ACCENT_HOVER = 'hsl(210,100%,48%)';

const NAV = [
  { label: 'Coverage', href: '#coverage' },
  { label: 'Use cases', href: '#use-cases' },
  { label: 'Platform', href: '#platform' },
  { label: 'About', href: '#about' },
];

const FEATURES = [
  { icon: Radar, title: 'Real-time OSINT', desc: 'Continuous ingestion from 55+ vetted feeds, Telegram, GDELT and licensed APIs.' },
  { icon: MapPin, title: 'City-level pinpointing', desc: '700+ cities geo-tagged with severity-coded markers across the globe.' },
  { icon: Bell, title: 'Watchlist alerts', desc: 'Push notifications scoped to your assets, regions and travelers in real time.' },
  { icon: Globe2, title: 'Country risk scoring', desc: 'Auto-scored from live event volume, severity and verified intelligence reports.' },
];

const USE_CASES = [
  {
    id: 'aviation',
    label: 'Aviation Incident',
    title: 'Plane crash disrupts regional operations',
    location: 'Detected at Municipal Airport',
    tags: ['Infrastructure', 'Closures', 'Traffic'],
    without: 'You learn about a regional aviation incident hours later through scattered social posts and news fragments — well after the operational impact has already disrupted travelers and supply chains.',
    with: 'Global Intel Desk surfaces the verified incident in real time with location, severity and asset proximity. You re-route travelers, notify staff and brief leadership before the news cycle catches up.',
  },
  {
    id: 'shooting',
    label: 'Active Shooter',
    title: 'Reports of gunfire near downtown asset',
    location: 'Detected near Central District',
    tags: ['Emergency', 'Safety', 'Lockdown'],
    without: 'Local emergency reports take time to surface. Your security team scrambles to confirm details while employees and travelers in the area remain unaware.',
    with: 'A geo-tagged alert is pushed to the desk and to every analyst with the area on watchlist. Asset proximity is calculated automatically and lockdown protocols can be triggered immediately.',
  },
  {
    id: 'weather',
    label: 'Severe Weather',
    title: 'Tropical cyclone tracking toward coast',
    location: 'Detected over open waters, ETA 36h',
    tags: ['Climate', 'Travel', 'Logistics'],
    without: 'You rely on generic weather alerts that lack context on which of your offices, travelers or shipments are actually exposed.',
    with: 'The platform overlays the storm path with your assets and itineraries, calculates exposure and pushes pre-impact briefings to affected stakeholders.',
  },
  {
    id: 'outage',
    label: 'Network Outage',
    title: 'Major telecom outage across region',
    location: 'Detected from multi-source signals',
    tags: ['Infrastructure', 'Connectivity'],
    without: 'Travelers and field teams go dark with no central visibility. Confirming the scope takes hours of manual investigation.',
    with: 'Cross-source anomaly detection flags the outage early. The desk maps the affected geography against your assets and travelers automatically.',
  },
  {
    id: 'military',
    label: 'Military Action',
    title: 'Forces movement reported in border region',
    location: 'Detected via OSINT + Telegram channels',
    tags: ['Geopolitical', 'Conflict'],
    without: 'Conflict signals are buried in noisy social channels and foreign-language sources. Critical context arrives too late.',
    with: 'Multilingual ingestion and analyst verification surface the event with full context, source links and severity rating in minutes.',
  },
];

const USE_CASE_ICONS: Record<string, typeof Plane> = {
  aviation: Plane, shooting: Shield, weather: CloudRain, outage: Wifi, military: Crosshair,
};

const FOOTER_LINKS = ['Resources', 'Partners & Integrations', 'About Us', 'Security', 'Careers'];

export default function Landing() {
  const [activeCase, setActiveCase] = useState(USE_CASES[0]);

  return (
    <div className="min-h-screen bg-[#070a0f] text-white antialiased">
      {/* Top accent line */}
      <div className="h-[3px] w-full" style={{ background: ACCENT }} />

      {/* Nav */}
      <nav className="bg-[#070a0f]">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-8 py-5">
          <Link to="/landing" className="flex items-center gap-2.5">
            <img src={logo} alt="Global Intel Desk" className="h-9 w-auto" />
            <span className="text-base font-semibold tracking-tight">Global Intel Desk</span>
          </Link>
          <div className="hidden md:flex items-center gap-10 text-[15px] text-white/85">
            {NAV.map(n => (
              <a key={n.label} href={n.href} className="hover:text-white transition">{n.label}</a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button
                className="text-white font-medium px-5 h-10 rounded-md hover:opacity-90 transition"
                style={{ background: ACCENT }}
              >
                Request Demo
              </Button>
            </Link>
            <Link to="/auth">
              <Button
                variant="outline"
                className="h-10 px-5 rounded-md border-white/30 bg-transparent text-white hover:bg-white/5"
              >
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Announcement banner */}
      <div className="w-full" style={{ background: ACCENT }}>
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-center gap-3 text-white">
          <span className="text-base font-semibold">Global Intel Desk Briefing 2026 — Learn more</span>
          <ArrowRight className="w-5 h-5" />
        </div>
      </div>

      {/* Hero */}
      <section className="relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(210,100%,30%)/0.18,_transparent_70%)]" />
        <div className="relative max-w-5xl mx-auto px-8 py-28 text-center">
          <p className="text-sm font-medium mb-6" style={{ color: ACCENT }}>
            Global Intelligence + Monitoring
          </p>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-8">
            Stay ahead of every<br />global disruption
          </h1>
          <p className="text-lg md:text-xl text-white/65 leading-relaxed max-w-2xl mx-auto mb-10">
            You cannot monitor every crisis the moment it happens — <span className="text-white font-semibold">Global Intel Desk can</span>.
            Our intelligence pipeline continuously scans the world for events that impact your people,
            assets and operations. Stop reacting. Take action.
          </p>
          <Link to="/auth">
            <Button
              className="text-white font-semibold px-8 h-12 rounded-md hover:opacity-90 transition text-base"
              style={{ background: ACCENT }}
            >
              Book a demo
            </Button>
          </Link>
        </div>
      </section>

      {/* Visual showcase */}
      <section className="relative pb-32">
        <div className="max-w-6xl mx-auto px-8">
          <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br from-[#0c1119] to-[#070a0f] p-10 md:p-16">
            <div className="grid md:grid-cols-3 gap-6 items-center">
              {/* Left card */}
              <div className="rounded-lg border border-white/10 bg-[#0c1119] p-5 shadow-2xl">
                <div className="text-[11px] font-semibold tracking-widest mb-2" style={{ color: ACCENT }}>BLOCKADE</div>
                <div className="text-sm font-semibold mb-1.5">Detours active on M-4 corridor</div>
                <div className="text-xs text-white/50">Detected · Eastern Province</div>
              </div>
              {/* Center card */}
              <div className="rounded-lg border border-white/15 bg-[#0c1119] p-6 shadow-2xl scale-105">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[11px] font-semibold tracking-widest" style={{ color: ACCENT }}>TORNADO</div>
                  <div className="text-[10px] text-white/40">Climate</div>
                </div>
                <div className="text-base font-semibold mb-1.5">Tornado touchdown in regional park</div>
                <div className="text-xs text-white/50">Detected · 800m from 2 assets</div>
              </div>
              {/* Right card */}
              <div className="rounded-lg border border-white/10 bg-[#0c1119] p-5 shadow-2xl">
                <div className="text-[11px] font-semibold tracking-widest text-white/70 mb-3">PEOPLE AT RISK <span className="text-white/40 font-normal">within 5 miles</span></div>
                <div className="space-y-2.5">
                  {[
                    { n: 'Operations Hub', t: 'Asset', d: '2.0 mi' },
                    { n: 'M. Rosser', t: 'Driver', d: '2.5 mi' },
                    { n: 'K. Kenter', t: 'Driver', d: '3.8 mi' },
                  ].map(p => (
                    <div key={p.n} className="flex items-center gap-2 text-xs">
                      <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                        <Activity className="w-3.5 h-3.5 text-white/60" />
                      </div>
                      <div className="flex-1">
                        <div className="text-white/90 font-medium">{p.n}</div>
                        <div className="text-[10px] text-white/40">{p.t}</div>
                      </div>
                      <div className="text-white/50 font-mono text-[11px]">{p.d}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Real-time alerts split */}
      <section id="platform" className="border-t border-white/5 bg-[#080b11]">
        <div className="max-w-6xl mx-auto px-8 py-28 grid md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-sm font-medium mb-5" style={{ color: ACCENT }}>Real-Time Intelligence Alerts</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight mb-7">
              Stop scrambling.<br />Get Intel Desk alerts.
            </h2>
            <p className="text-white/60 leading-relaxed mb-6">
              Our intelligence pipeline performs continuous analysis on public data sets to spot
              disruptive events. We send you early warning alerts and verified context, well ahead
              of traditional news and crisis monitoring tools.
            </p>
            <p className="text-white/60 leading-relaxed mb-8">
              Plug Global Intel Desk into your operational systems for deeper insights on travel
              management, employee safety, supply chain, market entry and operational resilience.
            </p>
            <ul className="space-y-3">
              {[
                'Instant real-time alerts so you are first to know',
                'Verified context with source links and severity scoring',
                'Asset proximity and traveler exposure calculated automatically',
                'Push delivery via the desk, email and webhook integrations',
              ].map(t => (
                <li key={t} className="flex items-start gap-3 text-[15px] text-white/80">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                       style={{ background: ACCENT }}>
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  </div>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Mock cards */}
          <div className="space-y-4">
            <div className="rounded-lg border border-white/10 bg-[#0c1119] p-5 shadow-xl">
              <div className="text-[11px] font-semibold tracking-widest mb-2" style={{ color: 'hsl(0,80%,65%)' }}>SHOOTING</div>
              <div className="text-sm font-semibold mb-1.5">Reports of gunfire near Central Park</div>
              <div className="text-xs text-white/50">Detected · 500m from 2 assets</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-[#0c1119] p-5 shadow-xl">
              <div className="text-[11px] font-semibold tracking-widest text-white/60 mb-3">NEARBY PEOPLE <span className="text-white/40 font-normal">within 5 miles</span></div>
              {[
                { n: 'Derek Wires', t: 'Employee' },
                { n: 'Cheyenne W.', t: 'Traveler' },
              ].map(p => (
                <div key={p.n} className="flex items-center gap-3 py-2 border-t border-white/5 first:border-t-0 text-sm">
                  <div className="w-8 h-8 rounded-full bg-white/10" />
                  <span className="flex-1 text-white/85">{p.n}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-white/60">{p.t}</span>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-white/10 bg-[#0c1119] p-6 shadow-xl">
              <div className="space-y-2.5">
                {[80, 45, 90, 60, 30].map((w, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: i % 2 ? ACCENT : 'hsl(0,80%,60%)' }} />
                    <div className="h-2 rounded-full bg-white/10" style={{ width: `${w}%` }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use cases (tabbed) */}
      <section id="use-cases" className="border-t border-white/5">
        <div className="max-w-6xl mx-auto px-8 py-28">
          <div className="text-center mb-14">
            <p className="text-sm font-medium mb-3" style={{ color: ACCENT }}>Use Cases</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">See Global Intel Desk in action</h2>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-12 border-b border-white/10">
            {USE_CASES.map(u => {
              const Icon = USE_CASE_ICONS[u.id];
              const active = activeCase.id === u.id;
              return (
                <button
                  key={u.id}
                  onClick={() => setActiveCase(u)}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition ${
                    active ? 'text-white' : 'border-transparent text-white/50 hover:text-white/80'
                  }`}
                  style={active ? { borderColor: ACCENT, color: 'white' } : { borderColor: 'transparent' }}
                >
                  <Icon className="w-4 h-4" />
                  {u.label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="grid md:grid-cols-2 gap-12 items-start">
            <div>
              <h3 className="text-2xl md:text-3xl font-bold mb-3 leading-tight">{activeCase.title}</h3>
              <p className="text-sm text-white/55 mb-5">{activeCase.location}</p>
              <div className="flex flex-wrap gap-2 mb-8">
                {activeCase.tags.map(t => (
                  <span key={t} className="text-xs px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/70">{t}</span>
                ))}
              </div>
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <X className="w-4 h-4 text-red-400" />
                    <span className="font-semibold">Without Global Intel Desk</span>
                  </div>
                  <p className="text-white/55 text-[15px] leading-relaxed pl-6">{activeCase.without}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="w-4 h-4" style={{ color: ACCENT }} />
                    <span className="font-semibold">With Global Intel Desk</span>
                  </div>
                  <p className="text-white/55 text-[15px] leading-relaxed pl-6">{activeCase.with}</p>
                </div>
              </div>
            </div>

            {/* Map mock */}
            <div className="rounded-xl border border-white/10 bg-[#0c1119] aspect-[4/3] relative overflow-hidden">
              <div className="absolute inset-0 opacity-20"
                   style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full animate-ping" style={{ background: `${ACCENT}`, opacity: 0.3, width: 220, height: 220, left: -110, top: -110 }} />
                  <div className="rounded-full" style={{ background: `${ACCENT}33`, width: 220, height: 220, position: 'absolute', left: -110, top: -110 }} />
                  <div className="rounded-full" style={{ background: `${ACCENT}55`, width: 120, height: 120, position: 'absolute', left: -60, top: -60 }} />
                  <div className="w-4 h-4 rounded-full ring-4 ring-white/30" style={{ background: ACCENT }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Coverage / capabilities grid */}
      <section id="coverage" className="border-t border-white/5 bg-[#080b11]">
        <div className="max-w-6xl mx-auto px-8 py-28">
          <div className="text-center mb-16">
            <p className="text-sm font-medium mb-3" style={{ color: ACCENT }}>Coverage Areas</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Built for professional intelligence work</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(f => (
              <div key={f.title} className="rounded-xl border border-white/10 bg-[#0c1119] p-7 hover:border-white/20 transition">
                <div className="w-11 h-11 rounded-lg flex items-center justify-center mb-5" style={{ background: `${ACCENT}22` }}>
                  <f.icon className="w-5 h-5" style={{ color: ACCENT }} />
                </div>
                <h3 className="text-base font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-white/55 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/5">
        <div className="max-w-4xl mx-auto px-8 py-28 text-center">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Ready to operate your own intelligence desk?
          </h2>
          <p className="text-white/60 mb-10 text-lg max-w-2xl mx-auto">
            Join security teams, risk analysts and corporate travel programs using Global Intel Desk
            to stay ahead of global events.
          </p>
          <Link to="/auth">
            <Button
              className="text-white font-semibold px-8 h-12 rounded-md hover:opacity-90 transition text-base gap-2"
              style={{ background: ACCENT }}
            >
              Request Demo <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer id="about" className="border-t border-white/5 bg-[#070a0f]">
        <div className="max-w-7xl mx-auto px-8 py-16 grid md:grid-cols-2 gap-14">
          <div>
            <div className="flex items-center gap-2.5 mb-8">
              <img src={logo} alt="Global Intel Desk" className="h-9 w-auto" />
              <span className="text-base font-semibold">Global Intel Desk</span>
            </div>
            <ul className="space-y-3.5">
              {FOOTER_LINKS.map(l => (
                <li key={l}><a href="#" className="text-[15px] text-white/80 underline-offset-4 hover:underline">{l}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-2xl font-bold mb-3">Stay informed</h3>
            <p className="text-white/60 mb-5 leading-relaxed">
              Keep up-to-date with the latest intelligence updates and insights from our team.
            </p>
            <form onSubmit={(e) => e.preventDefault()} className="space-y-3 max-w-md">
              <input
                type="email"
                placeholder="Enter email address*"
                className="w-full h-12 px-4 rounded-md bg-white text-black placeholder:text-black/40 focus:outline-none"
              />
              <Button
                type="submit"
                className="text-white font-semibold px-6 h-11 rounded-md hover:opacity-90 transition"
                style={{ background: ACCENT }}
              >
                Sign Up
              </Button>
            </form>
          </div>
        </div>
        <div className="border-t border-white/5">
          <div className="max-w-7xl mx-auto px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-white/50">
            <div className="flex items-center gap-6">
              <span>© 2026 Global Intel Desk</span>
              <a href="#" className="hover:text-white underline-offset-4 hover:underline">Privacy Policy</a>
              <a href="#" className="hover:text-white underline-offset-4 hover:underline">Terms of Service</a>
            </div>
            <div className="flex items-center gap-4">
              <span>Follow us</span>
              <Twitter className="w-5 h-5 hover:text-white cursor-pointer" />
              <Linkedin className="w-5 h-5 hover:text-white cursor-pointer" />
              <Youtube className="w-5 h-5 hover:text-white cursor-pointer" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}