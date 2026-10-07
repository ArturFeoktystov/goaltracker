import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoalForm } from '../components/GoalForm';
import { Button, Card, EmptyState, Icon, PageHeader, ProgressBar, Segmented, Sheet } from '../components/ui';
import { service } from '../data';
import { pluralDays } from '../domain/dates';
import { cumulativeRatio, dailyRatio, daysLeft, formatValue, percent, totalProgress, unitShort } from '../domain/logic';
import type { Goal, GoalStatus, ProgressEntry } from '../domain/types';
import { useQuery } from '../hooks/useQuery';

export function GoalsScreen({ today }: { today: string }) {
  const [filter, setFilter] = useState<GoalStatus>('active');
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const goals = useQuery(() => service.listGoals(), []);
  const entries = useQuery(() => service.allEntries(), []);

  const byGoal = new Map<string, ProgressEntry[]>();
  entries?.forEach((e) => byGoal.set(e.goalId, [...(byGoal.get(e.goalId) ?? []), e]));
  const visible = goals?.filter((g) => g.status === filter) ?? [];

  return (
    <>
      <PageHeader
        title="Цели"
        right={
          <Button className="h-11 min-h-11 w-11 rounded-full !px-0" onClick={() => setCreating(true)} aria-label="Новая цель">
            <Icon.Plus />
          </Button>
        }
      />
      <div className="mx-auto max-w-2xl space-y-4 px-4">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'active', label: 'Активные' },
            { value: 'completed', label: 'Выполнены' },
            { value: 'archived', label: 'Архив' },
          ]}
        />

        {goals && visible.length === 0 ? (
          filter === 'active' ? (
            <EmptyState
              title="Нет активных целей"
              text="Поставьте первую цель: например, прочитать 300 страниц по 10 в день."
              action={<Button onClick={() => setCreating(true)}>Создать цель</Button>}
            />
          ) : (
            <EmptyState title={filter === 'completed' ? 'Выполненных целей пока нет' : 'Архив пуст'} />
          )
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {visible.map((g) => (
              <GoalCard key={g.id} goal={g} entries={byGoal.get(g.id) ?? []} today={today} onClick={() => navigate(`/goals/${g.id}`)} />
            ))}
          </div>
        )}
      </div>

      <Sheet open={creating} onClose={() => setCreating(false)} title="Новая цель">
        <GoalForm
          onCancel={() => setCreating(false)}
          onSubmit={async (input) => {
            await service.createGoal(input);
            setCreating(false);
          }}
        />
      </Sheet>
    </>
  );
}

function GoalCard({ goal, entries, today, onClick }: { goal: Goal; entries: ProgressEntry[]; today: string; onClick: () => void }) {
  const cum = cumulativeRatio(goal, entries);
  const day = dailyRatio(goal, entries, today);
  const left = daysLeft(goal, today);
  const unit = unitShort(goal);
  const sum = totalProgress(entries);

  return (
    <Card onClick={onClick}>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 truncate text-lg font-semibold">{goal.title}</p>
        {cum !== undefined && <span className="text-lg font-bold tabular-nums text-accent">{percent(cum)}%</span>}
      </div>

      {cum !== undefined && (
        <div className="mt-2 space-y-1">
          <ProgressBar ratio={cum} muted={goal.status === 'archived'} />
          <p className="text-sm tabular-nums text-slate-500 dark:text-slate-400">
            {formatValue(sum)} из {formatValue(goal.totalTarget!)} {unit}
          </p>
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
        {day !== undefined && goal.status === 'active' && (
          <span className={day >= 1 ? 'font-medium text-accent' : ''}>
            Сегодня: {goal.unit === 'check' ? (day >= 1 ? 'сделано ✓' : 'не отмечено') : `${percent(day)}% нормы`}
          </span>
        )}
        {left !== undefined && goal.status === 'active' && (
          <span className={`inline-flex items-center gap-1 ${left < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
            <Icon.Calendar /> {left < 0 ? `просрочено на ${-left} ${pluralDays(-left)}` : left === 0 ? 'дедлайн сегодня' : `осталось ${left} ${pluralDays(left)}`}
          </span>
        )}
        {cum === undefined && day === undefined && <span>{formatValue(sum)} {unit}</span>}
      </div>
    </Card>
  );
}
