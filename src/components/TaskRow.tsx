import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { service } from '../data';
import { formatValue, unitShort } from '../domain/logic';
import type { DailyTask, Goal } from '../domain/types';
import { Icon, ProgressBar } from './ui';

export function TaskRow({ task, goal }: { task: DailyTask; goal?: Goal }) {
  const unit = goal ? unitShort(goal) : '';
  const [draft, setDraft] = useState(formatValue(task.actual));

  useEffect(() => setDraft(formatValue(task.actual)), [task.actual]);

  const commit = () => {
    const v = parseFloat(draft.replace(',', '.'));
    if (Number.isFinite(v) && v !== task.actual) service.setTaskActual(task.id, v);
    else setDraft(formatValue(task.actual));
  };

  return (
    <li className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800">
      <button
        type="button"
        onClick={() => service.toggleTask(task.id)}
        aria-label={task.done ? 'Снять отметку' : 'Отметить выполненной'}
        aria-pressed={task.done}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-90 ${
          task.done ? 'border-accent bg-accent text-white dark:text-slate-950' : 'border-slate-300 text-transparent dark:border-slate-600'
        }`}
      >
        <Icon.Check size={22} />
      </button>

      <div className="min-w-0 flex-1">
        {goal ? (
          <Link to={`/goals/${goal.id}`} className={`line-clamp-2 font-medium leading-snug ${task.done ? 'text-slate-400 line-through dark:text-slate-500' : ''}`}>
            {task.title}
          </Link>
        ) : (
          <p className={`line-clamp-2 font-medium leading-snug ${task.done ? 'text-slate-400 line-through dark:text-slate-500' : ''}`}>{task.title}</p>
        )}
        {task.target ? (
          <div className="mt-1.5 flex items-center gap-2">
            <ProgressBar ratio={task.actual / task.target} size="sm" />
            <span className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">
              {formatValue(task.actual)} / {formatValue(task.target)} {unit}
            </span>
          </div>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">{goal ? 'Цель' : 'Разовая задача'}</p>
        )}
      </div>

      {task.target ? (
        <div className="flex shrink-0 items-center rounded-xl bg-slate-100 dark:bg-slate-800">
          <button
            type="button"
            aria-label="Уменьшить"
            onClick={() => service.setTaskActual(task.id, task.actual - 1)}
            className="flex h-11 w-10 items-center justify-center text-slate-500 active:text-slate-900 dark:active:text-white"
          >
            <Icon.Minus size={18} />
          </button>
          <input
            type="text"
            inputMode="decimal"
            aria-label="Фактическое значение"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="h-11 w-12 bg-transparent text-center font-semibold tabular-nums outline-none"
          />
          <button
            type="button"
            aria-label="Увеличить"
            onClick={() => service.setTaskActual(task.id, task.actual + 1)}
            className="flex h-11 w-10 items-center justify-center text-slate-500 active:text-slate-900 dark:active:text-white"
          >
            <Icon.Plus size={18} />
          </button>
        </div>
      ) : (
        !goal && (
          <button
            type="button"
            aria-label="Удалить задачу"
            onClick={() => service.deleteTask(task.id)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 active:bg-slate-100 dark:active:bg-slate-800"
          >
            <Icon.Trash />
          </button>
        )
      )}
    </li>
  );
}
