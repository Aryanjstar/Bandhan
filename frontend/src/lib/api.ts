const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:7071/api';

const TOKEN_KEY = 'pawse.ownerToken';
const OWNER_KEY = 'pawse.ownerId';

// Must satisfy api-service's strong-password policy (lib/auth.js): 12+ chars,
// upper, lower, digit, symbol. The random hex body supplies length + entropy;
// the fixed prefix guarantees every character class is present.
function randomPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `Aa1!${hex}`;
}

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body?.error || `${res.status} ${res.statusText}`, res.status);
  return body as T;
}

async function authed<T>(path: string, init?: RequestInit): Promise<T> {
  const { token } = await ensureOwner();
  return request<T>(path, { ...init, headers: { Authorization: `Bearer ${token}`, ...init?.headers } });
}

export function hasOwnerSession(): boolean {
  return !!localStorage.getItem(TOKEN_KEY) && !!localStorage.getItem(OWNER_KEY);
}

// The onboarding flow (Figma design) has no login/signup screen — PRD §7 only
// describes an Account page for later. Every dog needs an ownerId server-side
// though, so we transparently provision (and cache) one guest owner per browser,
// the same way a single-owner/single-dog pilot app would bootstrap a local account.
export async function ensureOwner(): Promise<{ token: string; ownerId: string }> {
  const cachedToken = localStorage.getItem(TOKEN_KEY);
  const cachedOwnerId = localStorage.getItem(OWNER_KEY);
  if (cachedToken && cachedOwnerId) return { token: cachedToken, ownerId: cachedOwnerId };

  const email = `guest+${crypto.randomUUID()}@pawse.local`;
  const { token, ownerId } = await request<{ token: string; ownerId: string }>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password: randomPassword(), name: null }),
  });
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(OWNER_KEY, ownerId);
  return { token, ownerId };
}

export interface DogProfilePayload {
  name: string;
  breed: string;
  breedDetail?: string;
  age: string;
  sex: string;
  neutered: string;
  ownedSince: string;
  energyLevel: number;
  vocalLevel: number;
  whimperFrequency: string;
  barkTriggers: string[];
  temperament: string[];
  aloneTimeBehavior: string;
  aloneTimeDetail?: string;
  fears: string[];
  baselineRecordingBase64?: string;
}

export async function createDog(payload: DogProfilePayload): Promise<{ dog: Record<string, unknown> }> {
  const { token } = await ensureOwner();
  return request('/dogs', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

// ─── Post-onboarding (dashboard / analytics / profile) ───────────────────────

export interface Dog extends Omit<DogProfilePayload, 'baselineRecordingBase64'> {
  id: string;
  dogId: string;
  ownerId: string;
  createdAt: string;
}

export type EventClass = 'distress' | 'sustained_stillness' | 'minor_anomaly' | 'low_battery';

export interface DogEvent {
  id: string;
  dogId: string;
  timestamp: string;
  class: EventClass;
  confidence: number;
  sourceSignals: string[];
  feedback: 'unset' | 'accurate' | 'false';
  pushed: boolean;
  learning?: boolean;
}

export interface Cue {
  id: string;
  label: string;
  beepPattern: string;
  expectedPosture: string;
  approximate: boolean;
}

export interface DogSettings {
  sensitivity: Record<string, string>;
  quietHours: unknown;
  alertRateCapPerHour: number;
  cues: Cue[];
}

export interface CommandSession {
  id: string;
  dogId: string;
  cue: string;
  timestamp: string;
  observedPosture: string | null;
  matchResult: string;
}

export interface DeviceStatus {
  deviceId: string;
  batteryPct: number | null;
  lastSeenAt: string | null;
  connectivity: 'online' | 'offline';
}

const DOG_KEY = 'pawse.dogId';
export const cachedDogId = () => localStorage.getItem(DOG_KEY);

export async function getMyDog(): Promise<Dog | null> {
  const { dogs } = await authed<{ dogs: Dog[] }>('/dogs');
  const dog = dogs[0] ?? null;
  if (dog) localStorage.setItem(DOG_KEY, dog.id);
  return dog;
}

export async function getEvents(dogId: string, opts: { from?: string; limit?: number } = {}): Promise<DogEvent[]> {
  const q = new URLSearchParams();
  if (opts.from) q.set('from', opts.from);
  q.set('limit', String(opts.limit ?? 200));
  const { events } = await authed<{ events: DogEvent[] }>(`/dogs/${dogId}/events?${q}`);
  return events;
}

export function sendEventFeedback(dogId: string, eventId: string, feedback: 'accurate' | 'false') {
  return authed<{ event: DogEvent }>(`/events/${encodeURIComponent(eventId)}/feedback?dogId=${dogId}`, {
    method: 'POST', body: JSON.stringify({ feedback }),
  });
}

export async function getSettings(dogId: string): Promise<DogSettings> {
  return (await authed<{ settings: DogSettings }>(`/dogs/${dogId}/settings`)).settings;
}

export async function updateSettings(dogId: string, patch: Partial<DogSettings>): Promise<DogSettings> {
  return (await authed<{ settings: DogSettings }>(`/dogs/${dogId}/settings`, {
    method: 'PUT', body: JSON.stringify(patch),
  })).settings;
}

export async function sendCue(dogId: string, cue: string): Promise<CommandSession> {
  return (await authed<{ session: CommandSession }>(`/dogs/${dogId}/command`, {
    method: 'POST', body: JSON.stringify({ cue }),
  })).session;
}

export async function getCommandSessions(dogId: string, limit = 10): Promise<CommandSession[]> {
  return (await authed<{ commandSessions: CommandSession[] }>(`/dogs/${dogId}/command-sessions?limit=${limit}`)).commandSessions;
}

export async function startCheckIn(dogId: string): Promise<string> {
  return (await authed<{ checkInUntil: string }>(`/dogs/${dogId}/check-in`, { method: 'POST' })).checkInUntil;
}

export async function getDeviceStatus(dogId: string): Promise<DeviceStatus | null> {
  try {
    return (await authed<{ device: DeviceStatus }>(`/devices/${dogId}/status`)).device;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export function pairDevice(dogId: string, deviceId: string) {
  return authed<{ paired: boolean }>(`/dogs/${dogId}/pair-device`, {
    method: 'POST', body: JSON.stringify({ deviceId }),
  });
}

export async function getRealtimeUrl(dogId: string): Promise<string> {
  return (await authed<{ url: string }>(`/dogs/${dogId}/realtime-negotiate`)).url;
}
