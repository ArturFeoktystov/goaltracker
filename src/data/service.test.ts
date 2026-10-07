import { beforeEach, describe, expect, it } from 'vitest';
import { addDays } from '../domain/dates';
import { cumulativeRatio, dayCompletion } from '../domain/logic';
import { createDexieStore } from './dexie/dexieStore';
import { GoalService } from './service';

const TODAY = '2026-10-07';
let svc: GoalService;

beforeEach(() => {
  svc = new GoalService(createDexieStore(`test-${Math.random()}`), () => TODAY);
});

const reading = {
  title: 'Книга',
  unit: 'pages' as const,
  totalTarget: 30,
  dailyTarget: 10,
  startDate: TODAY,
  deadline: addDays(TODAY, 4),
};

describe('GoalService', () => {
  it('создаёт дневные задачи на каждый день до дедлайна', async () => {
    const g = await svc.createGoal(reading);
    const tasks = await svc.tasksInRange(TODAY, addDays(TODAY, 10));
    expect(tasks).toHaveLength(5);
    expect(tasks.every((t) => t.goalId === g.id && t.target === 10)).toBe(true);
  });

  it('повторный ensureDailyTasks не создаёт дублей', async () => {
    await svc.createGoal(reading);
    await svc.ensureDailyTasks();
    await svc.ensureDailyTasks();
    expect(await svc.tasksInRange(TODAY, addDays(TODAY, 10))).toHaveLength(5);
  });

  it('ввод значения в задачу обновляет накопительный прогресс и отметку', async () => {
    const g = await svc.createGoal(reading);
    const [task] = await svc.tasksForDate(TODAY);
    await svc.setTaskActual(task.id, 7);
    let entries = await svc.entriesForGoal(g.id);
    expect(cumulativeRatio(g, entries)).toBeCloseTo(7 / 30);
    expect((await svc.tasksForDate(TODAY))[0].done).toBe(false);

    await svc.setTaskActual(task.id, 12);
    entries = await svc.entriesForGoal(g.id);
    expect(entries).toHaveLength(1);
    expect(entries[0].value).toBe(12);
    expect((await svc.tasksForDate(TODAY))[0].done).toBe(true);
  });

  it('ручная запись на день с задачей добавляется в задачу', async () => {
    const g = await svc.createGoal(reading);
    await svc.addEntry(g.id, TODAY, 4);
    await svc.addEntry(g.id, TODAY, 6);
    const [task] = await svc.tasksForDate(TODAY);
    expect(task.actual).toBe(10);
    expect(task.done).toBe(true);
    expect(await svc.entriesForGoal(g.id)).toHaveLength(1);
  });

  it('цель завершается при достижении объёма и возвращается при удалении записи', async () => {
    const g = await svc.createGoal(reading);
    await svc.addEntry(g.id, '2026-10-01', 25);
    await svc.addEntry(g.id, TODAY, 5);
    expect((await svc.getGoal(g.id))?.status).toBe('completed');
    // будущие пустые задачи убраны
    expect(await svc.tasksInRange(addDays(TODAY, 1), addDays(TODAY, 10))).toHaveLength(0);

    const manual = (await svc.entriesForGoal(g.id)).find((e) => !e.taskId)!;
    await svc.deleteEntry(manual.id);
    expect((await svc.getGoal(g.id))?.status).toBe('active');
    expect(await svc.tasksInRange(addDays(TODAY, 1), addDays(TODAY, 10))).toHaveLength(4);
  });

  it('сокращение дедлайна убирает лишние будущие задачи', async () => {
    const g = await svc.createGoal(reading);
    await svc.updateGoal(g.id, { ...reading, deadline: addDays(TODAY, 1) });
    expect(await svc.tasksInRange(TODAY, addDays(TODAY, 10))).toHaveLength(2);
  });

  it('цель-галочка создаёт чекбоксы, процент дня считается по задачам', async () => {
    await svc.createGoal({ title: 'Медитация', unit: 'check', dailyTarget: 1, startDate: TODAY, deadline: TODAY });
    await svc.createGoal(reading);
    await svc.createTask({ title: 'Разовая', date: TODAY });
    const tasks = await svc.tasksForDate(TODAY);
    expect(tasks).toHaveLength(3);
    const check = tasks.find((t) => t.title === 'Медитация')!;
    expect(check.target).toBeUndefined();
    await svc.toggleTask(check.id);
    const after = await svc.tasksForDate(TODAY);
    expect(dayCompletion(after)).toMatchObject({ done: 1, total: 3 });
  });

  it('удаление цели скрывает её задачи и записи', async () => {
    const g = await svc.createGoal(reading);
    await svc.addEntry(g.id, TODAY, 3);
    await svc.deleteGoal(g.id);
    expect(await svc.getGoal(g.id)).toBeUndefined();
    expect(await svc.tasksForDate(TODAY)).toHaveLength(0);
    expect(await svc.entriesForGoal(g.id)).toHaveLength(0);
  });
});
