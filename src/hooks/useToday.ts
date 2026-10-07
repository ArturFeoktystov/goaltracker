import { useEffect, useRef, useState } from 'react';
import { today } from '../domain/dates';
import { service } from '../data';

/** Текущая дата; обновляется при возврате в приложение после полуночи и досоздаёт задачи. */
export function useToday(): string {
  const [date, setDate] = useState(today);
  const last = useRef(date);

  useEffect(() => {
    service.ensureDailyTasks();
    const check = () => {
      const d = today();
      if (d === last.current) return;
      last.current = d;
      setDate(d);
      service.ensureDailyTasks();
    };
    const timer = setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  return date;
}
