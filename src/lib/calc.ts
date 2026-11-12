import type { Data, FoodEntry, Habit, Macros, Profile, SleepEntry } from '../store';
import { addDays, dayKey, lastDays, minutesOfDay, weekday } from './date';

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const round1 = (v: number) => Math.round(v * 10) / 10;
export const fmtNum = (n: number) => Math.round(n).toLocaleString('ru-RU');

/* ===================== Питание ===================== */

export const ACTIVITY = [
  { v: 1.2, title: 'Сидячий', hint: 'Офис, почти без спорта', emoji: '🪑' },
  { v: 1.375, title: 'Лёгкая активность', hint: 'Тренировки 1–3 раза в неделю', emoji: '🚶' },
  { v: 1.55, title: 'Средняя', hint: 'Тренировки 3–5 раз в неделю', emoji: '🏃' },
  { v: 1.725, title: 'Высокая', hint: '6–7 тренировок в неделю', emoji: '🏋️' },
  { v: 1.9, title: 'Очень высокая', hint: 'Физическая работа + спорт', emoji: '⚡' },
];

export function bmr(p: Pick<Profile, 'sex' | 'age' | 'height'>, weight: number) {
  return 10 * weight + 6.25 * p.height - 5 * p.age + (p.sex === 'm' ? 5 : -161);
}

export interface Targets extends Macros {
  bmr: number;
  tdee: number;
  water: number;
  deficit: number; // >0 дефицит, <0 профицит
}

export function targets(p: Profile, weight: number): Targets {
  const b = bmr(p, weight);
  const tdee = b * p.activity;
  const daily = (p.pace * 7700) / 7;
  let kcal = tdee;
  if (p.goal === 'lose') kcal = Math.max(tdee - daily, p.sex === 'm' ? 1500 : 1200);
  if (p.goal === 'gain') kcal = tdee + daily;
  if (p.kcalOverride) kcal = p.kcalOverride;
  kcal = Math.round(kcal / 10) * 10;
  const perKg = p.goal === 'lose' ? 2 : p.goal === 'gain' ? 1.8 : 1.6;
  const protein = Math.round(weight * perKg);
  const fat = Math.round(Math.max(weight * 0.9, (kcal * 0.25) / 9));
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  const water = p.waterGoal ?? Math.round((weight * 30) / 50) * 50;
  return { bmr: Math.round(b), tdee: Math.round(tdee), kcal, p: protein, f: fat, c: carbs, water, deficit: Math.round(tdee - kcal) };
}

export function sumMacros(list: Macros[]): Macros {
  return list.reduce((a, x) => ({ kcal: a.kcal + x.kcal, p: a.p + x.p, f: a.f + x.f, c: a.c + x.c }), { kcal: 0, p: 0, f: 0, c: 0 });
}

export function scaleMacros(per100: Macros, grams: number): Macros {
  const k = grams / 100;
  return { kcal: Math.round(per100.kcal * k), p: round1(per100.p * k), f: round1(per100.f * k), c: round1(per100.c * k) };
}

export function dayFood(d: Data, day: string): FoodEntry[] {
  return d.food[day] ?? [];
}

export function currentWeight(d: Data): number {
  const keys = Object.keys(d.weights).sort();
  return keys.length ? d.weights[keys[keys.length - 1]] : d.profile.weight;
}

/** Норма на конкретный день (с учётом шагов, если включено) */
export function dayTargets(d: Data, day: string): Targets {
  const w = currentWeight(d);
  const t = targets(d.profile, w);
  if (d.profile.addActivity) {
    const extra = Math.max(0, (d.steps[day] ?? 0) - 4000);
    const bonus = Math.round(stepsKcal(extra, w) / 10) * 10;
    return { ...t, kcal: t.kcal + bonus, c: t.c + Math.round(bonus / 4) };
  }
  return t;
}

/* ===================== Шаги ===================== */

export function stepsKm(steps: number, p: Profile) {
  const stride = p.height * (p.sex === 'm' ? 0.415 : 0.413);
  return (steps * stride) / 100_000;
}
export function stepsKcal(steps: number, weight: number) {
  return steps * weight * 0.0005;
}
export function stepsMinutes(steps: number) {
  return steps / 100;
}

/* ===================== Сон ===================== */

export const sleepMin = (s: SleepEntry) => (s.end - s.start) / 60_000;

/** Дневной сон: помечен явно, либо это короткий сон днём (для записей без пометки) */
export function isNap(s: SleepEntry): boolean {
  if (s.nap != null) return s.nap;
  const h = new Date(s.start).getHours();
  return sleepMin(s) < 180 && h >= 9 && h < 20;
}

export interface DaySleep {
  main: SleepEntry | null; // основной ночной сон
  naps: SleepEntry[];
  night: number; // минут ночью
  nap: number; // минут днём
  total: number;
}

/** Сон по дням пробуждения: ночной (самый длинный — основной) и дневной отдельно */
export function nightsByDay(sleeps: SleepEntry[]): Record<string, DaySleep> {
  const out: Record<string, DaySleep> = {};
  for (const s of sleeps) {
    const d = (out[dayKey(s.end)] ??= { main: null, naps: [], night: 0, nap: 0, total: 0 });
    const m = sleepMin(s);
    d.total += m;
    if (isNap(s)) {
      d.naps.push(s);
      d.nap += m;
    } else {
      d.night += m;
      if (!d.main || m > sleepMin(d.main)) d.main = s;
    }
  }
  return out;
}

/** Оценка ночи 0–100. extraMin — дневной сон, он частично закрывает недосып. */
export function sleepScore(s: SleepEntry, goalH: number, extraMin = 0): number {
  const h = (sleepMin(s) + extraMin * 0.7) / 60;
  const diff = h - goalH;
  const dur = clamp(100 - (diff < 0 ? -diff * 22 : diff * 10), 0, 100);
  const q = s.quality ? ((s.quality - 1) / 4) * 100 : dur;
  return Math.round(dur * 0.65 + q * 0.35);
}

export function scoreLabel(v: number) {
  if (v >= 85) return 'Отлично';
  if (v >= 70) return 'Хорошо';
  if (v >= 50) return 'Так себе';
  return 'Плохо';
}

/** Варианты отбоя, чтобы встать в wake (мин. от полуночи). 15 мин — засыпание. */
export function bedtimesFor(wakeMin: number) {
  return [6, 5, 4, 3].map((c) => ({ cycles: c, at: wakeMin - c * 90 - 15, hours: (c * 90) / 60 }));
}
export function wakeTimesFrom(startMin: number) {
  return [3, 4, 5, 6].map((c) => ({ cycles: c, at: startMin + 15 + c * 90, hours: (c * 90) / 60 }));
}

/** Время отхода ко сну в «минутах вечера»: 23:00 → 1380, 01:00 → 1500 */
export function bedMinutes(ms: number) {
  const m = minutesOfDay(ms);
  return m < 15 * 60 ? m + 1440 : m;
}

function std(arr: number[]) {
  if (arr.length < 2) return 0;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length);
}

export interface SleepStats {
  nights: number;
  avg: number; // минут в сутки, вместе с дневным сном
  avgNight: number;
  debt: number; // минут за 7 дней
  consistency: number; // 0–100
  avgBed: number | null; // минут вечера
  avgWake: number | null;
  avgScore: number;
  naps: number; // сколько раз спал днём за период
  napAvg: number; // средняя длина дневного сна
}

export function sleepStats(d: Data, days = 7): SleepStats {
  const map = nightsByDay(d.sleeps);
  const all = lastDays(days);
  const keys = all.filter((k) => map[k]?.main);
  const mains = keys.map((k) => map[k].main!);
  const goal = d.profile.sleepGoal * 60;
  const avg = keys.length ? keys.reduce((a, k) => a + map[k].total, 0) / keys.length : 0;
  const avgNight = keys.length ? keys.reduce((a, k) => a + map[k].night, 0) / keys.length : 0;
  const debt = lastDays(7).reduce((a, k) => a + (map[k]?.main ? Math.max(0, goal - map[k].total) : 0), 0);
  const beds = mains.map((s) => bedMinutes(s.start));
  const wakes = mains.map((s) => minutesOfDay(s.end));
  const sd = (std(beds) + std(wakes)) / 2;
  const naps = all.flatMap((k) => map[k]?.naps ?? []);
  return {
    nights: keys.length,
    avg,
    avgNight,
    debt,
    consistency: mains.length >= 2 ? Math.round(clamp(100 - sd * 1.1, 0, 100)) : 0,
    avgBed: beds.length ? beds.reduce((a, b) => a + b, 0) / beds.length : null,
    avgWake: wakes.length ? wakes.reduce((a, b) => a + b, 0) / wakes.length : null,
    avgScore: keys.length ? Math.round(keys.reduce((a, k) => a + sleepScore(map[k].main!, d.profile.sleepGoal, map[k].nap), 0) / keys.length) : 0,
    naps: naps.length,
    napAvg: naps.length ? naps.reduce((a, s) => a + sleepMin(s), 0) / naps.length : 0,
  };
}

/* ===================== Привычки ===================== */

export const isScheduled = (h: Habit, k: string) => h.days.includes(weekday(k));
export const habitCount = (d: Data, k: string, id: string) => d.habitLog[k]?.[id] ?? 0;
export const habitDone = (d: Data, k: string, h: Habit) => habitCount(d, k, h.id) >= h.target;

export function habitStreak(d: Data, h: Habit, today = dayKey()): number {
  let k = today;
  let n = 0;
  const created = dayKey(h.createdAt);
  if (!habitDone(d, k, h)) k = addDays(k, -1);
  for (let i = 0; i < 1000 && k >= created; i++) {
    if (isScheduled(h, k)) {
      if (habitDone(d, k, h)) n++;
      else break;
    }
    k = addDays(k, -1);
  }
  return n;
}

export function habitBestStreak(d: Data, h: Habit): number {
  let best = 0;
  let cur = 0;
  let k = dayKey(h.createdAt);
  const today = dayKey();
  for (let i = 0; i < 2000 && k <= today; i++) {
    if (isScheduled(h, k)) {
      if (habitDone(d, k, h)) best = Math.max(best, ++cur);
      else if (k !== today) cur = 0;
    }
    k = addDays(k, 1);
  }
  return best;
}

/** Доля выполненных запланированных дней (с даты создания) */
export function habitRate(d: Data, h: Habit, days = 30): number {
  const created = dayKey(h.createdAt);
  const list = lastDays(days).filter((k) => k >= created && isScheduled(h, k));
  if (!list.length) return 0;
  return list.filter((k) => habitDone(d, k, h)).length / list.length;
}

export function dayHabitProgress(d: Data, k: string): { done: number; total: number } {
  const list = d.habits.filter((h) => !h.archived && isScheduled(h, k) && dayKey(h.createdAt) <= k);
  return { done: list.filter((h) => habitDone(d, k, h)).length, total: list.length };
}

/* ===================== Общее ===================== */

export function linearSlope(pts: { x: number; y: number }[]): number {
  if (pts.length < 2) return 0;
  const n = pts.length;
  const mx = pts.reduce((a, p) => a + p.x, 0) / n;
  const my = pts.reduce((a, p) => a + p.y, 0) / n;
  const num = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0);
  const den = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0);
  return den ? num / den : 0;
}

export function movingAvg(vals: number[], w: number): number[] {
  return vals.map((_, i) => {
    const s = vals.slice(Math.max(0, i - w + 1), i + 1);
    return s.reduce((a, b) => a + b, 0) / s.length;
  });
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

/* ===================== Индекс дня ===================== */

export interface DayScore {
  sleep: number | null; // 0…1, null — нет данных
  food: number | null;
  water: number;
  steps: number;
  habits: number | null;
  score: number; // 0…100
}

/** Насколько день «закрыт»: сон, питание, вода, шаги, привычки */
export function dayScore(d: Data, day: string): DayScore {
  const t = dayTargets(d, day);
  const ns = nightsByDay(d.sleeps)[day];
  const sleep = ns?.main ? clamp(ns.total / (d.profile.sleepGoal * 60), 0, 1) : null;
  const eaten = sumMacros(d.food[day] ?? []).kcal;
  const r = eaten / t.kcal;
  // попадание в норму ±10% = 100%; и недобор, и перебор снижают оценку
  const food = eaten === 0 ? null : r <= 1.1 ? clamp(r / 0.9, 0, 1) : clamp(1 - (r - 1.1) * 2, 0, 1);
  const water = clamp((d.water[day] ?? 0) / t.water, 0, 1);
  const steps = clamp((d.steps[day] ?? 0) / d.profile.stepGoal, 0, 1);
  const hp = dayHabitProgress(d, day);
  const habits = hp.total ? hp.done / hp.total : null;
  const parts = [sleep ?? 0, food ?? 0, water, steps, ...(habits != null ? [habits] : [])];
  return { sleep, food, water, steps, habits, score: Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100) };
}

/** Сколько дней подряд есть хоть одна запись */
export function activeStreak(d: Data): number {
  const days = new Set<string>();
  for (const k in d.food) if (d.food[k].length) days.add(k);
  for (const k in d.water) if (d.water[k] > 0) days.add(k);
  for (const k in d.steps) if (d.steps[k] > 0) days.add(k);
  for (const k in d.habitLog) if (Object.keys(d.habitLog[k]).length) days.add(k);
  for (const k in d.mood) days.add(k);
  for (const k in d.weights) days.add(k);
  for (const s of d.sleeps) days.add(dayKey(s.end));
  for (const t of d.txns) days.add(t.day);
  let k = dayKey();
  if (!days.has(k)) k = addDays(k, -1);
  let n = 0;
  while (days.has(k)) {
    n++;
    k = addDays(k, -1);
  }
  return n;
}
