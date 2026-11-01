import { useStore, type Habit } from '../store';
import { dayHabitProgress, habitCount, habitStreak, isScheduled } from '../lib/calc';
import { addDays, dayKey, weekday } from '../lib/date';
import { haptic } from '../lib/telegram';
import { Icon } from './Icon';
import { confetti, toast } from './ui';

/** Отметка привычки: для простых — переключение, для счётных — +1 до цели, потом сброс */
export function useHabitTap() {
  const s = useStore();
  return (h: Habit, day: string) => {
    const cur = habitCount(s, day, h.id);
    let next: number;
    if (h.target <= 1) next = cur >= 1 ? 0 : 1;
    else next = cur >= h.target ? 0 : cur + 1;
    s.setHabitCount(day, h.id, next);
    if (next >= h.target && cur < h.target) {
      haptic.success();
      const st = useStore.getState();
      const p = dayHabitProgress(st, day);
      const streak = habitStreak(st, h, day);
      if (p.total > 1 && p.done === p.total) {
        confetti();
        toast('⭐ Идеальный день! Все привычки выполнены');
      } else if ([7, 14, 21, 30, 50, 66, 100].includes(streak)) {
        confetti();
        toast(`🔥 ${streak} дней подряд: ${h.name}!`);
      }
    } else if (next === 0) {
      haptic.soft();
      if (cur > 0) toast('Отметка снята', { label: 'Вернуть', fn: () => useStore.getState().setHabitCount(day, h.id, cur) });
    } else haptic.light();
  };
}

export function HabitRow({ h, day, onOpen }: { h: Habit; day: string; onOpen?: () => void }) {
  const s = useStore();
  const tap = useHabitTap();
  const cnt = habitCount(s, day, h.id);
  const done = cnt >= h.target;
  const streak = habitStreak(s, h, day);
  const monday = addDays(dayKey(), -weekday(dayKey()));
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  return (
    <div className={`habit ${done ? 'done' : ''}`} style={{ ['--hc' as string]: h.color }}>
      <div className="fill" style={{ transform: `scaleX(${Math.min(1, cnt / h.target)})` }} />
      <button className="row grow" style={{ textAlign: 'left', position: 'relative' }} onClick={onOpen}>
        <div className="emoji-box">{h.emoji}</div>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="bold ellipsis" style={{ textDecoration: done ? 'none' : undefined }}>
            {h.name}
          </div>
          <div className="row" style={{ gap: 8, marginTop: 3 }}>
            {h.target > 1 && (
              <span className="tiny bold num" style={{ color: done ? h.color : 'var(--text-2)' }}>
                {cnt}/{h.target} {h.unit}
              </span>
            )}
            {streak > 0 && (
              <span className="tiny bold row" style={{ gap: 2, color: 'var(--food)' }}>
                <Icon name="flame" size={13} /> {streak}
              </span>
            )}
            <div className="mini-dots">
              {week.map((k) => {
                const sch = isScheduled(h, k);
                const ok = habitCount(s, k, h.id) >= h.target;
                return <i key={k} className={`${ok ? 'on' : ''} ${!sch ? 'off' : ''}`} />;
              })}
            </div>
          </div>
        </div>
      </button>
      <button className={`check ${done ? 'on' : cnt > 0 ? 'partial' : ''}`} onClick={() => tap(h, day)} aria-label={done ? 'Снять отметку' : 'Отметить'}>
        {done ? <Icon name="check" size={20} stroke={3} /> : h.target > 1 ? (cnt > 0 ? `+1` : <Icon name="plus" size={18} stroke={2.5} />) : null}
      </button>
    </div>
  );
}
