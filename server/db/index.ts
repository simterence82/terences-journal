import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const dbPath = process.env.DATABASE_PATH || "./data/journal.db";
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

// Bootstraps the schema directly with SQL DDL rather than requiring a
// separate drizzle-kit migration step -- keeps first-run setup to just
// `npm install && npm run dev` for a single-file SQLite database.
export function initDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lighting_purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand TEXT NOT NULL,
      client_name TEXT NOT NULL,
      address TEXT NOT NULL,
      date TEXT NOT NULL,
      commission_given REAL NOT NULL DEFAULT 0,
      commission_recipient TEXT,
      cost REAL NOT NULL DEFAULT 0,
      selling REAL NOT NULL DEFAULT 0,
      paid_to_seller INTEGER NOT NULL DEFAULT 0,
      reimbursed INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at INTEGER NOT NULL,
      deleted_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS blum_purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_name TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      date TEXT NOT NULL,
      paid_to_seller INTEGER NOT NULL DEFAULT 0,
      reimbursed INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at INTEGER NOT NULL,
      deleted_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      due_date TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      done INTEGER NOT NULL DEFAULT 0,
      assigned_to TEXT,
      file_name TEXT,
      file_data TEXT,
      file_type TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at INTEGER NOT NULL,
      deleted_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      file_name TEXT,
      file_data TEXT,
      file_type TEXT,
      resolved INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at INTEGER NOT NULL,
      deleted_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS schedule_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      location TEXT,
      notes TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at INTEGER NOT NULL,
      deleted_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_lighting_deleted_at ON lighting_purchases (deleted_at);
    CREATE INDEX IF NOT EXISTS idx_blum_deleted_at ON blum_purchases (deleted_at);
    CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks (deleted_at);
    CREATE INDEX IF NOT EXISTS idx_issues_deleted_at ON issues (deleted_at);
    CREATE INDEX IF NOT EXISTS idx_schedule_deleted_at ON schedule_events (deleted_at);
    CREATE INDEX IF NOT EXISTS idx_schedule_date ON schedule_events (date);
  `);
}
