// Статистика за неделю или месяц.

import { addDays, dateOfTimestamp, dateRange, endOfMonth, startOfMonth, startOfWeek, toISODate } from "./dates.js";
import { dayCompletion } from "./logic.js";

/** Период ("week" | "month"), сдвинутый на offset недель/месяцев от текущего. */
export function periodFor(kind, today, offset) {
  if (kind === "week") {
    const from = addDays(startOfWeek(today), offset * 7);
    return { from, to: addDays(from, 6) };
  }
  const [y, m] = today.split("-").map(Number);
  const anchor = toISODate(new Date(y, m - 1 + offset, 1));
  return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
}

export function previousPeriod(kind, p) {
  if (kind === "week") return { from: addDays(p.from, -7), to: addDays(p.to, -7) };
  const prevEnd = addDays(p.from, -1);
  return { from: startOfMonth(prevEnd), to: prevEnd };
}

/**
 * Агрегация за период. Будущие дни не учитываются, чтобы не занижать процент.
 * days[i].percent === null — в этот день задач не было (или он ещё не наступил).
 */
export function computePeriodStats(period, today, tasks, goals, entries) {
  const byDate = new Map();
  for (const t of tasks) {
    if (t.date < period.from || t.date > period.to) continue;
    byDate.set(t.date, [...(byDate.get(t.date) ?? []), t]);
  }

  let done = 0;
  let total = 0;
  const days = dateRange(period.from, period.to).map((date) => {
    if (date > today) return { date, done: 0, total: 0, percent: null };
    const c = dayCompletion(byDate.get(date) ?? []);
    done += c.done;
    total += c.total;
    return { date, done: c.done, total: c.total, percent: c.total ? Math.round(c.ratio * 100) : null };
  });

  const inPeriod = (d) => d >= period.from && d <= period.to;
  const goalsCompleted = goals.filter((g) => g.status === "completed" && g.completedAt && inPeriod(dateOfTimestamp(g.completedAt)));

  const amounts = new Map();
  for (const e of entries) {
    if (inPeriod(e.date)) amounts.set(e.goalId, (amounts.get(e.goalId) ?? 0) + e.value);
  }
  const progressByGoal = goals
    .filter((g) => amounts.has(g.id))
    .map((goal) => ({ goal, amount: amounts.get(goal.id) }))
    .sort((a, b) => b.amount - a.amount);

  return { days, done, total, ratio: total ? done / total : null, goalsCompleted, progressByGoal };
}
