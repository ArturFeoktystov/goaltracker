import type { TooltipProps } from 'recharts';

export const axisProps = {
  tick: { fill: 'var(--chart-axis)', fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

/** Подсказка при наведении/тапе по столбцу или точке графика. */
export function ChartTooltip({ active, payload, label, format }: TooltipProps<number | string | (number | string)[], number | string> & { format: (v: number) => string }) {
  if (!active || !payload?.length || payload[0].value == null) return null;
  return (
    <div className="rounded-lg bg-white px-3 py-2 text-sm shadow-lg ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="font-semibold tabular-nums">{format(payload[0].value as number)}</p>
    </div>
  );
}
