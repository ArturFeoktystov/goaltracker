// Сценарии работы с целями, задачами и прогрессом. Знает только интерфейс хранилища (см. db.js).
//
// Публичные методы, которые что-то меняют, выполняются строго по очереди (#exclusive),
// поэтому быстрые нажатия «+» не перетирают друг друга. Внутренние _методы вызываются уже под очередью.

import { today as todayFn } from "./dates.js";
import { effectiveDailyTarget, goalTaskId, isTaskDone, plannedTaskDates, totalProgress } from "./logic.js";

export function newId() {
  // randomUUID есть только в защищённом контексте (https или localhost)
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

const entryIdForTask = (taskId) => `entry_${taskId}`;
const byTitle = (a, b) => a.title.localeCompare(b.title, "ru");

function normalizeInput(input) {
  const g = { ...input, title: input.title.trim(), description: input.description?.trim() || undefined };
  if (g.unit !== "custom") g.customUnit = undefined;
  if (g.unit === "check" && g.dailyTarget) g.dailyTarget = 1;
  if (!(g.totalTarget > 0)) g.totalTarget = undefined;
  if (!(g.dailyTarget > 0)) g.dailyTarget = undefined;
  if (!g.deadline) g.deadline = undefined;
  return g;
}

export class GoalService {
  #queue = Promise.resolve();

  constructor(store, now = todayFn) {
    this.store = store;
    this.now = now;
  }

  #exclusive(fn) {
    const run = this.#queue.then(fn);
    this.#queue = run.catch(() => {});
    return run;
  }

  subscribe(listener) {
    return this.store.subscribe(listener);
  }

  // ---------- Чтение ----------

  async listGoals() {
    return (await this.store.goals.all()).sort((a, b) => b.createdAt - a.createdAt);
  }

  async getGoal(id) {
    const g = await this.store.goals.get(id);
    return g && !g.deleted ? g : undefined;
  }

  /** Задачи дня: сначала по целям, затем разовые. */
  async tasksForDate(date) {
    const tasks = await this.store.tasks.where("date", date);
    return tasks.sort((a, b) => Number(!a.goalId) - Number(!b.goalId) || byTitle(a, b));
  }

  tasksInRange(from, to) {
    return this.store.tasks.between("date", from, to);
  }

  async entriesForGoal(goalId) {
    const entries = await this.store.entries.where("goalId", goalId);
    return entries.sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt);
  }

  allEntries() {
    return this.store.entries.all();
  }

  // ---------- Цели ----------

  createGoal(input) {
    return this.#exclusive(async () => {
      const ts = Date.now();
      const goal = { ...normalizeInput(input), id: newId(), status: "active", createdAt: ts, updatedAt: ts };
      await this.store.goals.put(goal);
      await this._syncGoalTasks(goal);
      return goal;
    });
  }

  updateGoal(id, input) {
    return this.#exclusive(async () => {
      const goal = await this.getGoal(id);
      if (!goal) return;
      const updated = { ...goal, ...normalizeInput(input), updatedAt: Date.now() };
      await this.store.goals.put(updated);
      await this._syncGoalTasks(updated);
    });
  }

  setGoalStatus(id, status) {
    return this.#exclusive(() => this._setGoalStatus(id, status));
  }

  deleteGoal(id) {
    return this.#exclusive(async () => {
      const goal = await this.getGoal(id);
      if (!goal) return;
      const ts = Date.now();
      const remove = (x) => ({ ...x, deleted: true, updatedAt: ts });
      await this.store.goals.put(remove(goal));
      await this.store.tasks.bulkPut((await this.store.tasks.where("goalId", id)).map(remove));
      await this.store.entries.bulkPut((await this.store.entries.where("goalId", id)).map(remove));
    });
  }

  /** При запуске и смене дня: досоздаёт дневные задачи для всех активных целей. */
  ensureDailyTasks() {
    return this.#exclusive(async () => {
      for (const g of await this.store.goals.where("status", "active")) await this._syncGoalTasks(g);
    });
  }

  async _setGoalStatus(id, status) {
    const goal = await this.getGoal(id);
    if (!goal || goal.status === status) return;
    const updated = {
      ...goal,
      status,
      completedAt: status === "completed" ? Date.now() : undefined,
      updatedAt: Date.now(),
    };
    await this.store.goals.put(updated);
    await this._syncGoalTasks(updated);
  }

  /**
   * Приводит дневные задачи цели к плану: создаёт недостающие, восстанавливает удалённые
   * сегодняшние и будущие, убирает будущие пустые задачи, которых больше нет в плане,
   * и обновляет название и норму в сегодняшних и будущих задачах (у цели с темпом норма
   * пересчитывается каждый день).
   */
  async _syncGoalTasks(goal) {
    const today = this.now();
    const planned = plannedTaskDates(goal, today);
    const plannedSet = new Set(planned);
    const ts = Date.now();
    const entries = await this.store.entries.where("goalId", goal.id);
    const target = goal.unit === "check" ? undefined : effectiveDailyTarget(goal, entries, today);

    const existing = await this.store.tasks.bulkGet(planned.map((d) => goalTaskId(goal.id, d)));
    const changed = new Map();
    planned.forEach((date, i) => {
      const t = existing[i];
      if (!t) {
        changed.set(goalTaskId(goal.id, date), {
          id: goalTaskId(goal.id, date),
          goalId: goal.id,
          title: goal.title,
          date,
          target,
          actual: 0,
          done: false,
          updatedAt: ts,
        });
      } else if (t.deleted && date >= today) {
        changed.set(t.id, { ...t, deleted: false, updatedAt: ts });
      }
    });
    for (const t of await this.store.tasks.where("goalId", goal.id)) {
      if (changed.has(t.id)) continue;
      if (t.date > today && !plannedSet.has(t.date) && t.actual === 0) {
        changed.set(t.id, { ...t, deleted: true, updatedAt: ts });
      } else if (t.date >= today && plannedSet.has(t.date) && (t.title !== goal.title || t.target !== target)) {
        const next = { ...t, title: goal.title, target };
        changed.set(t.id, { ...next, done: isTaskDone(next), updatedAt: ts });
      }
    }
    await this.store.tasks.bulkPut([...changed.values()]);
  }

  // ---------- Задачи ----------

  createTask({ title, date, target }) {
    return this.#exclusive(async () => {
      const task = {
        id: newId(),
        title: title.trim(),
        date,
        target: target > 0 ? target : undefined,
        actual: 0,
        done: false,
        updatedAt: Date.now(),
      };
      await this.store.tasks.put(task);
      return task;
    });
  }

  /** Удалить можно только разовую задачу — задачи целей подчиняются плану цели. */
  deleteTask(id) {
    return this.#exclusive(async () => {
      const t = await this.store.tasks.get(id);
      if (t && !t.goalId) await this.store.tasks.put({ ...t, deleted: true, updatedAt: Date.now() });
    });
  }

  /** Ввод фактического значения. У задачи цели синхронно обновляется её запись прогресса. */
  setTaskActual(taskId, actual) {
    return this.#exclusive(() => this._setTaskActual(taskId, actual));
  }

  /** Изменить значение на delta (кнопки − и +). */
  addToTask(taskId, delta) {
    return this.#exclusive(async () => {
      const t = await this.store.tasks.get(taskId);
      if (t) await this._setTaskActual(taskId, t.actual + delta);
    });
  }

  /** Отметка «сделано»: ставит норму; снятие отметки обнуляет значение. */
  toggleTask(taskId) {
    return this.#exclusive(async () => {
      const t = await this.store.tasks.get(taskId);
      if (!t || t.deleted) return;
      await this._setTaskActual(taskId, t.done ? 0 : Math.max(t.actual, t.target ?? 1));
    });
  }

  async _setTaskActual(taskId, actual) {
    const task = await this.store.tasks.get(taskId);
    if (!task || task.deleted) return;
    const next = { ...task, actual: Math.max(0, actual) };
    await this.store.tasks.put({ ...next, done: isTaskDone(next), updatedAt: Date.now() });
    if (task.goalId) await this._writeTaskEntry(task.goalId, next);
  }

  // ---------- Прогресс ----------

  /**
   * Ручная запись прогресса. Если у цели есть задача на эту дату, значение добавляется в задачу —
   * так дневная и общая статистика не расходятся.
   */
  addEntry(goalId, date, value, note) {
    return this.#exclusive(async () => {
      if (!value) return;
      const task = await this.store.tasks.get(goalTaskId(goalId, date));
      if (task && !task.deleted) return this._setTaskActual(task.id, task.actual + value);
      const before = await this._goalTotal(goalId);
      await this.store.entries.put({ id: newId(), goalId, date, value, note: note?.trim() || undefined, updatedAt: Date.now() });
      await this._updateCompletion(goalId, before);
    });
  }

  deleteEntry(entryId) {
    return this.#exclusive(async () => {
      const entry = await this.store.entries.get(entryId);
      if (!entry || entry.deleted) return;
      if (entry.taskId) return this._setTaskActual(entry.taskId, 0);
      const before = await this._goalTotal(entry.goalId);
      await this.store.entries.put({ ...entry, deleted: true, updatedAt: Date.now() });
      await this._updateCompletion(entry.goalId, before);
    });
  }

  async _goalTotal(goalId) {
    return totalProgress(await this.store.entries.where("goalId", goalId));
  }

  /** Одна запись прогресса на задачу; её значение всегда равно actual задачи. */
  async _writeTaskEntry(goalId, task) {
    const before = await this._goalTotal(goalId);
    const id = entryIdForTask(task.id);
    const existing = await this.store.entries.get(id);
    const ts = Date.now();
    if (task.actual > 0) {
      await this.store.entries.put({ id, goalId, date: task.date, value: task.actual, taskId: task.id, updatedAt: ts });
    } else if (existing && !existing.deleted) {
      await this.store.entries.put({ ...existing, deleted: true, updatedAt: ts });
    }
    await this._updateCompletion(goalId, before);
  }

  /**
   * Цель завершается сама, когда прогресс пересёк целевое значение,
   * и возвращается в работу, если опустился ниже (например, запись удалили).
   */
  async _updateCompletion(goalId, before) {
    const goal = await this.getGoal(goalId);
    if (!goal?.totalTarget) return;
    const after = await this._goalTotal(goalId);
    const T = goal.totalTarget;
    if (goal.status === "active" && before < T && after >= T) await this._setGoalStatus(goalId, "completed");
    else if (goal.status === "completed" && before >= T && after < T) await this._setGoalStatus(goalId, "active");
  }
}
