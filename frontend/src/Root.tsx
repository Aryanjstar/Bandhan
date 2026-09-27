import { useEffect, useState } from 'react';
import App from './App';
import DashboardApp from './dashboard/DashboardApp';
import { cachedDogId, getMyDog, hasOwnerSession } from './lib/api';

type Mode = 'loading' | 'onboarding' | 'dashboard';

export default function Root() {
  const [mode, setMode] = useState<Mode>(() => {
    if (cachedDogId()) return 'dashboard';
    return hasOwnerSession() ? 'loading' : 'onboarding';
  });

  // A guest session without a cached dog id either never finished onboarding or
  // finished it before the id was cached — ask the backend which one.
  useEffect(() => {
    if (mode !== 'loading') return;
    getMyDog()
      .then(dog => setMode(dog ? 'dashboard' : 'onboarding'))
      .catch(() => setMode('onboarding'));
  }, [mode]);

  if (mode === 'loading') return <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a' }} />;
  if (mode === 'onboarding') return <App onFinished={() => setMode('dashboard')} />;
  return <DashboardApp />;
}
