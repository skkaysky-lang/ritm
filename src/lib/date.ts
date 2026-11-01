export const DAY = 86_400_000;

const pad = (n: number) => String(n).padStart(2, '0');

/** Ключ дня в локальном времени: YYYY-MM-DD */
export function dayKey(d: Date | number = new Date()): string {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

export function fromKey(k: string): Date {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(k: string, n: number): string {
  const d = fromKey(k);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

/** 0 = понедельник … 6 = воскресенье */
export function weekday(k: string): number {
  return (fromKey(k).getDay() + 6) % 7;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / DAY);
}

export const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export const WD_LONG = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
export const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

export function humanDay(k: string): string {
  const t = dayKey();
  if (k === t) return 'Сегодня';
  if (k === addDays(t, -1)) return 'Вчера';
  if (k === addDays(t, 1)) return 'Завтра';
  const d = fromKey(k);
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}

export function longDate(k: string = dayKey()): string {
  const d = fromKey(k);
  return `${WD_LONG[weekday(k)]}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}

export function fmtTime(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtMinutesOfDay(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

export function fmtDur(min: number): string {
  const total = Math.max(0, Math.round(min));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m} мин`;
  return m ? `${h} ч ${m} м` : `${h} ч`;
}

export function fmtDurShort(min: number): string {
  const total = Math.max(0, Math.round(min));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}:${pad(m)}`;
}

/** n последних дней, заканчивая end (включительно), по возрастанию */
export function lastDays(n: number, end: string = dayKey()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(end, -i));
  return out;
}

export function minutesOfDay(ms: number): number {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
}

export function parseHM(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
