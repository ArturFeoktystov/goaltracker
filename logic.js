// Бизнес-правила: чистые функции без хранилища и интерфейса.
//
// Модель данных (у каждой записи есть id, updatedAt и deleted — для будущей синхронизации):
//   Goal          { title, description?, unit, customUnit?, totalTarget?, dailyTarget?,
//                   startDate, deadline?, status: "active"|"completed"|"archived", createdAt, completedAt? }
//   DailyTask     { goalId?, title, date, target?, actual, done }   — target пустой = простой чекбокс
//   ProgressEntry { goalId, date, value, taskId?, note? }

import { addDays, dateRange, diffDays } from "./dates.js";

export const UNITS = {
  pages: { label: "pages", short: "pages" },
  km: { label: "km", short: "km" },
  hours: { label: "hours", short: "h" },
  minutes: { label: "minutes", short: "min" },
  reps: { label: "reps", short: "reps" },
  custom: { label: "custom", short: "" },
  check: { label: "checkbox", short: "" },
};

/** Для цели без дедлайна дневные задачи создаются на столько дней вперёд. */
export const ROLLING_WINDOW_DAYS = 14;

export function unitShort(goal) {
  return goal.unit === "custom" ? goal.customUnit ?? "" : UNITS[goal.unit].short;
}

export const clamp01 = (x) => Math.max(0, Math.min(1, x));
export const percent = (ratio) => Math.round(clamp01(ratio) * 100);

export function formatValue(v) {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** Сумма всех записей прогресса. */
export function totalProgress(entries) {
  return entries.reduce((s, e) => s + e.value, 0);
}

/** Накопительный прогресс 0..1: сумма записей / целевое значение. undefined — у цели нет общего объёма. */
export function cumulativeRatio(goal, entries) {
  if (!goal.totalTarget) return undefined;
  return clamp01(totalProgress(entries) / goal.totalTarget);
}

/** Внесённое за день. */
export function dayAmount(entries, date) {
  return entries.filter((e) => e.date === date).reduce((s, e) => s + e.value, 0);
}

/**
 * Норма на день. Если дневная норма не задана, но есть общий объём и дедлайн, —
 * темп: остаток на начало дня / дни до дедлайна (сегодня включительно).
 * Прогресс за сам день норму не меняет, поэтому отметка «сделано» не прыгает.
 */
export function effectiveDailyTarget(goal, entries, date) {
  if (goal.dailyTarget) return goal.dailyTarget;
  if (!isPaceGoal(goal)) return undefined;
  const days = diffDays(date, goal.deadline) + 1;
  const remaining = goal.totalTarget - totalProgress(entries.filter((e) => e.date < date));
  if (days <= 0 || remaining <= 0) return undefined;
  const pace = remaining / days;
  // целые единицы — округляем вверх до целого, км и часы — до десятых
  return goal.unit === "km" || goal.unit === "hours" ? Math.ceil(pace * 10) / 10 : Math.ceil(pace);
}

/** Цель с общим объёмом и дедлайном, но без дневной нормы: норма на день считается по темпу. */
export function isPaceGoal(goal) {
  return !goal.dailyTarget && !!goal.totalTarget && !!goal.deadline && goal.unit !== "check";
}

/** Дневной прогресс 0..1: внесённое за день / норма на день. */
export function dailyRatio(goal, entries, date) {
  const target = effectiveDailyTarget(goal, entries, date);
  if (!target) return undefined;
  return clamp01(dayAmount(entries, date) / target);
}

/** Процент выполнения дня: выполненные задачи / все задачи. */
export function dayCompletion(tasks) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  return { done, total, ratio: total ? done / total : 0 };
}

/** Задача выполнена, когда достигнута норма (или отмечен чекбокс). */
export function isTaskDone(task) {
  return task.target ? task.actual >= task.target : task.actual > 0;
}

/** Дней до дедлайна; отрицательное — просрочено. */
export function daysLeft(goal, now) {
  return goal.deadline ? diffDays(now, goal.deadline) : undefined;
}

/** Сколько нужно делать в день, чтобы успеть к дедлайну (сегодня тоже считается). */
export function requiredPace(goal, entries, now) {
  if (!goal.totalTarget || !goal.deadline) return undefined;
  const remaining = goal.totalTarget - totalProgress(entries);
  if (remaining <= 0) return 0;
  const days = diffDays(now, goal.deadline) + 1;
  return days > 0 ? remaining / days : undefined;
}

/** Детерминированный id дневной задачи цели — дублей не бывает, в том числе при синхронизации. */
export function goalTaskId(goalId, date) {
  return `${goalId}_${date}`;
}

/**
 * Даты, на которые у цели должны быть дневные задачи:
 * с дневной нормой — от начала до дедлайна (или на окно вперёд);
 * с темпом — от сегодня до дедлайна (прошлые дни норму задним числом не получают).
 */
export function plannedTaskDates(goal, now) {
  if (goal.status !== "active" || goal.deleted) return [];
  if (goal.dailyTarget) {
    const to = goal.deadline ?? addDays(now, ROLLING_WINDOW_DAYS);
    return to < goal.startDate ? [] : dateRange(goal.startDate, to);
  }
  if (isPaceGoal(goal)) {
    const from = goal.startDate > now ? goal.startDate : now;
    return goal.deadline < from ? [] : dateRange(from, goal.deadline);
  }
  return [];
}
