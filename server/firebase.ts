import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const keyPath = path.join(__dirname, "firebase-service-account.json");

if (!fs.existsSync(keyPath)) {
  throw new Error(
    `Firebase service account key not found at ${keyPath}. Download it from Firebase Console -> Project settings -> Service accounts -> Generate new private key, and save it at that exact path.`
  );
}

const serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf-8"));

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount),
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  });
}

export const firebaseAuth = getAuth();
export const firestoreDb = getFirestore();
export const bucket = getStorage().bucket();
