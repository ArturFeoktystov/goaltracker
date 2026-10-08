import test from "node:test";
import assert from "node:assert/strict";
import { addDays } from "./dates.js";
import { cumulativeRatio, dayCompletion } from "./logic.js";
import { createMemoryStore } from "./memory-store.js";
import { GoalService } from "./service.js";

const TODAY = "2026-10-07";
const fresh = () => new GoalService(createMemoryStore(), () => TODAY);

const reading = {
  title: "Книга",
  unit: "pages",
  totalTarget: 30,
  dailyTarget: 10,
  startDate: TODAY,
  deadline: addDays(TODAY, 4),
};

test("создаёт дневную задачу на каждый день до дедлайна", async () => {
  const svc = fresh();
  const g = await svc.createGoal(reading);
  const tasks = await svc.tasksInRange(TODAY, addDays(TODAY, 10));
  assert.equal(tasks.length, 5);
  assert.ok(tasks.every((t) => t.goalId === g.id && t.target === 10));
});

test("цель без дедлайна получает задачи на 14 дней вперёд", async () => {
  const svc = fresh();
  await svc.createGoal({ ...reading, deadline: undefined });
  assert.equal((await svc.tasksInRange(TODAY, addDays(TODAY, 100))).length, 15);
});

test("повторный ensureDailyTasks не создаёт дублей", async () => {
  const svc = fresh();
  await svc.createGoal(reading);
  await svc.ensureDailyTasks();
  await svc.ensureDailyTasks();
  assert.equal((await svc.tasksInRange(TODAY, addDays(TODAY, 10))).length, 5);
});

test("значение в задаче обновляет накопительный прогресс и отметку", async () => {
  const svc = fresh();
  const g = await svc.createGoal(reading);
  const [task] = await svc.tasksForDate(TODAY);
  await svc.setTaskActual(task.id, 7);
  assert.equal(cumulativeRatio(g, await svc.entriesForGoal(g.id)), 7 / 30);
  assert.equal((await svc.tasksForDate(TODAY))[0].done, false);

  await svc.addToTask(task.id, 5);
  const entries = await svc.entriesForGoal(g.id);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].value, 12);
  assert.equal((await svc.tasksForDate(TODAY))[0].done, true);
});

test("быстрые нажатия + не теряются", async () => {
  const svc = fresh();
  await svc.createGoal(reading);
  const [task] = await svc.tasksForDate(TODAY);
  await Promise.all([1, 2, 3, 4, 5].map(() => svc.addToTask(task.id, 1)));
  assert.equal((await svc.tasksForDate(TODAY))[0].actual, 5);
});

test("ручная запись на день с задачей добавляется в задачу", async () => {
  const svc = fresh();
  const g = await svc.createGoal(reading);
  await svc.addEntry(g.id, TODAY, 4);
  await svc.addEntry(g.id, TODAY, 6);
  const [task] = await svc.tasksForDate(TODAY);
  assert.equal(task.actual, 10);
  assert.equal(task.done, true);
  assert.equal((await svc.entriesForGoal(g.id)).length, 1);
});

test("цель завершается при достижении объёма и возвращается при удалении записи", async () => {
  const svc = fresh();
  const g = await svc.createGoal(reading);
  await svc.addEntry(g.id, "2026-10-01", 25);
  await svc.addEntry(g.id, TODAY, 5);
  assert.equal((await svc.getGoal(g.id)).status, "completed");
  assert.equal((await svc.tasksInRange(addDays(TODAY, 1), addDays(TODAY, 10))).length, 0, "будущие пустые задачи убраны");

  const manual = (await svc.entriesForGoal(g.id)).find((e) => !e.taskId);
  await svc.deleteEntry(manual.id);
  assert.equal((await svc.getGoal(g.id)).status, "active");
  assert.equal((await svc.tasksInRange(addDays(TODAY, 1), addDays(TODAY, 10))).length, 4);
});

test("сокращение дедлайна убирает лишние будущие задачи, правка нормы меняет задачи", async () => {
  const svc = fresh();
  const g = await svc.createGoal(reading);
  await svc.updateGoal(g.id, { ...reading, deadline: addDays(TODAY, 1), dailyTarget: 15 });
  const tasks = await svc.tasksInRange(TODAY, addDays(TODAY, 10));
  assert.equal(tasks.length, 2);
  assert.ok(tasks.every((t) => t.target === 15));
});

test("цель-галочка даёт чекбоксы; процент дня считается по задачам", async () => {
  const svc = fresh();
  await svc.createGoal({ title: "Медитация", unit: "check", dailyTarget: 1, startDate: TODAY, deadline: TODAY });
  await svc.createGoal(reading);
  await svc.createTask({ title: "Разовая", date: TODAY });
  const tasks = await svc.tasksForDate(TODAY);
  assert.equal(tasks.length, 3);
  const check = tasks.find((t) => t.title === "Медитация");
  assert.equal(check.target, undefined);
  await svc.toggleTask(check.id);
  const c = dayCompletion(await svc.tasksForDate(TODAY));
  assert.equal(c.done, 1);
  assert.equal(c.total, 3);
});

test("удаление цели скрывает её задачи и записи", async () => {
  const svc = fresh();
  const g = await svc.createGoal(reading);
  await svc.addEntry(g.id, TODAY, 3);
  await svc.deleteGoal(g.id);
  assert.equal(await svc.getGoal(g.id), undefined);
  assert.equal((await svc.tasksForDate(TODAY)).length, 0);
  assert.equal((await svc.entriesForGoal(g.id)).length, 0);
});

test("цель с объёмом и дедлайном без нормы: в «Сегодня» задача с темпом", async () => {
  let now = TODAY;
  const svc = new GoalService(createMemoryStore(), () => now);
  const g = await svc.createGoal({ title: "System Design", unit: "pages", totalTarget: 310, startDate: TODAY, deadline: addDays(TODAY, 23) });
  const tasks = await svc.tasksInRange(TODAY, addDays(TODAY, 100));
  assert.equal(tasks.length, 24);
  assert.ok(tasks.every((t) => t.target === 13), "310 страниц / 24 дня ≈ 13");

  // сделали больше нормы — сегодняшняя норма не меняется, задача выполнена
  const [today] = await svc.tasksForDate(TODAY);
  await svc.setTaskActual(today.id, 40);
  assert.equal((await svc.tasksForDate(TODAY))[0].target, 13);
  assert.equal((await svc.tasksForDate(TODAY))[0].done, true);

  // на следующий день норма пересчитана по остатку: 270 / 23 ≈ 12
  now = addDays(TODAY, 1);
  await svc.ensureDailyTasks();
  assert.equal((await svc.tasksForDate(now))[0].target, 12);
  assert.equal((await svc.tasksForDate(TODAY))[0].target, 13, "прошлые дни не меняются");
  assert.equal(g.dailyTarget, undefined);
});

test("цель с объёмом и дедлайном, созданная раньше: задачи появляются при запуске, но не задним числом", async () => {
  const store = createMemoryStore();
  const ts = Date.now();
  await store.goals.put({ id: "old", title: "Книга", unit: "pages", totalTarget: 100, startDate: addDays(TODAY, -3), deadline: addDays(TODAY, 9), status: "active", createdAt: ts, updatedAt: ts });
  const svc = new GoalService(store, () => TODAY);
  await svc.ensureDailyTasks();
  const tasks = await svc.tasksInRange(addDays(TODAY, -10), addDays(TODAY, 100));
  assert.equal(tasks.length, 10);
  assert.equal(tasks[0].target, 10);
  assert.ok(tasks.every((t) => t.date >= TODAY));
});

test("цель без нормы и без дедлайна в «Сегодня» не попадает", async () => {
  const svc = fresh();
  await svc.createGoal({ title: "Когда-нибудь", unit: "pages", totalTarget: 500, startDate: TODAY });
  assert.equal((await svc.tasksForDate(TODAY)).length, 0);
});
