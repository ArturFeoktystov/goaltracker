// Чистая бизнес-логика без зависимостей от хранилища и UI.
import { addDays, dateRange, diffDays } from './dates';
import type { DailyTask, Goal, ISODate, ProgressEntry, UnitType } from './types';

export const UNIT_LABELS: Record<UnitType, string> = {
  pages: 'страницы',
  km: 'км',
  hours: 'часы',
  minutes: 'минуты',
  reps: 'повторы',
  custom: 'своя единица',
  check: 'галочка',
};

const UNIT_SHORT: Record<UnitType, string> = {
  pages: 'стр.',
  km: 'км',
  hours: 'ч',
  minutes: 'мин',
  reps: 'раз',
  custom: '',
  check: '',
};

export function unitShort(goal: Pick<Goal, 'unit' | 'customUnit'>): string {
  return goal.unit === 'custom' ? goal.customUnit ?? '' : UNIT_SHORT[goal.unit];
}

export function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export function percent(ratio: number): number {
  return Math.round(clamp01(ratio) * 100);
}

/** Если для периодической цели без дедлайна задачи создаются на скользящее окно вперёд. */
export const ROLLING_WINDOW_DAYS = 14;

/** Сумма всех записей прогресса по цели. */
export function totalProgress(entries: ProgressEntry[]): number {
  return entries.reduce((s, e) => s + e.value, 0);
}

/** Накопительный прогресс: сумма записей / целевое значение (0..1). undefined — у цели нет общего объёма. */
export function cumulativeRatio(goal: Goal, entries: ProgressEntry[]): number | undefined {
  if (!goal.totalTarget) return undefined;
  return clamp01(totalProgress(entries) / goal.totalTarget);
}

/** Внесённое за день по цели. */
export function dayAmount(entries: ProgressEntry[], date: ISODate): number {
  return entries.filter((e) => e.date === date).reduce((s, e) => s + e.value, 0);
}

/** Дневной прогресс: внесённое за день / дневная норма (0..1). */
export function dailyRatio(goal: Goal, entries: ProgressEntry[], date: ISODate): number | undefined {
  if (!goal.dailyTarget) return undefined;
  return clamp01(dayAmount(entries, date) / goal.dailyTarget);
}

/** Процент выполнения дня: выполненные задачи / все задачи. */
export function dayCompletion(tasks: DailyTask[]): { done: number; total: number; ratio: number } {
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  return { done, total, ratio: total ? done / total : 0 };
}

/** Задача считается выполненной, когда достигнута дневная норма (или отмечена галочка). */
export function isTaskDone(task: Pick<DailyTask, 'target' | 'actual'>): boolean {
  return task.target ? task.actual >= task.target : task.actual > 0;
}

/** Дней до дедлайна (отрицательное — просрочено). */
export function daysLeft(goal: Goal, now: ISODate): number | undefined {
  return goal.deadline ? diffDays(now, goal.deadline) : undefined;
}

/**
 * Сколько нужно делать в день, чтобы успеть к дедлайну.
 * Учитывает сегодняшний день как доступный.
 */
export function requiredPace(goal: Goal, entries: ProgressEntry[], now: ISODate): number | undefined {
  if (!goal.totalTarget || !goal.deadline) return undefined;
  const remaining = goal.totalTarget - totalProgress(entries);
  if (remaining <= 0) return 0;
  const days = diffDays(now, goal.deadline) + 1;
  return days > 0 ? remaining / days : undefined;
}

/** Детерминированный id дневной задачи цели — защищает от дублей (в т.ч. при синхронизации). */
export function goalTaskId(goalId: string, date: ISODate): string {
  return `${goalId}_${date}`;
}

/**
 * Даты, на которые цель должна иметь дневные задачи.
 * С даты начала (но не раньше сегодня-создания) до дедлайна, или скользящее окно, если дедлайна нет.
 */
export function plannedTaskDates(goal: Goal, now: ISODate): ISODate[] {
  if (!goal.dailyTarget || goal.status !== 'active' || goal.deleted) return [];
  const from = goal.startDate;
  const to = goal.deadline ?? addDays(now, ROLLING_WINDOW_DAYS);
  if (to < from) return [];
  return dateRange(from, to);
}

export function formatValue(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ',');
}
