import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// ONE-TIME migration: converts each task's singular fileName/fileType/
// fileUrl/filePublicId fields into an attachments[] array (supporting more
// than one file per task), then strips the old scalar fields. hasFile stays
// as-is (still means "this task has at least one attachment"). Re-running
// is harmless (no-ops once the scalar fields are already gone).

const SCALAR_FILE_KEYS = ["fileName", "fileType", "fileUrl", "filePublicId"];

const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "firebase-service-account.json";
const serviceAccount = JSON.parse(readFileSync(keyPath, "utf-8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function migrate() {
  const snap = await db.collection("tasks").get();
  console.log(`Found ${snap.docs.length} task document(s).`);

  let migrated = 0;
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if ("attachments" in data) {
      console.log(`  ${docSnap.id}: already migrated, skipping.`);
      continue;
    }

    const attachments = data.fileUrl
      ? [{ fileName: data.fileName, fileType: data.fileType ?? "application/octet-stream", fileUrl: data.fileUrl, publicId: data.filePublicId ?? null }]
      : [];

    const clearedFields: Record<string, FirebaseFirestore.FieldValue> = {};
    for (const key of SCALAR_FILE_KEYS) {
      if (key in data) clearedFields[key] = FieldValue.delete();
    }

    await docSnap.ref.update({ attachments, ...clearedFields });
    migrated++;
    console.log(`  ${docSnap.id}: migrated (${attachments.length} attachment(s)) - ${data.title}.`);
  }

  console.log(`Migration complete. ${migrated} document(s) migrated.`);
}

migrate()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
