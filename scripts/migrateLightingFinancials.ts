import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// ONE-TIME migration: splits cost/selling/commission fields out of the
// existing lightingPurchases documents into new lightingFinancials
// documents (same id), then strips those fields from the original doc.
// Run once after publishing the updated firestore.rules, then delete this
// file -- re-running it is harmless (no-ops once fields are already gone)
// but it serves no purpose after the first run.

const FINANCIAL_KEYS = ["cost", "costs", "selling", "commissionGiven", "commissionRecipient"];

const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "firebase-service-account.json";
const serviceAccount = JSON.parse(readFileSync(keyPath, "utf-8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function migrate() {
  const snap = await db.collection("lightingPurchases").get();
  console.log(`Found ${snap.docs.length} lightingPurchases document(s).`);

  let migrated = 0;
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const hasFinancialFields = FINANCIAL_KEYS.some((k) => k in data);
    if (!hasFinancialFields) {
      console.log(`  ${docSnap.id}: no financial fields present, skipping.`);
      continue;
    }

    const costs = Array.isArray(data.costs) && data.costs.length > 0 ? data.costs : [{ vendor: null, amount: data.cost ?? 0 }];

    await db.collection("lightingFinancials").doc(docSnap.id).set({
      costs,
      cost: costs.reduce((sum: number, c: any) => sum + (c.amount ?? 0), 0),
      selling: data.selling ?? 0,
      commissionGiven: data.commissionGiven ?? 0,
      commissionRecipient: data.commissionRecipient ?? null,
    });

    const clearedFields: Record<string, FirebaseFirestore.FieldValue> = {};
    for (const key of FINANCIAL_KEYS) {
      if (key in data) clearedFields[key] = FieldValue.delete();
    }
    await docSnap.ref.update(clearedFields);

    migrated++;
    console.log(`  ${docSnap.id}: migrated (${data.brand} - ${data.clientName}).`);
  }

  console.log(`Migration complete. ${migrated} document(s) migrated.`);
}

migrate()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
