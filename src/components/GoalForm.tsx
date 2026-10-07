import { useState, type FormEvent } from 'react';
import { diffDays, pluralDays, today } from '../domain/dates';
import { UNIT_LABELS, formatValue } from '../domain/logic';
import type { Goal, GoalInput, UnitType } from '../domain/types';
import { Button, Field, inputCls } from './ui';

const UNITS = Object.keys(UNIT_LABELS) as UnitType[];

const num = (s: string) => {
  const v = parseFloat(s.replace(',', '.'));
  return Number.isFinite(v) && v > 0 ? v : undefined;
};

export function GoalForm({ initial, onSubmit, onCancel }: { initial?: Goal; onSubmit: (input: GoalInput) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [unit, setUnit] = useState<UnitType>(initial?.unit ?? 'pages');
  const [customUnit, setCustomUnit] = useState(initial?.customUnit ?? '');
  const [useTotal, setUseTotal] = useState(initial ? !!initial.totalTarget : true);
  const [total, setTotal] = useState(initial?.totalTarget?.toString() ?? '');
  const [useDaily, setUseDaily] = useState(initial ? !!initial.dailyTarget : true);
  const [daily, setDaily] = useState(initial?.dailyTarget?.toString() ?? '');
  const [startDate, setStartDate] = useState(initial?.startDate ?? today());
  const [deadline, setDeadline] = useState(initial?.deadline ?? '');

  const isCheck = unit === 'check';
  const totalV = useTotal ? num(total) : undefined;
  const dailyV = useDaily ? (isCheck ? 1 : num(daily)) : undefined;

  const errors: string[] = [];
  if (!title.trim()) errors.push('Введите название');
  if (unit === 'custom' && !customUnit.trim()) errors.push('Укажите единицу измерения');
  if (useTotal && !totalV) errors.push(isCheck ? 'Укажите, сколько раз' : 'Укажите целевое значение');
  if (useDaily && !dailyV) errors.push('Укажите дневную норму');
  if (deadline && deadline < startDate) errors.push('Дедлайн раньше даты начала');

  // Подсказка: хватит ли дневной нормы, чтобы успеть к дедлайну
  let hint: string | undefined;
  if (totalV && deadline && deadline >= startDate) {
    const days = diffDays(startDate, deadline) + 1;
    const pace = totalV / days;
    hint = `${days} ${pluralDays(days)} → нужно ≈ ${formatValue(Math.ceil(pace * 10) / 10)} в день`;
  } else if (totalV && dailyV && !isCheck) {
    const days = Math.ceil(totalV / dailyV);
    hint = `При норме ${formatValue(dailyV)} в день — ${days} ${pluralDays(days)}`;
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (errors.length) return;
    onSubmit({
      title,
      description,
      unit,
      customUnit: customUnit.trim() || undefined,
      totalTarget: totalV,
      dailyTarget: dailyV,
      startDate,
      deadline: deadline || undefined,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <Field label="Название">
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Прочитать «Войну и мир»" autoFocus={!initial} />
      </Field>

      <Field label="Описание (необязательно)">
        <textarea className={`${inputCls} py-3`} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>

      <div>
        <span className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-400">Единица измерения</span>
        <div className="flex flex-wrap gap-2">
          {UNITS.map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUnit(u)}
              className={`min-h-10 rounded-full px-3.5 text-sm font-medium transition ${
                unit === u ? 'bg-accent text-white dark:text-slate-950' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {UNIT_LABELS[u]}
            </button>
          ))}
        </div>
        {unit === 'custom' && (
          <input className={`${inputCls} mt-2`} value={customUnit} onChange={(e) => setCustomUnit(e.target.value)} placeholder="напр. стаканы воды" />
        )}
      </div>

      <div className="space-y-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/50">
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Режим цели — можно оба сразу</p>
        <ModeToggle checked={useTotal} onChange={setUseTotal} title="Накопительный" text={isCheck ? 'Сделать N раз всего' : 'Общий объём, напр. 300 страниц'}>
          <input className={inputCls} inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} placeholder={isCheck ? 'Сколько раз' : 'Целевое значение'} />
        </ModeToggle>
        <ModeToggle
          checked={useDaily}
          onChange={setUseDaily}
          title="Периодический"
          text={isCheck ? 'Отмечать каждый день' : 'Дневная норма, напр. 10 страниц в день'}
        >
          {!isCheck && <input className={inputCls} inputMode="decimal" value={daily} onChange={(e) => setDaily(e.target.value)} placeholder="Норма в день" />}
        </ModeToggle>
        {useDaily && <p className="text-xs text-slate-500">Задачи на каждый день появятся в «Сегодня» автоматически.</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Начало">
          <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </Field>
        <Field label="Дедлайн">
          <input type="date" className={inputCls} value={deadline} min={startDate} onChange={(e) => setDeadline(e.target.value)} />
        </Field>
      </div>
      {hint && <p className="-mt-2 text-sm text-slate-500 dark:text-slate-400">{hint}</p>}

      {errors.length > 0 && title && <p className="text-sm text-red-600 dark:text-red-400">{errors[0]}</p>}

      <div className="flex gap-3 pt-1">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit" className="flex-1" disabled={errors.length > 0}>
          {initial ? 'Сохранить' : 'Создать цель'}
        </Button>
      </div>
    </form>
  );
}

function ModeToggle({ checked, onChange, title, text, children }: { checked: boolean; onChange: (v: boolean) => void; title: string; text: string; children?: React.ReactNode }) {
  return (
    <div>
      <label className="flex min-h-12 cursor-pointer items-center gap-3">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-6 w-6 shrink-0 accent-[var(--color-accent)]" />
        <span>
          <span className="block font-medium">{title}</span>
          <span className="block text-xs text-slate-500">{text}</span>
        </span>
      </label>
      {checked && children && <div className="mt-2 pl-9">{children}</div>}
    </div>
  );
}
