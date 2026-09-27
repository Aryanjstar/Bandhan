import { useEffect, useRef, useState } from 'react';
import { createDog, ensureOwner } from './lib/api';

const A = '/assets';
const imgPawBg   = `${A}/eb15b.svg`;
const imgLogo    = `${A}/bf241.svg`;
const imgChevron = `${A}/423b7.svg`;
const imgDog     = `${A}/99de7.svg`;
const imgDoggu   = `${A}/92498.png`;
const imgEllipse = `${A}/43419.svg`;
const imgCheck   = `${A}/ab182.svg`;
const imgMic     = `${A}/7bf6c.svg`;
const imgInfo    = `${A}/82ab3.svg`;

// ─── Screen IDs ───────────────────────────────────────────────────────────────
// Order fixed to match the actual Figma flow (energy → temperament → alone-time
// → fears → vocal → whimper → bark-triggers → record → congrats) — the original
// Figma Make export had vocal/whimper/bark-triggers/record before temperament/
// alone-time/fears, which doesn't match the design screenshots.
type Screen =
  | 'intro' | 'splash' | 'paw' | 'onboarding'
  | 'name' | 'breed' | 'breed-mixed'
  | 'details' | 'energy' | 'temperament'
  | 'alone-time' | 'fears' | 'vocal'
  | 'whimper' | 'bark-triggers' | 'record'
  | 'congrats';

const ORDER: Screen[] = [
  'intro', 'splash', 'paw',
  'name', 'breed', 'breed-mixed',
  'details', 'onboarding', 'energy',
  'temperament', 'alone-time', 'fears',
  'vocal', 'whimper', 'bark-triggers', 'record',
  'congrats',
];

// ─── Stage — scales the fixed 390×844 design uniformly to fit any viewport
// without distorting the vector art (non-uniform scaling would stretch the
// paw/logo curves). Letterboxes on mismatched aspect ratios instead of cropping.
const STAGE_W = 390;
const STAGE_H = 844;

function useStageScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const compute = () => {
      const pad = 24;
      const fit = Math.min(
        (window.innerWidth - pad) / STAGE_W,
        (window.innerHeight - pad) / STAGE_H,
      );
      setScale(Math.max(0.45, Math.min(fit, 1.4)));
    };
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('orientationchange', compute);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('orientationchange', compute);
    };
  }, []);
  return scale;
}

// ─── Font tokens ──────────────────────────────────────────────────────────────
const sb  = { fontFamily:"'Poppins:SemiBold',Poppins,sans-serif", fontWeight:600 } as const;
const reg = { fontFamily:"'Poppins:Regular',Poppins,sans-serif",  fontWeight:400 } as const;
const med = { fontFamily:"'Poppins:Medium',Poppins,sans-serif",   fontWeight:500 } as const;

// ─── Shared layout atoms ──────────────────────────────────────────────────────
function PawBg() {
  return (
    <div className="absolute" style={{ inset: '-1.07% -76.29% -1.9% -75.9%' }}>
      <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgPawBg} />
    </div>
  );
}
function Blur() {
  return (
    <div className="absolute inset-0"
      style={{ backdropFilter: 'blur(78.2px)', background: 'rgba(255,255,255,0.15)' }} />
  );
}
function Logo() {
  return (
    <div className="absolute" style={{ inset: '8.53% 31.53% 87.83% 31.28%' }}>
      <img alt="PAWSE" className="absolute block inset-0 max-w-none size-full" src={imgLogo} />
    </div>
  );
}
function NextBtn({ onClick, disabled = false, label = 'Next' }: {
  onClick: () => void; disabled?: boolean; label?: string;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      className="absolute left-1/2 -translate-x-1/2 bg-white rounded-[32px] flex items-center justify-center px-8 py-3 w-[326px] transition-opacity duration-200"
      style={{ top: 718, opacity: disabled ? 0.4 : 1, boxShadow: '0 4px 2px rgba(0,0,0,.25)', cursor: disabled ? 'default' : 'pointer' }}
    >
      <span className="text-[#1b5df1] text-[20px] whitespace-nowrap" style={sb}>{label}</span>
    </button>
  );
}

// ─── Dropdown (radio, single-select) ─────────────────────────────────────────
function Dropdown({ label, options, value, onSelect, placeholder = 'Please select' }: {
  label?: string;
  options: string[];
  value: string;
  onSelect: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-3 w-full">
      {label && <p className="text-white text-[24px] leading-snug" style={sb}>{label}</p>}
      <div className="flex flex-col gap-2 w-full">
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full bg-[rgba(255,255,255,.1)] rounded-[32px] px-8 py-3 flex items-center justify-between active:opacity-80 transition-opacity"
        >
          <span className="text-white text-[20px] text-left" style={med}>
            {value || placeholder}
          </span>
          <img
            alt=""
            src={imgChevron}
            width={24}
            height={24}
            style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms' }}
          />
        </button>
        <div
          className="overflow-hidden transition-all duration-250 ease-out"
          style={{ maxHeight: open ? `${options.length * 60 + 16}px` : '0px', opacity: open ? 1 : 0 }}
        >
          <div className="bg-[rgba(255,255,255,.1)] rounded-[32px] py-[8px] flex flex-col gap-[6px]">
            {options.map(opt => {
              const sel = value === opt;
              return (
                <button
                  key={opt}
                  onClick={() => { onSelect(opt); setOpen(false); }}
                  className="w-[310px] mx-auto px-5 py-[14px] rounded-[24px] flex items-center text-left transition-colors active:opacity-70"
                  style={{ background: sel ? 'rgba(27,93,241,.2)' : 'transparent' }}
                >
                  <span className="text-white text-[18px]" style={sel ? med : reg}>{opt}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CheckList (multi-select) ─────────────────────────────────────────────────
function CheckList({ label, subtitle, options, selected, onToggle, max }: {
  label?: string;
  subtitle?: string;
  options: string[];
  selected: Set<string>;
  onToggle: (v: string) => void;
  max?: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-3 w-full">
      {label && <p className="text-white text-[24px] leading-snug" style={sb}>{label}</p>}
      <div className="flex flex-col gap-2 w-full">
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full bg-[rgba(255,255,255,.1)] rounded-[32px] px-8 py-3 flex items-center justify-between active:opacity-80 transition-opacity"
        >
          <span className="text-white text-[20px] text-left truncate pr-4 flex-1" style={med}>
            {selected.size > 0 ? `${selected.size} selected` : (subtitle ?? 'Please select')}
          </span>
          <img
            alt=""
            src={imgChevron}
            width={24}
            height={24}
            className="shrink-0"
            style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms' }}
          />
        </button>
        <div
          className="overflow-hidden transition-all duration-250 ease-out"
          style={{ maxHeight: open ? `${options.length * 60 + 16}px` : '0px', opacity: open ? 1 : 0 }}
        >
          <div className="bg-[rgba(255,255,255,.1)] rounded-[32px] py-[8px] flex flex-col gap-[6px]">
            {options.map(opt => {
              const checked = selected.has(opt);
              const disabled = !checked && !!max && selected.size >= max;
              return (
                <button
                  key={opt}
                  onClick={() => !disabled && onToggle(opt)}
                  className="w-[310px] mx-auto px-5 py-[14px] rounded-[24px] flex items-center justify-between transition-colors active:opacity-70"
                  style={{ background: checked ? 'rgba(27,93,241,.15)' : 'transparent', opacity: disabled ? 0.4 : 1 }}
                >
                  <span className="text-white text-[18px]" style={checked ? med : reg}>{opt}</span>
                  {checked
                    ? <div className="bg-[#1b5df1] rounded-[12px] size-6 flex items-center justify-center shrink-0">
                        <img alt="" src={imgCheck} width={14} height={14} />
                      </div>
                    : <div className="rounded-[12px] size-6 shrink-0 border border-[rgba(255,255,255,.2)]"
                        style={{ background: 'rgba(255,255,255,.08)' }} />
                  }
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Scale row (1–5) ──────────────────────────────────────────────────────────
const SCALE_LABELS = ['Very Low', 'Low', 'Medium', 'High', 'Very High'];
function ScaleRow({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-2 items-start w-full">
      {SCALE_LABELS.map((lbl, i) => {
        const v = i + 1, sel = value === v;
        return (
          <button key={i} onClick={() => onChange(v)}
            className="flex flex-col gap-2 items-center w-14 active:scale-95 transition-transform">
            <div
              className="size-8 rounded-[16px] flex items-center justify-center border border-[rgba(255,255,255,.2)] transition-colors duration-150"
              style={{ background: sel ? 'white' : 'rgba(255,255,255,.1)' }}
            >
              <span className="text-[14px]" style={{ ...sb, color: sel ? '#1b5df1' : 'white' }}>{v}</span>
            </div>
            <span className="text-[11px] text-center leading-tight w-full"
              style={{ ...med, color: 'rgba(255,255,255,.7)' }}>{lbl}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Opening video intro ──────────────────────────────────────────────────────
function Intro({ onDone }: { onDone: () => void }) {
  const [dimmed, setDimmed] = useState(false);
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setDimmed(true);
    setTimeout(onDone, 480);
  };

  useEffect(() => {
    // Safety net: if autoplay is blocked or the file fails to load, don't strand
    // the user on a black screen — fall through to the onboarding flow anyway.
    const t = setTimeout(finish, 6000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="absolute inset-0 bg-black overflow-hidden">
      <video
        className="absolute inset-0 size-full object-cover transition-[filter] duration-500 ease-out"
        style={{ filter: dimmed ? 'brightness(0.35)' : 'brightness(1)' }}
        src="/video/pawse-opening.mp4"
        autoPlay
        muted
        playsInline
        onEnded={finish}
        onError={finish}
      />
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState<Screen>('intro');
  const [prev, setPrev]     = useState<Screen | null>(null);

  const [dogName,     setDogName]     = useState('');
  const [breed,       setBreed]       = useState('');
  const [mixedDetail, setMixedDetail] = useState('');
  const [age,         setAge]         = useState('');
  const [sex,         setSex]         = useState('');
  const [neutered,    setNeutered]    = useState('');
  const [duration,    setDuration]    = useState('');
  const [energy,      setEnergy]      = useState<number | null>(null);
  const [vocal,       setVocal]       = useState<number | null>(null);
  const [whimper,     setWhimper]     = useState('');
  const [barkTriggers,setBarkTriggers]= useState<Set<string>>(new Set());
  const [recording,   setRecording]   = useState(false);
  const [recTime,     setRecTime]     = useState(0);
  const [temperament, setTemperament] = useState<Set<string>>(new Set());
  const [aloneTime,   setAloneTime]   = useState('');
  const [aloneDetail, setAloneDetail] = useState('');
  const [fears,       setFears]       = useState<Set<string>>(new Set());

  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scale = useStageScale();
  const go = (next: Screen) => { setPrev(screen); setScreen(next); };

  // Warm up a local owner session as soon as the app opens — the backend needs
  // an ownerId before it will save a dog, and the Figma flow has no login screen.
  useEffect(() => { ensureOwner().catch(() => {}); }, []);

  useEffect(() => {
    if (screen === 'splash') { const t = setTimeout(() => go('paw'), 1800); return () => clearTimeout(t); }
    if (screen === 'paw')    { const t = setTimeout(() => go('name'), 1000); return () => clearTimeout(t); }
  }, [screen]);

  useEffect(() => {
    if (recording) { timerRef.current = setInterval(() => setRecTime(t => t + 1), 1000); }
    else { if (timerRef.current) clearInterval(timerRef.current); }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [recording]);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const toggle = (set: Set<string>, val: string) => { const n = new Set(set); n.has(val) ? n.delete(val) : n.add(val); return n; };

  const finishOnboarding = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await createDog({
        name: dogName,
        breed,
        breedDetail: breed === 'Mixed Breed' ? mixedDetail : undefined,
        age,
        sex,
        neutered,
        ownedSince: duration,
        energyLevel: energy ?? 0,
        vocalLevel: vocal ?? 0,
        whimperFrequency: whimper,
        barkTriggers: [...barkTriggers],
        temperament: [...temperament],
        aloneTimeBehavior: aloneTime,
        aloneTimeDetail: aloneDetail || undefined,
        fears: [...fears],
      });
      go('congrats');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save — check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Screens ─────────────────────────────────────────────────────────────────

  const IntroScreen = <Intro onDone={() => go('splash')} />;

  const Splash = (
    <div className="absolute inset-0 bg-white flex items-center justify-center">
      <svg width="210" height="44" viewBox="0 0 210 44" fill="none" style={{ display: 'block' }}>
        <text x="0" y="36" fontFamily="Poppins,sans-serif" fontWeight="700" fontSize="40" fill="#0d0d0d" letterSpacing="-1">PAWS</text>
        <circle cx="106" cy="10" r="4.5" fill="#3b62f5" />
        <ellipse cx="96" cy="13" rx="3.5" ry="4" fill="#3b62f5" />
        <ellipse cx="116" cy="13" rx="3.5" ry="4" fill="#3b62f5" />
        <text x="162" y="36" fontFamily="Poppins,sans-serif" fontWeight="700" fontSize="40" fill="#a8b8f8">E</text>
      </svg>
    </div>
  );

  const Paw = <div className="absolute inset-0 bg-white overflow-hidden"><PawBg /></div>;

  const Onboarding = (
    <div className="absolute inset-0 bg-[#1b5df1] overflow-hidden">
      <div className="absolute" style={{ inset: '8.53% 31.53% 87.83% 31.28%' }}>
        <img alt="PAWSE" className="absolute block inset-0 max-w-none size-full" src={imgDog} />
      </div>
      <div className="absolute" style={{ left: 33, top: 164, width: 324, height: 364 }}>
        <img alt="Dog" className="absolute inset-0 max-w-none object-cover size-full" src={imgDoggu} />
      </div>
      <div className="absolute -translate-x-1/2" style={{ left: '50%', top: 505, width: 216, height: 9 }}>
        <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgEllipse} />
      </div>
      <div className="absolute left-8 w-[326px]" style={{ top: 560 }}>
        <div className="flex flex-col gap-3 mb-8">
          <p className="text-white text-[24px] leading-snug" style={sb}>Let's get to know your dog better</p>
          <p className="text-white text-[14px] leading-relaxed" style={reg}>This allows us to gain deeper insights into your dog's health.</p>
        </div>
        <button onClick={() => go('energy')}
          className="bg-white rounded-[32px] flex items-center justify-center px-8 py-3 w-full active:scale-95 transition-transform"
          style={{ boxShadow: '0 4px 2px rgba(0,0,0,.25)' }}>
          <span className="text-[#1b5df1] text-[20px]" style={sb}>Get Started</span>
        </button>
      </div>
    </div>
  );

  const Name = (
    <div className="absolute inset-0 bg-white overflow-hidden">
      <PawBg /><Blur /><Logo />
      <div className="absolute left-8 flex flex-col gap-3 w-[326px]" style={{ top: 167 }}>
        <p className="text-white text-[24px]" style={sb}>What's your dog's name?</p>
        <input type="text" value={dogName} onChange={e => setDogName(e.target.value)}
          placeholder="Pet's name here"
          className="w-full bg-[rgba(255,255,255,.1)] rounded-[32px] px-8 py-3 text-white text-[20px] outline-none placeholder:text-white/60"
          style={med} />
      </div>
      <NextBtn onClick={() => go('breed')} disabled={!dogName.trim()} />
    </div>
  );

  const DOG_BREEDS = ['Labrador Retriever', 'French Bulldog', 'German Shepherd', 'Golden Retriever', 'Mixed Breed'];

  const Breed = (
    <div className="absolute inset-0 bg-white overflow-hidden">
      <PawBg /><Blur /><Logo />
      <div className="absolute left-8 w-[326px]" style={{ top: 167 }}>
        <Dropdown
          label="What breed is your dog?"
          options={DOG_BREEDS}
          value={breed}
          placeholder="Please select one"
          onSelect={v => setBreed(v)}
        />
      </div>
      <NextBtn
        onClick={() => go(breed === 'Mixed Breed' ? 'breed-mixed' : 'details')}
        disabled={!breed}
      />
    </div>
  );

  const BreedMixed = (
    <div className="absolute inset-0 bg-white overflow-hidden">
      <PawBg /><Blur /><Logo />
      <div className="absolute left-8 flex flex-col gap-8 w-[326px]" style={{ top: 167 }}>
        <Dropdown
          label="What breed is your dog?"
          options={DOG_BREEDS}
          value={breed}
          placeholder="Please select one"
          onSelect={v => setBreed(v)}
        />
        <div className="flex flex-col gap-3">
          <p className="text-white text-[24px]" style={sb}>Please specify</p>
          <input type="text" value={mixedDetail} onChange={e => setMixedDetail(e.target.value)}
            placeholder="Detail goes here"
            className="w-full bg-[rgba(255,255,255,.1)] rounded-[32px] px-8 py-3 text-white text-[20px] outline-none placeholder:text-white/60"
            style={med} />
        </div>
      </div>
      <NextBtn onClick={() => go('details')} />
    </div>
  );

  const Details = (
    <div className="absolute inset-0 bg-white overflow-hidden">
      <PawBg /><Blur /><Logo />
      <div className="absolute left-8 flex flex-col gap-8 w-[326px]" style={{ top: 167 }}>
        <Dropdown label="Age" options={['< 1 year','1–2 years','3–5 years','6–9 years','10+ years']}
          value={age} onSelect={setAge} />
        <Dropdown label="Sex" options={['Male','Female']}
          value={sex} onSelect={setSex} />
        <Dropdown label="Neutered?" options={['Yes','No']}
          value={neutered} onSelect={setNeutered} />
        <Dropdown label="How long have you had this dog?" options={['< 1 year','1–2 years','3–5 years','6+ years']}
          value={duration} onSelect={setDuration} />
      </div>
      <NextBtn onClick={() => go('onboarding')} disabled={!age || !sex || !neutered || !duration} />
    </div>
  );

  const Energy = (
    <div className="absolute inset-0 bg-white overflow-hidden">
      <PawBg /><Blur />
      <div className="absolute left-8 flex flex-col gap-6 w-[326px]" style={{ top: 72 }}>
        <div className="flex flex-col gap-2">
          <p className="text-white text-[14px] text-center w-full" style={med}>On a scale of 1 to 5</p>
          <p className="text-white text-[24px] leading-snug" style={sb}>How would you describe your dog's general energy level?</p>
        </div>
        <ScaleRow value={energy} onChange={setEnergy} />
      </div>
      <NextBtn onClick={() => go('temperament')} disabled={energy === null} />
    </div>
  );

  const Temperament = (
    <div className="absolute inset-0 bg-white overflow-hidden">
      <PawBg /><Blur />
      <div className="absolute left-8 flex flex-col gap-6 w-[326px]" style={{ top: 72 }}>
        <div className="flex flex-col gap-2">
          <p className="text-white text-[14px] text-center w-full" style={med}>Pick up to 3</p>
          <p className="text-white text-[24px] leading-snug" style={sb}>How would you describe your dog's temperament?</p>
        </div>
        <CheckList
          options={['Energetic','Playful','Curious','Gentle','Affectionate','Calm','Protective']}
          selected={temperament} onToggle={v => setTemperament(toggle(temperament, v))} max={3} />
      </div>
      <NextBtn onClick={() => go('alone-time')} disabled={temperament.size === 0} />
    </div>
  );

  const AloneTime = (
    <div className="absolute inset-0 bg-white overflow-hidden">
      <PawBg /><Blur />
      <div className="absolute left-8 flex flex-col gap-6 w-[326px]" style={{ top: 72 }}>
        <Dropdown
          label="How does your dog usually spend time when left alone?"
          options={['Sleeps','Plays with toys','Looks out windows','Waits by door','Other']}
          value={aloneTime} onSelect={setAloneTime} />
        <div className="flex flex-col gap-3">
          <p className="text-white text-[24px]" style={sb}>Please specify</p>
          <input type="text" value={aloneDetail} onChange={e => setAloneDetail(e.target.value)}
            placeholder="Detail goes here"
            className="w-full bg-[rgba(255,255,255,.1)] rounded-[32px] px-8 py-3 text-white text-[20px] outline-none placeholder:text-white/60"
            style={med} />
        </div>
      </div>
      <NextBtn onClick={() => go('fears')} />
    </div>
  );

  const Fears = (
    <div className="absolute inset-0 bg-white overflow-hidden">
      <PawBg /><Blur />
      <div className="absolute left-8 flex flex-col gap-6 w-[326px]" style={{ top: 72 }}>
        <div className="flex flex-col gap-2">
          <p className="text-white text-[24px] leading-snug" style={sb}>Does your dog have any known fears or triggers?</p>
        </div>
        <CheckList
          options={['Thunderstorms','Fireworks','Specific sounds','Being alone in dark','Other']}
          selected={fears} onToggle={v => setFears(toggle(fears, v))} />
      </div>
      <NextBtn onClick={() => go('vocal')} disabled={fears.size === 0} />
    </div>
  );

  const Vocal = (
    <div className="absolute inset-0 bg-white overflow-hidden">
      <PawBg /><Blur />
      <div className="absolute left-8 flex flex-col gap-6 w-[326px]" style={{ top: 72 }}>
        <div className="flex flex-col gap-2">
          <p className="text-white text-[14px] text-center w-full" style={med}>On a scale of 1 to 5</p>
          <p className="text-white text-[24px] leading-snug" style={sb}>How vocal is your dog normally?</p>
        </div>
        <ScaleRow value={vocal} onChange={setVocal} />
      </div>
      <NextBtn onClick={() => go('whimper')} disabled={vocal === null} />
    </div>
  );

  const Whimper = (
    <div className="absolute inset-0 bg-white overflow-hidden">
      <PawBg /><Blur />
      <div className="absolute left-8 flex flex-col gap-6 w-[326px]" style={{ top: 72 }}>
        <div className="flex flex-col gap-2">
          <p className="text-white text-[14px] text-center w-full" style={med}>How often?</p>
          <p className="text-white text-[24px] leading-snug" style={sb}>Does your dog whine or whimper regularly, even when nothing seems wrong?</p>
        </div>
        <Dropdown options={['Never','Occasionally','Rarely','Often']} value={whimper} onSelect={setWhimper} />
      </div>
      <NextBtn onClick={() => go('bark-triggers')} disabled={!whimper} />
    </div>
  );

  const BarkTriggers = (
    <div className="absolute inset-0 bg-white overflow-hidden">
      <PawBg /><Blur />
      <div className="absolute left-8 flex flex-col gap-6 w-[326px]" style={{ top: 72 }}>
        <div className="flex flex-col gap-2">
          <p className="text-white text-[14px] text-center w-full" style={med}>Select all that apply</p>
          <p className="text-white text-[24px] leading-snug" style={sb}>What usually makes your dog bark or vocalize?</p>
        </div>
        <CheckList
          options={['Doorbell','Other animals','Being left alone','Wanting attention','Loud noises outside','Nothing in particular','Other']}
          selected={barkTriggers} onToggle={v => setBarkTriggers(toggle(barkTriggers, v))} />
      </div>
      <NextBtn onClick={() => go('record')} disabled={barkTriggers.size === 0} />
    </div>
  );

  const Record = (
    <div className="absolute inset-0 bg-white overflow-hidden">
      <PawBg /><Blur />
      <div className="absolute left-8 flex flex-col gap-6 w-[326px]" style={{ top: 72 }}>
        <div className="flex flex-col gap-2">
          <p className="text-white text-[14px] text-center w-full" style={med}>Optional</p>
          <p className="text-white text-[24px] leading-snug" style={sb}>Record a short clip of your dog's normal bark/whine to help calibrate the baseline faster.</p>
        </div>
        <div className="flex flex-col gap-3 w-full">
          <button onClick={() => setRecording(r => !r)}
            className="w-full bg-[rgba(255,255,255,.1)] rounded-[32px] px-6 py-4 flex gap-4 items-center active:opacity-80 transition-opacity"
            style={{ boxShadow: recording ? 'inset 0 0 0 2px rgba(255,255,255,.4)' : 'none' }}>
            <div className="rounded-[24px] size-12 flex items-center justify-center shrink-0"
              style={{ background: recording ? 'rgba(239,68,68,.3)' : 'rgba(255,255,255,.2)' }}>
              <img alt="" src={imgMic} width={24} height={24} />
            </div>
            <div className="flex-1 flex flex-col gap-[2px] items-start min-w-0">
              <p className="text-white text-[18px]" style={sb}>{recording ? 'Recording…' : 'Record bark/whine'}</p>
              <p className="text-[rgba(255,255,255,.7)] text-[13px] whitespace-nowrap" style={med}>{recording ? 'Tap to stop' : 'Tap to start recording'}</p>
            </div>
            <span className="text-white text-[14px] shrink-0" style={sb}>{fmt(recTime)}</span>
          </button>
          <div className="flex gap-2 items-center w-full">
            <img alt="" src={imgInfo} width={16} height={16} className="shrink-0" />
            <p className="text-white text-[12px] flex-1" style={reg}>Hold the phone near your dog and tap the mic to start.</p>
          </div>
          {saveError && (
            <p className="text-[13px] text-center" style={{ ...med, color: '#ffb4b4' }}>{saveError}</p>
          )}
        </div>
      </div>
      <NextBtn onClick={finishOnboarding} disabled={saving} label={saving ? 'Saving…' : 'Next'} />
    </div>
  );

  const Congrats = (
    <div className="absolute inset-0 bg-[#1b5df1] overflow-hidden">
      <div className="absolute" style={{ inset: '8.53% 31.53% 87.83% 31.28%' }}>
        <img alt="PAWSE" className="absolute block inset-0 max-w-none size-full" src={imgDog} />
      </div>
      <div className="absolute" style={{ left: 33, top: 164, width: 324, height: 364 }}>
        <img alt="Dog" className="absolute inset-0 max-w-none object-cover size-full" src={imgDoggu} />
      </div>
      <div className="absolute -translate-x-1/2" style={{ left: '50%', top: 505, width: 216, height: 9 }}>
        <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgEllipse} />
      </div>
      <div className="absolute left-8 w-[326px]" style={{ top: 560 }}>
        <div className="flex flex-col gap-3 mb-8">
          <div style={sb}>
            <p className="text-white text-[24px] leading-normal">Congratulations!</p>
            <p className="text-white text-[24px] leading-normal">You are all set</p>
          </div>
          <p className="text-white text-[14px] leading-relaxed" style={reg}>Begin monitoring your dog's activity and enjoy peace of mind.</p>
        </div>
        <button onClick={() => { setScreen('splash'); setPrev(null); }}
          className="bg-white rounded-[32px] flex items-center justify-center px-8 py-3 w-full active:scale-95 transition-transform"
          style={{ boxShadow: '0 4px 2px rgba(0,0,0,.25)' }}>
          <span className="text-[#1b5df1] text-[20px]" style={sb}>Get Started</span>
        </button>
      </div>
    </div>
  );

  const SCREENS: Record<Screen, React.ReactNode> = {
    intro: IntroScreen, splash: Splash, paw: Paw, onboarding: Onboarding,
    name: Name, breed: Breed, 'breed-mixed': BreedMixed,
    details: Details, energy: Energy, temperament: Temperament,
    'alone-time': AloneTime, fears: Fears, vocal: Vocal,
    whimper: Whimper, 'bark-triggers': BarkTriggers, record: Record,
    congrats: Congrats,
  };

  const curIdx  = ORDER.indexOf(screen);
  const prevIdx = prev ? ORDER.indexOf(prev) : -1;

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', overflow: 'hidden' }}>
      <div
        className="relative overflow-hidden bg-white"
        style={{ width: STAGE_W, height: STAGE_H, borderRadius: 40, transform: `scale(${scale})`, transformOrigin: 'center center', boxShadow: '0 30px 90px rgba(0,0,0,.55)' }}
      >
        {ORDER.map(id => {
          const active = screen === id, isPrev = prev === id;
          const thisIdx = ORDER.indexOf(id);
          let tx = '100%';
          if (active) tx = '0%';
          else if (isPrev) tx = curIdx > prevIdx ? '-100%' : '100%';
          else tx = thisIdx < curIdx ? '-100%' : '100%';
          return (
            <div key={id} className="absolute inset-0" style={{
              transform: `translateX(${tx})`,
              transition: 'transform 360ms cubic-bezier(0.4,0,0.2,1)',
              pointerEvents: active ? 'auto' : 'none',
              willChange: 'transform',
            }}>
              {SCREENS[id]}
            </div>
          );
        })}
      </div>
    </div>
  );
}
