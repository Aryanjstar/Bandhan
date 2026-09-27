import { useEffect, useMemo, useState } from 'react';
import { PetDigitalTwin, type PetActivity } from '../pet-3d';
import { sendCue, sendEventFeedback, startCheckIn, updateSettings, type Cue, type DogEvent } from '../lib/api';
import { EVENT_COPY, SEVERITY, timeAgo, type DogData } from './useDogData';
import { Bell, DogAvatar, font, imgBlob, type Page } from './ui';

const A = '/assets';
const imgChevronL = `${A}/30142.svg`;
const imgChevronR = `${A}/cbb34.svg`;
const imgPlus = `${A}/e1625.svg`;
const imgCheckCircle = `${A}/11942.svg`;

const LIVE_STALE_MS = 30_000;
const RECENT_ALERT_MS = 60 * 60 * 1000;

// Chevrons step through a preview of the twin's animations; "Live" follows the collar.
const VIEWS: { id: 'live' | PetActivity; label: string }[] = [
  { id: 'live', label: 'Live' },
  { id: 'idle', label: 'Resting' },
  { id: 'walk', label: 'Walking' },
  { id: 'run', label: 'Running' },
  { id: 'eat', label: 'Eating' },
];

// Mirrors the rest / pacing cut-offs in backend/fusion-service/src/lib/motionClassifier.js.
function activityFromMotion(motionClass: string, energy: number): PetActivity {
  if (motionClass === 'distress') return 'headShake';
  if (energy >= 0.5) return 'run';
  if (energy >= 0.15) return 'walk';
  return 'idle';
}

const POSTURES = [
  { id: 'stationary', label: 'Stays still' },
  { id: 'paw_raised', label: 'Raises a paw' },
  { id: 'approached', label: 'Comes closer' },
];
const BEEPS = ['single', 'double', 'continuous'];

const RESULT_COPY: Record<string, string> = {
  match: 'responded correctly',
  approximate_match: 'probably responded',
  no_match: "didn't respond as expected",
  timeout: 'no response in time',
};

interface Props {
  data: DogData;
  photo: string | null;
  unseen: number;
  onNavigate: (p: Page) => void;
  onBellClick: () => void;
  notify: (text: string, tone?: 'info' | 'error') => void;
}

export default function Dashboard({ data, photo, unseen, onNavigate, onBellClick, notify }: Props) {
  const { dog, settings, events, device, live, checkInUntil, lastSession } = data;
  const name = dog?.name || 'Your dog';
  const [viewIdx, setViewIdx] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const liveFresh = !!live && now - new Date(live.timestamp).getTime() < LIVE_STALE_MS;
  const view = VIEWS[viewIdx];
  const activity: PetActivity = view.id === 'live'
    ? (liveFresh ? activityFromMotion(live!.motionClass, live!.motionEnergy) : 'idle')
    : view.id;
  const checkingIn = !!checkInUntil && new Date(checkInUntil).getTime() > now;

  const cues = settings?.cues ?? [];

  const activeAlert: DogEvent | null = useMemo(() => {
    const recent = events.filter(e => e.feedback !== 'false' && now - new Date(e.timestamp).getTime() < RECENT_ALERT_MS);
    return recent.sort((a, b) => (SEVERITY[b.class] ?? 0) - (SEVERITY[a.class] ?? 0))[0] ?? null;
  }, [events, now]);

  useEffect(() => {
    if (lastSession && lastSession.matchResult !== 'pending') {
      const label = cues.find(c => c.id === lastSession.cue)?.label ?? lastSession.cue;
      notify(`${label}: ${name} ${RESULT_COPY[lastSession.matchResult] ?? lastSession.matchResult}`);
    }
  }, [lastSession?.id, lastSession?.matchResult]);

  const run = async (key: string, fn: () => Promise<void>) => {
    if (!dog || busy) return;
    setBusy(key);
    try { await fn(); } catch (err) {
      notify(err instanceof Error ? friendly(err.message) : 'Something went wrong', 'error');
    } finally { setBusy(null); }
  };

  const checkIn = () => run('check-in', async () => {
    const until = await startCheckIn(dog!.id);
    data.setCheckInUntil(until);
    setViewIdx(0);
    notify(`Beeping ${name}'s collar — live motion for the next 15 s`);
  });

  const cue = (c: Cue) => run(c.id, async () => {
    const session = await sendCue(dog!.id, c.id);
    data.trackSession(session);
    notify(`"${c.label}" sent — watching for ${name}'s response`);
  });

  const feedback = (e: DogEvent, value: 'accurate' | 'false') => run(`fb-${e.id}`, async () => {
    const { event } = await sendEventFeedback(dog!.id, e.id, value);
    data.patchEvent(event);
    notify(value === 'false' ? 'Thanks — marked as a false alarm' : 'Thanks — marked as accurate');
  });

  const addCue = (c: Cue) => run('add-cue', async () => {
    const next = await updateSettings(dog!.id, { cues: [...cues, c] });
    data.setSettings(next);
    setAdding(false);
    notify(`Added "${c.label}"`);
  });

  const [first, second, ...extra] = cues;

  return (
    <div className="absolute inset-0 bg-[#1b5df1] overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute" style={{ inset: '-1.07% -76.29% -1.9% -75.9%' }}>
          <div className="-rotate-180 -scale-x-100 w-full h-full">
            <img alt="" className="w-full h-full object-fill" src={imgBlob} />
          </div>
        </div>
      </div>
      <div className="absolute inset-0 backdrop-blur-[150px] bg-[rgba(255,255,255,0.15)]" />

      <div className="absolute inset-0 overflow-y-auto pawse-scroll">
        <div className="relative flex flex-col gap-[17px] px-6 pt-12 pb-32">
          <div className="flex items-center justify-between">
            <button onClick={() => onNavigate('profile')} aria-label="View profile"><DogAvatar size={59} photo={photo} /></button>
            <div className="flex flex-col items-center">
              <span className="text-[#1b5df1] text-[18px]" style={font.sb}>{name}</span>
              <span className="text-[11px] text-[#1b5df1]/70 flex items-center gap-1" style={font.med}>
                <span className="size-[6px] rounded-full" style={{ background: device?.connectivity === 'online' ? '#22c55e' : '#94a3b8' }} />
                {view.id === 'live'
                  ? (checkingIn ? 'Live check-in' : liveFresh ? `Live · ${VIEWS.find(v => v.id === activity)?.label ?? 'Active'}`
                    : device ? `Collar ${device.connectivity}${device.batteryPct != null ? ` · ${device.batteryPct}%` : ''}` : 'No collar paired')
                  : `Preview · ${view.label}`}
              </span>
            </div>
            <Bell count={unseen} onClick={onBellClick} />
          </div>

          <div className="flex items-center justify-between gap-2">
            <button onClick={() => setViewIdx(i => (i - 1 + VIEWS.length) % VIEWS.length)}
              className="bg-[rgba(255,255,255,0.1)] rounded-full p-[10px] shrink-0" aria-label="Previous">
              <img alt="" className="size-[18px] rotate-90" src={imgChevronL} />
            </button>
            <div className="relative flex-1 h-[252px] rounded-[24px] overflow-hidden pawse-twin">
              <PetDigitalTwin activity={activity} activityMode="manual" connected playing
                style={{ height: '100%', border: 'none', borderRadius: 24 }} />
            </div>
            <button onClick={() => setViewIdx(i => (i + 1) % VIEWS.length)}
              className="bg-[rgba(255,255,255,0.1)] rounded-full p-[10px] shrink-0" aria-label="Next">
              <img alt="" className="size-[18px] -rotate-90" src={imgChevronR} />
            </button>
          </div>

          <div className="flex flex-col gap-[8px]">
            <CmdButton label={checkingIn ? 'Checking in…' : 'Come to the camera'} busy={busy === 'check-in'} onClick={checkIn} full />
            <div className="flex gap-[8px] items-center">
              {first && <CmdButton label={first.label} busy={busy === first.id} onClick={() => cue(first)} className="w-[91px]" />}
              {second && <CmdButton label={second.label} busy={busy === second.id} onClick={() => cue(second)} className="flex-1" />}
              {!first && <div className="flex-1" />}
              <button onClick={() => setAdding(true)} aria-label="Add a command"
                className="bg-[rgba(255,255,255,0.4)] rounded-[34px] size-[54px] flex items-center justify-center shrink-0 active:scale-95 transition-transform">
                <img alt="" className="size-[24px]" src={imgPlus} />
              </button>
            </div>
            {extra.length > 0 && (
              <div className="flex flex-wrap gap-[8px]">
                {extra.map(c => <CmdButton key={c.id} label={c.label} busy={busy === c.id} onClick={() => cue(c)} className="flex-1 min-w-[40%]" />)}
              </div>
            )}
          </div>

          <StatusCard alert={activeAlert} name={name} busy={busy} onFeedback={feedback} />
        </div>
      </div>

      {adding && <AddCueSheet existing={cues} busy={busy === 'add-cue'} onClose={() => setAdding(false)} onSave={addCue} />}
    </div>
  );
}

function friendly(msg: string) {
  if (msg.includes('no device paired')) return 'Pair a collar first — open the profile to add one';
  return msg;
}

function CmdButton({ label, onClick, busy, full, className = '' }: {
  label: string; onClick: () => void; busy?: boolean; full?: boolean; className?: string;
}) {
  return (
    <button onClick={onClick} disabled={busy}
      className={`bg-[#1b5df1] rounded-[8px] px-[10px] py-[12px] text-center active:scale-[0.98] transition-transform ${full ? 'w-full' : ''} ${className}`}
      style={{ opacity: busy ? 0.6 : 1 }}>
      <span className="text-[20px] text-white leading-normal whitespace-nowrap" style={font.med}>{busy ? '…' : label}</span>
    </button>
  );
}

function StatusCard({ alert, name, busy, onFeedback }: {
  alert: DogEvent | null; name: string; busy: string | null;
  onFeedback: (e: DogEvent, v: 'accurate' | 'false') => void;
}) {
  const urgent = alert?.class === 'distress';
  const copy = alert ? EVENT_COPY[alert.class] : null;
  return (
    <div className="rounded-[30px] p-[24px] flex flex-col gap-[20px] items-center justify-center min-h-[200px]"
      style={{ background: urgent ? 'rgba(243,32,39,0.75)' : 'rgba(27,93,241,0.2)' }}>
      <div className="bg-[rgba(255,255,255,0.1)] rounded-[32px] size-[64px] flex items-center justify-center">
        {alert
          ? <span className="text-white text-[30px] leading-none" style={font.bold}>!</span>
          : <img alt="" className="size-[32px]" src={imgCheckCircle} />}
      </div>
      <div className="flex flex-col gap-[8px] items-center text-center w-full">
        <p className="text-[22px] text-white w-full leading-normal" style={font.inter(600)}>
          {copy ? copy.title : 'Everything is okay'}
        </p>
        <p className="text-[15px] text-[rgba(255,255,255,0.8)] leading-[1.5] w-full" style={font.inter(400)}>
          {copy
            ? `${copy.body(name)} · ${timeAgo(alert!.timestamp)}`
            : 'There are no urgent notifications or stressful updates right now. Take a deep breath and relax.'}
        </p>
      </div>
      {alert && alert.feedback === 'unset' && (
        <div className="flex gap-2 w-full">
          <button onClick={() => onFeedback(alert, 'false')} disabled={!!busy}
            className="flex-1 rounded-[16px] py-2 bg-white/20 text-white text-[13px]" style={font.sb}>False alarm</button>
          <button onClick={() => onFeedback(alert, 'accurate')} disabled={!!busy}
            className="flex-1 rounded-[16px] py-2 bg-white text-[#1b5df1] text-[13px]" style={font.sb}>That's right</button>
        </div>
      )}
    </div>
  );
}

function AddCueSheet({ existing, busy, onClose, onSave }: {
  existing: Cue[]; busy: boolean; onClose: () => void; onSave: (c: Cue) => void;
}) {
  const [label, setLabel] = useState('');
  const [posture, setPosture] = useState('stationary');
  const [beep, setBeep] = useState('single');
  const id = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const clash = existing.some(c => c.id === id);
  const valid = !!id && !clash;

  return (
    <div className="absolute inset-0 z-40 flex items-end bg-black/40" onClick={onClose}>
      <div className="w-full bg-white rounded-t-[32px] p-6 pb-8 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <p className="text-[#111827] text-[20px]" style={font.sb}>Add a command</p>
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Command name, e.g. Lie down"
          className="w-full rounded-[20px] bg-[#eff6ff] px-4 py-3 text-[16px] text-[#111827] outline-none" style={font.med} />
        {clash && <p className="text-[12px] text-[#d9363e] -mt-2" style={font.med}>A command with this name already exists.</p>}
        <Choice label="When it works, your dog…" options={POSTURES} value={posture} onChange={setPosture} />
        <Choice label="Collar beep" options={BEEPS.map(b => ({ id: b, label: b[0].toUpperCase() + b.slice(1) }))} value={beep} onChange={setBeep} />
        <button disabled={!valid || busy}
          onClick={() => onSave({ id, label: label.trim(), beepPattern: beep, expectedPosture: posture, approximate: posture === 'approached' })}
          className="w-full rounded-[32px] py-3 bg-[#1b5df1] text-white text-[18px] transition-opacity"
          style={{ ...font.sb, opacity: !valid || busy ? 0.4 : 1 }}>
          {busy ? 'Saving…' : 'Save command'}
        </button>
      </div>
    </div>
  );
}

function Choice({ label, options, value, onChange }: {
  label: string; options: { id: string; label: string }[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[#6b7280] text-[12px]" style={font.sb}>{label}</p>
      <div className="flex gap-2 flex-wrap">
        {options.map(o => (
          <button key={o.id} onClick={() => onChange(o.id)}
            className="rounded-full px-3 py-[6px] text-[13px] border transition-colors"
            style={{ ...font.med, background: value === o.id ? '#1b5df1' : 'white', color: value === o.id ? 'white' : '#111827', borderColor: value === o.id ? '#1b5df1' : '#e5e7eb' }}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
