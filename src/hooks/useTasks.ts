import { useMutation } from "@tanstack/react-query";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { cloudinaryDownloadUrl, uploadToCloudinary } from "../lib/cloudinary";
import { compareNullableAsc, toIso } from "../lib/firestoreUtil";
import { useCollectionQuery } from "../lib/useFirestoreQuery";
import type { Task, TaskPriority } from "../lib/types";

const COLLECTION = "tasks";
// Legacy sibling collection: attachments uploaded before the Cloudinary
// migration are still stored here as base64 text, kept only for reading.
const LEGACY_FILES_COLLECTION = "taskFiles";

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
    fileUrl: data.fileUrl ?? null,
    createdBy: data.createdBy,
    createdAt: toIso(data.createdAt),
  };
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
      const uploaded = input.file ? await uploadToCloudinary(input.file) : null;
      const ref = await addDoc(collection(db, COLLECTION), {
        title: input.title,
        description: input.description ?? null,
        dueDate: input.dueDate ?? null,
        priority: input.priority,
        done: false,
        assignedTo: input.assignedTo ?? null,
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

export const useDeleteTasks = () =>
  useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => updateDoc(doc(db, COLLECTION, id), { isDeleted: true, deletedAt: serverTimestamp() })));
      return { success: true as const };
    },
  });

/** Removes an attachment from a task without deleting the task itself. Does not delete the Cloudinary asset. */
export const useRemoveTaskFile = () =>
  useMutation({
    mutationFn: async (id: string) => {
      await updateDoc(doc(db, COLLECTION, id), {
        fileName: null,
        fileType: null,
        fileUrl: null,
        filePublicId: null,
        hasFile: false,
      });
      await deleteDoc(doc(db, LEGACY_FILES_COLLECTION, id));
      return { success: true as const };
    },
  });

/** Legacy fallback only -- attachments uploaded before the Cloudinary migration. */
export async function fetchTaskFileBlob(id: string, fileType: string | null): Promise<Blob> {
  const snap = await getDoc(doc(db, LEGACY_FILES_COLLECTION, id));
  if (!snap.exists()) throw new Error("File not found");
  const { fileData } = snap.data() as { fileData: string };
  const binary = atob(fileData);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: fileType ?? "application/octet-stream" });
}

export async function downloadTaskFile(id: string, fileName: string, fileType: string | null, fileUrl?: string | null): Promise<void> {
  if (fileUrl) {
    const a = document.createElement("a");
    a.href = cloudinaryDownloadUrl(fileUrl);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }
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
