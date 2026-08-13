import { db } from "../db";

const RETENTION_DAYS = 120;
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // once a day

const TABLES = ["lighting_purchases", "blum_purchases", "tasks", "issues", "schedule_events"];

function purgeExpiredTrash() {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  for (const table of TABLES) {
    db.prepare(`DELETE FROM ${table} WHERE deleted_at IS NOT NULL AND deleted_at < ?`).run(cutoff);
  }
}

// Runs once at server startup, then every 24 hours -- permanently removes
// anything that has sat in the Trash Bin for more than 120 days.
export function startPurgeJob() {
  try {
    purgeExpiredTrash();
  } catch (error) {
    console.error("Trash purge failed:", error);
  }
  setInterval(() => {
    try {
      purgeExpiredTrash();
    } catch (error) {
      console.error("Trash purge failed:", error);
    }
  }, CHECK_INTERVAL_MS);
}
