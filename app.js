// Интерфейс: экраны «Сегодня», «Цели», «Детали цели», «Статистика».
// Экран целиком перерисовывается из данных при каждом изменении хранилища.

import { areaChart, barChart } from "./charts.js";
import { createIdbStore, requestPersistentStorage } from "./db.js";
import { addDays, dateRange, diffDays, formatLong, formatMonth, formatShort, pluralDays, today } from "./dates.js";
import {
  UNITS,
  cumulativeRatio,
  dailyRatio,
  dayAmount,
  dayCompletion,
  effectiveDailyTarget,
  daysLeft,
  formatValue,
  percent,
  requiredPace,
  totalProgress,
  unitShort,
} from "./logic.js";
import { GoalService } from "./service.js";
import { computePeriodStats, periodFor, previousPeriod } from "./stats.js";

const service = new GoalService(createIdbStore());

const main = document.getElementById("main");
const sheet = document.getElementById("sheet");
const tooltip = document.getElementById("tooltip");

const state = {
  today: today(),
  dayOffset: 0,
  goalFilter: "active",
  chartMode: "daily",
  statsKind: "week",
  statsOffset: 0,
};

// ---------- Помощники ----------

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const parseNum = (s) => {
  const v = parseFloat(String(s).replace(",", "."));
  return Number.isFinite(v) ? v : undefined;
};
const icon = (d, size = 24) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  back: icon('<path d="M15 18l-6-6 6-6"/>'),
  forward: icon('<path d="M9 18l6-6-6-6"/>'),
  edit: icon('<path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/>', 22),
  trash: icon('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', 20),
  check: icon('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  plus: icon('<path d="M12 5v14M5 12h14"/>', 20),
  calendar: icon('<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/>', 15),
};

const bar = (ratio, cls = "") => `<div class="bar ${cls}"><div style="width:${percent(ratio)}%"></div></div>`;

function segmented(action, value, options) {
  return `<div class="segmented">${options
    .map(([v, label]) => `<button class="${v === value ? "on" : ""}" data-action="${action}" data-value="${v}">${label}</button>`)
    .join("")}</div>`;
}

function pageHead({ title, subtitle, left = "", right = "" }) {
  return `<header class="page-head">${left}<div class="title"><h1>${esc(title)}</h1>${
    subtitle ? `<div class="subtitle">${esc(subtitle)}</div>` : ""
  }</div>${right}</header>`;
}

function empty(title, text = "", action = "") {
  return `<div class="empty"><img src="icons/icon-192.png" alt=""><p class="big">${esc(title)}</p>${
    text ? `<p class="muted">${esc(text)}</p>` : ""
  }${action}</div>`;
}

/** Ширина области графика внутри карточки. */
const chartWidth = () => Math.max(240, main.clientWidth - 32 - 34);

function leftLabel(left) {
  if (left < 0) return `${-left} ${pluralDays(-left)} overdue`;
  if (left === 0) return "deadline today";
  return `${left} ${pluralDays(left)} left`;
}

// ---------- Экран «Сегодня» ----------

async function screenToday() {
  const date = addDays(state.today, state.dayOffset);
  const [tasks, goals] = await Promise.all([service.tasksForDate(date), service.listGoals()]);
  const goalById = new Map(goals.map((g) => [g.id, g]));
  const { done, total, ratio } = dayCompletion(tasks);

  const o = state.dayOffset;
  const title = o === 0 ? "Today" : o === -1 ? "Yesterday" : o === 1 ? "Tomorrow" : formatShort(date);
  const c = 2 * Math.PI * 52;
  const status = total === 0 ? "No tasks for this day" : done === total ? "All done! 🎉" : `${total - done} to go`;

  return `
    ${pageHead({
      title,
      subtitle: formatLong(date),
      right: `
        <button class="icon-button" data-action="day" data-value="-1" aria-label="Previous day">${ICON.back}</button>
        ${o !== 0 ? `<button class="link" data-action="day" data-value="0">Today</button>` : ""}
        <button class="icon-button" data-action="day" data-value="1" aria-label="Next day">${ICON.forward}</button>`,
    })}
    <div class="stack">
      <section class="card day-summary">
        <div class="ring">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle class="track" cx="60" cy="60" r="52"/>
            <circle class="fill" cx="60" cy="60" r="52" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - ratio)}"/>
          </svg>
          <div class="value num">${percent(ratio)}%</div>
        </div>
        <div>
          <div class="muted small">Tasks done</div>
          <div class="big num">${done} of ${total}</div>
          <div class="muted small">${status}</div>
        </div>
      </section>
      ${
        tasks.length
          ? `<ul class="tasks">${tasks.map((t) => taskRow(t, t.goalId && goalById.get(t.goalId))).join("")}</ul>`
          : empty("Nothing here yet", "Create a goal with a daily target and its tasks will show up here every day. Or add a one-off task.")
      }
      <button class="btn secondary block" data-action="new-task">${ICON.plus} One-off task</button>
    </div>`;
}

function taskRow(task, goal) {
  const unit = goal ? unitShort(goal) : "";
  const name = goal
    ? `<a class="name" href="#/goals/${goal.id}">${esc(task.title)}</a>`
    : `<button class="name" data-action="task-menu" data-id="${task.id}">${esc(task.title)}</button>`;
  const meta = task.target
    ? `<div class="meta">${bar(task.actual / task.target, "sm")}<span class="num">${formatValue(task.actual)} / ${formatValue(task.target)} ${esc(unit)}</span></div>`
    : `<div class="meta">${goal ? "Goal" : "One-off task"}</div>`;
  const stepper = task.target
    ? `<div class="stepper">
        <button data-action="step" data-id="${task.id}" data-value="-1" aria-label="Decrease">−</button>
        <input class="task-value" data-id="${task.id}" inputmode="decimal" enterkeyhint="done" value="${formatValue(task.actual)}" aria-label="Done so far">
        <button data-action="step" data-id="${task.id}" data-value="1" aria-label="Increase">+</button>
      </div>`
    : "";
  return `
    <li class="card task ${task.done ? "done" : ""}">
      <button class="check ${task.done ? "on" : ""}" data-action="toggle" data-id="${task.id}" aria-pressed="${task.done}"
        aria-label="${task.done ? "Mark as not done" : "Mark as done"}">${ICON.check}</button>
      <div class="body">${name}${meta}</div>
      ${stepper}
    </li>`;
}

// ---------- Экран «Цели» ----------

async function screenGoals() {
  const [goals, entries] = await Promise.all([service.listGoals(), service.allEntries()]);
  const byGoal = new Map();
  for (const e of entries) byGoal.set(e.goalId, [...(byGoal.get(e.goalId) ?? []), e]);
  const visible = goals.filter((g) => g.status === state.goalFilter);

  let content;
  if (visible.length) {
    content = `<div class="goal-grid">${visible.map((g) => goalCard(g, byGoal.get(g.id) ?? [])).join("")}</div>`;
  } else if (state.goalFilter === "active") {
    content = empty(
      "No active goals",
      "Set your first goal: for example, read 300 pages, 10 a day.",
      `<button class="btn" data-action="new-goal">Create a goal</button>`,
    );
  } else {
    content = empty(state.goalFilter === "completed" ? "No completed goals yet" : "Archive is empty");
  }

  return `
    ${pageHead({ title: "Goals", right: `<button class="btn round" data-action="new-goal" aria-label="New goal">+</button>` })}
    <div class="stack">
      ${segmented("goal-filter", state.goalFilter, [["active", "Active"], ["completed", "Completed"], ["archived", "Archived"]])}
      ${content}
    </div>`;
}

function goalCard(goal, entries) {
  const cum = cumulativeRatio(goal, entries);
  const day = dailyRatio(goal, entries, state.today);
  const left = daysLeft(goal, state.today);
  const unit = unitShort(goal);
  const active = goal.status === "active";

  const facts = [];
  if (cum !== undefined) facts.push(`<span class="num">${formatValue(totalProgress(entries))} of ${formatValue(goal.totalTarget)} ${esc(unit)}</span>`);
  if (day !== undefined && active) {
    const text = goal.unit === "check" ? (day >= 1 ? "done ✓" : "not yet") : `${percent(day)}% of target`;
    facts.push(`<span class="${day >= 1 ? "accent" : ""}">Today: ${text}</span>`);
  }
  if (left !== undefined && active) facts.push(`<span class="${left < 0 ? "danger" : ""}">${ICON.calendar} ${leftLabel(left)}</span>`);
  if (cum === undefined && day === undefined) facts.push(`<span>Total: ${formatValue(totalProgress(entries))} ${esc(unit)}</span>`);

  return `
    <a class="card goal-card" href="#/goals/${goal.id}">
      <div class="top">
        <div class="name">${esc(goal.title)}</div>
        ${cum !== undefined ? `<div class="pct num">${percent(cum)}%</div>` : ""}
      </div>
      ${cum !== undefined ? bar(cum, goal.status === "archived" ? "muted" : "") : ""}
      <div class="facts">${facts.join("")}</div>
    </a>`;
}

// ---------- Экран «Детали цели» ----------

const CHART_DAYS = 30;

async function screenGoal({ id }) {
  const back = `<a class="icon-button" href="#/goals" aria-label="Back">${ICON.back}</a>`;
  const [goal, entries] = await Promise.all([service.getGoal(id), service.entriesForGoal(id)]);
  if (!goal) return pageHead({ title: "Goal not found", left: back }) + empty("This goal was deleted or does not exist");

  const unit = unitShort(goal);
  const sum = totalProgress(entries);
  const cum = cumulativeRatio(goal, entries);
  const day = dailyRatio(goal, entries, state.today);
  const left = daysLeft(goal, state.today);
  const pace = requiredPace(goal, entries, state.today);
  const active = goal.status === "active";

  const stats = [];
  if (day !== undefined) {
    const v = goal.unit === "check" ? (day >= 1 ? "✓" : "—") : `${formatValue(dayAmount(entries, state.today))} / ${formatValue(effectiveDailyTarget(goal, entries, state.today))}`;
    stats.push(stat("Today", v));
  }
  if (left !== undefined) stats.push(stat("Deadline", left < 0 ? "overdue" : `${left} ${pluralDays(left)} left`, left < 0 && active));
  if (pace > 0 && active) {
    stats.push(stat("Needed per day", `${formatValue(Math.ceil(pace * 10) / 10)} ${esc(unit)}`, goal.dailyTarget && pace > goal.dailyTarget));
  }

  const headline =
    cum !== undefined
      ? `<div class="headline">
          <div><div class="muted small">Total progress</div>
            <div class="value num">${formatValue(sum)} <span class="muted small">of ${formatValue(goal.totalTarget)} ${esc(unit)}</span></div></div>
          <div class="pct num">${percent(cum)}%</div>
        </div>
        <div style="margin-top:12px">${bar(cum, "lg")}</div>`
      : `<div class="muted small">Total logged</div><div class="headline"><div class="value num">${formatValue(sum)} ${esc(unit)}</div></div>`;

  const history = entries.length
    ? `<ul class="list card">${entries
        .map(
          (e) => `
          <li>
            <div class="grow"><div>${formatLong(e.date)}</div>${e.note || e.taskId ? `<div class="muted small">${esc(e.note ?? "from the daily task")}</div>` : ""}</div>
            <b class="num">+${formatValue(e.value)} ${esc(unit)}</b>
            <button class="icon-button" data-action="delete-entry" data-id="${e.id}" aria-label="Delete entry">${ICON.trash}</button>
          </li>`,
        )
        .join("")}</ul>`
    : `<p class="muted small" style="margin:0 4px">No entries yet</p>`;

  const statusButtons = active
    ? `<button class="btn secondary" data-action="goal-status" data-value="completed">${ICON.check} Mark as completed</button>
       <button class="btn secondary" data-action="goal-status" data-value="archived">Archive</button>`
    : `<button class="btn secondary" data-action="goal-status" data-value="active">Make active again</button>`;

  return `
    ${pageHead({
      title: goal.title,
      subtitle: goal.unit === "custom" ? `${UNITS.custom.label}: ${goal.customUnit}` : UNITS[goal.unit].label,
      left: back,
      right: `<button class="icon-button" data-action="edit-goal" aria-label="Edit">${ICON.edit}</button>`,
    })}
    <div class="stack" data-goal="${goal.id}">
      ${goal.description ? `<p class="muted" style="margin:0 4px">${esc(goal.description)}</p>` : ""}
      ${goal.status !== "active" ? `<div class="banner">${goal.status === "completed" ? "🎉 Goal completed" : "Goal archived"}</div>` : ""}
      <section class="card">${headline}${stats.length ? `<div class="stat-grid">${stats.join("")}</div>` : ""}</section>
      <button class="btn block" data-action="add-entry">${ICON.plus} Log progress</button>
      ${progressChart(goal, entries)}
      <h2 class="section-title">History</h2>
      ${history}
      <div class="btn-wrap" style="padding-top:8px">
        ${statusButtons}
        <button class="btn danger" data-action="delete-goal">${ICON.trash} Delete</button>
      </div>
    </div>`;
}

function stat(label, value, bad) {
  return `<div class="stat"><div class="label">${label}</div><div class="value ${bad ? "danger" : ""}">${value}</div></div>`;
}

function progressChart(goal, entries) {
  const end = state.today;
  const start = [goal.startDate, addDays(end, -(CHART_DAYS - 1))].sort().at(-1);
  if (start > end) return "";
  const unit = unitShort(goal);
  const daily = state.chartMode === "daily";

  let running = entries.filter((e) => e.date < start).reduce((s, e) => s + e.value, 0);
  const data = dateRange(start, end).map((date) => {
    const amount = dayAmount(entries, date);
    running += amount;
    const value = daily ? amount : running;
    return { label: formatShort(date), value, tip: formatLong(date), tipValue: `${formatValue(value)} ${unit}` };
  });
  const width = chartWidth();
  const svg = daily
    ? barChart(data, { width, ref: goal.dailyTarget, label: "Progress by day" })
    : areaChart(data, { width, ref: goal.totalTarget, label: "Cumulative progress" });
  const ref = daily ? goal.dailyTarget && "daily target" : goal.totalTarget && "total target";

  return `
    <section class="card">
      <div class="chart-head">
        <h2>${daily ? "By day" : "Cumulative"}</h2>
        ${segmented("chart-mode", state.chartMode, [["daily", "Days"], ["total", "Total"]])}
      </div>
      <div class="chart">${svg}</div>
      ${ref ? `<p class="muted small" style="margin:8px 0 0">Dashed line: ${ref}</p>` : ""}
    </section>`;
}

// ---------- Экран «Статистика» ----------

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

async function screenStats() {
  const kind = state.statsKind;
  const period = periodFor(kind, state.today, state.statsOffset);
  const prev = previousPeriod(kind, period);
  const [tasks, goals, entries] = await Promise.all([service.tasksInRange(prev.from, period.to), service.listGoals(), service.allEntries()]);
  const s = computePeriodStats(period, state.today, tasks, goals, entries);
  const p = computePeriodStats(prev, state.today, tasks, goals, entries);

  const pct = s.ratio === null ? null : Math.round(s.ratio * 100);
  const prevPct = p.ratio === null ? null : Math.round(p.ratio * 100);
  let trend = "";
  if (pct !== null && prevPct !== null) {
    const d = pct - prevPct;
    const than = kind === "week" ? "last week" : "last month";
    trend = d === 0 ? `Same as ${than}` : d > 0 ? `▲ ${d} pp better than ${than}` : `▼ ${-d} pp worse than ${than}`;
  }

  const label = kind === "week" ? `${formatShort(period.from)} — ${formatShort(period.to)}` : formatMonth(period.from);
  const data = s.days.map((d, i) => ({
    label: kind === "week" ? WEEKDAYS[i] : String(Number(d.date.slice(8))),
    value: d.percent,
    tip: formatLong(d.date),
    tipValue: d.percent === null ? "no tasks" : `${d.percent}% · ${d.done} of ${d.total}`,
  }));

  return `
    ${pageHead({ title: "Statistics" })}
    <div class="stack">
      ${segmented("stats-kind", kind, [["week", "Week"], ["month", "Month"]])}
      <div class="period-nav">
        <button class="icon-button" data-action="stats-shift" data-value="-1" aria-label="Previous period">${ICON.back}</button>
        <div class="label">${label}</div>
        <button class="icon-button ${state.statsOffset === 0 ? "invisible" : ""}" data-action="stats-shift" data-value="1" aria-label="Next period">${ICON.forward}</button>
      </div>
      <div class="kpis">
        <div class="card kpi"><div class="value">${pct === null ? "—" : pct + "%"}</div><div class="label">of tasks done</div></div>
        <div class="card kpi"><div class="value">${s.done}/${s.total}</div><div class="label">tasks</div></div>
        <div class="card kpi"><div class="value">${s.goalsCompleted.length}</div><div class="label">goals completed</div></div>
      </div>
      ${trend ? `<p class="muted small" style="margin:8px 4px 0">${trend}</p>` : ""}
      <section class="card">
        <h2>Tasks done by day, %</h2>
        <div class="chart">${barChart(data, { width: chartWidth(), height: 200, max: 100, label: "Tasks done by day" })}</div>
      </section>
      ${
        s.progressByGoal.length
          ? `<section class="card"><h2>Progress by goal</h2><ul class="list">${s.progressByGoal
              .map(
                ({ goal, amount }) =>
                  `<li><a class="grow" href="#/goals/${goal.id}">${esc(goal.title)}</a><b class="num">+${formatValue(amount)} ${esc(unitShort(goal))}</b></li>`,
              )
              .join("")}</ul></section>`
          : ""
      }
      ${
        s.goalsCompleted.length
          ? `<section class="card"><h2>Completed goals 🎉</h2><ul class="list">${s.goalsCompleted
              .map((g) => `<li><span class="accent">${ICON.check}</span><a class="grow" href="#/goals/${g.id}">${esc(g.title)}</a></li>`)
              .join("")}</ul></section>`
          : ""
      }
    </div>`;
}

// ---------- Отрисовка и маршруты ----------

const SCREENS = { today: screenToday, goals: screenGoals, stats: screenStats };

function parseRoute() {
  const [screen, id] = location.hash.replace(/^#\/?/, "").split("/");
  if (screen === "goals" && id) return { screen: "goal", id, tab: "goals" };
  return SCREENS[screen] ? { screen, tab: screen } : { screen: "today", tab: "today" };
}

let renderToken = 0;
let deferred = false;
let lastRoute = "";

async function render() {
  // Не перерисовываем, пока пользователь вводит число, — иначе пропадёт фокус.
  if (document.activeElement?.matches?.("main input")) {
    deferred = true;
    return;
  }
  const token = ++renderToken;
  const route = parseRoute();
  const html = route.screen === "goal" ? await screenGoal(route) : await SCREENS[route.screen](route);
  if (token !== renderToken) return;
  hideTooltip();
  main.innerHTML = html;
  const key = location.hash;
  if (key !== lastRoute) window.scrollTo(0, 0);
  lastRoute = key;
  document.querySelectorAll(".tabbar a").forEach((a) => a.classList.toggle("active", a.dataset.tab === route.tab));
}

main.addEventListener("focusout", () => {
  if (deferred) setTimeout(() => {
    deferred = false;
    render();
  });
});

// ---------- Шторка ----------

function openSheet(title, html, setup) {
  document.getElementById("sheet-title").textContent = title;
  const body = document.getElementById("sheet-body");
  body.innerHTML = html;
  sheet.hidden = false;
  setup?.(body);
  body.querySelector("[autofocus]")?.focus();
}

function closeSheet() {
  sheet.hidden = true;
  document.getElementById("sheet-body").innerHTML = "";
}

sheet.addEventListener("click", (e) => {
  if (e.target.closest("[data-close]")) closeSheet();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !sheet.hidden) closeSheet();
});

function confirmSheet(title, text, label, onConfirm) {
  openSheet(
    title,
    `<p class="muted" style="margin:4px 0 20px">${esc(text)}</p>
     <div class="btn-row"><button class="btn secondary" data-close>Cancel</button><button class="btn danger" data-confirm>${label}</button></div>`,
    (body) =>
      body.querySelector("[data-confirm]").addEventListener("click", async () => {
        await onConfirm();
        closeSheet();
      }),
  );
}

// ---------- Формы ----------

function goalForm(goal) {
  const v = {
    title: goal?.title ?? "",
    description: goal?.description ?? "",
    unit: goal?.unit ?? "pages",
    customUnit: goal?.customUnit ?? "",
    useTotal: goal ? !!goal.totalTarget : true,
    total: goal?.totalTarget ?? "",
    useDaily: goal ? !!goal.dailyTarget : true,
    daily: goal?.dailyTarget ?? "",
    startDate: goal?.startDate ?? state.today,
    deadline: goal?.deadline ?? "",
  };
  const chips = Object.entries(UNITS)
    .map(([key, u]) => `<label><input type="radio" name="unit" value="${key}" ${key === v.unit ? "checked" : ""}><span>${u.label}</span></label>`)
    .join("");

  return `
    <form id="goal-form" novalidate>
      <label class="field"><span>Title</span>
        <input class="input" name="title" value="${esc(v.title)}" placeholder="Read War and Peace" ${goal ? "" : "autofocus"}></label>
      <label class="field"><span>Description (optional)</span>
        <textarea class="input" name="description" rows="2">${esc(v.description)}</textarea></label>
      <div class="field"><span>Unit</span>
        <div class="chips">${chips}</div>
        <input class="input" name="customUnit" value="${esc(v.customUnit)}" placeholder="e.g. glasses of water" style="margin-top:8px">
      </div>
      <div class="modes">
        <p>Goal type: choose one or both</p>
        <label class="toggle"><input type="checkbox" name="useTotal" ${v.useTotal ? "checked" : ""}>
          <span><b>Total amount</b><small data-text="total"></small></span></label>
        <div class="mode-value" data-for="useTotal"><input class="input" name="total" inputmode="decimal" value="${v.total}"></div>
        <label class="toggle"><input type="checkbox" name="useDaily" ${v.useDaily ? "checked" : ""}>
          <span><b>Daily target</b><small data-text="daily"></small></span></label>
        <div class="mode-value" data-for="useDaily"><input class="input" name="daily" inputmode="decimal" value="${v.daily}" placeholder="Per day"></div>
        <p class="hint" data-today-hint></p>
      </div>
      <div class="two-cols">
        <label class="field"><span>Start</span><input class="input" type="date" name="startDate" value="${v.startDate}"></label>
        <label class="field"><span>Deadline</span><input class="input" type="date" name="deadline" value="${v.deadline}"></label>
      </div>
      <p class="hint" data-hint style="margin:-8px 0 16px"></p>
      <p class="form-error" data-error></p>
      <div class="btn-row">
        <button type="button" class="btn secondary" data-close>Cancel</button>
        <button type="submit" class="btn">${goal ? "Save" : "Create goal"}</button>
      </div>
    </form>`;
}

/** Читает форму цели, обновляет подсказки и возвращает { input, error }. */
function readGoalForm(form) {
  const f = form.elements;
  const unit = f.unit.value;
  const isCheck = unit === "check";
  const useTotal = f.useTotal.checked;
  const useDaily = f.useDaily.checked;
  const total = useTotal ? parseNum(f.total.value) : undefined;
  const daily = useDaily ? (isCheck ? 1 : parseNum(f.daily.value)) : undefined;
  const startDate = f.startDate.value || state.today;
  const deadline = f.deadline.value;

  // Видимость и тексты зависят от выбранной единицы и режимов
  f.customUnit.hidden = unit !== "custom";
  form.querySelector('[data-text="total"]').textContent = isCheck ? "Do it N times in total" : "e.g. 300 pages in total";
  form.querySelector('[data-text="daily"]').textContent = isCheck ? "Check it off every day" : "e.g. 10 pages a day";
  f.total.placeholder = isCheck ? "How many times" : "Total target";
  form.querySelectorAll('[data-for="useTotal"]').forEach((el) => (el.hidden = !useTotal));
  form.querySelectorAll('[data-for="useDaily"]').forEach((el) => (el.hidden = !useDaily));
  form.querySelector('[data-for="useDaily"].mode-value').hidden = !useDaily || isCheck;
  f.deadline.min = startDate;
  form.querySelector("[data-today-hint]").textContent = useDaily
    ? "A task for each day will appear in Today automatically."
    : useTotal && deadline && !isCheck
      ? "No daily target: Today will show the pace needed to finish by the deadline."
      : "Without a daily target or a deadline, this goal won't appear in Today.";

  let error = "";
  if (!f.title.value.trim()) error = "Enter a title";
  else if (unit === "custom" && !f.customUnit.value.trim()) error = "Enter a unit";
  else if (useTotal && !(total > 0)) error = isCheck ? "Enter how many times" : "Enter the total target";
  else if (useDaily && !(daily > 0)) error = "Enter the daily target";
  else if (deadline && deadline < startDate) error = "The deadline is before the start date";

  let hint = "";
  if (total > 0 && deadline && deadline >= startDate) {
    const days = diffDays(startDate, deadline) + 1;
    hint = `${days} ${pluralDays(days)} → about ${formatValue(Math.ceil((total / days) * 10) / 10)} a day`;
  } else if (total > 0 && daily > 0 && !isCheck) {
    const days = Math.ceil(total / daily);
    hint = `At ${formatValue(daily)} a day: ${days} ${pluralDays(days)}`;
  }
  form.querySelector("[data-hint]").textContent = hint;

  return {
    error,
    input: {
      title: f.title.value,
      description: f.description.value,
      unit,
      customUnit: f.customUnit.value.trim() || undefined,
      totalTarget: total,
      dailyTarget: daily,
      startDate,
      deadline: deadline || undefined,
    },
  };
}

function openGoalForm(goal) {
  openSheet(goal ? "Edit goal" : "New goal", goalForm(goal), (body) => {
    const form = body.querySelector("form");
    let touched = false;
    const refresh = () => {
      const { error } = readGoalForm(form);
      form.querySelector("[data-error]").textContent = touched ? error : "";
    };
    form.addEventListener("input", refresh);
    form.addEventListener("change", refresh);
    refresh();
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      touched = true;
      const { error, input } = readGoalForm(form);
      if (error) return refresh();
      if (goal) await service.updateGoal(goal.id, input);
      else {
        const created = await service.createGoal(input);
        location.hash = `#/goals/${created.id}`;
      }
      closeSheet();
    });
  });
}

function openTaskForm(date) {
  openSheet(
    "New task",
    `<form>
      <label class="field"><span>Title</span><input class="input" name="title" placeholder="Call the dentist" autofocus></label>
      <label class="field"><span>Target (optional)</span>
        <input class="input" name="target" inputmode="decimal" placeholder="e.g. 20">
        <div class="hint">Leave empty for a simple checkbox</div></label>
      <button class="btn block">Add</button>
    </form>`,
    (body) =>
      body.querySelector("form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const f = e.target.elements;
        if (!f.title.value.trim()) return f.title.focus();
        await service.createTask({ title: f.title.value, date, target: parseNum(f.target.value) });
        closeSheet();
      }),
  );
}

function openEntryForm(goal) {
  const unit = unitShort(goal);
  openSheet(
    "Log progress",
    `<form>
      <div class="two-cols">
        <label class="field"><span>Amount${unit ? `, ${esc(unit)}` : ""}</span>
          <input class="input" name="value" inputmode="decimal" value="${goal.unit === "check" ? 1 : ""}" autofocus></label>
        <label class="field"><span>Date</span><input class="input" type="date" name="date" value="${state.today}" max="${state.today}"></label>
      </div>
      <label class="field"><span>Note (optional)</span><input class="input" name="note"></label>
      <p class="hint" style="margin:-8px 0 16px">If the goal has a task on this date, the amount is added to it.</p>
      <button class="btn block">Save</button>
    </form>`,
    (body) =>
      body.querySelector("form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const f = e.target.elements;
        const value = parseNum(f.value.value);
        if (!value) return f.value.focus();
        await service.addEntry(goal.id, f.date.value || state.today, value, f.note.value);
        closeSheet();
      }),
  );
}

// ---------- Действия ----------

const currentGoalId = () => main.querySelector("[data-goal]")?.dataset.goal;

const ACTIONS = {
  day: (v) => {
    state.dayOffset = v === "0" ? 0 : state.dayOffset + Number(v);
    render();
  },
  toggle: (_, id) => service.toggleTask(id),
  step: (v, id) => service.addToTask(id, Number(v)),
  "new-task": () => openTaskForm(addDays(state.today, state.dayOffset)),
  "task-menu": async (_, id) => {
    const tasks = await service.tasksForDate(addDays(state.today, state.dayOffset));
    const task = tasks.find((t) => t.id === id);
    if (task) confirmSheet("Delete task?", `"${task.title}" will be deleted.`, "Delete", () => service.deleteTask(id));
  },
  "goal-filter": (v) => {
    state.goalFilter = v;
    render();
  },
  "new-goal": () => openGoalForm(),
  "edit-goal": async () => openGoalForm(await service.getGoal(currentGoalId())),
  "add-entry": async () => openEntryForm(await service.getGoal(currentGoalId())),
  "delete-entry": (_, id) => service.deleteEntry(id),
  "goal-status": (v) => service.setGoalStatus(currentGoalId(), v),
  "delete-goal": () => {
    const id = currentGoalId();
    confirmSheet("Delete goal?", "The goal, its tasks and all its progress history will be deleted.", "Delete", async () => {
      await service.deleteGoal(id);
      location.hash = "#/goals";
    });
  },
  "chart-mode": (v) => {
    state.chartMode = v;
    render();
  },
  "stats-kind": (v) => {
    state.statsKind = v;
    state.statsOffset = 0;
    render();
  },
  "stats-shift": (v) => {
    state.statsOffset = Math.min(0, state.statsOffset + Number(v));
    render();
  },
};

main.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (el) ACTIONS[el.dataset.action]?.(el.dataset.value, el.dataset.id);
});

// Фактическое значение задачи сохраняется по Enter или при уходе из поля.
main.addEventListener("change", (e) => {
  if (!e.target.matches(".task-value")) return;
  const v = parseNum(e.target.value);
  if (v !== undefined) service.setTaskActual(e.target.dataset.id, v);
  else render();
});
main.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.matches(".task-value")) e.target.blur();
});
main.addEventListener("focusin", (e) => {
  if (e.target.matches(".task-value")) e.target.select();
});

// ---------- Подсказки графиков ----------

function showTooltip(hit) {
  main.querySelectorAll(".hit.on").forEach((h) => h.classList.remove("on"));
  hit.classList.add("on");
  tooltip.innerHTML = `${esc(hit.dataset.tipTitle)}${hit.dataset.tipValue ? `<b>${esc(hit.dataset.tipValue)}</b>` : ""}`;
  tooltip.hidden = false;
  const r = hit.getBoundingClientRect();
  const t = tooltip.getBoundingClientRect();
  const left = Math.min(Math.max(8, r.left + r.width / 2 - t.width / 2), window.innerWidth - t.width - 8);
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${Math.max(8, r.top - t.height - 6)}px`;
}

function hideTooltip() {
  tooltip.hidden = true;
  main.querySelectorAll(".hit.on").forEach((h) => h.classList.remove("on"));
}

main.addEventListener("pointerover", (e) => {
  if (e.target.matches?.(".hit")) showTooltip(e.target);
});
main.addEventListener("pointerdown", (e) => {
  if (e.target.matches?.(".hit")) showTooltip(e.target);
  else hideTooltip();
});
main.addEventListener("pointerout", (e) => {
  if (e.pointerType === "mouse" && e.target.matches?.(".hit")) hideTooltip();
});
window.addEventListener("scroll", hideTooltip, { passive: true });

// ---------- Запуск ----------

/** Смена дня (приложение могли оставить открытым на ночь). */
async function checkDay() {
  const d = today();
  if (d === state.today) return;
  state.today = d;
  await service.ensureDailyTasks();
  render();
}

let lastWidth = main.clientWidth;
window.addEventListener("resize", () => {
  if (Math.abs(main.clientWidth - lastWidth) < 8) return;
  lastWidth = main.clientWidth;
  render();
});

window.addEventListener("hashchange", render);
document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && checkDay());
setInterval(checkDay, 60_000);
service.subscribe(render);

if (!location.hash) history.replaceState(null, "", "#/today");
requestPersistentStorage();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
await service.ensureDailyTasks();
render();
