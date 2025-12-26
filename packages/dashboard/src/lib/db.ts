import { SQLiteStateStore } from '@conductor/state';

let stateStore: SQLiteStateStore | null = null;

export function getStateStore(): SQLiteStateStore {
  if (!stateStore) {
    const dbPath = process.env.CONDUCTOR_DB || './conductor.db';
    stateStore = new SQLiteStateStore({ dbPath });
  }
  return stateStore;
}

export function getProjectId(): string {
  return process.env.CONDUCTOR_PROJECT_ID || 'default';
}
