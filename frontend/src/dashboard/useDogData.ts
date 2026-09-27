import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getCommandSessions, getDeviceStatus, getEvents, getMyDog, getRealtimeUrl, getSettings,
  type CommandSession, type DeviceStatus, type Dog, type DogEvent, type DogSettings,
} from '../lib/api';

const POLL_MS = 20_000;
const WEEK_MS = 7 * 24 * 3600 * 1000;

export interface LiveMotion {
  motionClass: string;
  motionEnergy: number;
  stillDurationSec: number;
  timestamp: string;
}

export interface DogData {
  dog: Dog | null;
  settings: DogSettings | null;
  events: DogEvent[];
  device: DeviceStatus | null;
  live: LiveMotion | null;
  checkInUntil: string | null;
  lastSession: CommandSession | null;
  loading: boolean;
  error: string | null;
  notFound: boolean;
  refresh: () => Promise<void>;
  setSettings: (s: DogSettings) => void;
  setCheckInUntil: (until: string) => void;
  trackSession: (s: CommandSession) => void;
  patchEvent: (e: DogEvent) => void;
}

function describeError(err: unknown) {
  if (err instanceof TypeError) return "Can't reach the server — check the backend is running.";
  return err instanceof Error ? err.message : 'Something went wrong.';
}

export function useDogData(): DogData {
  const [dog, setDog] = useState<Dog | null>(null);
  const [settings, setSettings] = useState<DogSettings | null>(null);
  const [events, setEvents] = useState<DogEvent[]>([]);
  const [device, setDevice] = useState<DeviceStatus | null>(null);
  const [live, setLive] = useState<LiveMotion | null>(null);
  const [checkInUntil, setCheckInUntil] = useState<string | null>(null);
  const [lastSession, setLastSession] = useState<CommandSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const dogIdRef = useRef<string | null>(null);

  const mergeEvent = useCallback((e: DogEvent) => {
    setEvents(prev => [e, ...prev.filter(p => p.id !== e.id)]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const d = dogIdRef.current ? null : await getMyDog();
      if (!dogIdRef.current) {
        if (!d) { setNotFound(true); return; }
        dogIdRef.current = d.id;
        setDog(d);
      }
      const id = dogIdRef.current!;
      const from = new Date(Date.now() - WEEK_MS).toISOString();
      const [s, ev, dev] = await Promise.all([getSettings(id), getEvents(id, { from }), getDeviceStatus(id)]);
      setSettings(s);
      setEvents(ev);
      setDevice(dev);
      setError(null);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  // Web PubSub push channel (SYSTEM_DESIGN §7). Best-effort: when it isn't
  // configured (e.g. local-only backend) the poll above still keeps data fresh.
  useEffect(() => {
    if (!dog) return;
    let ws: WebSocket | null = null;
    let closed = false;
    getRealtimeUrl(dog.id).then(url => {
      if (closed) return;
      ws = new WebSocket(url);
      ws.onmessage = msg => {
        let data: any;
        try { data = JSON.parse(typeof msg.data === 'string' ? msg.data : ''); } catch { return; }
        if (data?.type === 'event' && data.event) mergeEvent(data.event);
        else if (data?.type === 'checkInStatus') setLive(data);
        else if (data?.type === 'checkInStarted') setCheckInUntil(data.until);
        else if (data?.type === 'commandSession' && data.session) setLastSession(data.session);
      };
    }).catch(() => {});
    return () => { closed = true; ws?.close(); };
  }, [dog, mergeEvent]);

  // Cue outcomes land via the realtime channel when it's up; otherwise poll until
  // the collar reports back or commandTimeoutSweep marks the session `timeout`.
  const pendingId = lastSession?.matchResult === 'pending' ? lastSession.id : null;
  useEffect(() => {
    if (!pendingId || !dog) return;
    const started = Date.now();
    const t = setInterval(async () => {
      if (Date.now() - started > 2 * 60_000) { clearInterval(t); return; }
      const sessions = await getCommandSessions(dog.id).catch(() => []);
      const s = sessions.find(x => x.id === pendingId);
      if (s && s.matchResult !== 'pending') { setLastSession(s); clearInterval(t); }
    }, 4000);
    return () => clearInterval(t);
  }, [pendingId, dog]);

  return {
    dog, settings, events, device, live, checkInUntil, lastSession, loading, error, notFound,
    refresh, setSettings, setCheckInUntil,
    trackSession: setLastSession,
    patchEvent: mergeEvent,
  };
}

// ─── Shared presentation helpers ─────────────────────────────────────────────

export const EVENT_COPY: Record<string, { title: string; body: (name: string) => string }> = {
  distress: { title: 'Distress detected', body: n => `${n} is showing signs of distress. Check in now.` },
  sustained_stillness: { title: 'Still for a long time', body: () => 'Encourage some movement to keep things calm.' },
  minor_anomaly: { title: 'Unusual movement', body: n => `A small change from ${n}'s usual pattern.` },
  low_battery: { title: 'Collar battery low', body: () => 'Charge the collar soon to keep monitoring.' },
};

export const SEVERITY: Record<string, number> = { distress: 3, sustained_stillness: 2, low_battery: 1, minor_anomaly: 1 };

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return 'never';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

const SEEN_KEY = 'pawse.alertsSeenAt';
export const alertsSeenAt = () => localStorage.getItem(SEEN_KEY) || '';
export const markAlertsSeen = () => localStorage.setItem(SEEN_KEY, new Date().toISOString());
