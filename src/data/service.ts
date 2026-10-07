// Прикладной слой: сценарии работы с целями, задачами и прогрессом.
// Знает только об интерфейсе Store, но не о конкретной БД.
import { today as todayFn } from '../domain/dates';
import { goalTaskId, isTaskDone, plannedTaskDates, totalProgress } from '../domain/logic';
import type { DailyTask, Goal, GoalInput, GoalStatus, ISODate, ProgressEntry } from '../domain/types';
import type { Store } from './store';

export function newId(): string {
  // randomUUID недоступен вне защищённого контекста (например, http по локальной сети)
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

const entryIdForTask = (taskId: string) => `entry_${taskId}`;

/** Для цели «галочка» дневная задача — чекбокс, норма = 1. */
function taskTarget(goal: Goal): number | undefined {
  return goal.unit === 'check' ? undefined : goal.dailyTarget;
}

function normalizeInput(input: GoalInput): GoalInput {
  const n = { ...input, title: input.title.trim(), description: input.description?.trim() || undefined };
  if (n.unit !== 'custom') n.customUnit = undefined;
  if (n.unit === 'check' && n.dailyTarget) n.dailyTarget = 1;
  if (!n.totalTarget || n.totalTarget <= 0) n.totalTarget = undefined;
  if (!n.dailyTarget || n.dailyTarget <= 0) n.dailyTarget = undefined;
  if (!n.deadline) n.deadline = undefined;
  return n;
}

export class GoalService {
  constructor(
    readonly store: Store,
    private readonly now: () => ISODate = todayFn,
  ) {}

  // ---------- Чтение ----------

  async listGoals(): Promise<Goal[]> {
    const goals = await this.store.goals.all();
    return goals.sort((a, b) => b.createdAt - a.createdAt);
  }

  async getGoal(id: string): Promise<Goal | undefined> {
    const g = await this.store.goals.get(id);
    return g && !g.deleted ? g : undefined;
  }

  async tasksForDate(date: ISODate): Promise<DailyTask[]> {
    const tasks = await this.store.tasks.where('date', date);
    // сначала задачи по целям, затем разовые; внутри — по названию
    return tasks.sort((a, b) => Number(!a.goalId) - Number(!b.goalId) || a.title.localeCompare(b.title, 'ru'));
  }

  tasksInRange(from: ISODate, to: ISODate): Promise<DailyTask[]> {
    return this.store.tasks.between('date', from, to);
  }

  async entriesForGoal(goalId: string): Promise<ProgressEntry[]> {
    const entries = await this.store.entries.where('goalId', goalId);
    return entries.sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt);
  }

  allEntries(): Promise<ProgressEntry[]> {
    return this.store.entries.all();
  }

  // ---------- Цели ----------

  async createGoal(input: GoalInput): Promise<Goal> {
    const now = Date.now();
    const goal: Goal = {
      ...normalizeInput(input),
      id: newId(),
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    await this.store.transaction(async () => {
      await this.store.goals.put(goal);
      await this.syncGoalTasks(goal);
    });
    return goal;
  }

  async updateGoal(id: string, input: GoalInput): Promise<void> {
    await this.store.transaction(async () => {
      const goal = await this.getGoal(id);
      if (!goal) return;
      const updated: Goal = { ...goal, ...normalizeInput(input), updatedAt: Date.now() };
      await this.store.goals.put(updated);
      await this.syncGoalTasks(updated);
      await this.refreshGoalTasksInfo(updated);
    });
  }

  async setGoalStatus(id: string, status: GoalStatus): Promise<void> {
    await this.store.transaction(async () => {
      const goal = await this.getGoal(id);
      if (!goal || goal.status === status) return;
      const updated: Goal = {
        ...goal,
        status,
        completedAt: status === 'completed' ? Date.now() : undefined,
        updatedAt: Date.now(),
      };
      await this.store.goals.put(updated);
      await this.syncGoalTasks(updated);
    });
  }

  async deleteGoal(id: string): Promise<void> {
    await this.store.transaction(async () => {
      const goal = await this.getGoal(id);
      if (!goal) return;
      const ts = Date.now();
      await this.store.goals.put({ ...goal, deleted: true, updatedAt: ts });
      const tasks = await this.store.tasks.where('goalId', id);
      await this.store.tasks.bulkPut(tasks.map((t) => ({ ...t, deleted: true, updatedAt: ts })));
      const entries = await this.store.entries.where('goalId', id);
      await this.store.entries.bulkPut(entries.map((e) => ({ ...e, deleted: true, updatedAt: ts })));
    });
  }

  /**
   * Приводит дневные задачи цели к плану:
   * создаёт недостающие (до дедлайна или на скользящее окно), восстанавливает
   * удалённые будущие и убирает будущие пустые задачи, вышедшие за план.
   */
  private async syncGoalTasks(goal: Goal): Promise<void> {
    const today = this.now();
    const planned = plannedTaskDates(goal, today);
    const plannedSet = new Set(planned);
    const ts = Date.now();

    const existing = await this.store.tasks.bulkGet(planned.map((d) => goalTaskId(goal.id, d)));
    const toPut: DailyTask[] = [];
    planned.forEach((date, i) => {
      const t = existing[i];
      if (!t) {
        toPut.push({
          id: goalTaskId(goal.id, date),
          goalId: goal.id,
          title: goal.title,
          date,
          target: taskTarget(goal),
          actual: 0,
          done: false,
          updatedAt: ts,
        });
      } else if (t.deleted && date >= today) {
        toPut.push({ ...t, deleted: false, updatedAt: ts });
      }
    });

    // Будущие задачи без прогресса, которых больше нет в плане, — убираем.
    const current = await this.store.tasks.where('goalId', goal.id);
    for (const t of current) {
      if (t.date > today && !plannedSet.has(t.date) && t.actual === 0) {
        toPut.push({ ...t, deleted: true, updatedAt: ts });
      }
    }
    await this.store.tasks.bulkPut(toPut);
  }

  /** После правки цели обновляет название и норму в сегодняшних и будущих задачах. */
  private async refreshGoalTasksInfo(goal: Goal): Promise<void> {
    const today = this.now();
    const tasks = await this.store.tasks.where('goalId', goal.id);
    const ts = Date.now();
    const target = taskTarget(goal);
    const changed = tasks
      .filter((t) => t.date >= today && (t.title !== goal.title || t.target !== target))
      .map((t) => {
        const next = { ...t, title: goal.title, target };
        return { ...next, done: isTaskDone(next), updatedAt: ts };
      });
    await this.store.tasks.bulkPut(changed);
  }

  /** Вызывается при запуске и смене дня: досоздаёт задачи для всех активных целей. */
  async ensureDailyTasks(): Promise<void> {
    await this.store.transaction(async () => {
      const goals = await this.store.goals.where('status', 'active');
      for (const g of goals) await this.syncGoalTasks(g);
    });
  }

  // ---------- Задачи ----------

  async createTask(input: { title: string; date: ISODate; target?: number }): Promise<DailyTask> {
    const task: DailyTask = {
      id: newId(),
      title: input.title.trim(),
      date: input.date,
      target: input.target && input.target > 0 ? input.target : undefined,
      actual: 0,
      done: false,
      updatedAt: Date.now(),
    };
    await this.store.tasks.put(task);
    return task;
  }

  /** Удалить можно только разовую задачу — задачи целей управляются планом цели. */
  async deleteTask(id: string): Promise<void> {
    const t = await this.store.tasks.get(id);
    if (!t || t.goalId) return;
    await this.store.tasks.put({ ...t, deleted: true, updatedAt: Date.now() });
  }

  /** Ввод фактического значения. Для задач цели синхронно обновляет запись прогресса. */
  async setTaskActual(taskId: string, actual: number): Promise<void> {
    await this.store.transaction(async () => {
      const task = await this.store.tasks.get(taskId);
      if (!task || task.deleted) return;
      const value = Math.max(0, actual);
      const next = { ...task, actual: value };
      await this.store.tasks.put({ ...next, done: isTaskDone(next), updatedAt: Date.now() });
      if (task.goalId) await this.writeTaskEntry(task.goalId, next);
    });
  }

  /** Отметка «сделано» / снятие отметки. */
  async toggleTask(taskId: string): Promise<void> {
    const task = await this.store.tasks.get(taskId);
    if (!task || task.deleted) return;
    if (task.done) await this.setTaskActual(taskId, 0);
    else await this.setTaskActual(taskId, Math.max(task.actual, task.target ?? 1));
  }

  // ---------- Прогресс ----------

  /**
   * Ручная запись прогресса. Если у цели есть задача на эту дату —
   * значение добавляется в неё, чтобы день и общий прогресс не расходились.
   */
  async addEntry(goalId: string, date: ISODate, value: number, note?: string): Promise<void> {
    if (!value) return;
    const task = await this.store.tasks.get(goalTaskId(goalId, date));
    if (task && !task.deleted) {
      await this.setTaskActual(task.id, task.actual + value);
      return;
    }
    await this.store.transaction(async () => {
      const before = await this.goalTotal(goalId);
      await this.store.entries.put({
        id: newId(),
        goalId,
        date,
        value,
        note: note?.trim() || undefined,
        updatedAt: Date.now(),
      });
      await this.updateCompletion(goalId, before);
    });
  }

  async deleteEntry(entryId: string): Promise<void> {
    const entry = await this.store.entries.get(entryId);
    if (!entry || entry.deleted) return;
    if (entry.taskId) {
      await this.setTaskActual(entry.taskId, 0);
      return;
    }
    await this.store.transaction(async () => {
      const before = await this.goalTotal(entry.goalId);
      await this.store.entries.put({ ...entry, deleted: true, updatedAt: Date.now() });
      await this.updateCompletion(entry.goalId, before);
    });
  }

  private async goalTotal(goalId: string): Promise<number> {
    return totalProgress(await this.store.entries.where('goalId', goalId));
  }

  /** Одна запись прогресса на задачу: её значение всегда равно actual задачи. */
  private async writeTaskEntry(goalId: string, task: DailyTask): Promise<void> {
    const before = await this.goalTotal(goalId);
    const id = entryIdForTask(task.id);
    const existing = await this.store.entries.get(id);
    const ts = Date.now();
    if (task.actual > 0) {
      await this.store.entries.put({ id, goalId, date: task.date, value: task.actual, taskId: task.id, updatedAt: ts });
    } else if (existing && !existing.deleted) {
      await this.store.entries.put({ ...existing, deleted: true, updatedAt: ts });
    }
    await this.updateCompletion(goalId, before);
  }

  /**
   * Автоматически завершает цель, когда накопительный прогресс пересёк целевое значение,
   * и возвращает в работу, если прогресс опустился ниже (например, запись удалили).
   */
  private async updateCompletion(goalId: string, before: number): Promise<void> {
    const goal = await this.getGoal(goalId);
    if (!goal?.totalTarget) return;
    const after = await this.goalTotal(goalId);
    const T = goal.totalTarget;
    if (goal.status === 'active' && before < T && after >= T) {
      await this.setGoalStatus(goalId, 'completed');
    } else if (goal.status === 'completed' && after < T && before >= T) {
      await this.setGoalStatus(goalId, 'active');
    }
  }
}
