import { useMutation } from "@tanstack/react-query";
import {
  addDoc,
  arrayUnion,
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
import { compareNullableAsc, toIso } from "../lib/firestoreUtil";
import { useCollectionQuery } from "../lib/useFirestoreQuery";
import type { Task, TaskAttachment, TaskPriority } from "../lib/types";

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
    attachments: Array.isArray(data.attachments) ? data.attachments : [],
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
  files?: File[];
}

async function uploadAttachments(files: File[]): Promise<TaskAttachment[]> {
  return Promise.all(
    files.map(async (file) => {
      const { url, publicId } = await uploadToCloudinary(file);
      return { fileName: file.name, fileType: file.type || "application/octet-stream", fileUrl: url, publicId };
    })
  );
}

export const useCreateTask = () =>
  useMutation({
    mutationFn: async (input: TaskCreateInput) => {
      const attachments = await uploadAttachments(input.files ?? []);
      const ref = await addDoc(collection(db, COLLECTION), {
        title: input.title,
        description: input.description ?? null,
        dueDate: input.dueDate ?? null,
        priority: input.priority,
        done: false,
        assignedTo: input.assignedTo ?? null,
        attachments,
        hasFile: attachments.length > 0,
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

/** Uploads and appends one or more attachments to an existing task. */
export const useAddTaskAttachments = () =>
  useMutation({
    mutationFn: async ({ id, files }: { id: string; files: File[] }) => {
      const attachments = await uploadAttachments(files);
      await updateDoc(doc(db, COLLECTION, id), { attachments: arrayUnion(...attachments), hasFile: true });
      return attachments;
    },
  });

/** Removes one attachment from a task without deleting the task itself. Does not delete the Cloudinary asset. */
export const useRemoveTaskAttachment = () =>
  useMutation({
    mutationFn: async ({ id, publicId }: { id: string; publicId: string }) => {
      const ref = doc(db, COLLECTION, id);
      const snap = await getDoc(ref);
      const current: TaskAttachment[] = snap.data()?.attachments ?? [];
      const attachments = current.filter((a) => a.publicId !== publicId);
      await updateDoc(ref, { attachments, hasFile: attachments.length > 0 });
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
