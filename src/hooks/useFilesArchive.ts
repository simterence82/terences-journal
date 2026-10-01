import { collection, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { toIso } from "../lib/firestoreUtil";
import { useMultiCollectionQuery } from "../lib/useFirestoreQuery";
import type { FileArchiveItem } from "../lib/types";

// A task can have several attachments -- one row per attachment. An issue
// still has at most one, so it always fans out to exactly one row.
function toFileArchiveItems(kind: "tasks" | "issues", id: string, data: Record<string, any>): FileArchiveItem[] {
  if (kind === "tasks") {
    const attachments = Array.isArray(data.attachments) ? data.attachments : [];
    return attachments.map((a: any) => ({
      kind,
      id,
      publicId: a.publicId ?? null,
      sourceTitle: data.title,
      fileName: a.fileName,
      fileType: a.fileType,
      fileUrl: a.fileUrl ?? null,
      createdAt: toIso(data.createdAt),
    }));
  }
  return [
    {
      kind,
      id,
      publicId: null,
      sourceTitle: data.title,
      fileName: data.fileName,
      fileType: data.fileType,
      fileUrl: data.fileUrl ?? null,
      createdAt: toIso(data.createdAt),
    },
  ];
}

export const useFilesArchiveList = () =>
  useMultiCollectionQuery(
    (["tasks", "issues"] as const).map((kind) => ({
      key: kind,
      buildQuery: () => query(collection(db, kind), where("isDeleted", "==", false), where("hasFile", "==", true)),
      mapDoc: (id: string, data: Record<string, any>) => toFileArchiveItems(kind, id, data),
    })),
    (a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0)
  );
