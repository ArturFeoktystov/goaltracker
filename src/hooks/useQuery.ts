import { useEffect, useState } from 'react';
import { service } from '../data';

/**
 * Выполняет асинхронный запрос к сервису и перезапускает его при любом изменении данных.
 * Возвращает undefined, пока данные загружаются.
 */
export function useQuery<T>(query: () => Promise<T>, deps: unknown[]): T | undefined {
  const [data, setData] = useState<T>();

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      query().then((r) => {
        if (!cancelled) setData(r);
      });
    };
    run();
    const unsubscribe = service.store.subscribe(run);
    return () => {
      cancelled = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return data;
}
