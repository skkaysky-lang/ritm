import { useState } from 'react';
import { useStore } from '../store';
import type { Tab } from '../App';
import { activeStreak, currentWeight, dayHabitProgress, dayScore, dayTargets, fmtNum, greeting, isScheduled, nightsByDay, round1, scoreLabel, sleepScore, stepsKm, sumMacros, wakeTimesFrom } from '../lib/calc';
import { addDays, dayKey, fmtDur, fmtMinutesOfDay, fmtTime, longDate, minutesOfDay } from '../lib/date';
import { allowance, daySpent, fmtMoney } from '../lib/money';
import { haptic } from '../lib/telegram';
import { tipOfDay } from '../lib/insights';
import { Icon } from '../components/Icon';
import { ActivityRings, Bar, CountUp, Ring, toast, useNow } from '../components/ui';
import { HabitRow } from '../components/HabitRow';
import { WaterCard } from '../components/widgets';
import { AddFoodSheet } from '../components/FoodSheets';
import { TxnSheet } from '../components/MoneySheets';
import { NapSheet, SettingsSheet, SleepEditSheet, SleepRateSheet, StepsSheet, WeightSheet } from '../components/sheets';

const MOODS = ['😞', '😕', '😐', '🙂', '😄'];
const Q = ['😫', '😕', '😐', '🙂', '🤩'];

function scorePhrase(v: number) {
  if (v >= 100) return 'Идеальный день! 🏆';
  if (v >= 85) return 'Почти идеально 🔥';
  if (v >= 60) return 'Отличный темп';
  if (v >= 30) return 'Хороший старт';
  return 'День только начинается';
}

export function Today({ go }: { go: (t: Tab) => void }) {
  const s = useStore();
  const now = useNow(30_000);
  const today = dayKey();
  const [sheet, setSheet] = useState<null | 'food' | 'steps' | 'weight' | 'settings' | 'sleep' | 'nap' | 'money' | 'napManual'>(null);
  const [rateId, setRateId] = useState<string | null>(null);

  const t = dayTargets(s, today);
  const eaten = sumMacros(s.food[today] ?? []);
  const left = t.kcal - eaten.kcal;
  const night = nightsByDay(s.sleeps)[today];
  const habits = s.habits.filter((h) => !h.archived && isScheduled(h, today));
  const hp = dayHabitProgress(s, today);
  const steps = s.steps[today] ?? 0;

  const w = currentWeight(s);
  const wkAgo = Object.keys(s.weights)
    .sort()
    .filter((k) => k <= addDays(today, -6))
    .pop();
  const wDiff = wkAgo ? w - s.weights[wkAgo] : null;
  const tip = tipOfDay();
  const hour = new Date(now).getHours();
  const evening = hour >= 20 || hour < 4;
  const ds = dayScore(s, today);
  const streak = activeStreak(s);
  const al = allowance(s);
  const spent = daySpent(s, today);
  const cur = s.fin.currency;
  const napping = s.sleepStart != null && s.sleepKind === 'nap';
  // now обновляется раз в несколько секунд, поэтому сразу после старта берём свежее время
  const elapsed = s.sleepStart ? Math.max(0, (Math.max(now, Date.now()) - s.sleepStart) / 60000) : 0;

  const wake = () => {
    const wasNap = napping;
    const id = s.endSleep();
    haptic.success();
    if (!id) return toast('Слишком короткий сон, не записал');
    if (wasNap) toast('😴 Дневной сон записан');
    else setRateId(id);
  };

  const legend: { e: string; l: string; v: string; c: string; tab: Tab }[] = [
    { e: '😴', l: 'Сон', v: night?.main ? fmtDur(night.total) : '—', c: 'var(--sleep)', tab: 'sleep' },
    { e: '🍎', l: 'Еда', v: `${fmtNum(eaten.kcal)} / ${fmtNum(t.kcal)}`, c: 'var(--food)', tab: 'food' },
    { e: '👟', l: 'Шаги', v: fmtNum(steps), c: 'var(--steps)', tab: 'progress' },
    { e: '✅', l: 'Привычки', v: hp.total ? `${hp.done} из ${hp.total}` : '—', c: 'var(--habit)', tab: 'habits' },
  ];

  return (
    <div className="screen stack">
      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <div className="page-title" style={{ fontSize: 25 }}>
            {greeting()}
            {s.profile.name ? `, ${s.profile.name}` : ''} 👋
          </div>
          <div className="page-sub">{longDate()}</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {streak > 1 && (
            <button className="streak" onClick={() => toast(`🔥 ${streak} дней подряд с записями. Не прерывай серию!`)}>
              <Icon name="flame" size={15} /> {streak}
            </button>
          )}
          <button className="icon-btn" onClick={() => (haptic.light(), setSheet('settings'))} aria-label="Настройки">
            <Icon name="settings" />
          </button>
        </div>
      </div>

      {/* ---------- Индекс дня ---------- */}
      <div className="card hero-day">
        <div className="row" style={{ gap: 16 }}>
          <ActivityRings
            size={148}
            stroke={12}
            rings={[
              { value: ds.sleep ?? 0, colors: ['#a99dff', '#6f8dff'] },
              { value: ds.food ?? 0, colors: ['#ffb057', '#ff6b6b'] },
              { value: ds.steps, colors: ['#4fb4ff', '#7c6cff'] },
              { value: ds.habits ?? 0, colors: ['#3fe0b0', '#19b3d6'] },
            ]}
          >
            <div className="num" style={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>
              <CountUp value={ds.score} />
            </div>
            <div className="tiny muted bold">из 100</div>
          </ActivityRings>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="tiny bold" style={{ color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Индекс дня
            </div>
            <div className="bold" style={{ fontSize: 16, marginBottom: 6 }}>
              {scorePhrase(ds.score)}
            </div>
            {legend.map((x) => (
              <button key={x.l} className="legend-row" onClick={() => go(x.tab)}>
                <i className="dot" style={{ background: x.c }} />
                <span className="muted">{x.l}</span>
                <span className="grow" />
                <span className="bold num">{x.v}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ---------- Быстрые действия ---------- */}
      <div className="chips quick">
        <button className="chip" onClick={() => (haptic.light(), setSheet('food'))}>
          🍽️ Еда
        </button>
        <button
          className="chip"
          onClick={() => {
            s.addWater(today, s.profile.glass);
            haptic.light();
            toast(`💧 +${s.profile.glass} мл`, { label: 'Отменить', fn: () => useStore.getState().addWater(today, -s.profile.glass) });
          }}
        >
          💧 Вода
        </button>
        <button className="chip" onClick={() => (haptic.light(), setSheet('money'))}>
          💸 Трата
        </button>
        <button className="chip" onClick={() => (haptic.light(), setSheet('steps'))}>
          👟 Шаги
        </button>
        {!s.sleepStart && !evening && (
          <button className="chip" onClick={() => (haptic.light(), setSheet('nap'))}>
            😴 Вздремнуть
          </button>
        )}
        <button className="chip" onClick={() => (haptic.light(), setSheet('weight'))}>
          ⚖️ Вес
        </button>
      </div>

      {/* ---------- Сон ---------- */}
      {s.sleepStart && napping ? (
        <div className="card hero-nap">
          <div className="row-between">
            <div>
              <div className="small bold" style={{ opacity: 0.9 }}>
                😴 Дневной сон с {fmtTime(s.sleepStart)}
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em' }} className="num">
                {Math.floor(elapsed)} мин{s.napTarget ? <span style={{ fontSize: 15, opacity: 0.8 }}> из {s.napTarget}</span> : null}
              </div>
              {s.napTarget != null && (
                <div className="tiny bold" style={{ opacity: 0.9 }}>
                  {elapsed >= s.napTarget ? '⏰ Пора вставать!' : `Подъём в ${fmtTime(s.sleepStart + s.napTarget * 60_000)}`}
                </div>
              )}
            </div>
            <button className="btn white sm" style={{ color: '#b45309', height: 44 }} onClick={wake}>
              ☀️ Проснулся
            </button>
          </div>
          {s.napTarget != null && (
            <div className="bar" style={{ marginTop: 12, background: 'rgba(255,255,255,.25)' }}>
              <i style={{ width: `${Math.min(100, (elapsed / s.napTarget) * 100)}%`, ['--c' as string]: '#fff' }} />
            </div>
          )}
        </div>
      ) : s.sleepStart ? (
        <div className="card hero-sleep">
          <div className="stars" />
          <div className="row-between" style={{ position: 'relative' }}>
            <div>
              <div className="small muted bold">🌙 Спишь с {fmtTime(s.sleepStart)}</div>
              <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em' }} className="num">
                {fmtDur(elapsed)}
              </div>
              <div className="tiny muted">
                Лучше встать в{' '}
                {wakeTimesFrom(minutesOfDay(s.sleepStart))
                  .slice(1, 4)
                  .map((x) => fmtMinutesOfDay(x.at))
                  .join(' · ')}
              </div>
            </div>
            <div style={{ fontSize: 46 }}>😴</div>
          </div>
          <div className="row" style={{ marginTop: 14, position: 'relative' }}>
            <button className="btn glass sm" onClick={() => (s.cancelSleep(), haptic.soft(), toast('Отменено'))}>
              Отмена
            </button>
            <button className="btn white" style={{ height: 44 }} onClick={wake}>
              ☀️ Я проснулся
            </button>
          </div>
        </div>
      ) : night?.main ? (
        <button className="card tap" style={{ textAlign: 'left' }} onClick={() => go('sleep')}>
          <div className="row" style={{ gap: 14 }}>
            <Ring value={night.total / (s.profile.sleepGoal * 60)} size={64} stroke={7} colors={['var(--sleep)', 'var(--sleep-2)']}>
              <span style={{ fontSize: 20 }}>{night.main.quality ? Q[night.main.quality - 1] : '😴'}</span>
            </Ring>
            <div className="grow">
              <div className="small muted bold">Сон этой ночью</div>
              <div style={{ fontSize: 22, fontWeight: 800 }} className="num">
                {fmtDur(night.night)}
                {night.nap > 0 && <span className="small" style={{ color: 'var(--nap)' }}> +{fmtDur(night.nap)} днём</span>}
              </div>
              <div className="tiny muted num">
                {fmtTime(night.main.start)} → {fmtTime(night.main.end)} · {scoreLabel(sleepScore(night.main, s.profile.sleepGoal, night.nap))} {sleepScore(night.main, s.profile.sleepGoal, night.nap)}/100
              </div>
            </div>
            {evening ? (
              <span
                className="btn sm"
                role="button"
                style={{ ['--c1' as string]: 'var(--sleep)', ['--c2' as string]: 'var(--sleep-2)' }}
                onClick={(e) => {
                  e.stopPropagation();
                  s.startSleep();
                  haptic.medium();
                  toast('🌙 Спокойной ночи!');
                }}
              >
                🌙 Лечь
              </span>
            ) : (
              <Icon name="right" className="faint" />
            )}
          </div>
        </button>
      ) : (
        <div className={`card ${evening ? 'hero-sleep' : ''}`}>
          {evening && <div className="stars" />}
          <div className="row-between" style={{ position: 'relative' }}>
            <div>
              <div className="card-title">{evening ? 'Пора отдыхать?' : night?.nap ? `Днём поспал ${fmtDur(night.nap)}` : 'Как спалось?'}</div>
              <div className="small muted">{evening ? 'Нажми, когда ложишься. Утром нажмёшь «Проснулся»' : 'Добавь ночной сон, чтобы видеть статистику'}</div>
            </div>
            <div style={{ fontSize: 36 }}>{evening ? '🌙' : '🛌'}</div>
          </div>
          <div className="grid-2" style={{ marginTop: 12, position: 'relative' }}>
            <button className={`btn sm ${evening ? 'glass' : 'ghost'}`} style={{ width: '100%' }} onClick={() => setSheet('sleep')}>
              <Icon name="edit" size={16} /> Вручную
            </button>
            <button
              className={`btn sm ${evening ? 'white' : ''}`}
              style={{ width: '100%', ['--c1' as string]: 'var(--sleep)', ['--c2' as string]: 'var(--sleep-2)' }}
              onClick={() => {
                s.startSleep();
                haptic.medium();
                toast('🌙 Спокойной ночи!');
              }}
            >
              🌙 Ложусь
            </button>
          </div>
        </div>
      )}

      {/* ---------- Калории ---------- */}
      <div className="card card-glow tap" style={{ ['--glow' as string]: 'var(--food)' }} onClick={() => go('food')}>
        <div className="row" style={{ gap: 16 }}>
          <Ring value={eaten.kcal / t.kcal} size={112} stroke={12} colors={left < 0 ? ['var(--bad)', 'var(--food-2)'] : ['var(--food)', 'var(--food-2)']}>
            <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1 }} className="num">
              <CountUp value={Math.abs(left)} />
            </div>
            <div className="tiny muted bold">{left >= 0 ? 'ккал осталось' : 'ккал сверху'}</div>
          </Ring>
          <div className="grow stack-sm">
            {(
              [
                ['Белки', eaten.p, t.p, 'var(--protein)'],
                ['Жиры', eaten.f, t.f, 'var(--fat)'],
                ['Углеводы', eaten.c, t.c, 'var(--carbs)'],
              ] as const
            ).map(([l, v, g, c]) => (
              <div key={l}>
                <div className="row-between tiny bold" style={{ marginBottom: 3 }}>
                  <span className="muted">{l}</span>
                  <span className="num">
                    {Math.round(v)}
                    <span className="faint">/{g} г</span>
                  </span>
                </div>
                <Bar value={v / g} color={c} className="thin" />
              </div>
            ))}
          </div>
        </div>
        <button
          className="btn sm"
          style={{ width: '100%', marginTop: 14, ['--c1' as string]: 'var(--food)', ['--c2' as string]: 'var(--food-2)' }}
          onClick={(e) => {
            e.stopPropagation();
            haptic.light();
            setSheet('food');
          }}
        >
          <Icon name="plus" size={18} /> Добавить еду
        </button>
      </div>

      {/* ---------- Вода и шаги ---------- */}
      <div className="grid-2">
        <WaterCard day={today} compact />
        <button className="card tight tap" style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10 }} onClick={() => (haptic.light(), setSheet('steps'))}>
          <div className="row-between" style={{ width: '100%' }}>
            <span className="card-title small" style={{ color: 'var(--steps)' }}>
              <Icon name="steps" size={17} /> Шаги
            </span>
            <span className="tiny faint bold num">{Math.round((steps / s.profile.stepGoal) * 100)}%</span>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <Ring value={steps / s.profile.stepGoal} size={46} stroke={6} colors={['var(--steps)', 'var(--steps-2)']}>
              <span style={{ fontSize: 15 }}>👟</span>
            </Ring>
            <div className="stat">
              <span className="v num" style={{ fontSize: 18 }}>
                {fmtNum(steps)}
              </span>
              <span className="l">{round1(stepsKm(steps, s.profile)).toString().replace('.', ',')} км</span>
            </div>
          </div>
          <span className="btn sm ghost" style={{ height: 32, width: '100%' }}>
            {steps ? 'Обновить' : 'Ввести шаги'}
          </span>
        </button>
      </div>

      {/* ---------- Деньги ---------- */}
      <div className="card tap" onClick={() => go('money')}>
        <div className="row" style={{ gap: 12 }}>
          <div className="emoji-box" style={{ background: 'color-mix(in srgb, var(--money) 18%, transparent)' }}>
            💸
          </div>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="small muted bold">{al ? (al.todayLeft >= 0 ? 'Сегодня можно потратить ещё' : 'Перерасход за сегодня') : 'Потрачено сегодня'}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: al && al.todayLeft < 0 ? 'var(--bad)' : undefined }} className="num">
              {fmtMoney(al ? Math.abs(Math.round(al.todayLeft)) : spent, cur)}
            </div>
          </div>
          <button
            className="btn sm"
            style={{ ['--c1' as string]: 'var(--money)', ['--c2' as string]: 'var(--money-2)', color: '#0b2a12' }}
            onClick={(e) => {
              e.stopPropagation();
              haptic.light();
              setSheet('money');
            }}
          >
            <Icon name="plus" size={16} stroke={2.6} /> Трата
          </button>
        </div>
        {al && (
          <div style={{ marginTop: 10 }}>
            <Bar value={al.todaySpent / Math.max(1, al.perDay)} color={al.todayLeft < 0 ? 'var(--bad)' : 'linear-gradient(90deg, var(--money), var(--money-2))'} className="thin" />
            <div className="row-between tiny muted bold" style={{ marginTop: 4 }}>
              <span>потрачено {fmtMoney(al.todaySpent, cur)}</span>
              <span>лимит дня {fmtMoney(Math.round(al.perDay), cur)}</span>
            </div>
          </div>
        )}
      </div>

      {/* ---------- Привычки ---------- */}
      <div className="row-between" style={{ marginTop: 6 }}>
        <div className="section-title" style={{ margin: '0 4px' }}>
          Привычки {hp.total ? `· ${hp.done}/${hp.total}` : ''}
        </div>
        <button className="link" onClick={() => go('habits')}>
          Все
        </button>
      </div>
      {habits.length ? (
        <div className="stack-sm">
          {habits.map((h) => (
            <HabitRow key={h.id} h={h} day={today} onOpen={() => go('habits')} />
          ))}
        </div>
      ) : (
        <button className="card tap row" onClick={() => go('habits')}>
          <div className="emoji-box">✨</div>
          <div className="grow" style={{ textAlign: 'left' }}>
            <div className="bold">На сегодня привычек нет</div>
            <div className="small muted">Добавь первую, например зарядку</div>
          </div>
          <Icon name="right" className="faint" />
        </button>
      )}

      {/* ---------- Настроение ---------- */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 10 }}>
          Как настроение?
        </div>
        <div className="moods">
          {MOODS.map((m, i) => (
            <button key={m} className={s.mood[today] === i + 1 ? 'on' : ''} onClick={() => (haptic.select(), s.setMood(today, i + 1))}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* ---------- Вес ---------- */}
      <button className="card tap row" style={{ textAlign: 'left' }} onClick={() => (haptic.light(), setSheet('weight'))}>
        <div className="emoji-box">⚖️</div>
        <div className="grow">
          <div className="small muted bold">Вес</div>
          <div className="row" style={{ gap: 8 }}>
            <span style={{ fontSize: 20, fontWeight: 800 }} className="num">
              {w.toFixed(1).replace('.', ',')} кг
            </span>
            {wDiff != null && Math.abs(wDiff) >= 0.05 && (
              <span className={`badge ${(s.profile.goal === 'lose' ? wDiff < 0 : s.profile.goal === 'gain' ? wDiff > 0 : Math.abs(wDiff) < 0.5) ? 'good' : 'warn'}`}>
                {wDiff > 0 ? '+' : '−'}
                {Math.abs(wDiff).toFixed(1).replace('.', ',')} за неделю
              </span>
            )}
          </div>
        </div>
        <span className="btn sm ghost">{s.weights[today] ? 'Изменить' : 'Взвеситься'}</span>
      </button>

      {/* ---------- Совет дня ---------- */}
      <div className="card tip">
        <div className="emoji-box">{tip.emoji}</div>
        <div>
          <div className="tiny bold" style={{ color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Совет дня
          </div>
          <div className="small">{tip.text}</div>
        </div>
      </div>

      <AddFoodSheet open={sheet === 'food'} onClose={() => setSheet(null)} day={today} />
      <StepsSheet open={sheet === 'steps'} onClose={() => setSheet(null)} day={today} />
      <WeightSheet open={sheet === 'weight'} onClose={() => setSheet(null)} />
      <SettingsSheet open={sheet === 'settings'} onClose={() => setSheet(null)} />
      <SleepEditSheet open={sheet === 'sleep' || sheet === 'napManual'} nap={sheet === 'napManual'} onClose={() => setSheet(null)} />
      <NapSheet open={sheet === 'nap'} onClose={() => setSheet(null)} onManual={() => setSheet('napManual')} />
      <TxnSheet open={sheet === 'money'} onClose={() => setSheet(null)} />
      <SleepRateSheet id={rateId} onClose={() => setRateId(null)} />
    </div>
  );
}

