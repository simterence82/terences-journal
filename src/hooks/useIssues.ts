import { useMutation } from "@tanstack/react-query";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { cloudinaryDownloadUrl, uploadToCloudinary } from "../lib/cloudinary";
import { toIso } from "../lib/firestoreUtil";
import { useCollectionQuery } from "../lib/useFirestoreQuery";
import type { Issue } from "../lib/types";

const COLLECTION = "issues";
// Legacy sibling collection: attachments uploaded before the Cloudinary
// migration are still stored here as base64 text, kept only for reading.
const LEGACY_FILES_COLLECTION = "issueFiles";

const ALLOWED_ISSUE_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];

function toIssue(id: string, data: Record<string, any>): Issue {
  return {
    id,
    title: data.title,
    description: data.description,
    resolved: data.resolved,
    fileName: data.fileName,
    fileType: data.fileType,
    fileUrl: data.fileUrl ?? null,
    createdBy: data.createdBy,
    createdAt: toIso(data.createdAt),
  };
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
      const uploaded = input.file ? await uploadToCloudinary(input.file) : null;
      const ref = await addDoc(collection(db, COLLECTION), {
        title: input.title,
        description: input.description ?? null,
        resolved: false,
        fileName: input.file?.name ?? null,
        fileType: input.file ? input.file.type || "application/octet-stream" : null,
        fileUrl: uploaded?.url ?? null,
        filePublicId: uploaded?.publicId ?? null,
        hasFile: !!input.file,
        createdBy: auth.currentUser?.uid ?? null,
        createdAt: serverTimestamp(),
        isDeleted: false,
      });
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

export async function downloadIssueFile(id: string, fileName: string, fileType: string | null, fileUrl?: string | null): Promise<void> {
  if (fileUrl) {
    const a = document.createElement("a");
    a.href = cloudinaryDownloadUrl(fileUrl);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }
  const snap = await getDoc(doc(db, LEGACY_FILES_COLLECTION, id));
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
