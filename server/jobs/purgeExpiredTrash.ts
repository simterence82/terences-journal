import { isNotNull, lt, and } from "drizzle-orm";
import { db } from "../db";
import { lightingPurchases, blumPurchases, tasks, issues, scheduleEvents } from "../db/schema";

const RETENTION_DAYS = 120;
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // once a day

async function purgeExpiredTrash() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  await db.delete(lightingPurchases).where(and(isNotNull(lightingPurchases.deletedAt), lt(lightingPurchases.deletedAt, cutoff)));
  await db.delete(blumPurchases).where(and(isNotNull(blumPurchases.deletedAt), lt(blumPurchases.deletedAt, cutoff)));
  await db.delete(tasks).where(and(isNotNull(tasks.deletedAt), lt(tasks.deletedAt, cutoff)));
  await db.delete(issues).where(and(isNotNull(issues.deletedAt), lt(issues.deletedAt, cutoff)));
  await db.delete(scheduleEvents).where(and(isNotNull(scheduleEvents.deletedAt), lt(scheduleEvents.deletedAt, cutoff)));
}

// Runs once at server startup, then every 24 hours -- permanently removes
// anything that has sat in the Trash Bin for more than 120 days.
export function startPurgeJob() {
  purgeExpiredTrash().catch((error) => console.error("Trash purge failed:", error));
  setInterval(() => {
    purgeExpiredTrash().catch((error) => console.error("Trash purge failed:", error));
  }, CHECK_INTERVAL_MS);
}
