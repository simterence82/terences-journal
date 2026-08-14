import type { Timestamp, WriteBatch } from "firebase-admin/firestore";
import { firestoreDb } from "../firebase";

const RETENTION_DAYS = 120;
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // once a day

const COLLECTIONS = ["lightingPurchases", "blumPurchases", "tasks", "issues", "scheduleEvents"];

async function purgeExpiredTrash() {
  const cutoffMs = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

  for (const collectionName of COLLECTIONS) {
    const snap = await firestoreDb.collection(collectionName).where("isDeleted", "==", true).get();

    const expired = snap.docs.filter((doc) => {
      const deletedAt = doc.data().deletedAt as Timestamp | undefined;
      return deletedAt && deletedAt.toMillis() < cutoffMs;
    });

    if (expired.length === 0) continue;

    const batches: WriteBatch[] = [];
    let batch = firestoreDb.batch();
    let opsInBatch = 0;
    for (const doc of expired) {
      batch.delete(doc.ref);
      opsInBatch++;
      if (opsInBatch === 500) {
        batches.push(batch);
        batch = firestoreDb.batch();
        opsInBatch = 0;
      }
    }
    if (opsInBatch > 0) batches.push(batch);

    await Promise.all(batches.map((b) => b.commit()));
  }
}

// Runs once at server startup, then every 24 hours -- permanently removes
// anything that has sat in the Trash Bin for more than 120 days.
export function startPurgeJob() {
  purgeExpiredTrash().catch((error) => console.error("Trash purge failed:", error));
  setInterval(() => {
    purgeExpiredTrash().catch((error) => console.error("Trash purge failed:", error));
  }, CHECK_INTERVAL_MS);
}
