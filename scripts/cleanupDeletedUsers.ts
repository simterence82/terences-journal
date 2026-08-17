import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Standalone script (no long-running server anymore) -- run on a schedule by
// .github/workflows/cleanup-deleted-users.yml. The browser can't delete a
// Firebase Auth account other than its own signed-in user, so when an admin
// removes someone in the Users page, it just queues a pendingAuthDeletions
// doc; this script finishes the job with Admin SDK privileges, freeing the
// email address for someone else to sign up with.

const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "firebase-service-account.json";
const serviceAccount = JSON.parse(readFileSync(keyPath, "utf-8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const auth = getAuth();

async function cleanupDeletedUsers() {
  const snap = await db.collection("pendingAuthDeletions").get();
  if (snap.empty) {
    console.log("No pending Auth account deletions.");
    return;
  }

  for (const docSnap of snap.docs) {
    const uid = docSnap.id;
    try {
      await auth.deleteUser(uid);
      console.log(`Deleted Auth account for ${docSnap.data().email ?? uid}.`);
    } catch (error: any) {
      if (error?.code !== "auth/user-not-found") {
        console.error(`Failed to delete Auth account ${uid}:`, error);
        continue; // leave the queued doc so it's retried next run
      }
    }
    await docSnap.ref.delete();
  }
}

cleanupDeletedUsers()
  .then(() => {
    console.log("Deleted-user cleanup complete.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Deleted-user cleanup failed:", error);
    process.exit(1);
  });
