import { useState } from 'react';
import { pickData, useStore, type Profile, type SleepEntry } from '../store';
import { ACTIVITY, currentWeight, fmtNum, isNap, stepsKcal, stepsKm, targets } from '../lib/calc';
import { addDays, dayKey, fmtDur, fmtTime, humanDay, parseHM } from '../lib/date';
import { confirmDialog, haptic, openReminders } from '../lib/telegram';
import { Icon } from './Icon';
import { NumInput, Segmented, Sheet, Stepper, TimeField, Toggle, toast } from './ui';
import { applyTheme, readThemePref, type ThemePref } from '../lib/theme';

/* ===================== Шаги ===================== */

export function StepsSheet({ open, onClose, day }: { open: boolean; onClose: () => void; day: string }) {
  const s = useStore();
  const cur = s.steps[day] ?? 0;
  const [val, setVal] = useState<number | ''>(cur || '');
  const [was, setWas] = useState(false);
  if (open !== was) {
    setWas(open);
    if (open) setVal(cur || '');
  }
  const n = Number(val) || 0;
  const w = currentWeight(s);
  return (
    <Sheet open={open} onClose={onClose} title={`Шаги · ${humanDay(day).toLowerCase()}`}>
      <div className="stack">
        <div className="card center" style={{ background: 'var(--surface-2)' }}>
          <input
            className="big-input num"
            inputMode="numeric"
            placeholder="0"
            value={val === '' ? '' : n.toLocaleString('ru-RU')}
            onFocus={(e) => e.target.select()}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '');
              setVal(v === '' ? '' : Math.min(200000, Number(v)));
            }}
          />
          <div className="small muted bold">шагов</div>
          <div className="chips" style={{ justifyContent: 'center', marginTop: 12 }}>
            {[500, 1000, 2000, 5000].map((d) => (
              <button key={d} className="chip" onClick={() => (haptic.select(), setVal(n + d))}>
                +{fmtNum(d)}
              </button>
            ))}
          </div>
        </div>
        <div className="grid-3">
          <div className="stat-box stat">
            <span className="v num">
              {stepsKm(n, s.profile).toFixed(1)}
              <small>км</small>
            </span>
            <span className="l">Дистанция</span>
          </div>
          <div className="stat-box stat">
            <span className="v num">
              {Math.round(stepsKcal(n, w))}
              <small>ккал</small>
            </span>
            <span className="l">Сожжено</span>
          </div>
          <div className="stat-box stat">
            <span className="v num">
              {Math.round(n / 100)}
              <small>мин</small>
            </span>
            <span className="l">Ходьбы</span>
          </div>
        </div>
        <div className="tiny faint">💡 Telegram не даёт доступ к шагомеру, поэтому переписывай число из «Здоровья» или с часов. Это пара секунд вечером.</div>
        <button
          className="btn"
          style={{ ['--c1' as string]: 'var(--steps)', ['--c2' as string]: 'var(--steps-2)' }}
          onClick={() => {
            s.setSteps(day, n);
            haptic.success();
            if (n >= s.profile.stepGoal && cur < s.profile.stepGoal) toast('🎉 Цель по шагам выполнена!');
            onClose();
          }}
        >
          Сохранить
        </button>
      </div>
    </Sheet>
  );
}

/* ===================== Вес ===================== */

export function WeightSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore();
  const [day, setDay] = useState(dayKey());
  const [val, setVal] = useState(currentWeight(s));
  const [was, setWas] = useState(false);
  if (open !== was) {
    setWas(open);
    if (open) {
      setDay(dayKey());
      setVal(s.weights[dayKey()] ?? currentWeight(s));
    }
  }
  return (
    <Sheet open={open} onClose={onClose} title="Взвешивание">
      <div className="stack">
        <div className="chips">
          {[0, -1, -2, -3].map((d) => {
            const k = addDays(dayKey(), d);
            return (
              <button
                key={k}
                className={`chip ${day === k ? 'on' : ''}`}
                onClick={() => {
                  haptic.select();
                  setDay(k);
                  if (s.weights[k]) setVal(s.weights[k]);
                }}
              >
                {humanDay(k)}
              </button>
            );
          })}
        </div>
        <div className="card" style={{ background: 'var(--surface-2)' }}>
          <Stepper value={val} step={0.1} min={30} max={300} onChange={setVal} format={(v) => `${v.toFixed(1).replace('.', ',')} кг`} />
          <div className="chips" style={{ justifyContent: 'center', marginTop: 12 }}>
            {[-1, -0.5, 0.5, 1].map((d) => (
              <button key={d} className="chip" onClick={() => (haptic.select(), setVal(Math.round((val + d) * 10) / 10))}>
                {d > 0 ? '+' : '−'}
                {Math.abs(d).toString().replace('.', ',')}
              </button>
            ))}
          </div>
        </div>
        <div className="tiny faint">💡 Взвешивайся утром натощак: так цифры честнее. Колебания ±1 кг за день — это вода, смотри на тренд.</div>
        <div className="row">
          {s.weights[day] != null && (
            <button
              className="btn danger"
              style={{ width: 56, padding: 0, flexShrink: 0 }}
              onClick={() => {
                s.removeWeight(day);
                haptic.warning();
                onClose();
              }}
              aria-label="Удалить"
            >
              <Icon name="trash" size={18} />
            </button>
          )}
          <button
            className="btn"
            style={{ ['--c1' as string]: 'var(--weight)', ['--c2' as string]: 'var(--food)' }}
            onClick={() => {
              s.setWeight(day, val);
              haptic.success();
              onClose();
            }}
          >
            Сохранить
          </button>
        </div>
      </div>
    </Sheet>
  );
}

/* ===================== Сон: ручное добавление / правка ===================== */

export function SleepEditSheet({ open, onClose, entry, nap: napDefault = false }: { open: boolean; onClose: () => void; entry?: SleepEntry | null; nap?: boolean }) {
  const s = useStore();
  const [bed, setBed] = useState('23:00');
  const [wake, setWake] = useState(s.profile.wakeTime);
  const [day, setDay] = useState(dayKey());
  const [quality, setQuality] = useState(0);
  const [nap, setNap] = useState(false);
  const [was, setWas] = useState(false);
  if (open !== was) {
    setWas(open);
    if (open) {
      if (entry) {
        setBed(fmtTime(entry.start));
        setWake(fmtTime(entry.end));
        setDay(dayKey(entry.end));
        setQuality(entry.quality);
        setNap(isNap(entry));
      } else if (napDefault) {
        // дневной сон: по умолчанию «последние полчаса»
        setBed(fmtTime(Date.now() - 30 * 60_000));
        setWake(fmtTime(Date.now()));
        setDay(dayKey());
        setQuality(0);
        setNap(true);
      } else {
        setBed('23:00');
        setWake(s.profile.wakeTime);
        setDay(dayKey());
        setQuality(0);
        setNap(false);
      }
    }
  }
  const [y, m, d] = day.split('-').map(Number);
  const wakeMs = new Date(y, m - 1, d, Math.floor(parseHM(wake) / 60), parseHM(wake) % 60).getTime();
  let startMs = new Date(y, m - 1, d, Math.floor(parseHM(bed) / 60), parseHM(bed) % 60).getTime();
  if (startMs >= wakeMs) startMs -= 86_400_000;
  const dur = (wakeMs - startMs) / 60000;

  return (
    <Sheet open={open} onClose={onClose} title={entry ? 'Изменить сон' : 'Добавить сон'}>
      <div className="stack">
        <Segmented
          value={nap ? 'nap' : 'night'}
          onChange={(v) => setNap(v === 'nap')}
          options={[
            { v: 'night', label: '🌙 Ночной' },
            { v: 'nap', label: '😴 Дневной' },
          ]}
        />
        <div className="field">
          <label>{nap ? 'День' : 'Утро пробуждения'}</label>
          <div className="chips">
            {[0, -1, -2, -3, -4, -5, -6].map((i) => {
              const k = addDays(dayKey(), i);
              return (
                <button key={k} className={`chip ${day === k ? 'on' : ''}`} onClick={() => (haptic.select(), setDay(k))}>
                  {humanDay(k)}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid-2">
          <TimeField label={nap ? '😴 Уснул' : '🌙 Лёг'} value={bed} onChange={setBed} />
          <TimeField label="☀️ Встал" value={wake} onChange={setWake} />
        </div>
        <div className="card center" style={{ background: 'var(--surface-2)', padding: 12 }}>
          <div className="small muted bold">Длительность</div>
          <div style={{ fontSize: 26, fontWeight: 800 }} className="num">
            {fmtDur(dur)}
          </div>
          <div className="tiny faint">≈ {(dur / 90).toFixed(1).replace('.', ',')} цикла сна</div>
        </div>
        <QualityPicker value={quality} onChange={setQuality} />
        <div className="row">
          {entry && (
            <button
              className="btn danger"
              style={{ width: 56, padding: 0, flexShrink: 0 }}
              aria-label="Удалить"
              onClick={() => {
                const r = s.removeSleep(entry.id);
                haptic.warning();
                onClose();
                if (r) toast('Сон удалён', { label: 'Вернуть', fn: () => s.addSleep(r) });
              }}
            >
              <Icon name="trash" size={18} />
            </button>
          )}
          <button
            className="btn"
            style={{ ['--c1' as string]: 'var(--sleep)', ['--c2' as string]: 'var(--sleep-2)' }}
            disabled={dur < 10 || dur > 20 * 60}
            onClick={() => {
              if (entry) s.updateSleep(entry.id, { start: startMs, end: wakeMs, quality, nap });
              else s.addSleep({ start: startMs, end: wakeMs, quality, nap });
              haptic.success();
              onClose();
            }}
          >
            Сохранить
          </button>
        </div>
      </div>
    </Sheet>
  );
}

export const QUALITY = [
  { v: 1, e: '😫', l: 'Ужасно' },
  { v: 2, e: '😕', l: 'Плохо' },
  { v: 3, e: '😐', l: 'Норм' },
  { v: 4, e: '🙂', l: 'Хорошо' },
  { v: 5, e: '🤩', l: 'Супер' },
];

export function QualityPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="field">
      <label>Как выспался?</label>
      <div className="moods">
        {QUALITY.map((q) => (
          <button key={q.v} className={value === q.v ? 'on' : ''} onClick={() => (haptic.select(), onChange(value === q.v ? 0 : q.v))} aria-label={q.l}>
            {q.e}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ===================== Сон: оценка сразу после пробуждения ===================== */

export function SleepRateSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const s = useStore();
  const e = s.sleeps.find((x) => x.id === id);
  return (
    <Sheet open={!!id && !!e} onClose={onClose} title="С добрым утром ☀️">
      {e && (
        <div className="stack">
          <div className="card hero-sleep center" style={{ padding: 20 }}>
            <div className="stars" />
            <div className="muted small bold">Ты спал</div>
            <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em' }} className="num">
              {fmtDur((e.end - e.start) / 60000)}
            </div>
            <div className="muted small num">
              {fmtTime(e.start)} → {fmtTime(e.end)}
            </div>
          </div>
          <div className="moods">
            {QUALITY.map((q) => (
              <button
                key={q.v}
                className={e.quality === q.v ? 'on' : ''}
                onClick={() => {
                  haptic.success();
                  s.updateSleep(e.id, { quality: q.v });
                  setTimeout(onClose, 250);
                }}
              >
                {q.e}
              </button>
            ))}
          </div>
          <div className="center small muted">Оцени, как выспался. По оценкам я найду, сколько сна тебе реально нужно.</div>
        </div>
      )}
    </Sheet>
  );
}

/* ===================== Сохранить приём как блюдо ===================== */

export function NameSheet({ open, title, initial, onClose, onSave, emoji: initialEmoji }: { open: boolean; title: string; initial: string; emoji?: string; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(initial);
  const [was, setWas] = useState(false);
  if (open !== was) {
    setWas(open);
    if (open) setName(initial);
  }
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="stack">
        <div className="row">
          {initialEmoji && <div className="emoji-box">{initialEmoji}</div>}
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Название" />
        </div>
        <button className="btn" disabled={!name.trim()} onClick={() => onSave(name.trim())}>
          Сохранить
        </button>
      </div>
    </Sheet>
  );
}

/* ===================== Настройки ===================== */

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore();
  const p = s.profile;
  const upd = (patch: Partial<Profile>) => s.updateProfile(patch);
  const w = currentWeight(s);
  const t = targets(p, w);
  const [theme, setTheme] = useState<ThemePref>(readThemePref());
  const [importing, setImporting] = useState(false);
  const [importText, setImportText] = useState('');

  const exportData = async () => {
    const json = JSON.stringify(pickData(useStore.getState()));
    try {
      await navigator.clipboard.writeText(json);
      toast('Данные скопированы в буфер обмена');
    } catch {
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `ritm-${dayKey()}.json`;
      a.click();
    }
    haptic.success();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Настройки" full>
      <div className="stack">
        <div className="section-title">Профиль</div>
        <div className="card stack">
          <div className="field">
            <label>Имя</label>
            <input className="input" value={p.name} onChange={(e) => upd({ name: e.target.value })} />
          </div>
          <Segmented
            value={p.sex}
            onChange={(v) => upd({ sex: v })}
            options={[
              { v: 'm', label: 'Мужской' },
              { v: 'f', label: 'Женский' },
            ]}
          />
          <div className="grid-3">
            <div className="field">
              <label>Возраст</label>
              <NumInput value={p.age} onChange={(v) => v && upd({ age: v })} />
            </div>
            <div className="field">
              <label>Рост</label>
              <NumInput value={p.height} onChange={(v) => v && upd({ height: v })} suffix="см" />
            </div>
            <div className="field">
              <label>Цель, кг</label>
              <NumInput value={p.targetWeight} step={0.1} onChange={(v) => v && upd({ targetWeight: v })} />
            </div>
          </div>
          <div className="field">
            <label>Активность</label>
            <select className="input" value={p.activity} onChange={(e) => upd({ activity: Number(e.target.value) })}>
              {ACTIVITY.map((a) => (
                <option key={a.v} value={a.v}>
                  {a.emoji} {a.title} · {a.hint}
                </option>
              ))}
            </select>
          </div>
          <Segmented
            value={p.goal}
            onChange={(v) => upd({ goal: v })}
            options={[
              { v: 'lose', label: '📉 Похудеть' },
              { v: 'keep', label: '⚖️ Держать' },
              { v: 'gain', label: '💪 Набрать' },
            ]}
          />
          {p.goal !== 'keep' && (
            <div className="field">
              <div className="row-between">
                <label>Темп</label>
                <span className="small bold">{String(p.pace).replace('.', ',')} кг/нед</span>
              </div>
              <input type="range" className="range" min={0.25} max={1} step={0.25} value={p.pace} onChange={(e) => upd({ pace: Number(e.target.value) })} />
            </div>
          )}
        </div>

        <div className="section-title">Норма питания</div>
        <div className="card stack">
          <div className="grid-2">
            <div className="stat-box stat">
              <span className="v num">{fmtNum(t.bmr)}</span>
              <span className="l">Базовый обмен</span>
            </div>
            <div className="stat-box stat">
              <span className="v num">{fmtNum(t.tdee)}</span>
              <span className="l">Расход за день</span>
            </div>
          </div>
          <div className="field">
            <label>Калории в день {p.kcalOverride ? '(вручную)' : '(авто)'}</label>
            <NumInput value={p.kcalOverride ?? ''} onChange={(v) => upd({ kcalOverride: v || null })} placeholder={`${t.kcal} — авто`} suffix="ккал" />
          </div>
          <div className="small muted">
            БЖУ: <b style={{ color: 'var(--protein)' }}>{t.p} г</b> · <b style={{ color: 'var(--fat)' }}>{t.f} г</b> · <b style={{ color: 'var(--carbs)' }}>{t.c} г</b>
          </div>
          <div className="row-between">
            <div>
              <div className="small bold">Учитывать шаги</div>
              <div className="tiny muted">Шаги сверх 4000 прибавляют калории к норме</div>
            </div>
            <Toggle on={p.addActivity} onChange={(v) => upd({ addActivity: v })} />
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Вода в день</label>
              <NumInput value={p.waterGoal ?? ''} onChange={(v) => upd({ waterGoal: v || null })} placeholder={`${t.water} авто`} suffix="мл" />
            </div>
            <div className="field">
              <label>Стакан</label>
              <NumInput value={p.glass} onChange={(v) => v && upd({ glass: v })} suffix="мл" />
            </div>
          </div>
        </div>

        <div className="section-title">Сон и шаги</div>
        <div className="card stack">
          <div className="field">
            <label>Цель сна</label>
            <Stepper value={p.sleepGoal} step={0.5} min={5} max={11} onChange={(v) => upd({ sleepGoal: v })} format={(v) => `${String(v).replace('.', ',')} ч`} />
          </div>
          <TimeField label="Обычно встаю в" value={p.wakeTime} onChange={(v) => upd({ wakeTime: v })} />
          <div className="field">
            <label>Цель по шагам</label>
            <NumInput value={p.stepGoal} onChange={(v) => v && upd({ stepGoal: v })} suffix="шагов" />
          </div>
        </div>

        <div className="section-title">Напоминания</div>
        <button className="card tap row" style={{ textAlign: 'left' }} onClick={() => (haptic.light(), openReminders())}>
          <div className="emoji-box">🔔</div>
          <div className="grow">
            <div className="bold">Напоминания в боте</div>
            <div className="small muted">Отбой, утро, еда, привычки, вода и итоги недели</div>
          </div>
          <Icon name="right" className="faint" />
        </button>

        <div className="section-title">Оформление</div>
        <Segmented
          value={theme}
          onChange={(v) => {
            setTheme(v);
            applyTheme(v);
          }}
          options={[
            { v: 'auto', label: 'Как в Telegram' },
            { v: 'dark', label: '🌙 Тёмная' },
            { v: 'light', label: '☀️ Светлая' },
          ]}
        />

        <div className="section-title">Данные</div>
        <div className="card stack">
          <div className="tiny muted">Данные хранятся на устройстве и синхронизируются через облако Telegram. Можно сохранить копию.</div>
          <div className="grid-2">
            <button className="btn ghost" onClick={exportData}>
              <Icon name="download" size={18} /> Экспорт
            </button>
            <button className="btn ghost" onClick={() => setImporting(!importing)}>
              <Icon name="upload" size={18} /> Импорт
            </button>
          </div>
          {importing && (
            <div className="stack-sm">
              <textarea className="input" style={{ height: 100, padding: 12, fontSize: 12 }} placeholder="Вставь сюда скопированные данные" value={importText} onChange={(e) => setImportText(e.target.value)} />
              <button
                className="btn"
                disabled={!importText.trim()}
                onClick={async () => {
                  try {
                    const d = JSON.parse(importText);
                    if (!d.profile) throw new Error();
                    if (!(await confirmDialog('Заменить текущие данные импортированными?'))) return;
                    s.importData(d);
                    haptic.success();
                    toast('Данные загружены');
                    setImporting(false);
                  } catch {
                    haptic.error();
                    toast('Не получилось прочитать данные');
                  }
                }}
              >
                Загрузить
              </button>
            </div>
          )}
          <button
            className="btn danger"
            onClick={async () => {
              if (await confirmDialog('Удалить все данные и начать заново? Это нельзя отменить.')) {
                s.resetAll();
                onClose();
              }
            }}
          >
            Сбросить всё
          </button>
        </div>
        <div className="center tiny faint" style={{ margin: '8px 0' }}>
          Ритм · v0.1
        </div>
      </div>
    </Sheet>
  );
}

/* ===================== Дневной сон: выбор длительности ===================== */

const NAPS = [
  { m: 20, title: 'Заряд бодрости', hint: 'Лёгкий сон: встаёшь свежим, без вялости', best: true },
  { m: 30, title: 'Короткий отдых', hint: 'Чуть глубже, после может быть лёгкая сонливость', best: false },
  { m: 60, title: 'Глубокий сон', hint: 'Полезно для памяти, но вставать тяжелее', best: false },
  { m: 90, title: 'Полный цикл', hint: 'Как маленькая ночь: просыпаешься в лёгкой фазе', best: true },
];

export function NapSheet({ open, onClose, onManual }: { open: boolean; onClose: () => void; onManual: () => void }) {
  const s = useStore();
  const late = new Date().getHours() >= 16;
  const start = (m: number | null) => {
    s.startSleep(undefined, 'nap', m);
    haptic.medium();
    toast(m ? `😴 Сладких снов! Подъём в ${fmtTime(Date.now() + m * 60_000)}` : '😴 Сладких снов! Нажми «Проснулся», когда встанешь');
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Дневной сон">
      <div className="stack">
        <div className="small muted">Выбери, сколько хочешь поспать. Я покажу таймер, а сон добавится к сегодняшнему дню.</div>
        {late && <div className="badge warn" style={{ alignSelf: 'flex-start', whiteSpace: 'normal' }}>⚠️ После 16:00 долгий сон может помешать уснуть вечером</div>}
        <div className="stack-sm">
          {NAPS.map((n) => (
            <button key={n.m} className="choice" onClick={() => start(n.m)}>
              <div className="num" style={{ fontSize: 22, fontWeight: 800, width: 62, textAlign: 'center' }}>
                {n.m}
                <span className="tiny muted"> мин</span>
              </div>
              <div className="grow">
                <div className="bold">
                  {n.title} {n.best && '⭐'}
                </div>
                <div className="tiny muted">{n.hint}</div>
              </div>
              <span className="tiny faint bold num">до {fmtTime(Date.now() + n.m * 60_000)}</span>
            </button>
          ))}
        </div>
        <div className="grid-2">
          <button className="btn ghost" onClick={() => start(null)}>
            Без таймера
          </button>
          <button
            className="btn ghost"
            onClick={() => {
              onClose();
              setTimeout(onManual, 220);
            }}
          >
            Уже поспал
          </button>
        </div>
      </div>
    </Sheet>
  );
}
