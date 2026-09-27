import { useEffect, useState, type ReactNode } from 'react';

const A = '/assets';
export const imgDoggu = `${A}/92498.png`;
const imgBell = `${A}/3949d.png`;
const imgPawActive = `${A}/715b2.svg`;
const imgPawIdle = `${A}/4b479.svg`;
const imgTrendActive = `${A}/89aeb.svg`;
const imgTrendIdle = `${A}/fba78.svg`;
export const imgBlob = `${A}/c83f9.svg`;

export type Page = 'dashboard' | 'analytics' | 'profile';

export const font = {
  reg: { fontFamily: 'Poppins, sans-serif', fontWeight: 400 },
  med: { fontFamily: 'Poppins, sans-serif', fontWeight: 500 },
  sb: { fontFamily: 'Poppins, sans-serif', fontWeight: 600 },
  bold: { fontFamily: 'Poppins, sans-serif', fontWeight: 700 },
  inter: (w: number) => ({ fontFamily: 'Inter, Poppins, sans-serif', fontWeight: w }),
} as const;

// Same 390×844 phone stage the onboarding flow renders into, so the hand-off
// from Congrats → Dashboard doesn't jump between layouts.
const STAGE_W = 390;
const STAGE_H = 844;

function useStageScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const compute = () => {
      const pad = 24;
      const fit = Math.min((window.innerWidth - pad) / STAGE_W, (window.innerHeight - pad) / STAGE_H);
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

export function Stage({ children }: { children: ReactNode }) {
  const scale = useStageScale();
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', overflow: 'hidden' }}>
      <div
        className="relative overflow-hidden bg-white"
        style={{ width: STAGE_W, height: STAGE_H, borderRadius: 40, transform: `scale(${scale})`, transformOrigin: 'center center', boxShadow: '0 30px 90px rgba(0,0,0,.55)' }}
      >
        {children}
      </div>
    </div>
  );
}

const PHOTO_KEY = 'pawse.dogPhoto';
export const getDogPhoto = () => localStorage.getItem(PHOTO_KEY);
export const setDogPhoto = (dataUrl: string) => localStorage.setItem(PHOTO_KEY, dataUrl);

export function DogAvatar({ size, photo }: { size: number; photo: string | null }) {
  return (
    <div className="bg-[#1b5df1] rounded-full overflow-hidden relative shrink-0" style={{ width: size, height: size }}>
      {photo
        ? <img alt="" src={photo} className="absolute inset-0 size-full object-cover" />
        : <img alt="" src={imgDoggu} className="absolute max-w-none" style={{ height: '240.49%', width: '195.51%', left: '-41.77%', top: '0.25%' }} />}
    </div>
  );
}

export function Bell({ count, onClick, className = '' }: { count: number; onClick: () => void; className?: string }) {
  return (
    <button onClick={onClick} className={`relative w-[35px] h-[40px] ${className}`} aria-label="Notifications">
      <img alt="" className="absolute h-[192.27%] left-0 max-w-none top-[-46.13%] w-full" src={imgBell} />
      {/* The design's bell PNG has a "1" badge baked in; cover it with the bell's own
          mirrored left side so the real count below is the only badge shown. */}
      <img alt="" className="absolute h-[192.27%] left-0 max-w-none top-[-46.13%] w-full" src={imgBell}
        style={{ transform: 'scaleX(-1)', clipPath: 'inset(28.5% 61% 55% 6.5%)' }} />
      {count > 0 && (
        <div className="absolute top-[2px] left-[19px] bg-[#f32027] rounded-full min-w-[16px] h-[16px] px-[3px] flex items-center justify-center">
          <span className="text-[8px] text-white leading-none" style={font.bold}>{count > 9 ? '9+' : count}</span>
        </div>
      )}
    </button>
  );
}

export function BottomNav({ page, onNavigate, tint = 'rgba(255,255,255,0.2)' }: {
  page: Page; onNavigate: (p: Page) => void; tint?: string;
}) {
  const item = (id: Page, active: string, idle: string, w: number, h: number, label: string) => {
    const on = page === id;
    return (
      <button onClick={() => onNavigate(id)} aria-label={label}
        className="rounded-[100px] size-[74px] flex items-center justify-center transition-colors"
        style={{ background: on ? '#1b5df1' : 'transparent' }}>
        <img alt="" src={on ? active : idle} style={{ width: w, height: h }} />
      </button>
    );
  };
  return (
    <div className="absolute bottom-4 left-6 flex gap-[17px] items-center px-[16px] py-[12px] rounded-[100px] h-[98px] z-30 backdrop-blur-md"
      style={{ background: tint }}>
      {item('dashboard', imgPawActive, imgPawIdle, 58.884, 51.505, 'Dashboard')}
      {item('analytics', imgTrendActive, imgTrendIdle, 58, 34, 'Analytics')}
    </div>
  );
}

export function Toast({ text, tone = 'info' }: { text: string | null; tone?: 'info' | 'error' }) {
  return (
    <div className="absolute left-6 right-6 z-50 transition-all duration-300 pointer-events-none"
      style={{ bottom: text ? 124 : 90, opacity: text ? 1 : 0 }}>
      <div className="rounded-[20px] px-4 py-3 text-center text-[13px] text-white shadow-lg"
        style={{ ...font.med, background: tone === 'error' ? '#d9363e' : '#111827' }}>
        {text}
      </div>
    </div>
  );
}
