import { useState } from 'react';
import { useStore } from '../store';
import type { Tab } from '../App';
import { currentWeight, dayHabitProgress, dayTargets, fmtNum, greeting, isScheduled, nightsByDay, round1, scoreLabel, sleepScore, stepsKm, sumMacros, wakeTimesFrom } from '../lib/calc';
import { addDays, dayKey, fmtDur, fmtMinutesOfDay, fmtTime, longDate, minutesOfDay } from '../lib/date';
import { haptic } from '../lib/telegram';
import { tipOfDay } from '../lib/insights';
import { Icon } from '../components/Icon';
import { Bar, CountUp, Ring, toast, useNow } from '../components/ui';
import { HabitRow } from '../components/HabitRow';
import { WaterCard } from '../components/widgets';
import { AddFoodSheet } from '../components/FoodSheets';
import { SettingsSheet, SleepEditSheet, SleepRateSheet, StepsSheet, WeightSheet } from '../components/sheets';

const MOODS = ['😞', '😕', '😐', '🙂', '😄'];

export function Today({ go }: { go: (t: Tab) => void }) {
  const s = useStore();
  const now = useNow(30_000);
  const today = dayKey();
  const [sheet, setSheet] = useState<null | 'food' | 'steps' | 'weight' | 'settings' | 'sleep'>(null);
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

  return (
    <div className="screen stack">
      <div className="page-head">
        <div>
          <div className="page-title" style={{ fontSize: 25 }}>
            {greeting()}
            {s.profile.name ? `, ${s.profile.name}` : ''} 👋
          </div>
          <div className="page-sub">{longDate()}</div>
        </div>
        <button className="icon-btn" onClick={() => (haptic.light(), setSheet('settings'))} aria-label="Настройки">
          <Icon name="settings" />
        </button>
      </div>

      {/* ---------- Сон ---------- */}
      {s.sleepStart ? (
        <div className="card hero-sleep">
          <div className="stars" />
          <div className="row-between" style={{ position: 'relative' }}>
            <div>
              <div className="small muted bold">🌙 Спишь с {fmtTime(s.sleepStart)}</div>
              <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em' }} className="num">
                {fmtDur((now - s.sleepStart) / 60000)}
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
            <button
              className="btn white"
              style={{ height: 44 }}
              onClick={() => {
                const id = s.endSleep();
                haptic.success();
                if (id) setRateId(id);
              }}
            >
              ☀️ Я проснулся
            </button>
          </div>
        </div>
      ) : night ? (
        <button className="card tap" style={{ textAlign: 'left' }} onClick={() => go('sleep')}>
          <div className="row" style={{ gap: 14 }}>
            <Ring value={night.total / (s.profile.sleepGoal * 60)} size={64} stroke={7} colors={['var(--sleep)', 'var(--sleep-2)']}>
              <span style={{ fontSize: 20 }}>{night.main.quality ? ['😫', '😕', '😐', '🙂', '🤩'][night.main.quality - 1] : '😴'}</span>
            </Ring>
            <div className="grow">
              <div className="small muted bold">Сон этой ночью</div>
              <div style={{ fontSize: 22, fontWeight: 800 }} className="num">
                {fmtDur(night.total)}
              </div>
              <div className="tiny muted num">
                {fmtTime(night.main.start)} → {fmtTime(night.main.end)} · {scoreLabel(sleepScore(night.main, s.profile.sleepGoal))} {sleepScore(night.main, s.profile.sleepGoal)}/100
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
              <div className="card-title">{evening ? 'Пора отдыхать?' : 'Как спалось?'}</div>
              <div className="small muted">{evening ? 'Нажми, когда ложишься. Утром нажмёшь «Проснулся»' : 'Добавь сон, чтобы видеть статистику'}</div>
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
          <Ring value={eaten.kcal / t.kcal} size={128} stroke={13} colors={left < 0 ? ['var(--bad)', 'var(--food-2)'] : ['var(--food)', 'var(--food-2)']}>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1 }} className="num">
              <CountUp value={Math.abs(left)} />
            </div>
            <div className="tiny muted bold">{left >= 0 ? 'ккал осталось' : 'ккал сверху'}</div>
          </Ring>
          <div className="grow stack-sm">
            <div className="row-between">
              <span className="small muted bold">Съедено</span>
              <span className="small bold num">
                {fmtNum(eaten.kcal)} / {fmtNum(t.kcal)}
              </span>
            </div>
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
      <SleepEditSheet open={sheet === 'sleep'} onClose={() => setSheet(null)} />
      <SleepRateSheet id={rateId} onClose={() => setRateId(null)} />
    </div>
  );
}