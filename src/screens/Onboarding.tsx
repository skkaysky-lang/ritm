import { useState } from 'react';
import { defaultProfile, useStore, type Profile } from '../store';
import { ACTIVITY, fmtNum, targets } from '../lib/calc';
import { HABIT_TEMPLATES } from '../data/habits';
import { confetti, Segmented, Stepper, TimeField } from '../components/ui';
import { haptic, telegramUserName } from '../lib/telegram';
import { addDays, dayKey, humanDay } from '../lib/date';

const STEPS = 7;

export function Onboarding() {
  const complete = useStore((s) => s.completeOnboarding);
  const [step, setStep] = useState(0);
  const [p, setP] = useState<Profile>({ ...defaultProfile, name: telegramUserName() });
  const [picked, setPicked] = useState<number[]>([0, 2, 6]);
  const upd = (patch: Partial<Profile>) => setP((x) => ({ ...x, ...patch }));
  const t = targets(p, p.weight);

  const next = () => {
    haptic.light();
    if (step < STEPS - 1) setStep(step + 1);
    else {
      haptic.success();
      complete(
        p,
        picked.map((i) => HABIT_TEMPLATES[i]),
      );
      setTimeout(confetti, 150);
    }
  };
  const back = () => {
    haptic.light();
    setStep(Math.max(0, step - 1));
  };

  const valid = [true, p.name.trim().length > 0, p.age >= 10 && p.age <= 100 && p.height >= 120 && p.height <= 230 && p.weight >= 30 && p.weight <= 300, true, p.targetWeight >= 30, true, true][step];

  const weeksToGoal = p.goal === 'keep' || !p.pace ? 0 : Math.abs(p.weight - p.targetWeight) / p.pace;
  const goalDate = weeksToGoal ? addDays(dayKey(), Math.round(weeksToGoal * 7)) : null;

  return (
    <div className="ob">
      {step > 0 && (
        <div className="ob-progress">
          {Array.from({ length: STEPS - 1 }, (_, i) => (
            <i key={i} className={i < step ? 'on' : ''} />
          ))}
        </div>
      )}

      <div className="ob-body" key={step}>
        {step === 0 && (
          <div className="stack" style={{ paddingTop: '8vh' }}>
            <div style={{ fontSize: 64, lineHeight: 1 }} className="pulse">
              🌙
            </div>
            <div className="ob-title" style={{ fontSize: 34 }}>
              Ритм
            </div>
            <p className="muted" style={{ fontSize: 16 }}>
              Твой помощник для сна, питания и хороших привычек. Отмечай за секунды, а графики и расчёты оставь мне.
            </p>
            <div className="stack-sm" style={{ marginTop: 18 }}>
              {[
                ['😴', 'Сон', 'Отмечай отбой и подъём в один тап'],
                ['🍎', 'Питание', 'Норма калорий и КБЖУ под твою цель'],
                ['👣', 'Шаги и вес', 'Прогресс и прогноз до цели'],
                ['✅', 'Привычки и цели', 'Серии дней, карта активности, достижения'],
              ].map(([e, a, b]) => (
                <div key={a} className="card tight row">
                  <div className="emoji-box">{e}</div>
                  <div>
                    <div className="bold">{a}</div>
                    <div className="small muted">{b}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="stack">
            <div className="ob-title">Давай знакомиться</div>
            <p className="muted">Это нужно, чтобы правильно посчитать норму калорий.</p>
            <div className="field" style={{ marginTop: 10 }}>
              <label>Как тебя зовут?</label>
              <input className="input" value={p.name} placeholder="Имя" onChange={(e) => upd({ name: e.target.value })} />
            </div>
            <div className="field">
              <label>Пол</label>
              <Segmented
                value={p.sex}
                onChange={(v) => upd({ sex: v })}
                options={[
                  { v: 'm', label: '👨 Мужской' },
                  { v: 'f', label: '👩 Женский' },
                ]}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="stack">
            <div className="ob-title">Параметры тела</div>
            <p className="muted">Можно поменять в любой момент в настройках.</p>
            <div className="card stack" style={{ marginTop: 10 }}>
              <div className="field">
                <label>Возраст</label>
                <Stepper value={p.age} onChange={(v) => upd({ age: v })} min={10} max={100} format={(v) => `${v} лет`} />
              </div>
              <div className="divider" />
              <div className="field">
                <label>Рост</label>
                <Stepper value={p.height} onChange={(v) => upd({ height: v })} min={120} max={230} format={(v) => `${v} см`} />
              </div>
              <div className="divider" />
              <div className="field">
                <label>Вес</label>
                <Stepper value={p.weight} step={0.5} onChange={(v) => upd({ weight: v, targetWeight: p.goal === 'keep' ? v : p.targetWeight })} min={30} max={300} format={(v) => `${v} кг`} />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="stack">
            <div className="ob-title">Насколько ты активен?</div>
            <p className="muted">Без учёта шагов: их можно будет добавлять отдельно.</p>
            <div className="stack-sm" style={{ marginTop: 10 }}>
              {ACTIVITY.map((a) => (
                <button key={a.v} className={`choice ${p.activity === a.v ? 'on' : ''}`} onClick={() => (haptic.select(), upd({ activity: a.v }))}>
                  <span className="ce">{a.emoji}</span>
                  <div>
                    <div className="bold">{a.title}</div>
                    <div className="small muted">{a.hint}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="stack">
            <div className="ob-title">Какая цель?</div>
            <div className="grid-3" style={{ marginTop: 6 }}>
              {(
                [
                  ['lose', '📉', 'Похудеть'],
                  ['keep', '⚖️', 'Держать вес'],
                  ['gain', '💪', 'Набрать'],
                ] as const
              ).map(([v, e, l]) => (
                <button
                  key={v}
                  className={`choice ${p.goal === v ? 'on' : ''}`}
                  style={{ flexDirection: 'column', gap: 6, padding: '14px 6px', textAlign: 'center' }}
                  onClick={() => {
                    haptic.select();
                    upd({ goal: v, targetWeight: v === 'keep' ? p.weight : v === 'lose' ? Math.round(p.weight * 0.9) : Math.round(p.weight * 1.08) });
                  }}
                >
                  <span className="ce">{e}</span>
                  <span className="small bold">{l}</span>
                </button>
              ))}
            </div>
            {p.goal !== 'keep' && (
              <>
                <div className="card stack">
                  <div className="field">
                    <label>Желаемый вес</label>
                    <Stepper value={p.targetWeight} step={0.5} min={30} max={300} onChange={(v) => upd({ targetWeight: v })} format={(v) => `${v} кг`} />
                  </div>
                  <div className="divider" />
                  <div className="field">
                    <div className="row-between">
                      <label>Темп</label>
                      <span className="bold">{p.pace} кг/нед</span>
                    </div>
                    <input
                      type="range"
                      className="range"
                      min={0.25}
                      max={1}
                      step={0.25}
                      value={p.pace}
                      onChange={(e) => {
                        haptic.select();
                        upd({ pace: Number(e.target.value) });
                      }}
                    />
                    <div className="row-between tiny faint bold">
                      <span>Мягко</span>
                      <span>Оптимально</span>
                      <span>Быстро</span>
                    </div>
                  </div>
                </div>
                {goalDate && (
                  <div className="card tight row">
                    <div className="emoji-box">🗓️</div>
                    <div className="small">
                      Дойдёшь до <b>{p.targetWeight} кг</b> примерно <b>{humanDay(goalDate)}</b>
                      {goalDate.slice(0, 4) !== dayKey().slice(0, 4) ? ` ${goalDate.slice(0, 4)}` : ''}, это ~{Math.round(weeksToGoal)} нед.
                    </div>
                  </div>
                )}
                {p.pace >= 1 && <div className="small muted">⚠️ Быстрый темп тяжело держать. Обычно лучше 0,5–0,75 кг в неделю.</div>}
              </>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="stack">
            <div className="ob-title">Сон и активность</div>
            <div className="card stack">
              <div className="field">
                <label>Сколько хочешь спать</label>
                <Stepper value={p.sleepGoal} step={0.5} min={5} max={11} onChange={(v) => upd({ sleepGoal: v })} format={(v) => `${String(v).replace('.', ',')} ч`} />
              </div>
              <div className="divider" />
              <TimeField label="Обычно встаю в" value={p.wakeTime} onChange={(v) => upd({ wakeTime: v })} />
              <div className="divider" />
              <div className="field">
                <label>Цель по шагам</label>
                <div className="chips wrap">
                  {[5000, 7500, 10000, 12000, 15000].map((n) => (
                    <button key={n} className={`chip ${p.stepGoal === n ? 'on' : ''}`} onClick={() => (haptic.select(), upd({ stepGoal: n }))}>
                      {fmtNum(n)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="stack">
            <div className="ob-title">Твой план готов 🎉</div>
            <div className="card card-glow" style={{ ['--glow' as string]: 'var(--food)' }}>
              <div className="small muted bold">Норма в день</div>
              <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.03em' }} className="num">
                {fmtNum(t.kcal)} <span style={{ fontSize: 18 }} className="muted">ккал</span>
              </div>
              <div className="small muted">
                Тратишь ~{fmtNum(t.tdee)} ккал
                {t.deficit > 0 ? `, дефицит ${fmtNum(t.deficit)} ккал` : t.deficit < 0 ? `, профицит ${fmtNum(-t.deficit)} ккал` : ''}
              </div>
              <div className="grid-3" style={{ marginTop: 14 }}>
                <div className="stat-box stat">
                  <span className="v" style={{ color: 'var(--protein)' }}>
                    {t.p}
                    <small>г</small>
                  </span>
                  <span className="l">Белки</span>
                </div>
                <div className="stat-box stat">
                  <span className="v" style={{ color: 'var(--fat)' }}>
                    {t.f}
                    <small>г</small>
                  </span>
                  <span className="l">Жиры</span>
                </div>
                <div className="stat-box stat">
                  <span className="v" style={{ color: 'var(--carbs)' }}>
                    {t.c}
                    <small>г</small>
                  </span>
                  <span className="l">Углеводы</span>
                </div>
              </div>
            </div>
            <div className="field" style={{ marginTop: 6 }}>
              <label>Выбери привычки для старта (потом можно добавить свои)</label>
              <div className="chips wrap">
                {HABIT_TEMPLATES.map((h, i) => (
                  <button
                    key={h.name}
                    className={`chip ${picked.includes(i) ? 'on' : ''}`}
                    onClick={() => {
                      haptic.select();
                      setPicked((x) => (x.includes(i) ? x.filter((y) => y !== i) : [...x, i]));
                    }}
                  >
                    {h.emoji} {h.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="tiny faint">Формула Миффлина — Сан Жеора. Вода: {fmtNum(t.water)} мл в день.</div>
          </div>
        )}
      </div>

      <div className="row" style={{ marginTop: 20 }}>
        {step > 0 && (
          <button className="btn ghost" style={{ width: 56, padding: 0, flexShrink: 0 }} onClick={back} aria-label="Назад">
            ←
          </button>
        )}
        <button className="btn" disabled={!valid} onClick={next}>
          {step === 0 ? 'Начать' : step === STEPS - 1 ? 'Поехали 🚀' : 'Дальше'}
        </button>
      </div>
    </div>
  );
}