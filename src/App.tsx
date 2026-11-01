import { useEffect, useState } from 'react';
import { useStore } from './store';
import { Icon } from './components/Icon';
import { ConfettiHost, ToastHost } from './components/ui';
import { haptic, initTelegram, onThemeChange } from './lib/telegram';
import { applyTheme, BG, readThemePref, resolveTheme } from './lib/theme';
import { Onboarding } from './screens/Onboarding';
import { Today } from './screens/Today';
import { Sleep } from './screens/Sleep';
import { FoodScreen } from './screens/Food';
import { Habits } from './screens/Habits';
import { Progress } from './screens/Progress';

export type Tab = 'today' | 'sleep' | 'food' | 'habits' | 'progress';
const TABS: { id: Tab; label: string; icon: string; color: string }[] = [
  { id: 'today', label: 'Сегодня', icon: 'home', color: 'var(--accent)' },
  { id: 'sleep', label: 'Сон', icon: 'moon', color: 'var(--sleep)' },
  { id: 'food', label: 'Питание', icon: 'food', color: 'var(--food)' },
  { id: 'habits', label: 'Привычки', icon: 'habits', color: 'var(--habit)' },
  { id: 'progress', label: 'Прогресс', icon: 'chart', color: 'var(--steps)' },
];

export default function App() {
  const onboarded = useStore((s) => s.onboarded);
  const [tab, setTab] = useState<Tab>(() => (sessionStorage.getItem('ritm-tab') as Tab) || 'today');

  useEffect(() => {
    const t = resolveTheme(readThemePref());
    document.documentElement.dataset.theme = t;
    initTelegram(BG[t]);
    onThemeChange(() => applyTheme(readThemePref()));
  }, []);

  useEffect(() => {
    sessionStorage.setItem('ritm-tab', tab);
    window.scrollTo({ top: 0 });
  }, [tab]);

  if (!onboarded) return <Onboarding />;

  const go = (t: Tab) => {
    haptic.select();
    setTab(t);
  };

  return (
    <div className="app">
      {tab === 'today' && <Today go={go} />}
      {tab === 'sleep' && <Sleep />}
      {tab === 'food' && <FoodScreen />}
      {tab === 'habits' && <Habits />}
      {tab === 'progress' && <Progress />}

      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'on' : ''}`} style={{ ['--tc' as string]: t.color }} onClick={() => go(t.id)}>
            <Icon name={t.icon} size={22} stroke={tab === t.id ? 2.3 : 2} />
            {t.label}
          </button>
        ))}
      </nav>
      <ToastHost />
      <ConfettiHost />
    </div>
  );
}
