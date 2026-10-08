# Goals

A goal tracker for the laptop (in the browser) and the iPhone (from the home screen). Set a goal,
log progress every day, see how far along you are.

It is a web app you add to the home screen. No App Store, no server, no sign-up. All data stays on
the device (IndexedDB) and works offline.

## Install on iPhone

1. Open <https://arturfeoktystov.github.io/goaltracker/> in **Safari**.
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Open it from the home screen.

Data entered in Safari and in the home-screen app is stored separately — use the home-screen app.
The laptop and the phone also keep separate data until cloud sync is added (see below).

New versions arrive on their own: after `git push`, GitHub Pages updates the site within a minute and
the app picks it up on the next launch.

## Features

- **Goals** measured in pages, km, hours, minutes, reps, a custom unit, or just a checkbox.
- **Goal types**: a total amount (e.g. 300 pages) and/or a daily target (e.g. 10 pages a day) — both at
  once is fine, with or without a deadline.
- **Today**: the day's tasks, the day's completion percentage, quick input (− / + or type a number) and
  a done checkmark. Browse other days, add one-off tasks.
- **Goal details**: total progress, days to the deadline, the pace needed, a chart by day and cumulative,
  history.
- **Statistics**: week and month — share of tasks done, change vs the previous period, progress by goal,
  completed goals.

## Rules

| What | Rule |
|---|---|
| Total progress | sum of progress entries / total target |
| Daily progress | amount logged that day / daily target |
| Day completion | tasks done / all tasks of the day (7 of 10 = 70 %) |
| Daily tasks | for a goal with a daily target: one per day from the start date to the deadline; without a deadline, 14 days ahead, rolling forward on every launch |
| Pace | a goal with a total and a deadline but no daily target still gets a task every day from today to the deadline: its target is what is left at the start of the day / days left (including today), so a missed day raises the next days' target |
| Not in Today | a goal with neither a daily target nor a deadline |
| Task done | when the daily target is reached (or the checkbox is ticked) |
| Tasks and progress | the amount in a goal's task is exactly one progress entry, so daily and total progress always agree; a manual entry on a day that has a task is added to that task |
| Goal completion | automatic when progress reaches the total target; back to active if it drops below again (an entry was deleted) |
| Statistics | future days are not counted, so they don't pull the percentage down |

## Development

```
npm start          # http://localhost:5180
npm test           # unit tests for the business logic (node --test)
```

| File | What it is |
|---|---|
| `index.html`, `style.css` | The shell and styles |
| `app.js` | UI: screens, forms, actions |
| `charts.js` | SVG charts, no library |
| `service.js` | Use cases: goals, automatic daily tasks, progress input, auto-completion |
| `logic.js`, `stats.js`, `dates.js` | Pure functions: progress math, statistics, dates (tested) |
| `db.js` | IndexedDB storage |
| `memory-store.js` | The same storage in memory, for tests |
| `manifest.webmanifest`, `icons/` | Home-screen name and icon (`npm run icons` regenerates the icons) |
| `sw.js` | Service worker: fresh files on every launch, last copy for offline |

## Cloud sync (later)

The UI and the service don't know where data lives: they go through the storage interface described in
`db.js`. Every record has `updatedAt` and a soft-delete flag `deleted`, and `changedSince(ts)` returns
everything changed since the last sync. Sync is a wrapper store: read and write locally, and in the
background exchange changes with a server, last write wins. Any backend works (Supabase, Firebase, your
own API).
