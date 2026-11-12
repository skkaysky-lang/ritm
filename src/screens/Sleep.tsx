import { useState } from 'react';
import { useStore, type SleepEntry } from '../store';
import { bedMinutes, bedtimesFor, isNap, nightsByDay, scoreLabel, sleepMin, sleepScore, sleepStats, wakeTimesFrom } from '../lib/calc';
import { dayKey, fmtDur, fmtMinutesOfDay, fmtTime, humanDay, lastDays, minutesOfDay, parseHM, plural, WD, weekday } from '../lib/date';
import { haptic } from '../lib/telegram';
import { Icon } from '../components/Icon';
import { Bars, SleepRange } from '../components/charts';
import { Empty, Ring, Segmented, Sheet, TimeField, toast, useNow } from '../components/ui';
import { NapSheet, QUALITY, SleepEditSheet, SleepRateSheet } from '../components/sheets';

export function Sleep() {
  const s = useStore();
  const now = useNow(15_000);
  const goalH = s.profile.sleepGoal;
  const [period, setPeriod] = useState<'7' | '30'>('7');
  const [edit, setEdit] = useState<{ entry: SleepEntry | null; nap: boolean } | null>(null);
  const [rateId, setRateId] = useState<string | null>(null);
  const [adjust, setAdjust] = useState<null | 'start' | 'end'>(null);
  const [napOpen, setNapOpen] = useState(false);

  const nights = nightsByDay(s.sleeps);
  const last = nights[dayKey()] ?? null;
  const st = sleepStats(s, 7);
  const days = lastDays(Number(period));
  const sorted = [...s.sleeps].sort((a, b) => b.end - a.end);
  const napping = s.sleepStart != null && s.sleepKind === 'nap';
  // now обновляется раз в несколько секунд, поэтому сразу после старта берём свежее время
  const elapsed = s.sleepStart ? Math.max(0, (Math.max(now, Date.now()) - s.sleepStart) / 60000) : 0;
  const lbl = (k: string) => (period === '7' ? WD[weekday(k)] : String(Number(k.slice(8))));

  const wake = (at?: number) => {
    const wasNap = napping;
    const id = s.endSleep(at);
    haptic.success();
    if (!id) return toast('Слишком короткий сон, не записал');
    if (wasNap) {
      const e = useStore.getState().sleeps.find((x) => x.id === id);
      toast(`😴 Дневной сон ${e ? fmtDur(sleepMin(e)) : ''} записан`);
    } else setRateId(id);
  };

  return (
    <div className="screen stack">
      <div className="page-head">
        <div>
          <div className="page-title">Сон</div>
          <div className="page-sub">Цель: {String(goalH).replace('.', ',')} ч в сутки</div>
        </div>
        <button className="icon-btn" onClick={() => (haptic.light(), setEdit({ entry: null, nap: false }))} aria-label="Добавить сон">
          <Icon name="plus" />
        </button>
      </div>

      {/* ---------- Главная карточка ---------- */}
      <div className={`card ${napping ? 'hero-nap' : 'hero-sleep'}`} style={{ padding: 20 }}>
        {!napping && <div className="stars" />}
        {s.sleepStart && napping ? (
          /* --- идёт дневной сон --- */
          <div style={{ position: 'relative' }} className="stack">
            <div className="row" style={{ gap: 18 }}>
              <Ring value={s.napTarget ? elapsed / s.napTarget : 0.02} size={120} stroke={11} colors={['#fff', '#ffe9b0']} track="rgba(255,255,255,.22)">
                <div style={{ fontSize: 26, fontWeight: 800 }} className="num">
                  {Math.floor(elapsed)}
                  <span style={{ fontSize: 13 }}> мин</span>
                </div>
                <div className="tiny bold" style={{ opacity: 0.85 }}>
                  {s.napTarget ? `из ${s.napTarget}` : 'спишь'}
                </div>
              </Ring>
              <div className="stack-sm grow">
                <div className="bold" style={{ fontSize: 18 }}>
                  😴 Дневной сон
                </div>
                <div className="small" style={{ opacity: 0.9 }}>
                  Уснул в {fmtTime(s.sleepStart)}
                  {s.napTarget ? ` · подъём в ${fmtTime(s.sleepStart + s.napTarget * 60_000)}` : ''}
                </div>
                {s.napTarget != null && elapsed >= s.napTarget && <div className="badge pulse" style={{ background: 'rgba(255,255,255,.9)', color: '#b45309', alignSelf: 'flex-start' }}>⏰ Пора вставать!</div>}
              </div>
            </div>
            <div className="row">
              <button className="btn glass sm" onClick={() => (s.cancelSleep(), haptic.soft())}>
                Отмена
              </button>
              <button className="btn white" style={{ height: 46, color: '#b45309' }} onClick={() => wake()}>
                ☀️ Проснулся
              </button>
            </div>
          </div>
        ) : s.sleepStart ? (
          /* --- идёт ночной сон --- */
          <div style={{ position: 'relative' }} className="stack">
            <div className="row" style={{ gap: 18 }}>
              <Ring value={elapsed / (goalH * 60)} size={120} stroke={11} colors={['#b3a8ff', '#6fa0ff']} track="rgba(255,255,255,.12)">
                <div style={{ fontSize: 24, fontWeight: 800 }} className="num">
                  {Math.floor(elapsed / 60)}:{String(Math.floor(elapsed % 60)).padStart(2, '0')}
                </div>
                <div className="tiny muted bold">спишь</div>
              </Ring>
              <div className="stack-sm grow">
                <div className="small muted bold">Лёг в {fmtTime(s.sleepStart)}</div>
                <div className="small">Проснись в конце цикла, чтобы встать бодрым:</div>
                <div className="chips wrap">
                  {wakeTimesFrom(minutesOfDay(s.sleepStart))
                    .slice(1)
                    .map((w) => (
                      <span key={w.cycles} className="badge" style={{ background: 'rgba(255,255,255,.14)', color: '#fff' }}>
                        {fmtMinutesOfDay(w.at)}
                      </span>
                    ))}
                </div>
              </div>
            </div>
            <div className="row">
              <button className="btn glass sm" onClick={() => setAdjust('end')}>
                Встал раньше
              </button>
              <button className="btn white" style={{ height: 46 }} onClick={() => wake()}>
                ☀️ Я проснулся
              </button>
            </div>
            <button className="tiny muted bold" onClick={() => (s.cancelSleep(), haptic.soft())}>
              Отменить отбой
            </button>
          </div>
        ) : (
          /* --- не сплю --- */
          <div style={{ position: 'relative' }} className="stack">
            {last?.main ? (
              <div className="row" style={{ gap: 18 }}>
                <Ring value={sleepScore(last.main, goalH, last.nap) / 100} size={110} stroke={10} colors={['#b3a8ff', '#6fa0ff']} track="rgba(255,255,255,.12)">
                  <div style={{ fontSize: 30, fontWeight: 800 }} className="num">
                    {sleepScore(last.main, goalH, last.nap)}
                  </div>
                  <div className="tiny muted bold">{scoreLabel(sleepScore(last.main, goalH, last.nap))}</div>
                </Ring>
                <div className="grow">
                  <div className="small muted bold">Этой ночью</div>
                  <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em' }} className="num">
                    {fmtDur(last.night)}
                  </div>
                  <div className="small muted num">
                    {fmtTime(last.main.start)} → {fmtTime(last.main.end)}
                    {last.main.quality ? ` · ${QUALITY[last.main.quality - 1].e} ${QUALITY[last.main.quality - 1].l}` : ''}
                  </div>
                  {last.nap > 0 && <div className="badge" style={{ background: 'rgba(255,255,255,.14)', color: '#fff', marginTop: 6 }}>😴 +{fmtDur(last.nap)} днём · всего {fmtDur(last.total)}</div>}
                </div>
              </div>
            ) : (
              <div className="row-between">
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{last?.nap ? `Днём поспал ${fmtDur(last.nap)}` : 'Сегодня ещё нет сна'}</div>
                  <div className="small muted">Вечером нажми «Ложусь», утром — «Проснулся». Остальное я посчитаю сам.</div>
                </div>
                <div style={{ fontSize: 46 }}>🌙</div>
              </div>
            )}
            <div className="row">
              <button className="btn glass sm" onClick={() => setAdjust('start')}>
                Уже лёг в…
              </button>
              <button
                className="btn white"
                style={{ height: 46 }}
                onClick={() => {
                  s.startSleep();
                  haptic.medium();
                  toast('🌙 Спокойной ночи! Утром нажми «Я проснулся»');
                }}
              >
                🌙 Ложусь спать
              </button>
            </div>
            <button className="btn glass sm" style={{ width: '100%' }} onClick={() => (haptic.light(), setNapOpen(true))}>
              😴 Вздремнуть днём
            </button>
          </div>
        )}
      </div>

      {/* ---------- Сводка ---------- */}
      <div className="grid-2">
        <StatCard emoji="⏱️" label="В сутки за 7 дней" value={st.nights ? fmtDur(st.avg) : '—'} hint={st.nights ? (st.naps ? 'с дневным сном' : `${st.nights} ноч.`) : 'нет данных'} />
        <StatCard emoji="🥱" label="Недосып за неделю" value={st.nights ? fmtDur(st.debt) : '—'} hint={st.debt > 120 ? 'стоит отоспаться' : st.nights ? 'всё ок' : ''} tone={st.debt > 120 ? 'warn' : 'good'} />
        <StatCard emoji="🎯" label="Регулярность режима" value={st.nights >= 2 ? `${st.consistency}%` : '—'} hint={st.consistency >= 80 ? 'стабильно' : st.nights >= 2 ? 'режим скачет' : 'нужно 2+ ночи'} tone={st.consistency >= 80 ? 'good' : 'warn'} />
        <StatCard emoji="🕰️" label="Обычно ложишься" value={st.avgBed != null ? fmtMinutesOfDay(st.avgBed) : '—'} hint={st.avgWake != null ? `встаёшь в ${fmtMinutesOfDay(st.avgWake)}` : ''} />
      </div>
      {st.naps > 0 && (
        <div className="card tight row">
          <div className="emoji-box">😴</div>
          <div className="grow">
            <div className="bold">
              Дневной сон: {st.naps} {plural(st.naps, 'раз', 'раза', 'раз')} за неделю
            </div>
            <div className="small muted">
              В среднем {fmtDur(st.napAvg)}. {st.napAvg <= 30 ? 'Отличная длина: бодрит и не сбивает ночной сон.' : st.napAvg < 80 ? 'Попробуй 20 или 90 минут: вставать будет легче.' : 'Долгий дневной сон может сдвигать отбой.'}
            </div>
          </div>
        </div>
      )}

      {/* ---------- Графики ---------- */}
      <div className="card stack">
        <div className="row-between">
          <div className="card-title">Длительность</div>
          <div style={{ width: 150 }}>
            <Segmented
              value={period}
              onChange={setPeriod}
              options={[
                { v: '7', label: '7 дн' },
                { v: '30', label: '30 дн' },
              ]}
            />
          </div>
        </div>
        {s.sleeps.length ? (
          <>
            <Bars
              data={days.map((k) => {
                const n = nights[k];
                return {
                  key: k,
                  label: lbl(k),
                  value: (n?.night ?? 0) / 60,
                  extra: n?.nap ? n.nap / 60 : undefined,
                  color: n?.main ? (n.total >= goalH * 60 - 20 ? 'linear-gradient(180deg, var(--sleep), var(--sleep-2))' : 'linear-gradient(180deg, #ff9f43, #ff6b8b)') : undefined,
                };
              })}
              goal={goalH}
              goalLabel={`${String(goalH).replace('.', ',')} ч`}
              extraColor="var(--nap)"
              format={(v) => fmtDur(v * 60)}
            />
            <div className="row tiny muted bold" style={{ gap: 12, flexWrap: 'wrap' }}>
              <span className="row" style={{ gap: 4 }}>
                <i className="dot" style={{ background: 'var(--sleep)' }} /> ночь в норме
              </span>
              <span className="row" style={{ gap: 4 }}>
                <i className="dot" style={{ background: '#ff9f43' }} /> недосып
              </span>
              <span className="row" style={{ gap: 4 }}>
                <i className="dot" style={{ background: 'var(--nap)' }} /> дневной сон
              </span>
            </div>
            <div className="divider" />
            <SleepRange
              nights={days.map((k) => {
                const n = nights[k]?.main;
                if (!n) return { key: k, label: lbl(k), bed: null, wake: null };
                const bed = bedMinutes(n.start);
                let w = minutesOfDay(n.end);
                if (w < bed) w += 1440;
                return { key: k, label: lbl(k), bed, wake: w };
              })}
            />
          </>
        ) : (
          <Empty emoji="📊" text="Здесь появятся графики после первой записанной ночи" />
        )}
      </div>

      <SleepCalculator wake={s.profile.wakeTime} />

      {/* ---------- История ---------- */}
      <div className="section-title">История</div>
      <div className="card" style={{ paddingTop: 6, paddingBottom: 6 }}>
        {sorted.length ? (
          <div className="list">
            {sorted.slice(0, 25).map((e) => {
              const nap = isNap(e);
              const sc = sleepScore(e, goalH);
              return (
                <button key={e.id} className="list-item" onClick={() => (haptic.light(), setEdit({ entry: e, nap }))}>
                  <div className="emoji-box sm" style={nap ? { background: 'color-mix(in srgb, var(--nap) 22%, transparent)' } : undefined}>
                    {nap ? '☀️' : e.quality ? QUALITY[e.quality - 1].e : '😴'}
                  </div>
                  <div className="grow">
                    <div className="bold">
                      {humanDay(dayKey(e.end))}
                      {nap && <span className="faint small"> · дневной</span>}
                    </div>
                    <div className="tiny muted num">
                      {fmtTime(e.start)} → {fmtTime(e.end)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="bold num">{fmtDur(sleepMin(e))}</div>
                    {!nap && <span className={`badge ${sc >= 70 ? 'good' : sc >= 50 ? 'warn' : 'bad'}`}>{sc}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <Empty emoji="🛌" text="Пока пусто" />
        )}
      </div>

      <SleepEditSheet open={!!edit} entry={edit?.entry ?? null} nap={edit?.nap} onClose={() => setEdit(null)} />
      <SleepRateSheet id={rateId} onClose={() => setRateId(null)} />
      <NapSheet open={napOpen} onClose={() => setNapOpen(false)} onManual={() => setEdit({ entry: null, nap: true })} />
      <AdjustSheet
        mode={adjust}
        onClose={() => setAdjust(null)}
        onSave={(ms) => {
          if (adjust === 'start') {
            s.startSleep(ms);
            haptic.success();
            toast(`🌙 Записал отбой в ${fmtTime(ms)}`);
          } else wake(ms);
          setAdjust(null);
        }}
        sleepStart={s.sleepStart}
      />
    </div>
  );
}

function StatCard({ emoji, label, value, hint, tone }: { emoji: string; label: string; value: string; hint?: string; tone?: 'good' | 'warn' }) {
  return (
    <div className="card tight">
      <div className="row-between">
        <span style={{ fontSize: 20 }}>{emoji}</span>
        {hint && (
          <span className="tiny bold" style={{ color: tone === 'warn' ? 'var(--warn)' : tone === 'good' ? 'var(--good)' : 'var(--text-3)' }}>
            {hint}
          </span>
        )}
      </div>
      <div className="stat" style={{ marginTop: 8 }}>
        <span className="v num">{value}</span>
        <span className="l">{label}</span>
      </div>
    </div>
  );
}

/* ---------- Калькулятор циклов сна ---------- */

function SleepCalculator({ wake }: { wake: string }) {
  const [mode, setMode] = useState<'wake' | 'now'>('wake');
  const [time, setTime] = useState(wake);
  const now = useNow(60_000);
  const nowMin = minutesOfDay(now);
  const list = mode === 'wake' ? bedtimesFor(parseHM(time)) : wakeTimesFrom(nowMin);
  return (
    <div className="card stack">
      <div className="card-title">
        <Icon name="sparkle" size={18} /> Калькулятор сна
      </div>
      <div className="small muted">Сон идёт циклами по ~90 минут. Проснуться в конце цикла легче, чем посреди глубокого сна.</div>
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { v: 'wake', label: 'Хочу встать в…' },
          { v: 'now', label: 'Ложусь сейчас' },
        ]}
      />
      {mode === 'wake' && <TimeField value={time} onChange={setTime} />}
      <div className="small muted bold">{mode === 'wake' ? 'Ложись в:' : `Если уснёшь к ${fmtMinutesOfDay(nowMin + 15)}, вставай в:`}</div>
      <div className="grid-2">
        {list.map((x) => {
          const best = x.cycles === 5 || x.cycles === 6;
          return (
            <div key={x.cycles} className="stat-box" style={best ? { background: 'color-mix(in srgb, var(--sleep) 16%, transparent)', outline: '1.5px solid color-mix(in srgb, var(--sleep) 45%, transparent)' } : undefined}>
              <div style={{ fontSize: 24, fontWeight: 800 }} className="num">
                {fmtMinutesOfDay(x.at)}
              </div>
              <div className="tiny muted bold">
                {x.cycles} цикл{x.cycles >= 5 ? 'ов' : 'а'} · {String(x.hours).replace('.', ',')} ч {best ? '⭐' : ''}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- «Уже лёг в…» / «Встал раньше» ---------- */

function AdjustSheet({ mode, onClose, onSave, sleepStart }: { mode: null | 'start' | 'end'; onClose: () => void; onSave: (ms: number) => void; sleepStart: number | null }) {
  const [time, setTime] = useState('23:00');
  const [was, setWas] = useState<typeof mode>(null);
  if (mode !== was) {
    setWas(mode);
    if (mode) setTime(fmtTime(Date.now() - (mode === 'start' ? 30 : 10) * 60_000));
  }
  const nowD = new Date();
  const m = parseHM(time);
  const d = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate(), Math.floor(m / 60), m % 60);
  if (d.getTime() > nowD.getTime()) d.setDate(d.getDate() - 1);
  const ms = d.getTime();
  const invalid = mode === 'end' && sleepStart != null && ms <= sleepStart;
  return (
    <Sheet open={!!mode} onClose={onClose} title={mode === 'start' ? 'Во сколько лёг?' : 'Во сколько встал?'}>
      <div className="stack">
        <TimeField value={time} onChange={setTime} />
        <div className="small muted center">
          {humanDay(dayKey(ms))}, {fmtTime(ms)}
        </div>
        <button className="btn" disabled={invalid} style={{ ['--c1' as string]: 'var(--sleep)', ['--c2' as string]: 'var(--sleep-2)' }} onClick={() => onSave(ms)}>
          Сохранить
        </button>
      </div>
    </Sheet>
  );
}
