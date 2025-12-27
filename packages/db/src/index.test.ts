import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock better-sqlite3
vi.mock('better-sqlite3', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      pragma: vi.fn(),
    })),
  };
});

// Mock drizzle-orm/better-sqlite3
vi.mock('drizzle-orm/better-sqlite3', () => ({
  drizzle: vi.fn().mockReturnValue({ type: 'sqlite-db' }),
}));

// Mock @neondatabase/serverless
vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn().mockReturnValue({ type: 'neon-sql' }),
}));

// Mock drizzle-orm/neon-http
vi.mock('drizzle-orm/neon-http', () => ({
  drizzle: vi.fn().mockReturnValue({ type: 'neon-db' }),
}));

import Database from 'better-sqlite3';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { createSqliteDb, createNeonDb, createDb, getDb } from './index';

describe('Database Connection Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createSqliteDb', () => {
    it('should create SQLite database with WAL mode', () => {
      const db = createSqliteDb('./test.db');

      expect(Database).toHaveBeenCalledWith('./test.db');
      expect(drizzleSqlite).toHaveBeenCalled();
      expect(db).toEqual({ type: 'sqlite-db' });
    });

    it('should set journal mode to WAL', () => {
      const mockDb = { pragma: vi.fn() };
      vi.mocked(Database).mockImplementation(() => mockDb as any);

      createSqliteDb('./test.db');

      expect(mockDb.pragma).toHaveBeenCalledWith('journal_mode = WAL');
    });

    it('should work with different file paths', () => {
      createSqliteDb('/path/to/database.sqlite');
      expect(Database).toHaveBeenCalledWith('/path/to/database.sqlite');

      createSqliteDb(':memory:');
      expect(Database).toHaveBeenCalledWith(':memory:');
    });
  });

  describe('createNeonDb', () => {
    it('should create Neon database connection', () => {
      const db = createNeonDb('postgres://user:pass@host/db');

      expect(neon).toHaveBeenCalledWith('postgres://user:pass@host/db');
      expect(drizzleNeon).toHaveBeenCalled();
      expect(db).toEqual({ type: 'neon-db' });
    });

    it('should work with different connection strings', () => {
      createNeonDb('postgres://localhost:5432/test');
      expect(neon).toHaveBeenCalledWith('postgres://localhost:5432/test');
    });
  });

  describe('createDb', () => {
    it('should create SQLite database when type is sqlite', () => {
      const db = createDb({ type: 'sqlite', url: './conductor.db' });

      expect(Database).toHaveBeenCalledWith('./conductor.db');
      expect(db).toEqual({ type: 'sqlite-db' });
    });

    it('should create Neon database when type is neon', () => {
      const db = createDb({ type: 'neon', url: 'postgres://host/db' });

      expect(neon).toHaveBeenCalledWith('postgres://host/db');
      expect(db).toEqual({ type: 'neon-db' });
    });
  });

  describe('getDb', () => {
    beforeEach(() => {
      // Reset module state between tests
      vi.resetModules();
    });

    it('should create database with provided config', async () => {
      // Re-import to get fresh module state
      const { getDb: freshGetDb } = await import('./index');

      const db = freshGetDb({ type: 'sqlite', url: './custom.db' });

      expect(Database).toHaveBeenCalledWith('./custom.db');
      expect(db).toEqual({ type: 'sqlite-db' });
    });

    it('should create default SQLite database when no config provided', async () => {
      const originalEnv = process.env['CONDUCTOR_DB_PATH'];
      delete process.env['CONDUCTOR_DB_PATH'];

      // Re-import to get fresh module state
      const { getDb: freshGetDb } = await import('./index');

      freshGetDb();

      expect(Database).toHaveBeenCalledWith('./conductor.db');

      process.env['CONDUCTOR_DB_PATH'] = originalEnv;
    });

    it('should use CONDUCTOR_DB_PATH environment variable', async () => {
      const originalEnv = process.env['CONDUCTOR_DB_PATH'];
      process.env['CONDUCTOR_DB_PATH'] = './env-specified.db';

      vi.resetModules();
      const { getDb: freshGetDb } = await import('./index');

      freshGetDb();

      expect(Database).toHaveBeenCalledWith('./env-specified.db');

      process.env['CONDUCTOR_DB_PATH'] = originalEnv;
    });

    it('should return cached database on subsequent calls', async () => {
      vi.resetModules();
      const { getDb: freshGetDb } = await import('./index');

      const db1 = freshGetDb();
      const db2 = freshGetDb();

      expect(db1).toBe(db2);
    });
  });
});
