import { useState } from 'react';
import { useStore, type Goal, type Habit } from '../store';
import { clamp, currentWeight, dayHabitProgress, habitBestStreak, habitCount, habitRate, habitStreak, isScheduled } from '../lib/calc';
import { dayKey, daysBetween, fromKey, humanDay, MONTHS_GEN, plural, WD } from '../lib/date';
import { confirmDialog, haptic } from '../lib/telegram';
import { HABIT_COLORS, HABIT_EMOJI, HABIT_TEMPLATES } from '../data/habits';
import { Icon } from '../components/Icon';
import { Heatmap } from '../components/charts';
import { Bar, confetti, DayStrip, Empty, NumInput, Ring, Segmented, Sheet, Stepper, toast } from '../components/ui';
import { HabitRow } from '../components/HabitRow';
import { EmojiPicker } from '../components/FoodSheets';

export function Habits() {
  const s = useStore();
  const [view, setView] = useState<'habits' | 'goals'>('habits');
  const [day, setDay] = useState(dayKey());
  const [editing, setEditing] = useState<Habit | null | undefined>(undefined);
  const [detail, setDetail] = useState<Habit | null>(null);
  const [goalEdit, setGoalEdit] = useState(false);
  const [goalOpen, setGoalOpen] = useState<string | null>(null);

  const active = s.habits.filter((h) => !h.archived && dayKey(h.createdAt) <= day);
  const todays = active.filter((h) => isScheduled(h, day));
  const others = active.filter((h) => !isScheduled(h, day));
  const hp = dayHabitProgress(s, day);
  const bestNow = Math.max(0, ...s.habits.map((h) => habitStreak(s, h)));

  return (
    <div className="screen stack">
      <div className="page-head">
        <div>
          <div className="page-title">{view === 'habits' ? 'Привычки' : 'Цели'}</div>
          <div className="page-sub">{view === 'habits' ? humanDay(day) : `${s.goals.filter((g) => !g.done).length} активных`}</div>
        </div>
        <button
          className="icon-btn"
          style={{ background: 'color-mix(in srgb, var(--habit) 18%, transparent)', color: 'var(--habit)' }}
          onClick={() => {
            haptic.light();
            if (view === 'habits') setEditing(null);
            else setGoalEdit(true);
          }}
          aria-label="Добавить"
        >
          <Icon name="plus" stroke={2.5} />
        </button>
      </div>

      <Segmented
        value={view}
        onChange={setView}
        options={[
          { v: 'habits', label: '✅ Привычки' },
          { v: 'goals', label: '🎯 Цели' },
        ]}
      />

      {view === 'habits' ? (
        <>
          <DayStrip value={day} onChange={setDay} mark={(k) => {
            const p = dayHabitProgress(s, k);
            return p.total ? p.done / p.total : 0;
          }} />

          {active.length > 0 && (
            <div className="card row" style={{ gap: 16 }}>
              <Ring value={hp.total ? hp.done / hp.total : 0} size={72} stroke={8} colors={['var(--habit)', 'var(--habit-2)']}>
                <span className="bold num">{hp.total ? Math.round((hp.done / hp.total) * 100) : 0}%</span>
              </Ring>
              <div className="grow">
                <div style={{ fontSize: 20, fontWeight: 800 }}>
                  {hp.done} из {hp.total}
                </div>
                <div className="small muted">{hp.total === 0 ? 'Сегодня день отдыха' : hp.done === hp.total ? 'Идеальный день! ⭐' : `Осталось ${hp.total - hp.done} ${plural(hp.total - hp.done, 'привычка', 'привычки', 'привычек')}`}</div>
              </div>
              {bestNow > 0 && (
                <div className="center">
                  <div style={{ fontSize: 22 }}>🔥</div>
                  <div className="bold num">{bestNow}</div>
                  <div className="tiny faint bold">серия</div>
                </div>
              )}
            </div>
          )}

          {todays.length > 0 ? (
            <div className="stack-sm">
              {todays.map((h) => (
                <HabitRow key={h.id} h={h} day={day} onOpen={() => (haptic.light(), setDetail(h))} />
              ))}
            </div>
          ) : (
            <div className="card">
              <Empty emoji="🌱" text={s.habits.length ? 'На этот день привычек нет' : 'Маленькие шаги каждый день дают большие результаты. Начни с одной привычки.'}>
                <button className="btn sm" style={{ ['--c1' as string]: 'var(--habit)', ['--c2' as string]: 'var(--habit-2)' }} onClick={() => setEditing(null)}>
                  <Icon name="plus" size={18} /> Новая привычка
                </button>
              </Empty>
            </div>
          )}

          {others.length > 0 && (
            <>
              <div className="section-title">Не по расписанию</div>
              <div className="stack-sm" style={{ opacity: 0.65 }}>
                {others.map((h) => (
                  <HabitRow key={h.id} h={h} day={day} onOpen={() => setDetail(h)} />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <GoalsView onOpen={setGoalOpen} onNew={() => setGoalEdit(true)} />
      )}

      <HabitEditor open={editing !== undefined} habit={editing ?? null} onClose={() => setEditing(undefined)} />
      <HabitDetail
        habit={detail}
        onClose={() => setDetail(null)}
        onEdit={(h) => {
          setDetail(null);
          setTimeout(() => setEditing(h), 200);
        }}
      />
      <GoalEditor open={goalEdit} onClose={() => setGoalEdit(false)} />
      <GoalDetail id={goalOpen} onClose={() => setGoalOpen(null)} />
    </div>
  );
}

/* ===================== Редактор привычки ===================== */

function HabitEditor({ open, habit, onClose }: { open: boolean; habit: Habit | null; onClose: () => void }) {
  const s = useStore();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🏃');
  const [color, setColor] = useState(HABIT_COLORS[0]);
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [target, setTarget] = useState(1);
  const [unit, setUnit] = useState('');
  const [was, setWas] = useState(false);
  if (open !== was) {
    setWas(open);
    if (open) {
      setName(habit?.name ?? '');
      setEmoji(habit?.emoji ?? '🏃');
      setColor(habit?.color ?? HABIT_COLORS[Math.floor(Math.random() * HABIT_COLORS.length)]);
      setDays(habit?.days ?? [0, 1, 2, 3, 4, 5, 6]);
      setTarget(habit?.target ?? 1);
      setUnit(habit?.unit ?? '');
    }
  }
  const presets: [string, number[]][] = [
    ['Каждый день', [0, 1, 2, 3, 4, 5, 6]],
    ['Будни', [0, 1, 2, 3, 4]],
    ['Выходные', [5, 6]],
    ['Пн Ср Пт', [0, 2, 4]],
  ];
  const same = (a: number[], b: number[]) => a.length === b.length && a.every((x) => b.includes(x));

  return (
    <Sheet open={open} onClose={onClose} title={habit ? 'Изменить привычку' : 'Новая привычка'} full>
      <div className="stack">
        {!habit && (
          <>
            <div className="small muted bold">Быстрый выбор</div>
            <div className="chips">
              {HABIT_TEMPLATES.map((t) => (
                <button
                  key={t.name}
                  className="chip"
                  onClick={() => {
                    haptic.select();
                    setName(t.name);
                    setEmoji(t.emoji);
                    setColor(t.color);
                    setDays(t.days);
                    setTarget(t.target);
                    setUnit(t.unit);
                  }}
                >
                  {t.emoji} {t.name}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="row">
          <div className="emoji-box" style={{ width: 48, height: 48, background: `color-mix(in srgb, ${color} 20%, transparent)` }}>
            {emoji}
          </div>
          <input className="input" placeholder="Например: читать перед сном" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="field">
          <label>Иконка</label>
          <div className="emoji-grid">
            {HABIT_EMOJI.map((e) => (
              <button key={e} className={emoji === e ? 'on' : ''} onClick={() => (haptic.select(), setEmoji(e))}>
                {e}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Цвет</label>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            {HABIT_COLORS.map((c) => (
              <button key={c} className={`color-dot ${color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => (haptic.select(), setColor(c))} aria-label={c} />
            ))}
          </div>
        </div>

        <div className="field">
          <label>Дни</label>
          <div className="chips" style={{ marginBottom: 6 }}>
            {presets.map(([l, d]) => (
              <button key={l} className={`chip ${same(days, d) ? 'on' : ''}`} onClick={() => (haptic.select(), setDays(d))}>
                {l}
              </button>
            ))}
          </div>
          <div className="wd-pick">
            {WD.map((w, i) => (
              <button
                key={w}
                className={days.includes(i) ? 'on' : ''}
                style={days.includes(i) ? { background: color } : undefined}
                onClick={() => {
                  haptic.select();
                  setDays((d) => (d.includes(i) ? (d.length > 1 ? d.filter((x) => x !== i) : d) : [...d, i].sort()));
                }}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Сколько раз за день</label>
          <div className="row">
            <div className="grow">
              <Stepper value={target} min={1} max={1000} onChange={setTarget} />
            </div>
            <input className="input" style={{ width: 110 }} placeholder="раз, мин…" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </div>
          <div className="tiny faint">{target > 1 ? `Каждое нажатие добавляет +1. Привычка выполнена при ${target} ${unit || 'раз'}.` : 'Одно нажатие — и привычка выполнена.'}</div>
        </div>

        <button
          className="btn"
          disabled={!name.trim()}
          style={{ ['--c1' as string]: color, ['--c2' as string]: color }}
          onClick={() => {
            const data = { name: name.trim(), emoji, color, days, target, unit: unit.trim() };
            if (habit) s.updateHabit(habit.id, data);
            else s.addHabit(data);
            haptic.success();
            toast(habit ? 'Сохранено' : `${emoji} Привычка добавлена`);
            onClose();
          }}
        >
          {habit ? 'Сохранить' : 'Добавить привычку'}
        </button>
      </div>
    </Sheet>
  );
}

/* ===================== Детали привычки ===================== */

function HabitDetail({ habit, onClose, onEdit }: { habit: Habit | null; onClose: () => void; onEdit: (h: Habit) => void }) {
  const s = useStore();
  const h = habit ? s.habits.find((x) => x.id === habit.id) ?? null : null;
  return (
    <Sheet open={!!h} onClose={onClose} title={h ? `${h.emoji} ${h.name}` : ''}>
      {h && (
        <div className="stack">
          <div className="grid-3">
            <div className="stat-box stat center">
              <span className="v num" style={{ color: 'var(--food)' }}>
                🔥 {habitStreak(s, h)}
              </span>
              <span className="l">Серия</span>
            </div>
            <div className="stat-box stat center">
              <span className="v num">{habitBestStreak(s, h)}</span>
              <span className="l">Рекорд</span>
            </div>
            <div className="stat-box stat center">
              <span className="v num">{Math.round(habitRate(s, h, 30) * 100)}%</span>
              <span className="l">За 30 дней</span>
            </div>
          </div>
          <div className="card" style={{ background: 'var(--surface-2)', padding: 12 }}>
            <div className="small muted bold" style={{ marginBottom: 8 }}>
              Последние 4 месяца
            </div>
            <Heatmap weeks={17} color={h.color} value={(k) => (dayKey(h.createdAt) > k ? 0 : Math.min(1, habitCount(s, k, h.id) / h.target))} />
          </div>
          <div className="small muted">
            Дни: {h.days.length === 7 ? 'каждый день' : h.days.map((d) => WD[d]).join(', ')}
            {h.target > 1 ? ` · цель ${h.target} ${h.unit}` : ''}
            {` · с ${fromKey(dayKey(h.createdAt)).getDate()} ${MONTHS_GEN[fromKey(dayKey(h.createdAt)).getMonth()]}`}
          </div>
          <div className="grid-2">
            <button
              className="btn danger"
              onClick={async () => {
                if (await confirmDialog(`Удалить привычку «${h.name}» вместе с историей?`)) {
                  s.removeHabit(h.id);
                  haptic.warning();
                  onClose();
                }
              }}
            >
              <Icon name="trash" size={18} /> Удалить
            </button>
            <button className="btn ghost" onClick={() => onEdit(h)}>
              <Icon name="edit" size={18} /> Изменить
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

/* ===================== Цели ===================== */

export function goalProgress(g: Goal, weight: number): number {
  if (g.done) return 1;
  if (g.kind === 'checklist') return g.steps.length ? g.steps.filter((x) => x.done).length / g.steps.length : 0;
  if (g.kind === 'weight' && g.start != null && g.target != null) return g.start === g.target ? 1 : clamp((g.start - weight) / (g.start - g.target), 0, 1);
  if (g.kind === 'number' && g.start != null && g.target != null) return g.start === g.target ? 1 : clamp(((g.current ?? g.start) - g.start) / (g.target - g.start), 0, 1);
  return 0;
}

function deadlineText(g: Goal) {
  if (!g.deadline) return null;
  const n = daysBetween(dayKey(), g.deadline);
  if (n < 0) return { text: `просрочено на ${-n} ${plural(-n, 'день', 'дня', 'дней')}`, tone: 'bad' };
  if (n === 0) return { text: 'сегодня', tone: 'warn' };
  return { text: `${n} ${plural(n, 'день', 'дня', 'дней')}`, tone: n <= 7 ? 'warn' : '' };
}

function GoalsView({ onOpen, onNew }: { onOpen: (id: string) => void; onNew: () => void }) {
  const s = useStore();
  const w = currentWeight(s);
  const active = s.goals.filter((g) => !g.done);
  const done = s.goals.filter((g) => g.done);
  if (!s.goals.length)
    return (
      <div className="card">
        <Empty emoji="🎯" text="Поставь цель: сбросить вес, прочитать 12 книг, выучить 500 слов… Разбей её на шаги, и я буду считать прогресс.">
          <button className="btn sm" style={{ ['--c1' as string]: 'var(--habit)', ['--c2' as string]: 'var(--habit-2)' }} onClick={onNew}>
            <Icon name="plus" size={18} /> Новая цель
          </button>
        </Empty>
      </div>
    );
  const Card = ({ g }: { g: Goal }) => {
    const p = goalProgress(g, w);
    const dl = deadlineText(g);
    return (
      <button className="card tap" style={{ textAlign: 'left', opacity: g.done ? 0.7 : 1 }} onClick={() => (haptic.light(), onOpen(g.id))}>
        <div className="row">
          <div className="emoji-box">{g.emoji}</div>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="bold ellipsis">{g.title}</div>
            <div className="tiny muted">
              {g.kind === 'checklist' && `${g.steps.filter((x) => x.done).length} из ${g.steps.length} шагов`}
              {g.kind === 'weight' && `${w.toFixed(1)} → ${g.target} кг`}
              {g.kind === 'number' && `${g.current ?? g.start} из ${g.target} ${g.unit ?? ''}`}
            </div>
          </div>
          {g.done ? <span className="badge good">✓ Готово</span> : dl && <span className={`badge ${dl.tone}`}>⏳ {dl.text}</span>}
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <div className="grow">
            <Bar value={p} color="linear-gradient(90deg, var(--habit), var(--habit-2))" />
          </div>
          <span className="small bold num">{Math.round(p * 100)}%</span>
        </div>
      </button>
    );
  };
  return (
    <div className="stack-sm">
      {active.map((g) => (
        <Card key={g.id} g={g} />
      ))}
      {done.length > 0 && (
        <>
          <div className="section-title">Выполнено 🏆</div>
          {done.map((g) => (
            <Card key={g.id} g={g} />
          ))}
        </>
      )}
    </div>
  );
}

const GOAL_EMOJI = ['🎯', '🏆', '📚', '💪', '🏃', '⚖️', '💰', '🧠', '✈️', '🏠', '🎸', '🇬🇧', '💻', '🧘', '❤️', '🚀', '🌱', '📝', '🎨', '🚴', '🏊', '🥗', '😴', '⭐'];

function GoalEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore();
  const w = currentWeight(s);
  const [kind, setKind] = useState<Goal['kind']>('checklist');
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('🎯');
  const [deadline, setDeadline] = useState('');
  const [steps, setSteps] = useState<string[]>([]);
  const [stepText, setStepText] = useState('');
  const [target, setTarget] = useState<number | ''>('');
  const [start, setStart] = useState<number | ''>(0);
  const [unit, setUnit] = useState('');
  const [was, setWas] = useState(false);
  if (open !== was) {
    setWas(open);
    if (open) {
      setKind('checklist');
      setTitle('');
      setEmoji('🎯');
      setDeadline('');
      setSteps([]);
      setStepText('');
      setTarget('');
      setStart(0);
      setUnit('');
    }
  }
  const addStep = () => {
    if (!stepText.trim()) return;
    setSteps((x) => [...x, stepText.trim()]);
    setStepText('');
    haptic.light();
  };
  const ok = title.trim() && (kind === 'checklist' || (target !== '' && Number(target) > 0));
  return (
    <Sheet open={open} onClose={onClose} title="Новая цель" full>
      <div className="stack">
        <Segmented
          value={kind}
          onChange={(v) => {
            setKind(v);
            if (v === 'weight') {
              setEmoji('⚖️');
              setTitle((t) => t || `Вес ${s.profile.targetWeight} кг`);
              setTarget(s.profile.targetWeight);
            }
          }}
          options={[
            { v: 'checklist', label: '☑️ Шаги' },
            { v: 'number', label: '🔢 Число' },
            { v: 'weight', label: '⚖️ Вес' },
          ]}
        />
        <div className="row">
          <EmojiPicker value={emoji} onChange={setEmoji} list={GOAL_EMOJI} />
          <input className="input" placeholder={kind === 'number' ? 'Прочитать 12 книг' : kind === 'weight' ? 'Вес 70 кг' : 'Пробежать полумарафон'} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        {kind === 'checklist' && (
          <div className="field">
            <label>Шаги к цели</label>
            {steps.map((st, i) => (
              <div key={i} className="row" style={{ padding: '4px 0' }}>
                <span className="faint bold num" style={{ width: 20 }}>
                  {i + 1}.
                </span>
                <span className="grow">{st}</span>
                <button className="icon-btn sm plain faint" onClick={() => setSteps((x) => x.filter((_, j) => j !== i))} aria-label="Удалить шаг">
                  <Icon name="close" size={16} />
                </button>
              </div>
            ))}
            <div className="row">
              <input className="input" placeholder="Добавить шаг" value={stepText} onChange={(e) => setStepText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addStep()} />
              <button className="icon-btn" style={{ width: 48, height: 48 }} onClick={addStep} aria-label="Добавить шаг">
                <Icon name="plus" />
              </button>
            </div>
          </div>
        )}

        {kind === 'number' && (
          <div className="grid-3">
            <div className="field">
              <label>Старт</label>
              <NumInput value={start} onChange={setStart} />
            </div>
            <div className="field">
              <label>Цель</label>
              <NumInput value={target} onChange={setTarget} placeholder="12" />
            </div>
            <div className="field">
              <label>Единица</label>
              <input className="input" placeholder="книг" value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
          </div>
        )}

        {kind === 'weight' && (
          <div className="grid-2">
            <div className="stat-box stat">
              <span className="v num">{w.toFixed(1)} кг</span>
              <span className="l">Сейчас</span>
            </div>
            <div className="field">
              <label>Цель</label>
              <NumInput value={target} onChange={setTarget} suffix="кг" step={0.1} />
            </div>
          </div>
        )}

        <div className="field">
          <label>Дедлайн (необязательно)</label>
          <input type="date" className="input" value={deadline} min={dayKey()} onChange={(e) => setDeadline(e.target.value)} />
          <div className="chips">
            {[
              ['Месяц', 30],
              ['3 месяца', 90],
              ['Полгода', 182],
              ['Год', 365],
            ].map(([l, n]) => {
              const d = new Date();
              d.setDate(d.getDate() + Number(n));
              const k = dayKey(d);
              return (
                <button key={l} className={`chip ${deadline === k ? 'on' : ''}`} onClick={() => (haptic.select(), setDeadline(k))}>
                  {l}
                </button>
              );
            })}
          </div>
        </div>

        <button
          className="btn"
          disabled={!ok}
          style={{ ['--c1' as string]: 'var(--habit)', ['--c2' as string]: 'var(--habit-2)' }}
          onClick={() => {
            s.addGoal({
              title: title.trim(),
              emoji,
              kind,
              deadline: deadline || undefined,
              steps: steps.map((t, i) => ({ id: `s${Date.now()}${i}`, text: t, done: false })),
              start: kind === 'weight' ? w : kind === 'number' ? Number(start) || 0 : undefined,
              current: kind === 'number' ? Number(start) || 0 : undefined,
              target: kind === 'checklist' ? undefined : Number(target),
              unit: kind === 'number' ? unit : kind === 'weight' ? 'кг' : undefined,
            });
            haptic.success();
            toast(`${emoji} Цель поставлена. Вперёд!`);
            onClose();
          }}
        >
          Поставить цель
        </button>
      </div>
    </Sheet>
  );
}

function GoalDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const s = useStore();
  const g = s.goals.find((x) => x.id === id) ?? null;
  const w = currentWeight(s);
  const [stepText, setStepText] = useState('');
  const p = g ? goalProgress(g, w) : 0;
  const dl = g ? deadlineText(g) : null;

  const finish = () => {
    if (!g) return;
    s.updateGoal(g.id, { done: true, doneAt: Date.now() });
    haptic.success();
    confetti();
    toast('🏆 Цель достигнута! Ты молодец');
  };

  return (
    <Sheet open={!!g} onClose={onClose} title={g ? `${g.emoji} ${g.title}` : ''} full>
      {g && (
        <div className="stack">
          <div className="card row" style={{ gap: 16, background: 'var(--surface-2)' }}>
            <Ring value={p} size={90} stroke={10} colors={['var(--habit)', 'var(--habit-2)']}>
              <span style={{ fontSize: 20, fontWeight: 800 }} className="num">
                {Math.round(p * 100)}%
              </span>
            </Ring>
            <div className="grow">
              {g.kind === 'weight' && (
                <div className="small">
                  Старт {g.start?.toFixed(1)} кг → сейчас <b>{w.toFixed(1)} кг</b> → цель {g.target} кг
                  <div className="muted">Осталось {Math.abs(w - (g.target ?? w)).toFixed(1)} кг. Вес берётся из взвешиваний.</div>
                </div>
              )}
              {g.kind === 'number' && (
                <div className="small">
                  <b>{g.current}</b> из {g.target} {g.unit}
                </div>
              )}
              {g.kind === 'checklist' && (
                <div className="small">
                  {g.steps.filter((x) => x.done).length} из {g.steps.length} шагов
                </div>
              )}
              {dl && <div className={`badge ${dl.tone}`} style={{ marginTop: 6 }}>⏳ {g.deadline && humanDay(g.deadline)} · {dl.text}</div>}
            </div>
          </div>

          {g.kind === 'number' && !g.done && (
            <div className="field">
              <label>Текущее значение</label>
              <Stepper value={g.current ?? 0} onChange={(v) => s.updateGoal(g.id, { current: v })} format={(v) => `${v} ${g.unit ?? ''}`} />
            </div>
          )}

          {g.kind === 'checklist' && (
            <div className="stack-sm">
              {g.steps.map((st) => (
                <div key={st.id} className="row" style={{ gap: 12 }}>
                  <button
                    className={`check ${st.done ? 'on' : ''}`}
                    style={{ ['--hc' as string]: 'var(--habit)', width: 32, height: 32, borderRadius: 10 }}
                    onClick={() => {
                      s.toggleGoalStep(g.id, st.id);
                      haptic[st.done ? 'soft' : 'success']();
                    }}
                    aria-label="Отметить шаг"
                  >
                    {st.done && <Icon name="check" size={16} stroke={3} />}
                  </button>
                  <span className="grow" style={{ textDecoration: st.done ? 'line-through' : undefined, color: st.done ? 'var(--text-3)' : undefined }}>
                    {st.text}
                  </span>
                  <button className="icon-btn sm plain faint" onClick={() => s.removeGoalStep(g.id, st.id)} aria-label="Удалить">
                    <Icon name="close" size={15} />
                  </button>
                </div>
              ))}
              <div className="row">
                <input
                  className="input"
                  placeholder="Новый шаг"
                  value={stepText}
                  onChange={(e) => setStepText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && stepText.trim()) {
                      s.addGoalStep(g.id, stepText.trim());
                      setStepText('');
                    }
                  }}
                />
                <button
                  className="icon-btn"
                  style={{ width: 48, height: 48 }}
                  onClick={() => {
                    if (!stepText.trim()) return;
                    s.addGoalStep(g.id, stepText.trim());
                    setStepText('');
                    haptic.light();
                  }}
                  aria-label="Добавить шаг"
                >
                  <Icon name="plus" />
                </button>
              </div>
            </div>
          )}

          {!g.done && (
            <button className="btn" style={{ ['--c1' as string]: 'var(--habit)', ['--c2' as string]: 'var(--habit-2)' }} onClick={finish}>
              {p >= 1 ? '🏆 Цель достигнута!' : 'Отметить выполненной'}
            </button>
          )}
          {g.done && (
            <button className="btn ghost" onClick={() => s.updateGoal(g.id, { done: false, doneAt: undefined })}>
              Вернуть в работу
            </button>
          )}
          <button
            className="btn danger"
            onClick={async () => {
              if (await confirmDialog('Удалить цель?')) {
                s.removeGoal(g.id);
                onClose();
              }
            }}
          >
            <Icon name="trash" size={18} /> Удалить цель
          </button>
        </div>
      )}
    </Sheet>
  );
}
