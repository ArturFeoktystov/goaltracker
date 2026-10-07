import { useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { GoalForm } from '../components/GoalForm';
import { Button, Card, EmptyState, Field, Icon, IconButton, PageHeader, ProgressBar, Segmented, Sheet, inputCls } from '../components/ui';
import { ChartTooltip, axisProps } from '../components/chart';
import { service } from '../data';
import { addDays, dateRange, formatLong, formatShort, pluralDays } from '../domain/dates';
import {
  UNIT_LABELS,
  cumulativeRatio,
  dailyRatio,
  dayAmount,
  daysLeft,
  formatValue,
  percent,
  requiredPace,
  totalProgress,
  unitShort,
} from '../domain/logic';
import type { Goal, ProgressEntry } from '../domain/types';
import { useQuery } from '../hooks/useQuery';

const CHART_DAYS = 30;

export function GoalDetailScreen({ today }: { today: string }) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const goal = useQuery(() => service.getGoal(id).then((g) => g ?? null), [id]);
  const entries = useQuery(() => service.entriesForGoal(id), [id]);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const back = (
    <IconButton label="Назад" onClick={() => navigate('/goals')} className="-ml-2">
      <Icon.Back />
    </IconButton>
  );

  if (goal === undefined || entries === undefined) return <PageHeader title="" left={back} />;
  if (goal === null)
    return (
      <>
        <PageHeader title="Цель не найдена" left={back} />
        <EmptyState title="Цель удалена или не существует" />
      </>
    );

  const unit = unitShort(goal);
  const sum = totalProgress(entries);
  const cum = cumulativeRatio(goal, entries);
  const day = dailyRatio(goal, entries, today);
  const left = daysLeft(goal, today);
  const pace = requiredPace(goal, entries, today);

  return (
    <>
      <PageHeader
        title={goal.title}
        subtitle={`${UNIT_LABELS[goal.unit]}${goal.unit === 'custom' && goal.customUnit ? `: ${goal.customUnit}` : ''}`}
        left={back}
        right={
          <IconButton label="Редактировать" onClick={() => setEditing(true)}>
            <Icon.Edit />
          </IconButton>
        }
      />

      <div className="mx-auto max-w-2xl space-y-4 px-4">
        {goal.description && <p className="text-slate-600 dark:text-slate-400">{goal.description}</p>}

        {goal.status !== 'active' && (
          <div className="rounded-2xl bg-accent-soft px-4 py-3 text-sm font-medium text-accent">
            {goal.status === 'completed' ? '🎉 Цель выполнена' : 'Цель в архиве'}
          </div>
        )}

        <Card>
          {cum !== undefined ? (
            <>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Общий прогресс</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {formatValue(sum)} <span className="text-base font-normal text-slate-500">из {formatValue(goal.totalTarget!)} {unit}</span>
                  </p>
                </div>
                <p className="text-4xl font-bold tabular-nums text-accent">{percent(cum)}%</p>
              </div>
              <div className="mt-3">
                <ProgressBar ratio={cum} size="lg" />
              </div>
            </>
          ) : (
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Всего внесено</p>
              <p className="text-2xl font-semibold tabular-nums">
                {formatValue(sum)} {unit}
              </p>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {day !== undefined && (
              <Stat label="Сегодня" value={goal.unit === 'check' ? (day >= 1 ? '✓' : '—') : `${formatValue(dayAmount(entries, today))} / ${formatValue(goal.dailyTarget!)}`} />
            )}
            {left !== undefined && (
              <Stat
                label="До дедлайна"
                value={left < 0 ? 'просрочен' : `${left} ${pluralDays(left)}`}
                tone={left < 0 && goal.status === 'active' ? 'bad' : undefined}
              />
            )}
            {pace !== undefined && goal.status === 'active' && pace > 0 && (
              <Stat
                label="Нужно в день"
                value={`${formatValue(Math.ceil(pace * 10) / 10)} ${unit}`}
                tone={goal.dailyTarget && pace > goal.dailyTarget ? 'bad' : undefined}
              />
            )}
          </div>
        </Card>

        <Button className="w-full" onClick={() => setAdding(true)}>
          <Icon.Plus size={20} /> Внести прогресс
        </Button>

        <ProgressChart goal={goal} entries={entries} today={today} />

        <section>
          <h2 className="mb-2 px-1 text-lg font-semibold">История</h2>
          {entries.length === 0 ? (
            <p className="px-1 text-sm text-slate-500">Записей пока нет</p>
          ) : (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70 dark:divide-slate-800 dark:bg-slate-900 dark:ring-slate-800">
              {entries.map((e) => (
                <li key={e.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium first-letter:uppercase">{formatLong(e.date)}</p>
                    {(e.note || e.taskId) && <p className="truncate text-xs text-slate-500">{e.note ?? 'из задачи дня'}</p>}
                  </div>
                  <span className="font-semibold tabular-nums">
                    +{formatValue(e.value)} {unit}
                  </span>
                  <IconButton label="Удалить запись" onClick={() => service.deleteEntry(e.id)} className="text-slate-400">
                    <Icon.Trash />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-wrap gap-2 pt-2">
          {goal.status === 'active' ? (
            <>
              <Button variant="secondary" onClick={() => service.setGoalStatus(goal.id, 'completed')}>
                <Icon.Check size={20} /> Отметить выполненной
              </Button>
              <Button variant="secondary" onClick={() => service.setGoalStatus(goal.id, 'archived')}>
                В архив
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => service.setGoalStatus(goal.id, 'active')}>
              Вернуть в активные
            </Button>
          )}
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            <Icon.Trash /> Удалить
          </Button>
        </section>
      </div>

      <Sheet open={editing} onClose={() => setEditing(false)} title="Редактировать цель">
        <GoalForm
          initial={goal}
          onCancel={() => setEditing(false)}
          onSubmit={async (input) => {
            await service.updateGoal(goal.id, input);
            setEditing(false);
          }}
        />
      </Sheet>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Внести прогресс">
        <AddEntryForm goal={goal} today={today} onDone={() => setAdding(false)} />
      </Sheet>

      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Удалить цель?">
        <p className="mb-5 text-slate-600 dark:text-slate-400">Цель, её задачи и вся история прогресса будут удалены.</p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(false)}>
            Отмена
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={async () => {
              await service.deleteGoal(goal.id);
              navigate('/goals');
            }}
          >
            Удалить
          </Button>
        </div>
      </Sheet>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: 'bad' }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-950/60">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`font-semibold tabular-nums ${tone === 'bad' ? 'text-red-600 dark:text-red-400' : ''}`}>{value}</p>
    </div>
  );
}

function ProgressChart({ goal, entries, today }: { goal: Goal; entries: ProgressEntry[]; today: string }) {
  const [mode, setMode] = useState<'daily' | 'total'>('daily');
  const unit = unitShort(goal);

  const end = today;
  const startCandidate = addDays(end, -(CHART_DAYS - 1));
  const start = goal.startDate > startCandidate ? goal.startDate : startCandidate;
  if (start > end) return null;

  const before = entries.filter((e) => e.date < start).reduce((s, e) => s + e.value, 0);
  let running = before;
  const data = dateRange(start, end).map((date) => {
    const amount = dayAmount(entries, date);
    running += amount;
    return { date, label: formatShort(date), amount, total: running };
  });
  const showTotal = mode === 'total';

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{showTotal ? 'Накопительно' : 'По дням'}</h2>
        <div className="w-48">
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'daily', label: 'Дни' },
              { value: 'total', label: 'Всего' },
            ]}
          />
        </div>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          {showTotal ? (
            <AreaChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={24} />
              <YAxis {...axisProps} allowDecimals={false} domain={[0, (max: number) => Math.max(max, goal.totalTarget ?? 0)]} />
              <Tooltip content={<ChartTooltip format={(v) => `${formatValue(v)} ${unit}`} />} cursor={{ stroke: 'var(--chart-ref)' }} />
              {goal.totalTarget && <ReferenceLine y={goal.totalTarget} stroke="var(--chart-ref)" strokeDasharray="4 4" />}
              <Area type="monotone" dataKey="total" stroke="var(--chart-bar)" strokeWidth={2} fill="var(--chart-bar-muted)" fillOpacity={0.5} />
            </AreaChart>
          ) : (
            <BarChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={24} />
              <YAxis {...axisProps} allowDecimals={false} />
              <Tooltip content={<ChartTooltip format={(v) => `${formatValue(v)} ${unit}`} />} cursor={{ fill: 'var(--chart-grid)' }} />
              {goal.dailyTarget && <ReferenceLine y={goal.dailyTarget} stroke="var(--chart-ref)" strokeDasharray="4 4" />}
              <Bar dataKey="amount" fill="var(--chart-bar)" radius={[4, 4, 0, 0]} maxBarSize={18} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      {(showTotal ? goal.totalTarget : goal.dailyTarget) && (
        <p className="mt-2 text-xs text-slate-500">Пунктир — {showTotal ? 'целевое значение' : 'дневная норма'}</p>
      )}
    </Card>
  );
}

function AddEntryForm({ goal, today, onDone }: { goal: Goal; today: string; onDone: () => void }) {
  const [value, setValue] = useState(goal.unit === 'check' ? '1' : '');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const v = parseFloat(value.replace(',', '.'));
  const valid = Number.isFinite(v) && v !== 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    await service.addEntry(goal.id, date, v, note);
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Значение${unitShort(goal) ? `, ${unitShort(goal)}` : ''}`}>
          <input className={inputCls} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        </Field>
        <Field label="Дата">
          <input type="date" className={inputCls} value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <Field label="Заметка (необязательно)">
        <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <p className="text-xs text-slate-500">Если на эту дату есть задача по цели, значение добавится к ней.</p>
      <Button type="submit" className="w-full" disabled={!valid}>
        Сохранить
      </Button>
    </form>
  );
}
