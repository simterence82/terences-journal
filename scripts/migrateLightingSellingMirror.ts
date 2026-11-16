import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// ONE-TIME migration: copies each Smart Lighting entry's selling price from
// lightingFinancials (Super Admin only) onto the lightingPurchases doc, so the
// Pending Claims total can be shown to Admin as well. Cost, profit and
// commission are NOT copied. Re-running is harmless.

const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "firebase-service-account.json";
initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, "utf-8"))) });
const db = getFirestore();

async function migrate() {
  const financials = await db.collection("lightingFinancials").get();
  let updated = 0;
  for (const fin of financials.docs) {
    const selling = Number(fin.data().selling ?? 0);
    const ref = db.collection("lightingPurchases").doc(fin.id);
    const purchase = await ref.get();
    if (!purchase.exists) continue;
    if (purchase.data()?.selling === selling) continue;
    await ref.update({ selling });
    updated++;
    console.log(`  ${fin.id}: selling = ${selling}`);
  }
  console.log(`Done. ${updated} entr${updated === 1 ? "y" : "ies"} updated.`);
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
