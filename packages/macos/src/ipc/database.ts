import { IpcMain } from 'electron';
import Database from 'better-sqlite3';
import * as path from 'path';
import { app } from 'electron';

let db: Database.Database | null = null;

function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = path.join(app.getPath('userData'), 'codepop.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    initializeTables(db);
  }
  return db;
}

function initializeTables(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS repos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      last_indexed INTEGER,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_id INTEGER NOT NULL,
      path TEXT NOT NULL,
      content TEXT,
      language TEXT,
      indexed_at INTEGER,
      FOREIGN KEY (repo_id) REFERENCES repos(id) ON DELETE CASCADE,
      UNIQUE(repo_id, path)
    );

    CREATE TABLE IF NOT EXISTS embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id INTEGER NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      embedding BLOB,
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
      UNIQUE(file_id, chunk_index)
    );

    CREATE TABLE IF NOT EXISTS search_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query TEXT NOT NULL,
      results_count INTEGER,
      searched_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_files_repo ON files(repo_id);
    CREATE INDEX IF NOT EXISTS idx_embeddings_file ON embeddings(file_id);
    CREATE INDEX IF NOT EXISTS idx_search_history_date ON search_history(searched_at);
  `);
}

export function setupDatabaseHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('db-query', async (_, sql: string, params?: unknown[]) => {
    try {
      const database = getDatabase();
      const stmt = database.prepare(sql);
      return params ? stmt.all(...params) : stmt.all();
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  });

  ipcMain.handle('db-run', async (_, sql: string, params?: unknown[]) => {
    try {
      const database = getDatabase();
      const stmt = database.prepare(sql);
      const result = params ? stmt.run(...params) : stmt.run();
      return { changes: result.changes, lastInsertRowid: Number(result.lastInsertRowid) };
    } catch (error) {
      console.error('Database run error:', error);
      throw error;
    }
  });

  ipcMain.handle('db-get-all', async (_, table: string, filter?: Record<string, unknown>) => {
    try {
      const database = getDatabase();
      if (!filter) {
        return database.prepare(`SELECT * FROM ${table}`).all();
      }
      const keys = Object.keys(filter);
      const conditions = keys.map((k) => `${k} = ?`).join(' AND ');
      const values = Object.values(filter);
      return database.prepare(`SELECT * FROM ${table} WHERE ${conditions}`).all(...values);
    } catch (error) {
      console.error('Database getAll error:', error);
      throw error;
    }
  });

  ipcMain.handle('db-get-by-id', async (_, table: string, id: string | number) => {
    try {
      const database = getDatabase();
      return database.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
    } catch (error) {
      console.error('Database getById error:', error);
      throw error;
    }
  });

  ipcMain.handle('db-insert', async (_, table: string, data: Record<string, unknown>) => {
    try {
      const database = getDatabase();
      const keys = Object.keys(data);
      const values = Object.values(data);
      const placeholders = keys.map(() => '?').join(', ');
      const result = database
        .prepare(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`)
        .run(...values);
      return Number(result.lastInsertRowid);
    } catch (error) {
      console.error('Database insert error:', error);
      throw error;
    }
  });

  ipcMain.handle('db-update', async (_, table: string, id: string | number, data: Record<string, unknown>) => {
    try {
      const database = getDatabase();
      const keys = Object.keys(data);
      const values = Object.values(data);
      const setClause = keys.map((k) => `${k} = ?`).join(', ');
      const result = database
        .prepare(`UPDATE ${table} SET ${setClause} WHERE id = ?`)
        .run(...values, id);
      return result.changes > 0;
    } catch (error) {
      console.error('Database update error:', error);
      throw error;
    }
  });

  ipcMain.handle('db-delete', async (_, table: string, id: string | number) => {
    try {
      const database = getDatabase();
      const result = database.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Database delete error:', error);
      throw error;
    }
  });
}
