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
import { compareNullableAsc, toIso } from "../lib/firestoreUtil";
import { useCollectionQuery } from "../lib/useFirestoreQuery";
import type { Task, TaskPriority } from "../lib/types";

const COLLECTION = "tasks";
const FILES_COLLECTION = "taskFiles";

// Firestore documents are capped at 1MiB; base64 inflates raw bytes by ~33%,
// so the effective raw-file ceiling here is roughly 700 * 1024 bytes. Not
// enforced client-side -- an oversized file simply fails the setDoc below and
// surfaces via the mutation's onError.

function toTask(id: string, data: Record<string, any>): Task {
  return {
    id,
    title: data.title,
    description: data.description,
    dueDate: data.dueDate,
    priority: data.priority,
    done: data.done,
    assignedTo: data.assignedTo,
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

export const useTasksList = () =>
  useCollectionQuery(
    () => query(collection(db, COLLECTION), where("isDeleted", "==", false)),
    toTask,
    (a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const dueCmp = compareNullableAsc(a.dueDate, b.dueDate);
      if (dueCmp !== 0) return dueCmp;
      return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
    }
  );

export interface TaskCreateInput {
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: TaskPriority;
  assignedTo: string | null;
  file?: File | null;
}

export const useCreateTask = () =>
  useMutation({
    mutationFn: async (input: TaskCreateInput) => {
      const ref = await addDoc(collection(db, COLLECTION), {
        title: input.title,
        description: input.description ?? null,
        dueDate: input.dueDate ?? null,
        priority: input.priority,
        done: false,
        assignedTo: input.assignedTo ?? null,
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
      return toTask(snap.id, snap.data()!);
    },
  });

export interface TaskUpdateInput {
  id: string;
  title?: string;
  description?: string | null;
  dueDate?: string | null;
  priority?: TaskPriority;
  assignedTo?: string | null;
  done?: boolean;
}

export const useUpdateTask = () =>
  useMutation({
    mutationFn: async ({ id, ...updates }: TaskUpdateInput) => {
      const ref = doc(db, COLLECTION, id);
      await updateDoc(ref, updates);
      const snap = await getDoc(ref);
      return toTask(snap.id, snap.data()!);
    },
  });

export const useDeleteTask = () =>
  useMutation({
    mutationFn: async (id: string) => {
      await updateDoc(doc(db, COLLECTION, id), { isDeleted: true, deletedAt: serverTimestamp() });
      return { success: true as const };
    },
  });

export async function fetchTaskFileBlob(id: string, fileType: string | null): Promise<Blob> {
  const snap = await getDoc(doc(db, FILES_COLLECTION, id));
  if (!snap.exists()) throw new Error("File not found");
  const { fileData } = snap.data() as { fileData: string };
  const binary = atob(fileData);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: fileType ?? "application/octet-stream" });
}

export async function downloadTaskFile(id: string, fileName: string, fileType: string | null): Promise<void> {
  const blob = await fetchTaskFileBlob(id, fileType);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
