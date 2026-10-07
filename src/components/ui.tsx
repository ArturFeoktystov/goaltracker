import { useEffect, type ReactNode } from 'react';
import { clamp01 } from '../domain/logic';

export function ProgressBar({ ratio, size = 'md', muted }: { ratio: number; size?: 'sm' | 'md' | 'lg'; muted?: boolean }) {
  const h = size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-4' : 'h-2.5';
  return (
    <div
      className={`${h} w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800`}
      role="progressbar"
      aria-valuenow={Math.round(clamp01(ratio) * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${muted ? 'bg-slate-400 dark:bg-slate-600' : 'bg-accent'}`}
        style={{ width: `${clamp01(ratio) * 100}%` }}
      />
    </div>
  );
}

export function ProgressRing({ ratio, size = 132, stroke = 12, children }: { ratio: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-200 dark:stroke-slate-800" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamp01(ratio))}
          className="stroke-accent transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  const cls = `rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800 ${className}`;
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} block w-full text-left active:scale-[0.99] transition-transform`}>
      {children}
    </button>
  ) : (
    <div className={cls}>{children}</div>
  );
}

export function PageHeader({ title, subtitle, left, right }: { title: string; subtitle?: string; left?: ReactNode; right?: ReactNode }) {
  return (
    <header className="pt-safe sticky top-0 z-10 bg-slate-50/90 backdrop-blur dark:bg-slate-950/90">
      <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
        {left}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="truncate text-sm text-slate-500 dark:text-slate-400 first-letter:uppercase">{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
  );
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
const btnStyles: Record<BtnVariant, string> = {
  primary: 'bg-accent text-white dark:text-slate-950 font-semibold',
  secondary: 'bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100 font-medium',
  ghost: 'text-slate-700 dark:text-slate-300 font-medium',
  danger: 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400 font-medium',
};

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 transition active:opacity-70 disabled:opacity-40 ${btnStyles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function IconButton({ label, children, onClick, className = '' }: { label: string; children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-600 transition active:bg-slate-200 dark:text-slate-300 dark:active:bg-slate-800 ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export const inputCls =
  'w-full min-h-12 rounded-xl border-0 bg-slate-100 px-3.5 text-slate-900 outline-none ring-1 ring-transparent placeholder:text-slate-400 focus:ring-2 focus:ring-accent dark:bg-slate-800 dark:text-slate-100';

/** Нижняя шторка на телефоне, диалог по центру на широком экране. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="pb-safe relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white shadow-xl sm:rounded-3xl dark:bg-slate-900">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-white px-5 pt-4 pb-2 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">{title}</h2>
          <IconButton label="Закрыть" onClick={onClose}>
            <Icon.Close />
          </IconButton>
        </div>
        <div className="px-5 pb-5">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-3 text-accent">
        <Icon.Target size={44} />
      </div>
      <p className="text-lg font-semibold">{title}</p>
      {text && <p className="mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-xl bg-slate-200/70 p-1 dark:bg-slate-800">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`min-h-10 flex-1 rounded-lg px-3 text-sm font-medium transition ${
            value === o.value ? 'bg-white shadow-sm dark:bg-slate-950' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

type IconProps = { size?: number };
const svg = (size: number, path: ReactNode) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {path}
  </svg>
);

export const Icon = {
  Today: ({ size = 24 }: IconProps) => svg(size, <><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M16 2v4M8 2v4M3 10h18M9 15l2 2 4-4" /></>),
  Target: ({ size = 24 }: IconProps) => svg(size, <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>),
  Chart: ({ size = 24 }: IconProps) => svg(size, <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />),
  Plus: ({ size = 24 }: IconProps) => svg(size, <path d="M12 5v14M5 12h14" />),
  Minus: ({ size = 24 }: IconProps) => svg(size, <path d="M5 12h14" />),
  Check: ({ size = 24 }: IconProps) => svg(size, <path d="M5 12.5l4.5 4.5L19 7.5" />),
  Close: ({ size = 22 }: IconProps) => svg(size, <path d="M6 6l12 12M18 6L6 18" />),
  Back: ({ size = 24 }: IconProps) => svg(size, <path d="M15 18l-6-6 6-6" />),
  Forward: ({ size = 24 }: IconProps) => svg(size, <path d="M9 18l6-6-6-6" />),
  Edit: ({ size = 22 }: IconProps) => svg(size, <path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" />),
  Trash: ({ size = 20 }: IconProps) => svg(size, <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />),
  Calendar: ({ size = 16 }: IconProps) => svg(size, <><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M16 2v4M8 2v4M3 10h18" /></>),
};
