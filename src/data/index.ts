import { createDexieStore } from './dexie/dexieStore';
import { GoalService } from './service';

// Точка сборки слоя данных. Для облачной синхронизации достаточно
// подменить store на реализацию, оборачивающую локальный.
export const service = new GoalService(createDexieStore());
