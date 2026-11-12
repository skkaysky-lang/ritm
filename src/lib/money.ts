import type { Data, Fin, FinCat, Sub, Txn } from '../store';
import { EXP_CATS, INC_CATS } from '../data/finance';
import { addDays, dayKey, daysBetween } from './date';

/* ===================== Формат ===================== */

export function fmtMoney(n: number, cur: string, sign = false): string {
  const abs = Math.abs(n);
  const frac = Math.abs(abs - Math.round(abs)) > 0.004 && abs < 10000;
  const body = abs.toLocaleString('ru-RU', { minimumFractionDigits: frac ? 2 : 0, maximumFractionDigits: frac ? 2 : 0 });
  const s = n < 0 ? '−' : sign && n > 0 ? '+' : '';
  return `${s}${body} ${cur}`;
}

/** Коротко для тесных мест: 12,4 тыс */
export function fmtShort(n: number): string {
  const a = Math.abs(n);
  const one = (v: number) => v.toFixed(1).replace('.', ',').replace(',0', '');
  if (a >= 1_000_000) return one(n / 1_000_000) + ' млн';
  if (a >= 10_000) return Math.round(n / 1000) + ' тыс';
  if (a >= 1000) return one(n / 1000) + ' тыс';
  return String(Math.round(n));
}

/** «250+120,50» → 370.5. Понимает плюс и минус, запятую и точку. */
export function parseAmount(text: string): number {
  const parts = text.replace(/,/g, '.').match(/[+-]?\d*\.?\d+/g);
  if (!parts) return 0;
  const sum = parts.reduce((a, p) => a + Number(p), 0);
  return Number.isFinite(sum) ? Math.max(0, Math.round(sum * 100) / 100) : 0;
}

/* ===================== Категории ===================== */

export function allCats(fin: Fin, type: 'exp' | 'inc'): FinCat[] {
  return [...(type === 'exp' ? EXP_CATS : INC_CATS), ...fin.customCats.filter((c) => c.type === type)];
}

export function catById(fin: Fin, id: string): FinCat {
  return [...EXP_CATS, ...INC_CATS, ...fin.customCats].find((c) => c.id === id) ?? EXP_CATS[EXP_CATS.length - 1];
}

/** Категории в порядке «чаще используешь — выше» */
export function catsByUsage(d: Data, type: 'exp' | 'inc'): FinCat[] {
  const from = addDays(dayKey(), -90);
  const cnt: Record<string, number> = {};
  for (const t of d.txns) if (t.type === type && t.day >= from) cnt[t.cat] = (cnt[t.cat] ?? 0) + 1;
  return allCats(d.fin, type)
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (cnt[b.c.id] ?? 0) - (cnt[a.c.id] ?? 0) || a.i - b.i)
    .map((x) => x.c);
}

/* ===================== Месяцы ===================== */

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

export const monthOf = (day: string) => day.slice(0, 7);
export const curMonth = () => monthOf(dayKey());

export function monthLabel(m: string): string {
  const [y, mm] = m.split('-').map(Number);
  return `${MONTHS[mm - 1]}${y === new Date().getFullYear() ? '' : ' ' + y}`;
}

export function addMonths(m: string, n: number): string {
  const [y, mm] = m.split('-').map(Number);
  const d = new Date(y, mm - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function daysIn(m: string): number {
  const [y, mm] = m.split('-').map(Number);
  return new Date(y, mm, 0).getDate();
}

/* ===================== Статистика месяца ===================== */

export interface MonthStats {
  exp: number;
  inc: number;
  balance: number;
  byCat: { cat: FinCat; sum: number; share: number; count: number }[];
  byDay: number[]; // расходы по дням месяца, индекс 0 = 1-е число
  count: number;
  daysPassed: number; // сколько дней месяца уже прошло, включая сегодня
  daysTotal: number;
  avgPerDay: number;
  noSpendDays: number;
  biggest: Txn | null;
  forecast: number; // расходы к концу месяца при текущем темпе
}

export function monthStats(d: Data, m: string): MonthStats {
  const list = d.txns.filter((t) => monthOf(t.day) === m);
  const exps = list.filter((t) => t.type === 'exp');
  const exp = exps.reduce((a, t) => a + t.amount, 0);
  const inc = list.filter((t) => t.type === 'inc').reduce((a, t) => a + t.amount, 0);
  const daysTotal = daysIn(m);
  const cur = curMonth();
  const daysPassed = m < cur ? daysTotal : m > cur ? 0 : new Date().getDate();
  const byDay = Array.from({ length: daysTotal }, () => 0);
  const sums: Record<string, { sum: number; count: number }> = {};
  for (const t of exps) {
    byDay[Number(t.day.slice(8)) - 1] += t.amount;
    const s = (sums[t.cat] ??= { sum: 0, count: 0 });
    s.sum += t.amount;
    s.count++;
  }
  const byCat = Object.entries(sums)
    .map(([id, s]) => ({ cat: catById(d.fin, id), sum: s.sum, count: s.count, share: exp ? s.sum / exp : 0 }))
    .sort((a, b) => b.sum - a.sum);
  const avgPerDay = daysPassed ? exp / daysPassed : 0;
  return {
    exp,
    inc,
    balance: inc - exp,
    byCat,
    byDay,
    count: list.length,
    daysPassed,
    daysTotal,
    avgPerDay,
    noSpendDays: byDay.slice(0, daysPassed).filter((v) => v === 0).length,
    biggest: exps.reduce<Txn | null>((a, t) => (!a || t.amount > a.amount ? t : a), null),
    forecast: m === cur ? avgPerDay * daysTotal : exp,
  };
}

export interface Allowance {
  budget: number;
  spent: number;
  left: number; // остаток бюджета на месяц
  perDay: number; // лимит на сегодня
  todaySpent: number;
  todayLeft: number;
  daysLeft: number; // включая сегодня
}

/** Сколько можно тратить в день, чтобы уложиться в бюджет месяца */
export function allowance(d: Data): Allowance | null {
  const budget = d.fin.budget;
  if (!budget) return null;
  const today = dayKey();
  const m = monthOf(today);
  let spent = 0;
  let todaySpent = 0;
  for (const t of d.txns) {
    if (t.type !== 'exp' || monthOf(t.day) !== m) continue;
    spent += t.amount;
    if (t.day === today) todaySpent += t.amount;
  }
  const daysLeft = daysIn(m) - new Date().getDate() + 1;
  const perDay = Math.max(0, (budget - (spent - todaySpent)) / daysLeft);
  return { budget, spent, left: budget - spent, perDay, todaySpent, todayLeft: perDay - todaySpent, daysLeft };
}

export function daySpent(d: Data, day: string): number {
  return d.txns.reduce((a, t) => (t.type === 'exp' && t.day === day ? a + t.amount : a), 0);
}

/* ===================== Регулярные платежи и копилки ===================== */

export function subStatus(sub: Sub, today = dayKey()): { due: string; inDays: number; paid: boolean } {
  const m = monthOf(today);
  const paid = sub.lastPaid === m;
  const target = paid ? addMonths(m, 1) : m;
  const dom = Math.min(sub.dom, daysIn(target));
  const due = `${target}-${String(dom).padStart(2, '0')}`;
  return { due, inDays: daysBetween(today, due), paid };
}

export const subsMonthly = (d: Data) => d.subs.reduce((a, s) => a + s.amount, 0);

/** Сколько откладывать в месяц, чтобы успеть к дедлайну */
export function potMonthly(target: number, saved: number, deadline?: string): number | null {
  if (!deadline) return null;
  const days = daysBetween(dayKey(), deadline);
  if (days <= 0) return null;
  return Math.max(0, (target - saved) / Math.max(1, days / 30.4));
}

/** Велись ли записи в этом месяце с самого начала (иначе сравнивать с ним нечестно) */
export function trackedFromStart(d: Data, m: string): boolean {
  return d.txns.some((t) => t.type === 'exp' && monthOf(t.day) === m && Number(t.day.slice(8)) <= 7);
}
