import { useEffect, useRef, useState } from 'react';
import Dashboard from './Dashboard';
import Analytics from './Analytics';
import Profile from './Profile';
import { EVENT_COPY, alertsSeenAt, markAlertsSeen, timeAgo, useDogData } from './useDogData';
import { BottomNav, Stage, Toast, font, getDogPhoto, type Page } from './ui';
import './dashboard.css';

const imgClock = '/assets/3e578.svg';

export default function DashboardApp() {
  const data = useDogData();
  const [page, setPage] = useState<Page>('dashboard');
  const [photo, setPhoto] = useState<string | null>(getDogPhoto);
  const [showNudge, setShowNudge] = useState(false);
  const [seenAt, setSeenAt] = useState(alertsSeenAt);
  const [toast, setToast] = useState<{ text: string; tone: 'info' | 'error' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const notify = (text: string, tone: 'info' | 'error' = 'info') => {
    setToast({ text, tone });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const unseenEvents = data.events.filter(e => e.timestamp > seenAt && e.feedback !== 'false');
  const latest = unseenEvents[0] ?? data.events[0] ?? null;
  const name = data.dog?.name || 'Your dog';

  const toggleNudge = () => {
    setShowNudge(v => {
      if (!v) { markAlertsSeen(); setSeenAt(alertsSeenAt()); }
      return !v;
    });
  };

  if (data.notFound) {
    return (
      <Stage>
        <div className="absolute inset-0 bg-[#1b5df1] flex flex-col items-center justify-center gap-6 px-8 text-center">
          <p className="text-white text-[22px]" style={font.sb}>We couldn't find your dog's profile</p>
          <button onClick={() => { localStorage.removeItem('pawse.dogId'); window.location.reload(); }}
            className="bg-white rounded-[32px] px-8 py-3 text-[#1b5df1] text-[18px]" style={font.sb}>Set up again</button>
        </div>
      </Stage>
    );
  }

  const common = { data, photo, unseen: unseenEvents.length, onBellClick: toggleNudge };

  return (
    <Stage>
      {page === 'dashboard' && <Dashboard {...common} onNavigate={setPage} notify={notify} />}
      {page === 'analytics' && <Analytics {...common} />}
      {page === 'profile' && <Profile {...common} onNavigate={setPage} onPhoto={setPhoto} notify={notify} />}

      <BottomNav page={page} onNavigate={setPage} tint={page === 'profile' ? 'rgba(27,93,241,0.2)' : undefined} />

      {data.error && !data.loading && (
        <div className="absolute top-3 left-6 right-6 z-40 rounded-[16px] bg-[#111827]/85 px-4 py-2 text-center">
          <p className="text-white text-[12px]" style={font.med}>{data.error}</p>
        </div>
      )}

      <div className="absolute left-6 right-6 transition-all duration-300 ease-out z-50"
        style={{ top: showNudge ? 32 : -140, opacity: showNudge ? 1 : 0, pointerEvents: showNudge ? 'auto' : 'none' }}>
        <div className="bg-[#1b5df1] rounded-[24px] px-[16px] py-[12px] flex gap-[12px] items-center shadow-lg">
          <div className="bg-[rgba(255,255,255,0.1)] rounded-[16px] size-[32px] flex items-center justify-center shrink-0">
            <img alt="" className="size-[18px]" src={imgClock} />
          </div>
          <div className="flex flex-col gap-[2px] flex-1 min-w-0">
            <p className="text-[14px] text-white" style={font.sb}>
              {latest ? (EVENT_COPY[latest.class]?.title ?? latest.class) : 'No new alerts'}
            </p>
            <p className="text-[12px] text-[rgba(255,255,255,0.8)] leading-[1.4]" style={font.reg}>
              {latest
                ? `${EVENT_COPY[latest.class]?.body(name) ?? ''} · ${timeAgo(latest.timestamp)}`
                : `${name} is doing fine. We'll let you know if anything changes.`}
            </p>
          </div>
          <button onClick={() => setShowNudge(false)} className="text-[rgba(255,255,255,0.6)] text-[20px] leading-none shrink-0 pl-1" aria-label="Dismiss">×</button>
        </div>
      </div>

      <Toast text={toast?.text ?? null} tone={toast?.tone} />
    </Stage>
  );
}
