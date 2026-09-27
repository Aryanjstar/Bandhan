import { useMemo } from 'react';
import type { DogEvent } from '../lib/api';
import { EVENT_COPY, timeAgo, type DogData } from './useDogData';
import { Bell, DogAvatar, font } from './ui';

const DAY_MS = 24 * 3600 * 1000;
const WEIGHT: Record<string, number> = { distress: 5, sustained_stillness: 3, minor_anomaly: 1, low_battery: 0 };
const TYPES = [
  { id: 'distress', label: 'Distress', color: '#ffffff' },
  { id: 'sustained_stillness', label: 'Stillness', color: '#93c5fd' },
  { id: 'minor_anomaly', label: 'Minor', color: '#1e3a8a' },
  { id: 'low_battery', label: 'Battery', color: '#fbbf24' },
];

const card = 'bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.15)] rounded-[24px] flex flex-col gap-[14px] p-[16px]';
const dim = 'text-[rgba(255,255,255,0.7)]';

function startOfDay(t: number) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }

export default function Analytics({ data, photo, unseen, onBellClick }: {
  data: DogData; photo: string | null; unseen: number; onBellClick: () => void;
}) {
  const { dog, events, device } = data;
  const name = dog?.name || 'Your dog';

  const stats = useMemo(() => computeStats(events), [events]);

  return (
    <div className="absolute inset-0 bg-[#1b5df1] overflow-hidden">
      <div className="absolute inset-0 backdrop-blur-[150px] bg-[rgba(255,255,255,0.15)] pointer-events-none" />
      <div className="absolute inset-0 overflow-y-auto pawse-scroll">
        <div className="absolute bg-[#1b5df1] h-[220px] left-0 top-0 w-full rounded-bl-[40px] rounded-br-[40px]" />
        <div className="relative flex flex-col gap-[16px] px-6 pt-12 pb-32">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-[4px]">
              <p className="text-[28px] text-white leading-normal" style={font.bold}>Analytics</p>
              <p className="text-[13px] text-[rgba(255,255,255,0.8)]" style={font.med}>{name} · Last 7 days</p>
            </div>
            <Bell count={unseen} onClick={onBellClick} />
          </div>

          <div className="bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.15)] rounded-[24px] flex gap-[12px] items-center p-[12px]">
            <DogAvatar size={64} photo={photo} />
            <div className="flex flex-col gap-[4px] flex-1 min-w-0">
              <p className="text-[18px] text-white" style={font.bold}>{name}</p>
              <p className="text-[12px] text-[rgba(255,255,255,0.8)] truncate" style={font.med}>
                {[dog?.age, dog?.breed === 'Mixed Breed' && dog?.breedDetail ? dog.breedDetail : dog?.breed].filter(Boolean).join(' · ')}
              </p>
              <div className="flex gap-[8px] items-center">
                <div className="bg-[rgba(255,255,255,0.1)] rounded-full px-[10px] py-[6px]">
                  <p className="text-[11px] text-white" style={font.sb}>
                    {device ? (device.connectivity === 'online' ? 'Collar online' : 'Collar offline') : 'No collar'}
                  </p>
                </div>
                <p className={`text-[11px] ${dim}`} style={font.med}>
                  {device ? `Last sync ${timeAgo(device.lastSeenAt)}` : 'Pair one in Profile'}
                </p>
              </div>
            </div>
          </div>

          <div className={card}>
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-[2px]">
                <p className="text-[16px] text-white" style={font.bold}>Overall trends</p>
                <p className={`text-[12px] ${dim}`} style={font.med}>Alerts per day</p>
              </div>
              <div className="bg-[rgba(255,255,255,0.1)] rounded-full px-[10px] py-[6px]">
                <p className="text-[11px] text-white" style={font.sb}>7 day view</p>
              </div>
            </div>
            <div className="flex gap-[8px]">
              {[
                { label: 'Today', value: String(stats.today) },
                { label: 'This week', value: String(events.length) },
                { label: 'Alert score', value: String(stats.score) },
              ].map(({ label, value }) => (
                <div key={label} className="bg-[rgba(255,255,255,0.07)] rounded-[16px] p-[10px] flex flex-col gap-[4px] flex-1">
                  <p className={`text-[11px] ${dim}`} style={font.med}>{label}</p>
                  <p className="text-[18px] text-white" style={font.bold}>{value}</p>
                </div>
              ))}
            </div>
            <TrendChart points={stats.perDay.map(d => d.count)} />
            <div className="flex justify-between">
              {stats.perDay.map(d => <p key={d.label} className={`text-[11px] ${dim}`} style={font.med}>{d.label}</p>)}
            </div>
          </div>

          <div className={card}>
            <div className="flex flex-col gap-[2px]">
              <p className="text-[16px] text-white" style={font.bold}>Motion analytics</p>
              <p className={`text-[12px] ${dim}`} style={font.med}>Motion-triggered alerts by hour</p>
            </div>
            <div className="flex gap-[4px] items-end justify-between">
              {stats.motionByHour.map(({ hour, count }) => (
                <div key={hour} className="flex flex-col gap-[6px] items-center">
                  <div className="bg-[rgba(255,255,255,0.12)] h-[72px] overflow-hidden rounded-[12px] w-[20px] relative">
                    <div className="absolute bg-white left-0 right-0 bottom-0 transition-all"
                      style={{ height: `${stats.motionMax ? (count / stats.motionMax) * 72 : 0}px` }} />
                  </div>
                  <p className={`text-[10px] ${dim}`} style={font.med}>{hour}</p>
                </div>
              ))}
            </div>
            {stats.motionMax === 0 && <p className={`text-[12px] ${dim} text-center`} style={font.med}>No unusual movement this week</p>}
          </div>

          <div className={card}>
            <div className="flex flex-col gap-[2px]">
              <p className="text-[16px] text-white" style={font.bold}>Alert breakdown</p>
              <p className={`text-[12px] ${dim}`} style={font.med}>
                By type · {stats.vocal} vocal-triggered, {stats.motion} motion-triggered
              </p>
            </div>
            <div className="flex items-center justify-center h-[140px] relative">
              <div className="size-[132px] rounded-full" style={{ background: stats.donut }} />
              <div className="absolute size-[92px] rounded-full bg-[#4a7ef4] flex flex-col items-center justify-center">
                <p className="text-[24px] text-white leading-none" style={font.bold}>{stats.today}</p>
                <p className={`text-[11px] ${dim}`} style={font.med}>alerts today</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-[8px]">
              {TYPES.map(t => (
                <div key={t.id} className="bg-[rgba(255,255,255,0.07)] rounded-[16px] p-[10px] flex gap-[8px] items-center">
                  <div className="size-[10px] rounded-full shrink-0" style={{ background: t.color }} />
                  <div className="flex flex-col gap-px">
                    <p className="text-[11px] text-white" style={font.sb}>{t.label}</p>
                    <p className={`text-[10px] ${dim}`} style={font.med}>{stats.pct[t.id]}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={card}>
            <p className="text-[16px] text-white" style={font.bold}>Recent alerts</p>
            {events.length === 0 && (
              <p className={`text-[12px] ${dim}`} style={font.med}>
                Nothing yet. Pawse is learning {name}'s normal routine — alerts will show up here.
              </p>
            )}
            {events.slice(0, 6).map(e => (
              <div key={e.id} className="flex items-center justify-between gap-2">
                <div className="flex flex-col min-w-0">
                  <p className="text-[13px] text-white truncate" style={font.sb}>{EVENT_COPY[e.class]?.title ?? e.class}</p>
                  <p className={`text-[11px] ${dim}`} style={font.med}>
                    {timeAgo(e.timestamp)}{e.sourceSignals?.length ? ` · ${e.sourceSignals.join(' + ')}` : ''}
                  </p>
                </div>
                {e.feedback !== 'unset' && (
                  <span className="text-[10px] text-white bg-white/15 rounded-full px-2 py-1 shrink-0" style={font.sb}>
                    {e.feedback === 'false' ? 'False alarm' : 'Confirmed'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function computeStats(events: DogEvent[]) {
  const now = Date.now();
  const today0 = startOfDay(now);
  const real = events.filter(e => e.feedback !== 'false');

  const perDay = Array.from({ length: 7 }, (_, i) => {
    const start = today0 - (6 - i) * DAY_MS;
    return {
      label: new Date(start).toLocaleDateString(undefined, { weekday: 'short' }),
      count: real.filter(e => { const t = new Date(e.timestamp).getTime(); return t >= start && t < start + DAY_MS; }).length,
    };
  });

  const motionByHour = Array.from({ length: 12 }, (_, i) => ({ hour: String(i * 2).padStart(2, '0'), count: 0 }));
  for (const e of real) {
    if (e.sourceSignals?.includes('motion')) motionByHour[Math.floor(new Date(e.timestamp).getHours() / 2)].count++;
  }

  const counts: Record<string, number> = {};
  for (const e of real) counts[e.class] = (counts[e.class] ?? 0) + 1;
  const total = real.length;
  const pct: Record<string, number> = {};
  let acc = 0;
  const stops: string[] = [];
  for (const t of TYPES) {
    const share = total ? (counts[t.id] ?? 0) / total : 0;
    pct[t.id] = Math.round(share * 100);
    if (share > 0) stops.push(`${t.color} ${acc * 360}deg ${(acc + share) * 360}deg`);
    acc += share;
  }

  return {
    perDay,
    today: perDay[6].count,
    score: Math.min(100, real.filter(e => new Date(e.timestamp).getTime() >= now - DAY_MS)
      .reduce((s, e) => s + (WEIGHT[e.class] ?? 0), 0)),
    motionByHour,
    motionMax: Math.max(0, ...motionByHour.map(b => b.count)),
    vocal: real.filter(e => e.sourceSignals?.includes('vocal')).length,
    motion: real.filter(e => e.sourceSignals?.includes('motion')).length,
    pct,
    donut: stops.length ? `conic-gradient(${stops.join(', ')})` : 'rgba(255,255,255,0.15)',
  };
}

function TrendChart({ points }: { points: number[] }) {
  const W = 300, H = 90;
  const max = Math.max(1, ...points);
  const xy = points.map((p, i) => [(i / (points.length - 1)) * W, H - (p / max) * (H - 6) - 3] as const);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [lx, ly] = xy[xy.length - 1];
  return (
    <div className="bg-[rgba(255,255,255,0.05)] rounded-[16px] overflow-hidden relative h-[132px] px-[12px] pt-[24px]">
      {[24, 54, 84, 114].map(top => <div key={top} className="absolute bg-[rgba(255,255,255,0.1)] h-px left-[12px] right-[12px]" style={{ top }} />)}
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="relative w-full h-[90px] overflow-visible">
        <path d={`${line} L${W},${H} L0,${H} Z`} fill="rgba(255,255,255,0.12)" />
        <path d={line} fill="none" stroke="white" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        <circle cx={lx} cy={ly} r={4} fill="white" />
      </svg>
    </div>
  );
}
