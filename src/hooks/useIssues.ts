import { useMutation } from "@tanstack/react-query";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { toIso } from "../lib/firestoreUtil";
import { useCollectionQuery } from "../lib/useFirestoreQuery";
import type { Issue } from "../lib/types";

const COLLECTION = "issues";
const FILES_COLLECTION = "issueFiles";

const ALLOWED_ISSUE_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];

// Firestore documents are capped at 1MiB; base64 inflates raw bytes by ~33%,
// so the effective raw-file ceiling here is roughly 700 * 1024 bytes. Not
// enforced client-side -- an oversized file simply fails the setDoc below and
// surfaces via the mutation's onError.

function toIssue(id: string, data: Record<string, any>): Issue {
  return {
    id,
    title: data.title,
    description: data.description,
    resolved: data.resolved,
    fileName: data.fileName,
    fileType: data.fileType,
    createdBy: data.createdBy,
    createdAt: toIso(data.createdAt),
  };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const useIssuesList = () =>
  useCollectionQuery(
    () => query(collection(db, COLLECTION), where("isDeleted", "==", false)),
    toIssue,
    (a, b) => {
      if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
      return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
    }
  );

export interface IssueCreateInput {
  title: string;
  description: string | null;
  file?: File | null;
}

export const useCreateIssue = () =>
  useMutation({
    mutationFn: async (input: IssueCreateInput) => {
      if (input.file && !ALLOWED_ISSUE_FILE_TYPES.includes(input.file.type)) {
        throw new Error("Only PDF, JPEG, or PNG attachments are allowed");
      }
      const ref = await addDoc(collection(db, COLLECTION), {
        title: input.title,
        description: input.description ?? null,
        resolved: false,
        fileName: input.file?.name ?? null,
        fileType: input.file ? input.file.type || "application/octet-stream" : null,
        hasFile: !!input.file,
        createdBy: auth.currentUser?.uid ?? null,
        createdAt: serverTimestamp(),
        isDeleted: false,
      });
      if (input.file) {
        const fileData = await fileToBase64(input.file);
        await setDoc(doc(db, FILES_COLLECTION, ref.id), { fileData });
      }
      const snap = await getDoc(ref);
      return toIssue(snap.id, snap.data()!);
    },
  });

export interface IssueUpdateInput {
  id: string;
  title?: string;
  description?: string | null;
  resolved?: boolean;
}

export const useUpdateIssue = () =>
  useMutation({
    mutationFn: async ({ id, ...updates }: IssueUpdateInput) => {
      const ref = doc(db, COLLECTION, id);
      await updateDoc(ref, updates);
      const snap = await getDoc(ref);
      return toIssue(snap.id, snap.data()!);
    },
  });

export const useDeleteIssue = () =>
  useMutation({
    mutationFn: async (id: string) => {
      await updateDoc(doc(db, COLLECTION, id), { isDeleted: true, deletedAt: serverTimestamp() });
      return { success: true as const };
    },
  });

export async function downloadIssueFile(id: string, fileName: string, fileType: string | null): Promise<void> {
  const snap = await getDoc(doc(db, FILES_COLLECTION, id));
  if (!snap.exists()) return;
  const { fileData } = snap.data() as { fileData: string };
  const binary = atob(fileData);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: fileType ?? "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
