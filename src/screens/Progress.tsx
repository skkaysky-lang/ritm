import { useState } from 'react';
import { useStore } from '../store';
import { currentWeight, fmtNum, linearSlope, movingAvg, stepsKcal, stepsKm } from '../lib/calc';
import { addDays, dayKey, daysBetween, fmtDur, fromKey, humanDay, lastDays, MONTHS_GEN, WD, weekday } from '../lib/date';
import { haptic } from '../lib/telegram';
import { achievements, insights, periodSummary } from '../lib/insights';
import { Icon } from '../components/Icon';
import { Bars, LineChart } from '../components/charts';
import { Empty, Ring, Segmented, toast } from '../components/ui';
import { StepsSheet, WeightSheet } from '../components/sheets';

export function Progress() {
  const s = useStore();
  const [period, setPeriod] = useState<'7' | '30'>('7');
  const [sheet, setSheet] = useState<null | 'steps' | 'weight'>(null);
  const [stepDay, setStepDay] = useState(dayKey());
  const n = Number(period);
  const today = dayKey();
  const sum = periodSummary(s, n);

  /* --- шаги --- */
  const stepsToday = s.steps[today] ?? 0;
  const goal = s.profile.stepGoal;
  const stepKeys = lastDays(n);
  const stepVals = stepKeys.map((k) => s.steps[k] ?? 0);
  const stepTotal = stepVals.reduce((a, b) => a + b, 0);
  const goalDays = stepVals.filter((v) => v >= goal).length;
  const w = currentWeight(s);

  /* --- вес --- */
  const wKeys = Object.keys(s.weights)
    .sort()
    .filter((k) => daysBetween(k, today) <= (n === 7 ? 30 : 120));
  const wPts = wKeys.map((k) => ({ x: daysBetween(wKeys[0], k), y: s.weights[k], label: humanDay(k) }));
  const trend = movingAvg(
    wPts.map((p) => p.y),
    5,
  );
  const recent = wKeys.filter((k) => daysBetween(k, today) <= 28);
  const slope = recent.length >= 3 ? linearSlope(recent.map((k) => ({ x: daysBetween(recent[0], k), y: s.weights[k] }))) : 0;
  const target = s.profile.targetWeight;
  const toGo = w - target;
  const daysLeft = slope && Math.sign(-toGo) === Math.sign(slope) && s.profile.goal !== 'keep' ? Math.abs(toGo / slope) : null;
  const forecast = daysLeft && daysLeft < 1000 ? addDays(today, Math.round(daysLeft)) : null;
  const startW = s.profile.weight;
  const wLabels =
    wPts.length > 1
      ? [wKeys[0], wKeys[Math.floor(wKeys.length / 2)], wKeys[wKeys.length - 1]].map((k) => ({ x: daysBetween(wKeys[0], k), text: `${fromKey(k).getDate()} ${MONTHS_GEN[fromKey(k).getMonth()].slice(0, 3)}` }))
      : undefined;

  const ins = insights(s);
  const ach = achievements(s);
  const got = ach.filter((a) => a.done).length;

  return (
    <div className="screen stack">
      <div className="page-head">
        <div>
          <div className="page-title">Прогресс</div>
          <div className="page-sub">Как идут дела</div>
        </div>
        <div style={{ width: 150 }}>
          <Segmented
            value={period}
            onChange={setPeriod}
            options={[
              { v: '7', label: 'Неделя' },
              { v: '30', label: 'Месяц' },
            ]}
          />
        </div>
      </div>

      {/* ---------- Сводка ---------- */}
      <div className="grid-2">
        {(
          [
            ['😴', 'Сон в среднем', sum.sleep ? fmtDur(sum.sleep) : '—', 'var(--sleep)'],
            ['🍎', 'Калорий в день', sum.kcal ? fmtNum(sum.kcal) : '—', 'var(--food)'],
            ['👟', 'Шагов в день', sum.steps ? fmtNum(sum.steps) : '—', 'var(--steps)'],
            ['✅', 'Привычек выполнено', sum.habits ? `${Math.round(sum.habits * 100)}%` : '—', 'var(--habit)'],
          ] as const
        ).map(([e, l, v, c]) => (
          <div key={l} className="card tight card-glow" style={{ ['--glow' as string]: c }}>
            <span style={{ fontSize: 20 }}>{e}</span>
            <div className="stat" style={{ marginTop: 6 }}>
              <span className="v num">{v}</span>
              <span className="l">{l}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ---------- Шаги ---------- */}
      <div className="card stack">
        <div className="row-between">
          <div className="card-title" style={{ color: 'var(--steps)' }}>
            <Icon name="steps" size={18} /> Шаги
          </div>
          <button
            className="btn sm"
            style={{ ['--c1' as string]: 'var(--steps)', ['--c2' as string]: 'var(--steps-2)' }}
            onClick={() => {
              haptic.light();
              setStepDay(today);
              setSheet('steps');
            }}
          >
            <Icon name="plus" size={16} /> Ввести
          </button>
        </div>
        <div className="row" style={{ gap: 16 }}>
          <Ring value={stepsToday / goal} size={104} stroke={11} colors={['var(--steps)', 'var(--steps-2)']}>
            <div style={{ fontSize: 19, fontWeight: 800 }} className="num">
              {fmtNum(stepsToday)}
            </div>
            <div className="tiny muted bold">из {fmtNum(goal)}</div>
          </Ring>
          <div className="grid-2 grow" style={{ gap: 8 }}>
            <div className="stat-box stat">
              <span className="v num" style={{ fontSize: 17 }}>
                {stepsKm(stepsToday, s.profile).toFixed(1).replace('.', ',')}
                <small>км</small>
              </span>
              <span className="l">сегодня</span>
            </div>
            <div className="stat-box stat">
              <span className="v num" style={{ fontSize: 17 }}>
                {Math.round(stepsKcal(stepsToday, w))}
                <small>ккал</small>
              </span>
              <span className="l">сожжено</span>
            </div>
            <div className="stat-box stat">
              <span className="v num" style={{ fontSize: 17 }}>
                {stepsKm(stepTotal, s.profile).toFixed(0)}
                <small>км</small>
              </span>
              <span className="l">за период</span>
            </div>
            <div className="stat-box stat">
              <span className="v num" style={{ fontSize: 17 }}>
                {goalDays}
                <small>/{n}</small>
              </span>
              <span className="l">дней с целью</span>
            </div>
          </div>
        </div>
        <Bars
          data={stepKeys.map((k) => ({
            key: k,
            label: n === 7 ? WD[weekday(k)] : String(Number(k.slice(8))),
            value: s.steps[k] ?? 0,
            color: (s.steps[k] ?? 0) >= goal ? 'linear-gradient(180deg, var(--good), #19b3d6)' : undefined,
          }))}
          color="var(--steps)"
          color2="var(--steps-2)"
          goal={goal}
          goalLabel={fmtNum(goal)}
          format={(v) => `${fmtNum(v)} шагов`}
        />
        <div className="tiny faint">Пропустил день? Нажми на день ниже, чтобы внести шаги задним числом.</div>
        <div className="chips">
          {lastDays(7)
            .reverse()
            .slice(1)
            .map((k) => (
              <button
                key={k}
                className="chip"
                onClick={() => {
                  haptic.light();
                  setStepDay(k);
                  setSheet('steps');
                }}
              >
                {humanDay(k)} · {s.steps[k] ? fmtNum(s.steps[k]) : '—'}
              </button>
            ))}
        </div>
      </div>

      {/* ---------- Вес ---------- */}
      <div className="card stack">
        <div className="row-between">
          <div className="card-title" style={{ color: 'var(--weight)' }}>
            <Icon name="scale" size={18} /> Вес
          </div>
          <button className="btn sm" style={{ ['--c1' as string]: 'var(--weight)', ['--c2' as string]: 'var(--food)' }} onClick={() => (haptic.light(), setSheet('weight'))}>
            <Icon name="plus" size={16} /> Взвеситься
          </button>
        </div>
        <div className="grid-3">
          <div className="stat-box stat">
            <span className="v num" style={{ fontSize: 18 }}>
              {w.toFixed(1).replace('.', ',')}
            </span>
            <span className="l">сейчас, кг</span>
          </div>
          <div className="stat-box stat">
            <span className="v num" style={{ fontSize: 18, color: (s.profile.goal === 'gain' ? w - startW > 0 : w - startW < 0) ? 'var(--good)' : undefined }}>
              {w - startW > 0 ? '+' : w - startW < 0 ? '−' : ''}
              {Math.abs(w - startW).toFixed(1).replace('.', ',')}
            </span>
            <span className="l">со старта</span>
          </div>
          <div className="stat-box stat">
            <span className="v num" style={{ fontSize: 18 }}>
              {s.profile.goal === 'keep' ? '—' : Math.abs(toGo).toFixed(1).replace('.', ',')}
            </span>
            <span className="l">до цели</span>
          </div>
        </div>
        {wPts.length >= 2 ? (
          <LineChart points={wPts} trend={wPts.length >= 5 ? trend : undefined} goal={s.profile.goal !== 'keep' ? target : undefined} labels={wLabels} format={(v) => `${v.toFixed(1).replace('.', ',')} кг`} />
        ) : (
          <Empty emoji="⚖️" text="Взвешивайся хотя бы пару раз в неделю, и здесь появится график с трендом" />
        )}
        {forecast && (
          <div className="row stat-box" style={{ gap: 10 }}>
            <span style={{ fontSize: 22 }}>🔮</span>
            <div className="small">
              При текущем темпе ({(Math.abs(slope) * 7).toFixed(2).replace('.', ',')} кг/нед) дойдёшь до {target} кг примерно <b>{humanDay(forecast)}</b>
              {forecast.slice(0, 4) !== today.slice(0, 4) ? ` ${forecast.slice(0, 4)}` : ''}
            </div>
          </div>
        )}
      </div>

      {/* ---------- Выводы ---------- */}
      <div className="section-title">Выводы</div>
      <div className="stack-sm">
        {ins.map((i) => (
          <div key={i.title} className="card tight tip" style={{ borderColor: i.tone === 'good' ? 'rgba(47,211,164,.25)' : i.tone === 'warn' ? 'rgba(255,176,32,.25)' : undefined }}>
            <div className="emoji-box sm">{i.emoji}</div>
            <div>
              <div className="bold small">{i.title}</div>
              <div className="small muted">{i.text}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ---------- Достижения ---------- */}
      <div className="row-between">
        <div className="section-title">Достижения</div>
        <span className="badge accent" style={{ marginTop: 10 }}>
          <Icon name="trophy" size={13} /> {got}/{ach.length}
        </span>
      </div>
      <div className="grid-3">
        {[...ach]
          .sort((a, b) => Number(b.done) - Number(a.done) || b.progress - a.progress)
          .map((a) => (
            <button key={a.id} className={`ach ${a.done ? '' : 'locked'}`} onClick={() => (haptic.light(), toast(`${a.emoji} ${a.desc}${a.done ? ' ✓' : ` · ${Math.round(a.progress * 100)}%`}`))}>
              <div className="ae">{a.emoji}</div>
              <div className="an">{a.name}</div>
              {!a.done && (
                <div className="bar thin" style={{ width: '70%' }}>
                  <i style={{ width: `${a.progress * 100}%`, ['--c' as string]: 'var(--warn)' }} />
                </div>
              )}
            </button>
          ))}
      </div>

      <StepsSheet open={sheet === 'steps'} onClose={() => setSheet(null)} day={stepDay} />
      <WeightSheet open={sheet === 'weight'} onClose={() => setSheet(null)} />
    </div>
  );
}
