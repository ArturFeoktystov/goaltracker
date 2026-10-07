import Dexie, { type EntityTable } from 'dexie';
import type { DailyTask, Goal, ProgressEntry, SyncMeta } from '../../domain/types';
import type { Store, Table } from '../store';

class GoalsDB extends Dexie {
  goals!: EntityTable<Goal, 'id'>;
  tasks!: EntityTable<DailyTask, 'id'>;
  entries!: EntityTable<ProgressEntry, 'id'>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      goals: 'id, status, updatedAt',
      tasks: 'id, date, goalId, updatedAt',
      entries: 'id, goalId, date, taskId, updatedAt',
    });
  }
}

const alive = <T extends SyncMeta>(x: T) => !x.deleted;

function wrapTable<T extends SyncMeta>(t: Dexie.Table<T, string>, notify: () => void): Table<T> {
  return {
    get: (id) => t.get(id),
    bulkGet: (ids) => t.bulkGet(ids),
    async put(item) {
      await t.put(item);
      notify();
    },
    async bulkPut(items) {
      if (!items.length) return;
      await t.bulkPut(items);
      notify();
    },
    all: async () => (await t.toArray()).filter(alive),
    where: async (field, value) =>
      (await t.where(field).equals(value as unknown as string).toArray()).filter(alive),
    between: async (field, from, to) =>
      (await t
        .where(field)
        .between(from as unknown as string, to as unknown as string, true, true)
        .toArray()).filter(alive),
    changedSince: (ts) => t.where('updatedAt').above(ts).toArray(),
  };
}

export function createDexieStore(name = 'goal-tracker'): Store {
  const db = new GoalsDB(name);
  const listeners = new Set<() => void>();
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(`${name}-changes`) : null;

  let scheduled = false;
  const emit = () => {
    listeners.forEach((l) => l());
  };
  // Склеиваем серию записей в одно уведомление.
  const notify = () => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      emit();
      channel?.postMessage('changed');
    }, 0);
  };
  channel?.addEventListener('message', emit);

  return {
    goals: wrapTable(db.goals as unknown as Dexie.Table<Goal, string>, notify),
    tasks: wrapTable(db.tasks as unknown as Dexie.Table<DailyTask, string>, notify),
    entries: wrapTable(db.entries as unknown as Dexie.Table<ProgressEntry, string>, notify),
    transaction: (fn) => db.transaction('rw', db.goals, db.tasks, db.entries, fn),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
