import { useRef, useState } from 'react';
import { pairDevice, updateSettings } from '../lib/api';
import { timeAgo, type DogData } from './useDogData';
import { Bell, DogAvatar, font, imgBlob, setDogPhoto, type Page } from './ui';

const A = '/assets';
const imgAvatarTab = `${A}/4f625.svg`;
const imgEdit = `${A}/ec05b.svg`;

const LEVELS = ['low', 'medium', 'high'];
const SENSITIVITY_ROWS = [
  { id: 'distress', label: 'Distress' },
  { id: 'sustained_stillness', label: 'Long stillness' },
  { id: 'minor_anomaly', label: 'Minor changes' },
];

const list = (v: unknown) => (Array.isArray(v) && v.length ? v.join(', ') : null);
const scale = (v: unknown) => (typeof v === 'number' && v > 0 ? `${v} / 5` : null);

// Keeps the stored avatar small — it lives in localStorage, not the backend.
function resizeToDataUrl(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const s = Math.min(img.width, img.height);
      c.getContext('2d')!.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export default function Profile({ data, photo, unseen, onPhoto, onNavigate, onBellClick, notify }: {
  data: DogData; photo: string | null; unseen: number;
  onPhoto: (p: string) => void; onNavigate: (p: Page) => void; onBellClick: () => void;
  notify: (text: string, tone?: 'info' | 'error') => void;
}) {
  const { dog, settings, device } = data;
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [busy, setBusy] = useState(false);

  const details = dog ? [
    { label: 'Name', value: dog.name },
    { label: 'Breed', value: dog.breed === 'Mixed Breed' && dog.breedDetail ? `Mixed (${dog.breedDetail})` : dog.breed },
    { label: 'Age', value: dog.age },
    { label: 'Sex', value: dog.sex },
    { label: 'Neutered', value: dog.neutered },
    { label: 'With you for', value: dog.ownedSince },
    { label: 'Energy level', value: scale(dog.energyLevel) },
    { label: 'Temperament', value: list(dog.temperament) },
    { label: 'When alone', value: dog.aloneTimeDetail ? `${dog.aloneTimeBehavior} (${dog.aloneTimeDetail})` : dog.aloneTimeBehavior },
    { label: 'Fears', value: list(dog.fears) },
    { label: 'How vocal', value: scale(dog.vocalLevel) },
    { label: 'Whimpers', value: dog.whimperFrequency },
    { label: 'Barks at', value: list(dog.barkTriggers) },
  ].filter(d => d.value) : [];

  const pickPhoto = async (file?: File) => {
    if (!file) return;
    try {
      const url = await resizeToDataUrl(file);
      setDogPhoto(url);
      onPhoto(url);
    } catch { notify("Couldn't read that image", 'error'); }
  };

  const save = async (fn: () => Promise<void>) => {
    if (!dog || busy) return;
    setBusy(true);
    try { await fn(); } catch (err) {
      notify(err instanceof Error ? err.message : 'Something went wrong', 'error');
    } finally { setBusy(false); }
  };

  const setSensitivity = (key: string, level: string) => save(async () => {
    const next = await updateSettings(dog!.id, { sensitivity: { ...settings?.sensitivity, [key]: level } });
    data.setSettings(next);
  });

  const setRateCap = (n: number) => save(async () => {
    data.setSettings(await updateSettings(dog!.id, { alertRateCapPerHour: n }));
  });

  const pair = () => save(async () => {
    await pairDevice(dog!.id, deviceId.trim());
    setDeviceId('');
    await data.refresh();
    notify('Collar paired');
  });

  return (
    <div className="absolute inset-0 bg-[#1b5df1] overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="-rotate-180 -scale-x-100 w-full h-full">
          <img alt="" className="w-full h-full object-fill" src={imgBlob} />
        </div>
      </div>
      <div className="absolute inset-0 backdrop-blur-[150px] bg-[rgba(255,255,255,0.15)] pointer-events-none" />
      <div className="absolute top-[59px] right-6 z-40"><Bell count={unseen} onClick={onBellClick} /></div>

      <div className="absolute inset-0 overflow-y-auto pawse-scroll">
        <div className="relative flex flex-col items-start pt-10 px-4">
          <button onClick={() => onNavigate('dashboard')} className="relative" style={{ width: 97.5, height: 67 }} aria-label="Back to dashboard">
            <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgAvatarTab} />
            <div className="absolute left-[8px] top-[8px]"><DogAvatar size={59} photo={photo} /></div>
          </button>

          <div className="bg-white rounded-tr-[16px] rounded-bl-[16px] rounded-br-[16px] w-full pb-36 min-h-[600px]">
            <div className="flex flex-col gap-[32px] pt-[40px] px-5 pb-5">
              <div className="flex flex-col gap-[24px] items-center">
                <button onClick={() => fileRef.current?.click()} aria-label="Change profile picture"
                  className="bg-[#eff6ff] rounded-[44px] size-[88px] overflow-hidden relative">
                  <DogAvatar size={88} photo={photo} />
                </button>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => pickPhoto(e.target.files?.[0])} />
                <div className="flex flex-col gap-[4px] items-center w-full">
                  <p className="text-[#111827] text-[24px]" style={font.inter(700)}>{dog?.name ?? '—'}</p>
                  <p className="text-[#6b7280] text-[11px] text-center" style={font.inter(400)}>
                    Tap the photo to add or change the profile picture.
                  </p>
                </div>
              </div>

              <Section title="Collected details" action={
                <button onClick={() => setEditing(e => !e)} aria-label="Edit alert settings" className="size-[21px]">
                  <img alt="" className="size-full" src={imgEdit} style={{ opacity: editing ? 0.5 : 1 }} />
                </button>
              }>
                {details.map(({ label, value }) => <Row key={label} label={label} value={String(value)} />)}
              </Section>

              {editing && settings && (
                <Section title="Alert sensitivity">
                  {SENSITIVITY_ROWS.map(r => (
                    <div key={r.id} className="flex items-center justify-between gap-2">
                      <p className="text-[#6b7280] text-[14px]" style={font.inter(400)}>{r.label}</p>
                      <Segmented options={LEVELS} value={settings.sensitivity?.[r.id] ?? 'medium'} disabled={busy}
                        onChange={v => setSensitivity(r.id, v)} />
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[#6b7280] text-[14px]" style={font.inter(400)}>Max pushes / hour</p>
                    <Segmented options={['1', '2', '4']} value={String(settings.alertRateCapPerHour)} disabled={busy}
                      onChange={v => setRateCap(Number(v))} />
                  </div>
                </Section>
              )}

              <Section title="Collar">
                {device ? (
                  <>
                    <Row label="Device" value={device.deviceId} />
                    <Row label="Status" value={device.connectivity === 'online' ? 'Online' : 'Offline'} />
                    <Row label="Battery" value={device.batteryPct != null ? `${device.batteryPct}%` : '—'} />
                    <Row label="Last seen" value={timeAgo(device.lastSeenAt)} />
                  </>
                ) : (
                  <div className="flex flex-col gap-3">
                    <p className="text-[#6b7280] text-[13px]" style={font.inter(400)}>
                      Enter the pairing code printed on the collar to start monitoring.
                    </p>
                    <div className="flex gap-2">
                      <input value={deviceId} onChange={e => setDeviceId(e.target.value)} placeholder="e.g. pawse-collar-01"
                        className="flex-1 min-w-0 rounded-[16px] bg-[#eff6ff] px-3 py-2 text-[14px] text-[#111827] outline-none" style={font.med} />
                      <button onClick={pair} disabled={!deviceId.trim() || busy}
                        className="rounded-[16px] bg-[#1b5df1] text-white px-4 text-[14px]"
                        style={{ ...font.sb, opacity: !deviceId.trim() || busy ? 0.4 : 1 }}>Pair</button>
                    </div>
                  </div>
                )}
              </Section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[16px]">
      <div className="flex items-center justify-between">
        <p className="text-[#6b7280] text-[12px]" style={font.inter(600)}>{title}</p>
        {action}
      </div>
      <div className="bg-[rgba(229,231,235,0.6)] h-px w-full" />
      <div className="flex flex-col gap-[20px]">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <p className="text-[#6b7280] text-[14px] shrink-0" style={font.inter(400)}>{label}</p>
      <p className="text-[#111827] text-[14px] text-right" style={font.inter(600)}>{value}</p>
    </div>
  );
}

function Segmented({ options, value, onChange, disabled }: {
  options: string[]; value: string; onChange: (v: string) => void; disabled?: boolean;
}) {
  return (
    <div className="flex bg-[#eff6ff] rounded-full p-[3px]">
      {options.map(o => (
        <button key={o} disabled={disabled} onClick={() => o !== value && onChange(o)}
          className="rounded-full px-3 py-1 text-[12px] capitalize transition-colors"
          style={{ ...font.sb, background: o === value ? '#1b5df1' : 'transparent', color: o === value ? 'white' : '#1b5df1' }}>
          {o}
        </button>
      ))}
    </div>
  );
}
