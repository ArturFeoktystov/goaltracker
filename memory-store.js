// Хранилище в памяти с тем же интерфейсом, что и db.js. Используется в тестах.

const alive = (x) => !x.deleted;
const copy = (x) => (x === undefined ? undefined : structuredClone(x));

export function createMemoryStore() {
  const listeners = new Set();
  const notify = () => listeners.forEach((l) => l());

  const table = () => {
    const rows = new Map();
    const list = () => [...rows.values()].map(copy);
    return {
      get: async (id) => copy(rows.get(id)),
      bulkGet: async (ids) => ids.map((id) => copy(rows.get(id))),
      put: async (item) => {
        rows.set(item.id, copy(item));
        notify();
      },
      bulkPut: async (items) => {
        items.forEach((i) => rows.set(i.id, copy(i)));
        if (items.length) notify();
      },
      all: async () => list().filter(alive),
      where: async (field, value) => list().filter((r) => alive(r) && r[field] === value),
      between: async (field, from, to) => list().filter((r) => alive(r) && r[field] >= from && r[field] <= to),
      changedSince: async (ts) => list().filter((r) => r.updatedAt > ts),
    };
  };

  return {
    goals: table(),
    tasks: table(),
    entries: table(),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
