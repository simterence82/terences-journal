import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Standalone script (no long-running server anymore) -- run on a schedule by
// .github/workflows/cleanup-orphaned-files.yml. Removing an attachment or
// permanently deleting a task/issue only clears the Firestore record -- the
// browser has no Cloudinary API secret to delete the underlying file with.
// This script reconciles the two: anything in Cloudinary that no current
// task/issue points to gets deleted.

const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "firebase-service-account.json";
const serviceAccount = JSON.parse(readFileSync(keyPath, "utf-8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;
if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
  throw new Error("Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.");
}

const AUTH_HEADER = "Basic " + Buffer.from(`${API_KEY}:${API_SECRET}`).toString("base64");
// Cloudinary's "auto" upload endpoint files images/PDFs under "image", but
// videos and other formats (docx, zip, ...) land under "video"/"raw".
const RESOURCE_TYPES = ["image", "video", "raw"] as const;
// Skip anything uploaded in the last 24h, in case its Firestore write is
// still in flight when this runs.
const GRACE_MS = 24 * 60 * 60 * 1000;

interface CloudinaryAsset {
  public_id: string;
  created_at: string;
}

async function collectInUsePublicIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const collectionName of ["tasks", "issues"]) {
    const snap = await db.collection(collectionName).get();
    for (const doc of snap.docs) {
      const publicId = doc.data().filePublicId;
      if (publicId) ids.add(publicId);
    }
  }
  return ids;
}

async function listCloudinaryAssets(resourceType: string): Promise<CloudinaryAsset[]> {
  const assets: CloudinaryAsset[] = [];
  let cursor: string | undefined;
  do {
    const url = new URL(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/${resourceType}/upload`);
    url.searchParams.set("max_results", "500");
    if (cursor) url.searchParams.set("next_cursor", cursor);
    const res = await fetch(url, { headers: { Authorization: AUTH_HEADER } });
    if (!res.ok) throw new Error(`Cloudinary list (${resourceType}) failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    assets.push(...data.resources);
    cursor = data.next_cursor;
  } while (cursor);
  return assets;
}

async function deleteCloudinaryAssets(resourceType: string, publicIds: string[]): Promise<void> {
  for (let i = 0; i < publicIds.length; i += 100) {
    const chunk = publicIds.slice(i, i + 100);
    const url = new URL(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/${resourceType}/upload`);
    for (const id of chunk) url.searchParams.append("public_ids[]", id);
    const res = await fetch(url, { method: "DELETE", headers: { Authorization: AUTH_HEADER } });
    if (!res.ok) throw new Error(`Cloudinary delete (${resourceType}) failed: ${res.status} ${await res.text()}`);
  }
}

async function cleanupOrphanedCloudinaryFiles() {
  const inUse = await collectInUsePublicIds();
  const cutoffMs = Date.now() - GRACE_MS;

  for (const resourceType of RESOURCE_TYPES) {
    const assets = await listCloudinaryAssets(resourceType);
    const orphaned = assets.filter(
      (asset) => !inUse.has(asset.public_id) && new Date(asset.created_at).getTime() < cutoffMs
    );
    if (orphaned.length === 0) {
      console.log(`No orphaned ${resourceType} assets.`);
      continue;
    }
    await deleteCloudinaryAssets(resourceType, orphaned.map((a) => a.public_id));
    console.log(
      `Deleted ${orphaned.length} orphaned ${resourceType} asset(s): ${orphaned.map((a) => a.public_id).join(", ")}`
    );
  }
}

cleanupOrphanedCloudinaryFiles()
  .then(() => {
    console.log("Orphaned Cloudinary file cleanup complete.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Orphaned Cloudinary file cleanup failed:", error);
    process.exit(1);
  });
