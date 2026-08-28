import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp, type WriteBatch } from "firebase-admin/firestore";

// Standalone script (no long-running server anymore) -- run on a schedule by
// .github/workflows/purge-trash.yml. Permanently removes anything that has
// sat in the Trash Bin for more than 60 days.

const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "firebase-service-account.json";
const serviceAccount = JSON.parse(readFileSync(keyPath, "utf-8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const RETENTION_DAYS = 60;
const COLLECTIONS = ["lightingPurchases", "blumPurchases", "tasks", "issues", "scheduleEvents"];
const FILE_COLLECTION_BY_KIND: Record<string, string> = { tasks: "taskFiles", issues: "issueFiles" };

async function purgeExpiredTrash() {
  const cutoffMs = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

  for (const collectionName of COLLECTIONS) {
    const snap = await db.collection(collectionName).where("isDeleted", "==", true).get();

    const expired = snap.docs.filter((doc) => {
      const deletedAt = doc.data().deletedAt as Timestamp | undefined;
      return deletedAt && deletedAt.toMillis() < cutoffMs;
    });

    if (expired.length === 0) continue;

    const fileCollection = FILE_COLLECTION_BY_KIND[collectionName];
    if (fileCollection) {
      for (const doc of expired) {
        if (doc.data().hasFile) {
          await db.collection(fileCollection).doc(doc.id).delete();
        }
      }
    }

    const batches: WriteBatch[] = [];
    let batch = db.batch();
    let opsInBatch = 0;
    for (const doc of expired) {
      batch.delete(doc.ref);
      opsInBatch++;
      if (opsInBatch === 500) {
        batches.push(batch);
        batch = db.batch();
        opsInBatch = 0;
      }
    }
    if (opsInBatch > 0) batches.push(batch);

    await Promise.all(batches.map((b) => b.commit()));
    console.log(`Purged ${expired.length} expired ${collectionName} record(s).`);
  }
}

purgeExpiredTrash()
  .then(() => {
    console.log("Trash purge complete.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Trash purge failed:", error);
    process.exit(1);
  });
