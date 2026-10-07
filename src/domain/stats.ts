import { addDays, dateRange, endOfMonth, startOfMonth, startOfWeek } from './dates';
import { dayCompletion } from './logic';
import type { DailyTask, Goal, ISODate, ProgressEntry } from './types';

export type PeriodKind = 'week' | 'month';

export interface Period {
  from: ISODate;
  to: ISODate;
}

/** Период, сдвинутый на offset недель/месяцев относительно текущего. */
export function periodFor(kind: PeriodKind, today: ISODate, offset: number): Period {
  if (kind === 'week') {
    const from = addDays(startOfWeek(today), offset * 7);
    return { from, to: addDays(from, 6) };
  }
  const [y, m] = today.split('-').map(Number);
  const d = new Date(y, m - 1 + offset, 1);
  const anchor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
}

export function previousPeriod(kind: PeriodKind, p: Period): Period {
  if (kind === 'week') return { from: addDays(p.from, -7), to: addDays(p.to, -7) };
  const prevEnd = addDays(p.from, -1);
  return { from: startOfMonth(prevEnd), to: prevEnd };
}

export interface DayStat {
  date: ISODate;
  done: number;
  total: number;
  /** null — задач в этот день не было (или день ещё не наступил). */
  percent: number | null;
}

export interface PeriodStats {
  days: DayStat[];
  done: number;
  total: number;
  ratio: number | null;
  goalsCompleted: Goal[];
  progressByGoal: { goal: Goal; amount: number }[];
}

/** Агрегация за период. Будущие дни не учитываются, чтобы не занижать процент. */
export function computePeriodStats(
  period: Period,
  today: ISODate,
  tasks: DailyTask[],
  goals: Goal[],
  entries: ProgressEntry[],
): PeriodStats {
  const byDate = new Map<ISODate, DailyTask[]>();
  for (const t of tasks) {
    if (t.date < period.from || t.date > period.to) continue;
    byDate.set(t.date, [...(byDate.get(t.date) ?? []), t]);
  }

  let done = 0;
  let total = 0;
  const days = dateRange(period.from, period.to).map((date): DayStat => {
    if (date > today) return { date, done: 0, total: 0, percent: null };
    const c = dayCompletion(byDate.get(date) ?? []);
    done += c.done;
    total += c.total;
    return { date, done: c.done, total: c.total, percent: c.total ? Math.round(c.ratio * 100) : null };
  });

  const inPeriod = (ts: number) => {
    const d = new Date(ts);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return iso >= period.from && iso <= period.to;
  };
  const goalsCompleted = goals.filter((g) => g.status === 'completed' && g.completedAt && inPeriod(g.completedAt));

  const amounts = new Map<string, number>();
  for (const e of entries) {
    if (e.date >= period.from && e.date <= period.to) amounts.set(e.goalId, (amounts.get(e.goalId) ?? 0) + e.value);
  }
  const progressByGoal = goals
    .filter((g) => amounts.has(g.id))
    .map((goal) => ({ goal, amount: amounts.get(goal.id)! }))
    .sort((a, b) => b.amount - a.amount);

  return { days, done, total, ratio: total ? done / total : null, goalsCompleted, progressByGoal };
}
