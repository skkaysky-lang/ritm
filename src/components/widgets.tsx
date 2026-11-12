import { useState } from 'react';
import { useStore } from '../store';
import { dayTargets, fmtNum } from '../lib/calc';
import { fmtDur, fmtTime } from '../lib/date';
import { haptic } from '../lib/telegram';
import { Icon } from './Icon';
import { confetti, Ring, toast, useNow } from './ui';

/* ===================== Вода ===================== */

export function WaterCard({ day, compact }: { day: string; compact?: boolean }) {
  const s = useStore();
  const ml = s.water[day] ?? 0;
  const goal = dayTargets(s, day).water;
  const glass = s.profile.glass;
  const v = Math.min(1, ml / goal);
  const add = (d: number) => {
    const before = ml;
    s.addWater(day, d);
    if (d > 0) {
      haptic.light();
      if (before < goal && before + d >= goal) {
        haptic.success();
        toast('💧 Норма воды выполнена!');
      }
    } else haptic.soft();
  };

  if (compact)
    return (
      <div className="card tight" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="row-between">
          <span className="card-title small" style={{ color: 'var(--water)' }}>
            <Icon name="drop" size={17} /> Вода
          </span>
          <span className="tiny faint bold num">{Math.round(v * 100)}%</span>
        </div>
        <div className="row" style={{ gap: 12 }}>
          <div className="wglass" style={{ width: 34, height: 46 }}>
            <i style={{ height: `${v * 100}%` }} />
          </div>
          <div className="stat">
            <span className="v num" style={{ fontSize: 18 }}>
              {(ml / 1000).toFixed(ml % 1000 === 0 ? 0 : 2).replace('.', ',')}
              <small>/ {(goal / 1000).toFixed(1).replace('.', ',')} л</small>
            </span>
            <span className="l">{Math.floor(ml / glass)} стак.</span>
          </div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button className="icon-btn sm" onClick={() => add(-glass)} disabled={!ml} aria-label="Убрать стакан">
            <Icon name="minus" size={16} />
          </button>
          <button className="btn sm grow" style={{ ['--c1' as string]: 'var(--water)', ['--c2' as string]: '#4f8bff', height: 32 }} onClick={() => add(glass)}>
            +{glass} мл
          </button>
        </div>
      </div>
    );

  return (
    <div className="card">
      <div className="row" style={{ gap: 16 }}>
        <div className="wglass">
          <i style={{ height: `${v * 100}%` }} />
        </div>
        <div className="grow">
          <div className="card-title" style={{ color: 'var(--water)' }}>
            <Icon name="drop" size={18} /> Вода
          </div>
          <div style={{ fontSize: 22, fontWeight: 800 }} className="num">
            {fmtNum(ml)} <span className="small muted">/ {fmtNum(goal)} мл</span>
          </div>
          <div className="row" style={{ gap: 3, marginTop: 4, flexWrap: 'wrap' }}>
            {Array.from({ length: Math.ceil(goal / glass) }, (_, i) => (
              <i key={i} style={{ width: 10, height: 14, borderRadius: 3, background: i < Math.floor(ml / glass) ? 'var(--water)' : 'var(--surface-3)', transition: 'background .3s' }} />
            ))}
          </div>
        </div>
      </div>
      <div className="row" style={{ marginTop: 12, gap: 6 }}>
        <button className="icon-btn" onClick={() => add(-glass)} disabled={!ml} aria-label="Убрать">
          <Icon name="minus" size={18} />
        </button>
        {[glass, 500].map((d) => (
          <button key={d} className="btn sm grow" style={{ ['--c1' as string]: 'var(--water)', ['--c2' as string]: '#4f8bff', height: 40 }} onClick={() => add(d)}>
            +{d} мл
          </button>
        ))}
      </div>
    </div>
  );
}

/* ===================== Интервальное голодание ===================== */

const PHASES: [number, string, string][] = [
  [0, '🍽️', 'Переваривание. Сахар в крови после еды'],
  [4, '📉', 'Сахар и инсулин снижаются'],
  [10, '🔥', 'Организм начинает активнее расходовать жир'],
  [14, '⚡', 'Основная энергия — из жировых запасов'],
  [18, '🧬', 'Глубокое голодание. Не забывай пить воду'],
];

export function FastingCard() {
  const s = useStore();
  const now = useNow(15_000);
  const [plan, setPlan] = useState(s.fastGoal || 16);
  const start = s.fastStart;

  if (!start)
    return (
      <div className="card">
        <div className="row-between">
          <div className="card-title">
            <Icon name="timer" size={18} /> Интервальное голодание
          </div>
          <span className="badge">{plan}:{24 - plan}</span>
        </div>
        <div className="small muted" style={{ margin: '6px 0 12px' }}>
          Запусти таймер после последнего приёма пищи, и я покажу, когда можно есть.
        </div>
        <div className="chips" style={{ marginBottom: 12 }}>
          {[12, 14, 16, 18, 20].map((h) => (
            <button key={h} className={`chip ${plan === h ? 'on' : ''}`} onClick={() => (haptic.select(), setPlan(h))}>
              {h} ч
            </button>
          ))}
        </div>
        <button
          className="btn"
          style={{ ['--c1' as string]: '#c86bff', ['--c2' as string]: 'var(--accent)' }}
          onClick={() => {
            s.startFast(plan);
            haptic.medium();
            toast(`⏳ Голодание ${plan} ч началось`);
          }}
        >
          Начать голодание
        </button>
      </div>
    );

  const el = (now - start) / 3_600_000;
  const goal = s.fastGoal;
  const v = el / goal;
  const phase = [...PHASES].reverse().find((p) => el >= p[0])!;
  const endAt = start + goal * 3_600_000;
  return (
    <div className="card card-glow" style={{ ['--glow' as string]: '#c86bff' }}>
      <div className="row" style={{ gap: 16 }}>
        <Ring value={v} size={110} stroke={11} colors={['#c86bff', '#7c6cff']}>
          <div className="tiny muted bold">{v >= 1 ? 'Готово!' : 'прошло'}</div>
          <div style={{ fontSize: 20, fontWeight: 800 }} className="num">
            {fmtDur(el * 60).replace(' м', 'м').replace(' ч', 'ч')}
          </div>
          <div className="tiny faint bold num">{Math.min(100, Math.round(v * 100))}%</div>
        </Ring>
        <div className="grow stack-sm">
          <div className="card-title">⏳ Голодание {goal} ч</div>
          <div className="small">
            {phase[1]} {phase[2]}
          </div>
          <div className="small muted">{v >= 1 ? 'Цель достигнута, можно есть 🎉' : `Можно есть в ${fmtTime(endAt)} · осталось ${fmtDur((endAt - now) / 60000)}`}</div>
        </div>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button
          className="btn ghost sm"
          onClick={() => {
            s.cancelFast();
            haptic.soft();
          }}
        >
          Отменить
        </button>
        <button
          className="btn sm grow"
          style={{ ['--c1' as string]: '#c86bff', ['--c2' as string]: 'var(--accent)' }}
          onClick={() => {
            const f = s.endFast();
            if (f && f.end - f.start >= f.goal * 3_600_000) {
              haptic.success();
              confetti();
              toast('🏆 Голодание завершено по плану!');
            } else {
              haptic.light();
              toast('Голодание завершено');
            }
          }}
        >
          Завершить
        </button>
      </div>
    </div>
  );
}
