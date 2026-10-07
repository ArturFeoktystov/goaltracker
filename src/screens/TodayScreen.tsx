import { useState, type FormEvent } from 'react';
import { TaskRow } from '../components/TaskRow';
import { Button, EmptyState, Field, Icon, IconButton, PageHeader, ProgressRing, Sheet, inputCls } from '../components/ui';
import { service } from '../data';
import { addDays, formatLong } from '../domain/dates';
import { dayCompletion, percent } from '../domain/logic';
import type { Goal } from '../domain/types';
import { useQuery } from '../hooks/useQuery';

export function TodayScreen({ today }: { today: string }) {
  const [offset, setOffset] = useState(0);
  const [adding, setAdding] = useState(false);
  const date = addDays(today, offset);

  const tasks = useQuery(() => service.tasksForDate(date), [date]);
  const goals = useQuery(() => service.listGoals(), []);
  const goalById = new Map<string, Goal>(goals?.map((g) => [g.id, g]));

  const { done, total, ratio } = dayCompletion(tasks ?? []);
  const title = offset === 0 ? 'Сегодня' : offset === -1 ? 'Вчера' : offset === 1 ? 'Завтра' : formatLong(date).split(',')[0];

  return (
    <>
      <PageHeader
        title={title}
        subtitle={formatLong(date)}
        right={
          <div className="flex">
            <IconButton label="Предыдущий день" onClick={() => setOffset(offset - 1)}>
              <Icon.Back />
            </IconButton>
            {offset !== 0 && (
              <button type="button" onClick={() => setOffset(0)} className="min-h-11 rounded-full px-2 text-sm font-medium text-accent">
                Сегодня
              </button>
            )}
            <IconButton label="Следующий день" onClick={() => setOffset(offset + 1)}>
              <Icon.Forward />
            </IconButton>
          </div>
        }
      />

      <div className="mx-auto max-w-2xl space-y-4 px-4">
        <section className="flex items-center gap-5 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800">
          <ProgressRing ratio={ratio}>
            <span className="text-3xl font-bold tabular-nums">{percent(ratio)}%</span>
          </ProgressRing>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Выполнено задач</p>
            <p className="text-2xl font-semibold tabular-nums">
              {done} из {total}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {total === 0 ? 'Задач на этот день нет' : done === total ? 'Отличная работа! 🎉' : `Осталось: ${total - done}`}
            </p>
          </div>
        </section>

        {tasks && tasks.length === 0 ? (
          <EmptyState
            title="Пока пусто"
            text="Создайте цель с дневной нормой — задачи будут появляться здесь каждый день. Или добавьте разовую задачу."
          />
        ) : (
          <ul className="space-y-2">
            {tasks?.map((t) => (
              <TaskRow key={t.id} task={t} goal={t.goalId ? goalById.get(t.goalId) : undefined} />
            ))}
          </ul>
        )}

        <Button variant="secondary" className="w-full" onClick={() => setAdding(true)}>
          <Icon.Plus size={20} /> Разовая задача
        </Button>
      </div>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Новая задача">
        <NewTaskForm date={date} onDone={() => setAdding(false)} />
      </Sheet>
    </>
  );
}

function NewTaskForm({ date, onDone }: { date: string; onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const t = parseFloat(target.replace(',', '.'));
    await service.createTask({ title, date, target: Number.isFinite(t) ? t : undefined });
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Название">
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Позвонить врачу" autoFocus />
      </Field>
      <Field label="Целевое значение (необязательно)" hint="Оставьте пустым — будет простой чекбокс">
        <input className={inputCls} inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="напр. 20" />
      </Field>
      <Button type="submit" className="w-full" disabled={!title.trim()}>
        Добавить
      </Button>
    </form>
  );
}
