// Хранилище в IndexedDB. Все данные остаются на устройстве.
//
// Интерфейс хранилища (его же реализует memory-store.js для тестов):
//   store.goals / store.tasks / store.entries — таблицы с методами
//     get(id), bulkGet(ids)          — как есть, включая мягко удалённые записи
//     put(item), bulkPut(items)
//     all(), where(field, value), between(field, from, to) — без удалённых записей
//     changedSince(ts)               — все изменения после метки времени (для синхронизации)
//   store.subscribe(listener)        — уведомления об изменениях (и из других вкладок)
//
// Чтобы добавить облачную синхронизацию, достаточно обернуть это хранилище — сервис и интерфейс не меняются.

const DB_VERSION = 1;
const INDEXES = {
  goals: ["status", "updatedAt"],
  tasks: ["date", "goalId", "updatedAt"],
  entries: ["goalId", "date", "updatedAt"],
};

const alive = (x) => !x.deleted;
const promisify = (request) =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

export function createIdbStore(name = "goaltracker") {
  let dbPromise;
  function open() {
    dbPromise ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(name, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const [table, indexes] of Object.entries(INDEXES)) {
          const os = db.createObjectStore(table, { keyPath: "id" });
          for (const field of indexes) os.createIndex(field, field);
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => reject(request.error);
    });
    return dbPromise;
  }

  async function read(table, action) {
    const db = await open();
    return promisify(action(db.transaction(table).objectStore(table)));
  }

  async function write(table, items) {
    if (!items.length) return;
    const db = await open();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(table, "readwrite");
      const os = tx.objectStore(table);
      for (const item of items) os.put(item);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    notify();
  }

  const table = (t) => ({
    get: (id) => read(t, (os) => os.get(id)),
    bulkGet: (ids) => Promise.all(ids.map((id) => read(t, (os) => os.get(id)))),
    put: (item) => write(t, [item]),
    bulkPut: (items) => write(t, items),
    all: async () => (await read(t, (os) => os.getAll())).filter(alive),
    where: async (field, value) => (await read(t, (os) => os.index(field).getAll(value))).filter(alive),
    between: async (field, from, to) =>
      (await read(t, (os) => os.index(field).getAll(IDBKeyRange.bound(from, to)))).filter(alive),
    changedSince: (ts) => read(t, (os) => os.index("updatedAt").getAll(IDBKeyRange.lowerBound(ts, true))),
  });

  // Изменения склеиваются в одно уведомление; другие вкладки узнают о них через BroadcastChannel.
  const listeners = new Set();
  const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(`${name}-changes`) : null;
  const emit = () => listeners.forEach((l) => l());
  let scheduled = false;
  function notify() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      emit();
      channel?.postMessage("changed");
    });
  }
  channel?.addEventListener("message", emit);

  return {
    goals: table("goals"),
    tasks: table("tasks"),
    entries: table("entries"),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Просит браузер не удалять данные при нехватке места. */
export function requestPersistentStorage() {
  navigator.storage?.persist?.().catch(() => {});
}
