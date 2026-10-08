import test from "node:test";
import assert from "node:assert/strict";
import { computePeriodStats, periodFor, previousPeriod } from "./stats.js";

test("неделя начинается с понедельника", () => {
  assert.deepEqual(periodFor("week", "2026-10-07", 0), { from: "2026-10-05", to: "2026-10-11" });
  assert.deepEqual(periodFor("week", "2026-10-07", -1), { from: "2026-09-28", to: "2026-10-04" });
});

test("месяц и предыдущий месяц", () => {
  const p = periodFor("month", "2026-03-15", 0);
  assert.deepEqual(p, { from: "2026-03-01", to: "2026-03-31" });
  assert.deepEqual(previousPeriod("month", p), { from: "2026-02-01", to: "2026-02-28" });
});

test("будущие дни не занижают процент", () => {
  const tasks = [
    { date: "2026-10-05", done: true },
    { date: "2026-10-05", done: false },
    { date: "2026-10-06", done: true },
    { date: "2026-10-09", done: false },
  ];
  const s = computePeriodStats({ from: "2026-10-05", to: "2026-10-11" }, "2026-10-07", tasks, [], []);
  assert.equal(s.done, 2);
  assert.equal(s.total, 3);
  assert.deepEqual(s.days.slice(0, 4).map((d) => d.percent), [50, 100, null, null]);
});
