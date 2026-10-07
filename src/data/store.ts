// Абстракция хранилища. Сервисы и UI зависят только от этого интерфейса,
// поэтому локальную реализацию (Dexie) можно обернуть синхронизацией
// с облачным бэкендом, не трогая бизнес-логику.
import type { DailyTask, Goal, ProgressEntry, SyncMeta } from '../domain/types';

export interface Table<T extends SyncMeta> {
  /** Возвращает запись как есть, включая мягко удалённые. */
  get(id: string): Promise<T | undefined>;
  bulkGet(ids: string[]): Promise<(T | undefined)[]>;
  put(item: T): Promise<void>;
  bulkPut(items: T[]): Promise<void>;
  /** Запросы ниже не возвращают удалённые записи. */
  all(): Promise<T[]>;
  where<K extends keyof T & string>(field: K, value: T[K]): Promise<T[]>;
  between<K extends keyof T & string>(field: K, from: T[K], to: T[K]): Promise<T[]>;
  /** Все изменения после метки времени (включая удалённые) — для будущей синхронизации. */
  changedSince(ts: number): Promise<T[]>;
}

export interface Store {
  goals: Table<Goal>;
  tasks: Table<DailyTask>;
  entries: Table<ProgressEntry>;
  /** Атомарно выполняет несколько операций. */
  transaction<R>(fn: () => Promise<R>): Promise<R>;
  /** Подписка на любые изменения данных (в т.ч. из других вкладок). */
  subscribe(listener: () => void): () => void;
}
