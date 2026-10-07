import type { ISODate } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISODate(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function today(): ISODate {
  return toISODate(new Date());
}

export function addDays(s: ISODate, days: number): ISODate {
  const d = fromISODate(s);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Количество дней от a до b (b - a). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((fromISODate(b).getTime() - fromISODate(a).getTime()) / 86_400_000);
}

/** Все даты от from до to включительно. */
export function dateRange(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Понедельник недели, в которую входит дата. */
export function startOfWeek(s: ISODate): ISODate {
  const d = fromISODate(s);
  const shift = (d.getDay() + 6) % 7;
  return addDays(s, -shift);
}

export function startOfMonth(s: ISODate): ISODate {
  return s.slice(0, 8) + '01';
}

export function endOfMonth(s: ISODate): ISODate {
  const d = fromISODate(s);
  return toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

const fmtShort = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });
const fmtLong = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

export function formatShort(s: ISODate): string {
  return fmtShort.format(fromISODate(s)).replace('.', '');
}

export function formatLong(s: ISODate): string {
  return fmtLong.format(fromISODate(s));
}

export function pluralDays(n: number): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return 'дней';
  if (b === 1) return 'день';
  if (b >= 2 && b <= 4) return 'дня';
  return 'дней';
}
