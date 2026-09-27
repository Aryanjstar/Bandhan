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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `${res.status} ${res.statusText}`);
  return body as T;
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
}

export async function createDog(payload: DogProfilePayload): Promise<{ dog: Record<string, unknown> }> {
  const { token } = await ensureOwner();
  return request('/dogs', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}
