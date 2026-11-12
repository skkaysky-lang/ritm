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
import { Finance } from './screens/Finance';
import { Progress } from './screens/Progress';

export type Tab = 'today' | 'sleep' | 'food' | 'habits' | 'money' | 'progress';

const TABS: { id: Tab; label: string; icon: string; color: string }[] = [
  { id: 'today', label: 'Сегодня', icon: 'home', color: 'var(--accent)' },
  { id: 'sleep', label: 'Сон', icon: 'moon', color: 'var(--sleep)' },
  { id: 'food', label: 'Еда', icon: 'food', color: 'var(--food)' },
  { id: 'habits', label: 'Привычки', icon: 'habits', color: 'var(--habit)' },
  { id: 'money', label: 'Деньги', icon: 'wallet', color: 'var(--money)' },
  { id: 'progress', label: 'Итоги', icon: 'chart', color: 'var(--steps)' },
];

export default function App() {
  const onboarded = useStore((s) => s.onboarded);
  const [tab, setTab] = useState<Tab>(() => {
    const t = sessionStorage.getItem('ritm-tab') as Tab | null;
    return t && TABS.some((x) => x.id === t) ? t : 'today';
  });

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
  const color = TABS.find((t) => t.id === tab)!.color;

  return (
    <div className="app" style={{ ['--amb' as string]: color }}>
      {/* мягкое цветное свечение сверху — у каждого раздела своё */}
      <div className="ambient" key={tab} />
      {tab === 'today' && <Today go={go} />}
      {tab === 'sleep' && <Sleep />}
      {tab === 'food' && <FoodScreen />}
      {tab === 'habits' && <Habits />}
      {tab === 'money' && <Finance />}
      {tab === 'progress' && <Progress />}

      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'on' : ''}`} style={{ ['--tc' as string]: t.color }} onClick={() => go(t.id)}>
            <Icon name={t.icon} size={21} stroke={tab === t.id ? 2.3 : 2} />
            {t.label}
          </button>
        ))}
      </nav>
      <ToastHost />
      <ConfettiHost />
    </div>
  );
}
