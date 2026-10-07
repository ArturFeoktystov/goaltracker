/** Дата в локальном формате YYYY-MM-DD (без времени и часового пояса). */
export type ISODate = string;

export type UnitType = 'pages' | 'km' | 'hours' | 'minutes' | 'reps' | 'custom' | 'check';

export type GoalStatus = 'active' | 'completed' | 'archived';

/** Поля синхронизации — есть у каждой сущности, чтобы позже подключить облако. */
export interface SyncMeta {
  id: string;
  /** ms since epoch, обновляется при каждом изменении (для last-write-wins). */
  updatedAt: number;
  /** Мягкое удаление: запись остаётся, чтобы удаление могло синхронизироваться. */
  deleted?: boolean;
}

export interface Goal extends SyncMeta {
  title: string;
  description?: string;
  unit: UnitType;
  /** Название единицы, если unit === 'custom'. */
  customUnit?: string;
  /** Накопительный режим: общий объём (напр. 300 страниц). */
  totalTarget?: number;
  /** Периодический режим: дневная норма (напр. 10 страниц в день). */
  dailyTarget?: number;
  /** Дата начала — с неё создаются дневные задачи. */
  startDate: ISODate;
  deadline?: ISODate;
  status: GoalStatus;
  createdAt: number;
  completedAt?: number;
}

export interface DailyTask extends SyncMeta {
  goalId?: string;
  title: string;
  date: ISODate;
  /** Целевое значение на день; undefined — простой чекбокс. */
  target?: number;
  actual: number;
  done: boolean;
}

export interface ProgressEntry extends SyncMeta {
  goalId: string;
  date: ISODate;
  value: number;
  /** Если запись создана из дневной задачи — ссылка на неё (одна запись на задачу). */
  taskId?: string;
  note?: string;
}

export type GoalInput = Pick<
  Goal,
  'title' | 'description' | 'unit' | 'customUnit' | 'totalTarget' | 'dailyTarget' | 'startDate' | 'deadline'
>;
