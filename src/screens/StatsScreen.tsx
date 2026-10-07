import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltip, axisProps } from '../components/chart';
import { Card, Icon, IconButton, PageHeader, Segmented } from '../components/ui';
import { service } from '../data';
import { formatShort } from '../domain/dates';
import { formatValue, unitShort } from '../domain/logic';
import { computePeriodStats, periodFor, previousPeriod, type PeriodKind } from '../domain/stats';
import { useQuery } from '../hooks/useQuery';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function StatsScreen({ today }: { today: string }) {
  const [kind, setKind] = useState<PeriodKind>('week');
  const [offset, setOffset] = useState(0);

  const period = periodFor(kind, today, offset);
  const prev = previousPeriod(kind, period);

  const tasks = useQuery(() => service.tasksInRange(prev.from, period.to), [prev.from, period.to]);
  const goals = useQuery(() => service.listGoals(), []);
  const entries = useQuery(() => service.allEntries(), []);

  const stats = tasks && goals && entries ? computePeriodStats(period, today, tasks, goals, entries) : undefined;
  const prevStats = tasks && goals && entries ? computePeriodStats(prev, today, tasks, goals, entries) : undefined;

  const pct = stats?.ratio != null ? Math.round(stats.ratio * 100) : null;
  const prevPct = prevStats?.ratio != null ? Math.round(prevStats.ratio * 100) : null;
  const delta = pct != null && prevPct != null ? pct - prevPct : null;

  const periodLabel =
    kind === 'week'
      ? `${formatShort(period.from)} — ${formatShort(period.to)}`
      : new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(new Date(period.from + 'T00:00'));

  const chartData = stats?.days.map((d, i) => ({
    label: kind === 'week' ? WEEKDAYS[i] : String(Number(d.date.slice(8))),
    percent: d.percent,
    tip: `${formatShort(d.date)} · ${d.done} из ${d.total}`,
  }));

  return (
    <>
      <PageHeader title="Статистика" />
      <div className="mx-auto max-w-2xl space-y-4 px-4">
        <Segmented
          value={kind}
          onChange={(k) => {
            setKind(k);
            setOffset(0);
          }}
          options={[
            { value: 'week', label: 'Неделя' },
            { value: 'month', label: 'Месяц' },
          ]}
        />

        <div className="flex items-center justify-between">
          <IconButton label="Предыдущий период" onClick={() => setOffset(offset - 1)}>
            <Icon.Back />
          </IconButton>
          <p className="font-semibold first-letter:uppercase">{periodLabel}</p>
          <IconButton label="Следующий период" onClick={() => setOffset(Math.min(0, offset + 1))} className={offset === 0 ? 'invisible' : ''}>
            <Icon.Forward />
          </IconButton>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Kpi label="Задач выполнено" value={pct != null ? `${pct}%` : '—'} />
          <Kpi label="Задачи" value={stats ? `${stats.done}/${stats.total}` : '—'} />
          <Kpi label="Целей выполнено" value={stats ? String(stats.goalsCompleted.length) : '—'} />
        </div>
        {delta != null && (
          <p className="-mt-1 px-1 text-sm text-slate-500 dark:text-slate-400">
            {delta === 0 ? 'Так же, как' : delta > 0 ? `▲ на ${delta} п.п. лучше, чем` : `▼ на ${-delta} п.п. хуже, чем`}{' '}
            {kind === 'week' ? 'на прошлой неделе' : 'в прошлом месяце'}
          </p>
        )}

        <Card>
          <h2 className="mb-3 text-lg font-semibold">Выполнение задач по дням, %</h2>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                <XAxis dataKey="label" {...axisProps} interval={kind === 'week' ? 0 : 'preserveStartEnd'} minTickGap={8} />
                <YAxis {...axisProps} domain={[0, 100]} ticks={[0, 50, 100]} />
                <Tooltip
                  cursor={{ fill: 'var(--chart-grid)' }}
                  content={(p) => (
                    <ChartTooltip {...p} label={p.payload?.[0]?.payload?.tip} format={(v) => `${v}%`} />
                  )}
                />
                <Bar dataKey="percent" fill="var(--chart-bar)" radius={[4, 4, 0, 0]} maxBarSize={kind === 'week' ? 32 : 12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {stats && stats.progressByGoal.length > 0 && (
          <Card>
            <h2 className="mb-2 text-lg font-semibold">Прогресс по целям за период</h2>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {stats.progressByGoal.map(({ goal, amount }) => (
                <li key={goal.id}>
                  <Link to={`/goals/${goal.id}`} className="flex min-h-12 items-center justify-between gap-3">
                    <span className="truncate">{goal.title}</span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      +{formatValue(amount)} {unitShort(goal)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {stats && stats.goalsCompleted.length > 0 && (
          <Card>
            <h2 className="mb-2 text-lg font-semibold">Выполненные цели 🎉</h2>
            <ul className="space-y-1">
              {stats.goalsCompleted.map((g) => (
                <li key={g.id}>
                  <Link to={`/goals/${g.id}`} className="flex min-h-11 items-center gap-2">
                    <span className="text-accent">
                      <Icon.Check size={20} />
                    </span>
                    {g.title}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs leading-tight text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}
