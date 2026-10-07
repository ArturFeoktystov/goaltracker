import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Icon } from './components/ui';
import { useToday } from './hooks/useToday';
import { GoalDetailScreen } from './screens/GoalDetailScreen';
import { GoalsScreen } from './screens/GoalsScreen';
import { StatsScreen } from './screens/StatsScreen';
import { TodayScreen } from './screens/TodayScreen';

const tabs = [
  { to: '/today', label: 'Сегодня', icon: <Icon.Today /> },
  { to: '/goals', label: 'Цели', icon: <Icon.Target /> },
  { to: '/stats', label: 'Статистика', icon: <Icon.Chart /> },
];

export default function App() {
  const today = useToday();

  return (
    <div className="min-h-dvh md:pl-56">
      {/* боковая навигация на десктопе */}
      <nav className="fixed inset-y-0 left-0 hidden w-56 flex-col gap-1 border-r border-slate-200 bg-white p-4 md:flex dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex items-center gap-2 px-2 text-lg font-bold">
          <span className="text-accent">
            <Icon.Target size={28} />
          </span>
          Цели
        </div>
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `flex min-h-11 items-center gap-3 rounded-xl px-3 font-medium transition ${
                isActive ? 'bg-accent-soft text-accent' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`
            }
          >
            {t.icon}
            {t.label}
          </NavLink>
        ))}
      </nav>

      <main className="pb-28 md:pb-10">
        <Routes>
          <Route path="/" element={<Navigate to="/today" replace />} />
          <Route path="/today" element={<TodayScreen today={today} />} />
          <Route path="/goals" element={<GoalsScreen today={today} />} />
          <Route path="/goals/:id" element={<GoalDetailScreen today={today} />} />
          <Route path="/stats" element={<StatsScreen today={today} />} />
          <Route path="*" element={<Navigate to="/today" replace />} />
        </Routes>
      </main>

      {/* нижняя панель вкладок на телефоне */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/90 backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-2xl">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `flex min-h-16 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition ${
                  isActive ? 'text-accent' : 'text-slate-500 dark:text-slate-400'
                }`
              }
            >
              {t.icon}
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
