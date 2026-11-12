import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';
import { Icon } from './Icon';
import { haptic, pushBack } from '../lib/telegram';
import { addDays, dayKey, fromKey, weekday, WD } from '../lib/date';

/* ===================== Кольцо прогресса ===================== */

export function Ring({
  value,
  size = 120,
  stroke = 12,
  colors = ['var(--accent)', 'var(--accent-2)'],
  track = 'var(--surface-3)',
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  colors?: [string, string];
  track?: string;
  children?: ReactNode;
}) {
  const id = useId().replace(/:/g, '');
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(v));
    return () => cancelAnimationFrame(t);
  }, [v]);
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={colors[0]} />
            <stop offset="100%" stopColor={colors[1]} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown)}
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.3, 0.9, 0.3, 1)' }}
          opacity={shown > 0.001 ? 1 : 0}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        {children}
      </div>
    </div>
  );
}

/* ===================== Полоса прогресса ===================== */

export function Bar({ value, color, className = '' }: { value: number; color?: string; className?: string }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = requestAnimationFrame(() => setW(Math.max(0, Math.min(1, value))));
    return () => cancelAnimationFrame(t);
  }, [value]);
  return (
    <div className={`bar ${className}`}>
      <i style={{ width: `${w * 100}%`, ['--c' as string]: color }} />
    </div>
  );
}

/* ===================== Сегменты ===================== */

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  const i = Math.max(0, options.findIndex((o) => o.v === value));
  const w = 100 / options.length;
  return (
    <div className="seg">
      <div className="seg-thumb" style={{ left: `calc(${i * w}% + ${i === 0 ? 4 : 2}px)`, width: `calc(${w}% - 6px)` }} />
      {options.map((o) => (
        <button
          key={o.v}
          className={o.v === value ? 'on' : ''}
          onClick={() => {
            if (o.v !== value) haptic.select();
            onChange(o.v);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ===================== Переключатель ===================== */

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      className={`toggle ${on ? 'on' : ''}`}
      onClick={() => {
        haptic.select();
        onChange(!on);
      }}
      aria-pressed={on}
    />
  );
}

/* ===================== Шторка снизу ===================== */

export function Sheet({ open, onClose, title, children, full, right }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; full?: boolean; right?: ReactNode }) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; dy: number } | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
      const t = setTimeout(() => {
        setMounted(false);
        setClosing(false);
      }, 220);
      return () => clearTimeout(t);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const off = pushBack(() => closeRef.current());
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      off();
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!mounted) return null;

  const onStart = (e: React.PointerEvent) => {
    drag.current = { y: e.clientY, dy: 0 };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current || !sheetRef.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.y);
    sheetRef.current.style.transform = `translate(-50%, ${drag.current.dy}px)`;
    sheetRef.current.style.transition = 'none';
  };
  const onEnd = () => {
    if (!drag.current || !sheetRef.current) return;
    const dy = drag.current.dy;
    drag.current = null;
    sheetRef.current.style.transition = 'transform 0.25s ease';
    sheetRef.current.style.transform = '';
    if (dy > 90) closeRef.current();
  };

  return createPortal(
    <>
      <div className={`backdrop ${closing ? 'closing' : ''}`} onClick={() => closeRef.current()} />
      <div ref={sheetRef} className={`sheet ${full ? 'full' : ''} ${closing ? 'closing' : ''}`} role="dialog">
        <div className="sheet-handle" onPointerDown={onStart} onPointerMove={onMove} onPointerUp={onEnd} onPointerCancel={onEnd}>
          <i />
        </div>
        {(title || right) && (
          <div className="sheet-head" onPointerDown={onStart} onPointerMove={onMove} onPointerUp={onEnd} onPointerCancel={onEnd}>
            <div className="sheet-title">{title}</div>
            <div className="row" onPointerDown={(e) => e.stopPropagation()}>
              {right}
              <button className="icon-btn sm" onClick={() => closeRef.current()} aria-label="Закрыть">
                <Icon name="close" size={18} />
              </button>
            </div>
          </div>
        )}
        <div className="sheet-body">{children}</div>
      </div>
    </>,
    document.body,
  );
}

/* ===================== Тосты ===================== */

interface ToastState {
  msg: string | null;
  action?: { label: string; fn: () => void };
  key: number;
  show: (msg: string, action?: { label: string; fn: () => void }) => void;
  hide: () => void;
}
export const useToast = create<ToastState>((set) => ({
  msg: null,
  key: 0,
  show: (msg, action) => set((s) => ({ msg, action, key: s.key + 1 })),
  hide: () => set({ msg: null, action: undefined }),
}));
export const toast = (msg: string, action?: { label: string; fn: () => void }) => useToast.getState().show(msg, action);

export function ToastHost() {
  const { msg, action, key, hide } = useToast();
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(hide, action ? 4500 : 2200);
    return () => clearTimeout(t);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!msg) return null;
  return createPortal(
    <div className="toast" key={key}>
      <span>{msg}</span>
      {action && (
        <button
          onClick={() => {
            action.fn();
            haptic.light();
            hide();
          }}
        >
          {action.label}
        </button>
      )}
    </div>,
    document.body,
  );
}

/* ===================== Конфетти ===================== */

const useConfetti = create<{ n: number; fire: () => void }>((set) => ({ n: 0, fire: () => set((s) => ({ n: s.n + 1 })) }));
export const confetti = () => useConfetti.getState().fire();

export function ConfettiHost() {
  const n = useConfetti((s) => s.n);
  const [items, setItems] = useState<{ id: number; pieces: React.CSSProperties[] } | null>(null);
  useEffect(() => {
    if (!n) return;
    const colors = ['#7c6cff', '#2fd3a4', '#ff9f43', '#ff6b8b', '#43c6f5', '#ffc04d'];
    const pieces = Array.from({ length: 70 }, () => ({
      left: `${Math.random() * 100}%`,
      background: colors[Math.floor(Math.random() * colors.length)],
      animationDelay: `${Math.random() * 0.35}s`,
      animationDuration: `${1.2 + Math.random() * 1}s`,
      ['--dx' as string]: `${(Math.random() - 0.5) * 160}px`,
      ['--rot' as string]: `${Math.random() * 720 - 360}deg`,
      borderRadius: Math.random() > 0.5 ? '50%' : '2px',
      width: `${6 + Math.random() * 6}px`,
    }));
    setItems({ id: n, pieces });
    const t = setTimeout(() => setItems(null), 2600);
    return () => clearTimeout(t);
  }, [n]);
  if (!items) return null;
  return createPortal(
    <div className="confetti" key={items.id}>
      {items.pieces.map((s, i) => (
        <i key={i} style={s} />
      ))}
    </div>,
    document.body,
  );
}

/* ===================== Полоса дней недели ===================== */

export function DayStrip({ value, onChange, mark }: { value: string; onChange: (k: string) => void; mark?: (k: string) => number }) {
  const today = dayKey();
  const monday = addDays(value, -weekday(value));
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const canNext = addDays(monday, 7) <= today;
  return (
    <div className="daystrip">
      <button className="icon-btn sm plain" onClick={() => (haptic.select(), onChange(addDays(value, -7)))} aria-label="Прошлая неделя">
        <Icon name="left" size={18} />
      </button>
      <div className="days">
        {days.map((k) => {
          const future = k > today;
          const m = mark && !future ? mark(k) : 0;
          return (
            <button
              key={k}
              className={`day ${k === value ? 'on' : ''} ${k === today ? 'today' : ''} ${future ? 'future' : ''}`}
              disabled={future}
              onClick={() => {
                haptic.select();
                onChange(k);
              }}
            >
              <span className="wd">{WD[weekday(k)]}</span>
              <span className="dn">
                {m > 0 && (
                  <svg width="32" height="32" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
                    <circle cx="16" cy="16" r="14" fill="none" stroke="var(--surface-3)" strokeWidth="2.5" />
                    <circle
                      cx="16"
                      cy="16"
                      r="14"
                      fill="none"
                      stroke={m >= 1 ? 'var(--good)' : 'var(--accent)'}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeDasharray={88}
                      strokeDashoffset={88 * (1 - Math.min(1, m))}
                    />
                  </svg>
                )}
                {fromKey(k).getDate()}
              </span>
            </button>
          );
        })}
      </div>
      <button className="icon-btn sm plain" disabled={!canNext} style={{ opacity: canNext ? 1 : 0.25 }} onClick={() => (haptic.select(), onChange(addDays(value, 7) > today ? today : addDays(value, 7)))} aria-label="Следующая неделя">
        <Icon name="right" size={18} />
      </button>
    </div>
  );
}

/* ===================== Числовое поле ===================== */

export function NumInput({
  value,
  onChange,
  suffix,
  placeholder,
  step,
  autoFocus,
  className = '',
}: {
  value: number | '' | null | undefined;
  onChange: (v: number | '') => void;
  suffix?: string;
  placeholder?: string;
  step?: number;
  autoFocus?: boolean;
  className?: string;
}) {
  const [text, setText] = useState(value === '' || value == null ? '' : String(value));
  const last = useRef(value);
  useLayoutEffect(() => {
    if (value !== last.current) {
      const cur = text.replace(',', '.');
      if (Number(cur) !== value) setText(value === '' || value == null ? '' : String(value));
      last.current = value;
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="input-wrap">
      <input
        className={`input num ${className}`}
        inputMode={step && step < 1 ? 'decimal' : 'numeric'}
        value={text}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => {
          const t = e.target.value.replace(/[^\d.,]/g, '');
          setText(t);
          const n = t === '' ? '' : Number(t.replace(',', '.'));
          if (n === '' || !Number.isNaN(n)) {
            last.current = n;
            onChange(n);
          }
        }}
        onFocus={(e) => e.target.select()}
        style={suffix ? { paddingRight: 14 + suffix.length * 9 } : undefined}
      />
      {suffix && <span className="suffix">{suffix}</span>}
    </div>
  );
}

/* ===================== Счётчик −/+ ===================== */

export function Stepper({ value, onChange, step = 1, min = 0, max = 1e9, format }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; format?: (v: number) => ReactNode }) {
  const hold = useRef<number>();
  const valRef = useRef(value);
  valRef.current = value;
  const change = (dir: number) => {
    const v = Math.round((valRef.current + dir * step) * 100) / 100;
    if (v < min || v > max) return;
    haptic.select();
    onChange(v);
  };
  const start = (dir: number) => {
    change(dir);
    let delay = 380;
    const tick = () => {
      change(dir);
      delay = Math.max(60, delay * 0.8);
      hold.current = window.setTimeout(tick, delay);
    };
    hold.current = window.setTimeout(tick, delay);
  };
  const stop = () => window.clearTimeout(hold.current);
  return (
    <div className="stepper">
      <button className="icon-btn" onPointerDown={() => start(-1)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} aria-label="Меньше">
        <Icon name="minus" />
      </button>
      <div className="val num">{format ? format(value) : value}</div>
      <button className="icon-btn" onPointerDown={() => start(1)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} aria-label="Больше">
        <Icon name="plus" />
      </button>
    </div>
  );
}

/* ===================== Ввод времени с подстройкой ===================== */

export function TimeField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  const shift = (d: number) => {
    const [h, m] = value.split(':').map(Number);
    const t = (((h * 60 + m + d) % 1440) + 1440) % 1440;
    haptic.select();
    onChange(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
  };
  return (
    <div className="field">
      {label && <label>{label}</label>}
      <div className="row" style={{ gap: 6 }}>
        <button className="icon-btn" onClick={() => shift(-15)} aria-label="−15 минут">
          <span className="tiny bold">−15</span>
        </button>
        <input type="time" className="input num grow" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} />
        <button className="icon-btn" onClick={() => shift(15)} aria-label="+15 минут">
          <span className="tiny bold">+15</span>
        </button>
      </div>
    </div>
  );
}

/* ===================== Мелочи ===================== */

export function Empty({ emoji, text, children }: { emoji: string; text: ReactNode; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="e">{emoji}</div>
      <div className="small">{text}</div>
      {children && <div style={{ marginTop: 12 }}>{children}</div>}
    </div>
  );
}

export function useNow(interval = 30_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(t);
  }, [interval]);
  return now;
}

export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(320);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    setW(ref.current.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Анимированное число */
export function CountUp({ value, format = (v: number) => Math.round(v).toLocaleString('ru-RU') }: { value: number; format?: (v: number) => string }) {
  const [v, setV] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 600);
      const e = 1 - Math.pow(1 - k, 3);
      setV(a + (value - a) * e);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value]);
  return <>{format(v)}</>;
}

/* ===================== Кольца активности (несколько колец одно в другом) ===================== */

export function ActivityRings({
  rings,
  size = 150,
  stroke = 13,
  gap = 4,
  children,
}: {
  rings: { value: number; colors: [string, string] }[];
  size?: number;
  stroke?: number;
  gap?: number;
  children?: ReactNode;
}) {
  const id = useId().replace(/:/g, '');
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(t);
  }, []);
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          {rings.map((r, i) => (
            <linearGradient key={i} id={`${id}-${i}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={r.colors[0]} />
              <stop offset="100%" stopColor={r.colors[1]} />
            </linearGradient>
          ))}
        </defs>
        {rings.map((ring, i) => {
          const r = (size - stroke) / 2 - i * (stroke + gap);
          const c = 2 * Math.PI * r;
          const v = shown ? Math.max(0, Math.min(1, ring.value)) : 0;
          return (
            <g key={i}>
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={ring.colors[0]} strokeOpacity={0.16} strokeWidth={stroke} />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={`url(#${id}-${i})`}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={c * (1 - v)}
                opacity={v > 0.001 ? 1 : 0}
                style={{ transition: `stroke-dashoffset 1s cubic-bezier(.3,.9,.3,1) ${i * 0.08}s` }}
              />
            </g>
          );
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>{children}</div>
    </div>
  );
}
