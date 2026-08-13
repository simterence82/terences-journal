import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const dbPath = process.env.DATABASE_PATH || "./data/journal.db";
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

// Bootstraps the schema directly with SQL DDL -- keeps first-run setup to
// just `npm install && npm run dev` for a single-file SQLite database, no
// separate migration step and no native build tooling required (node:sqlite
// is built into Node.js itself).
//
// NOTE: user accounts and login credentials live entirely in Firebase
// Authentication (see server/firebase.ts) -- there is no local `users`
// table. `created_by` columns below store the Firebase UID (a string) of
// whoever created the record, with no local foreign key.
export function initDatabase() {
  db.exec(`
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
      created_by TEXT,
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
      created_by TEXT,
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
      created_by TEXT,
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
      created_by TEXT,
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
      created_by TEXT,
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
