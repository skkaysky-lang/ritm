import { useState, type ReactNode } from 'react';
import { useWidth } from './ui';
import { haptic } from '../lib/telegram';
import { addDays, dayKey, fmtMinutesOfDay, weekday } from '../lib/date';

/* ===================== Столбики ===================== */

export interface BarDatum {
  key: string;
  label: string;
  value: number;
  color?: string;
}

export function Bars({
  data,
  goal,
  color = 'var(--accent)',
  color2,
  height = 140,
  format = (v) => String(Math.round(v)),
  goalLabel,
}: {
  data: BarDatum[];
  goal?: number;
  color?: string;
  color2?: string;
  height?: number;
  format?: (v: number) => ReactNode;
  goalLabel?: string;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const max = Math.max(goal ?? 0, ...data.map((d) => d.value), 1) * 1.12;
  const many = data.length > 14;
  const showLabel = (i: number) => !many || i % Math.ceil(data.length / 7) === (data.length - 1) % Math.ceil(data.length / 7);
  const active = sel != null ? data[sel] : null;
  return (
    <div>
      <div style={{ height: 22, marginBottom: 4 }} className="row-between small">
        {active ? (
          <>
            <span className="muted bold">{active.label}</span>
            <span className="bold num">{format(active.value)}</span>
          </>
        ) : (
          <span className="faint tiny">Нажми на столбик, чтобы увидеть значение</span>
        )}
      </div>
      <div style={{ position: 'relative', height }}>
        {goal ? (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${(goal / max) * 100}%`, borderTop: '1.5px dashed var(--text-3)', opacity: 0.6, zIndex: 1 }}>
            {goalLabel && (
              <span className="tiny bold faint" style={{ position: 'absolute', right: 0, top: -17 }}>
                {goalLabel}
              </span>
            )}
          </div>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%', gap: many ? 2 : 7 }}>
          {data.map((d, i) => {
            const h = d.value > 0 ? Math.max(3, (d.value / max) * 100) : 0;
            const isSel = sel === i;
            return (
              <button
                key={d.key}
                onClick={() => {
                  haptic.select();
                  setSel(isSel ? null : i);
                }}
                style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', minWidth: 0 }}
                aria-label={`${d.label}: ${d.value}`}
              >
                <div
                  style={{
                    width: '100%',
                    height: `${h}%`,
                    borderRadius: many ? 3 : 8,
                    background: d.color ?? `linear-gradient(180deg, ${color}, ${color2 ?? color})`,
                    opacity: sel == null || isSel ? 1 : 0.4,
                    transition: 'height .6s cubic-bezier(.3,.9,.3,1), opacity .2s',
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ display: 'flex', gap: many ? 2 : 7, marginTop: 6 }}>
        {data.map((d, i) => (
          <span key={d.key} className="tiny faint bold center" style={{ flex: 1, minWidth: 0, overflow: 'visible', whiteSpace: 'nowrap' }}>
            {showLabel(i) ? d.label : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ===================== Линия ===================== */

function smoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const t = 0.18;
    d += ` C${p1[0] + (p2[0] - p0[0]) * t},${p1[1] + (p2[1] - p0[1]) * t} ${p2[0] - (p3[0] - p1[0]) * t},${p2[1] - (p3[1] - p1[1]) * t} ${p2[0]},${p2[1]}`;
  }
  return d;
}

export function LineChart({
  points,
  trend,
  goal,
  color = 'var(--weight)',
  height = 150,
  format = (v) => v.toFixed(1),
  labels,
}: {
  points: { x: number; y: number; label: string }[];
  trend?: number[];
  goal?: number;
  color?: string;
  height?: number;
  format?: (v: number) => string;
  labels?: { x: number; text: string }[];
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [sel, setSel] = useState<number | null>(null);
  if (points.length === 0) return <div ref={ref} />;
  const ys = [...points.map((p) => p.y), ...(goal != null ? [goal] : [])];
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  if (maxY - minY < 1) {
    minY -= 0.5;
    maxY += 0.5;
  }
  const padY = (maxY - minY) * 0.15;
  minY -= padY;
  maxY += padY;
  const minX = points[0].x;
  const maxX = Math.max(points[points.length - 1].x, minX + 1);
  const px = 8;
  const top = 10;
  const bottom = 10;
  const X = (x: number) => px + ((x - minX) / (maxX - minX)) * (w - px * 2);
  const Y = (y: number) => top + (1 - (y - minY) / (maxY - minY)) * (height - top - bottom);
  const pts = points.map((p) => [X(p.x), Y(p.y)] as [number, number]);
  const line = smoothPath(pts);
  const area = `${line} L${pts[pts.length - 1][0]},${height} L${pts[0][0]},${height} Z`;
  const tr = trend ? smoothPath(trend.map((v, i) => [X(points[i].x), Y(v)] as [number, number])) : '';
  const s = sel != null ? points[sel] : null;
  return (
    <div ref={ref}>
      <div style={{ height: 22, marginBottom: 4 }} className="row-between small">
        {s ? (
          <>
            <span className="muted bold">{s.label}</span>
            <span className="bold num">{format(s.y)}</span>
          </>
        ) : (
          <span className="faint tiny">Нажми на график, чтобы увидеть значение</span>
        )}
      </div>
      <svg
        width={w}
        height={height}
        style={{ display: 'block', touchAction: 'pan-y' }}
        onPointerDown={(e) => {
          const r = (e.currentTarget as SVGElement).getBoundingClientRect();
          const x = e.clientX - r.left;
          let best = 0;
          pts.forEach((p, i) => Math.abs(p[0] - x) < Math.abs(pts[best][0] - x) && (best = i));
          haptic.select();
          setSel(best);
        }}
      >
        <defs>
          <linearGradient id="lc-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {goal != null && (
          <g>
            <line x1={0} x2={w} y1={Y(goal)} y2={Y(goal)} stroke="var(--good)" strokeDasharray="5 5" strokeWidth={1.5} opacity={0.8} />
            <text x={w - 4} y={Y(goal) - 5} textAnchor="end" fontSize="11" fontWeight="700" fill="var(--good)">
              цель {format(goal)}
            </text>
          </g>
        )}
        <path d={area} fill="url(#lc-fill)" />
        {tr && <path d={tr} fill="none" stroke="var(--text-2)" strokeWidth={1.5} strokeDasharray="3 4" opacity={0.7} />}
        <path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r={sel === i ? 6 : points.length > 20 ? 0 : 3.5} fill={sel === i ? color : 'var(--surface)'} stroke={color} strokeWidth={2} />
        ))}
        {s && sel != null && <line x1={pts[sel][0]} x2={pts[sel][0]} y1={0} y2={height} stroke={color} opacity={0.3} />}
      </svg>
      {labels && (
        <div style={{ position: 'relative', height: 16, marginTop: 4 }}>
          {labels.map((l, i) => (
            <span key={i} className="tiny faint bold" style={{ position: 'absolute', left: X(l.x), transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
              {l.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ===================== Когда спал (полосы от отбоя до подъёма) ===================== */

export function SleepRange({ nights, height = 170 }: { nights: { key: string; label: string; bed: number | null; wake: number | null }[]; height?: number }) {
  const valid = nights.filter((n) => n.bed != null && n.wake != null) as { key: string; label: string; bed: number; wake: number }[];
  const [sel, setSel] = useState<string | null>(null);
  if (!valid.length) return null;
  let lo = Math.floor((Math.min(...valid.map((n) => n.bed)) - 30) / 60) * 60;
  let hi = Math.ceil((Math.max(...valid.map((n) => n.wake)) + 30) / 60) * 60;
  if (hi - lo < 360) hi = lo + 360;
  const span = hi - lo;
  const ticks: number[] = [];
  const stepT = span > 720 ? 180 : 120;
  for (let t = lo; t <= hi; t += stepT) ticks.push(t);
  const pos = (m: number) => ((m - lo) / span) * 100;
  const many = nights.length > 14;
  const s = valid.find((n) => n.key === sel);
  return (
    <div>
      <div style={{ height: 22, marginBottom: 4 }} className="row-between small">
        {s ? (
          <>
            <span className="muted bold">{s.label}</span>
            <span className="bold num">
              {fmtMinutesOfDay(s.bed)} → {fmtMinutesOfDay(s.wake)}
            </span>
          </>
        ) : (
          <span className="faint tiny">Когда ты ложишься и встаёшь</span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ position: 'relative', width: 34, height }}>
          {ticks.map((t) => (
            <span key={t} className="tiny faint bold num" style={{ position: 'absolute', top: `${pos(t)}%`, transform: 'translateY(-50%)', right: 0 }}>
              {fmtMinutesOfDay(t)}
            </span>
          ))}
        </div>
        <div style={{ flex: 1, position: 'relative', height }}>
          {ticks.map((t) => (
            <div key={t} style={{ position: 'absolute', left: 0, right: 0, top: `${pos(t)}%`, borderTop: '1px solid var(--line)' }} />
          ))}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', gap: many ? 2 : 8 }}>
            {nights.map((n) => (
              <button key={n.key} style={{ flex: 1, position: 'relative', minWidth: 0 }} onClick={() => n.bed != null && (haptic.select(), setSel(sel === n.key ? null : n.key))}>
                {n.bed != null && n.wake != null && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: `${pos(n.bed)}%`,
                      height: `${pos(n.wake) - pos(n.bed)}%`,
                      borderRadius: many ? 3 : 8,
                      background: 'linear-gradient(180deg, var(--sleep), var(--sleep-2))',
                      opacity: sel == null || sel === n.key ? 1 : 0.35,
                      transition: 'opacity .2s',
                    }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: many ? 2 : 8, marginTop: 6, paddingLeft: 42 }}>
        {nights.map((n, i) => (
          <span key={n.key} className="tiny faint bold center" style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap' }}>
            {!many || i % 5 === (nights.length - 1) % 5 ? n.label : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ===================== Тепловая карта (как на GitHub) ===================== */

export function Heatmap({ weeks = 17, value, color }: { weeks?: number; value: (k: string) => number | null; color: string }) {
  const today = dayKey();
  const start = addDays(today, -weekday(today) - (weeks - 1) * 7);
  const cells: { k: string; v: number | null }[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const k = addDays(start, i);
    cells.push({ k, v: k > today ? null : value(k) });
  }
  return (
    <div className="heatmap" style={{ gridTemplateColumns: `repeat(${weeks}, 1fr)` }}>
      {cells.map((c) => (
        <i
          key={c.k}
          title={c.k}
          style={{
            background: c.v == null ? 'transparent' : c.v > 0 ? `color-mix(in srgb, ${color} ${Math.round(25 + c.v * 75)}%, transparent)` : undefined,
            outline: c.k === today ? '1.5px solid var(--text-2)' : undefined,
          }}
        />
      ))}
    </div>
  );
}
