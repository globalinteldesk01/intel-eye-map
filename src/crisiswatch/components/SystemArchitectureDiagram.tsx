import { Github, Youtube, Instagram, Linkedin } from 'lucide-react';

/**
 * Animated system architecture diagram.
 * Sources -> Global Data Source -> NLP+AI -> GIO AI -> Interactive Dashboard
 * Dashboard inputs: Country Risk, Travel Itinerary
 * Dashboard outputs: In Travel alerts, Pre Travel alerts
 */

const Node = ({
  x,
  y,
  w = 120,
  h = 64,
  label,
  sub,
  highlight,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  label: string;
  sub?: string;
  highlight?: boolean;
}) => (
  <g>
    <rect
      x={x - w / 2}
      y={y - h / 2}
      width={w}
      height={h}
      rx={10}
      fill="rgba(17,19,24,0.8)"
      stroke={highlight ? '#00d4ff' : 'rgba(0,212,255,0.35)'}
      strokeWidth={highlight ? 1.4 : 1}
    />
    <text
      x={x}
      y={sub ? y - 4 : y + 4}
      textAnchor="middle"
      fontFamily="ui-monospace, SFMono-Regular, monospace"
      fontSize={11}
      fill="#e2e8f0"
      fontWeight={600}
    >
      {label}
    </text>
    {sub && (
      <text
        x={x}
        y={y + 12}
        textAnchor="middle"
        fontFamily="ui-monospace, SFMono-Regular, monospace"
        fontSize={9}
        fill="rgba(255,255,255,0.45)"
      >
        {sub}
      </text>
    )}
  </g>
);

const FlowPath = ({ d, delay = 0 }: { d: string; delay?: number }) => (
  <>
    <path d={d} stroke="rgba(0,212,255,0.25)" strokeWidth={1} fill="none" />
    <path
      d={d}
      stroke="#00d4ff"
      strokeWidth={1.5}
      fill="none"
      strokeLinecap="round"
      strokeDasharray="6 200"
    >
      <animate
        attributeName="stroke-dashoffset"
        from="0"
        to="-206"
        dur="3s"
        begin={`${delay}s`}
        repeatCount="indefinite"
      />
    </path>
  </>
);

// Source brand icons
const SourceTelegram = () => (
  <svg viewBox="0 0 24 24" width={20} height={20}>
    <circle cx="12" cy="12" r="11" fill="#2AABEE" />
    <path
      d="M5.5 11.5l11-4.2c.5-.2 1 .1.85.7l-1.9 9c-.1.5-.5.6-.95.4l-2.7-2-1.3 1.25c-.15.15-.3.3-.6.3l.2-2.85L15.4 9.5c.2-.2-.05-.3-.3-.1L9.1 13.3l-2.6-.85c-.55-.2-.55-.6.1-.9z"
      fill="white"
    />
  </svg>
);
const SourceX = () => (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="white">
    <path d="M18 2h3l-7.5 8.6L22 22h-6.8l-5.3-6.9L3.6 22H.5l8-9.2L0 2h7l4.8 6.3L18 2zm-2.4 18h2L7.5 4H5.5l10.1 16z" />
  </svg>
);
const SourceReddit = () => (
  <svg viewBox="0 0 24 24" width={20} height={20}>
    <circle cx="12" cy="12" r="11" fill="#FF4500" />
    <circle cx="12" cy="13" r="6.5" fill="white" />
    <circle cx="9.6" cy="12.6" r="1" fill="#FF4500" />
    <circle cx="14.4" cy="12.6" r="1" fill="#FF4500" />
    <path
      d="M9.5 15c.7.6 1.6.9 2.5.9s1.8-.3 2.5-.9"
      stroke="#FF4500"
      strokeWidth="1"
      fill="none"
      strokeLinecap="round"
    />
  </svg>
);

export function SystemArchitectureDiagram() {
  // Layout coordinates (viewBox 1100 x 560)
  const sourceY = 470;
  const sources = [
    { x: 80, label: 'Telegram', Icon: SourceTelegram },
    { x: 160, label: 'GitHub', Icon: () => <Github className="w-5 h-5 text-white" /> },
    { x: 240, label: 'YouTube', Icon: () => <Youtube className="w-5 h-5 text-[#FF0000]" /> },
    { x: 320, label: 'Instagram', Icon: () => <Instagram className="w-5 h-5 text-[#E4405F]" /> },
    { x: 400, label: 'Reddit', Icon: SourceReddit },
    { x: 480, label: 'LinkedIn', Icon: () => <Linkedin className="w-5 h-5 text-[#0A66C2]" /> },
    { x: 560, label: 'X', Icon: SourceX },
  ];

  const hub = { x: 320, y: 110 };
  const nlp = { x: 600, y: 110 };
  const sam = { x: 800, y: 110 };
  const dash = { x: 800, y: 310 };
  const countryRisk = { x: 580, y: 310 };
  const itinerary = { x: 1020, y: 310 };
  const inTravel = { x: 660, y: 500 };
  const preTravel = { x: 940, y: 500 };

  const curve = (x1: number, y1: number, x2: number, y2: number) => {
    const mx = (x1 + x2) / 2;
    return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
  };

  return (
    <div className="w-full overflow-hidden rounded-xl border" style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'radial-gradient(ellipse at center, #0d1117 0%, #050608 100%)' }}>
      <svg viewBox="0 0 1100 560" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        {/* Glow defs */}
        <defs>
          <radialGradient id="ringGlow" cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor="rgba(0,212,255,0)" />
            <stop offset="100%" stopColor="rgba(0,212,255,0.25)" />
          </radialGradient>
        </defs>

        {/* Source feed lines into hub */}
        {sources.map((s, i) => (
          <FlowPath key={s.label} d={curve(s.x, sourceY - 22, hub.x, hub.y + 32)} delay={i * 0.25} />
        ))}

        {/* Pipeline lines */}
        <FlowPath d={curve(hub.x + 60, hub.y, nlp.x - 60, nlp.y)} delay={0.2} />
        <FlowPath d={curve(nlp.x + 60, nlp.y, sam.x - 60, sam.y)} delay={0.5} />
        <FlowPath d={`M${sam.x},${sam.y + 32} L${sam.x},${dash.y - 64}`} delay={0.8} />

        {/* Inputs to dashboard */}
        <FlowPath d={curve(countryRisk.x + 60, countryRisk.y, dash.x - 60, dash.y)} delay={1.1} />
        <FlowPath d={curve(itinerary.x - 60, itinerary.y, dash.x + 60, dash.y)} delay={1.3} />

        {/* Outputs from dashboard */}
        <FlowPath d={curve(dash.x - 30, dash.y + 60, inTravel.x, inTravel.y - 30)} delay={1.5} />
        <FlowPath d={curve(dash.x + 30, dash.y + 60, preTravel.x, preTravel.y - 30)} delay={1.7} />

        {/* Nodes */}
        <Node x={hub.x} y={hub.y} w={140} h={64} label="Global Data" sub="Source" highlight />
        <Node x={nlp.x} y={nlp.y} label="NLP + AI" />
        <Node x={sam.x} y={sam.y} label="GIO AI" highlight />

        {/* Interactive Dashboard ring */}
        <g>
          <circle cx={dash.x} cy={dash.y} r={75} fill="url(#ringGlow)" />
          <circle
            cx={dash.x}
            cy={dash.y}
            r={62}
            fill="none"
            stroke="rgba(0,212,255,0.4)"
            strokeWidth={1}
          />
          {/* Tick ring */}
          {Array.from({ length: 60 }).map((_, i) => {
            const a = (i / 60) * Math.PI * 2;
            const r1 = 50;
            const r2 = 60;
            return (
              <line
                key={i}
                x1={dash.x + Math.cos(a) * r1}
                y1={dash.y + Math.sin(a) * r1}
                x2={dash.x + Math.cos(a) * r2}
                y2={dash.y + Math.sin(a) * r2}
                stroke="rgba(0,212,255,0.45)"
                strokeWidth={1}
              />
            );
          })}
          <circle
            cx={dash.x}
            cy={dash.y}
            r={40}
            fill="none"
            stroke="#00d4ff"
            strokeWidth={1.2}
            strokeDasharray="20 230"
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              from={`0 ${dash.x} ${dash.y}`}
              to={`360 ${dash.x} ${dash.y}`}
              dur="8s"
              repeatCount="indefinite"
            />
          </circle>
          <text
            x={dash.x}
            y={dash.y - 4}
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            fontSize={11}
            fill="#e2e8f0"
            fontWeight={700}
          >
            Interactive
          </text>
          <text
            x={dash.x}
            y={dash.y + 10}
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            fontSize={11}
            fill="#e2e8f0"
            fontWeight={700}
          >
            Dashboard
          </text>
        </g>

        <Node x={countryRisk.x} y={countryRisk.y} label="Country" sub="Risk" />
        <Node x={itinerary.x} y={itinerary.y} label="Travel" sub="Itinerary" />
        <Node x={inTravel.x} y={inTravel.y} w={130} label="In Travel" sub="alerts" />
        <Node x={preTravel.x} y={preTravel.y} w={130} label="Pre Travel" sub="alerts" />
      </svg>

      {/* Source icons row, layered over svg using same coords */}
      <div className="relative -mt-[140px] pointer-events-none" aria-hidden>
        <div className="relative w-full" style={{ aspectRatio: '1100 / 90' }}>
          {sources.map((s) => (
            <div
              key={s.label}
              className="absolute flex flex-col items-center gap-1"
              style={{ left: `${(s.x / 1100) * 100}%`, top: 0, transform: 'translateX(-50%)' }}
            >
              <div className="w-9 h-9 rounded-full bg-[#0d1117] border border-white/10 flex items-center justify-center shadow-[0_0_12px_rgba(0,212,255,0.15)]">
                <s.Icon />
              </div>
              <span className="text-[9px] font-mono uppercase tracking-wider text-white/40">
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}