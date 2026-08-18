import { collection, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { toIso } from "../lib/firestoreUtil";
import { useMultiCollectionQuery } from "../lib/useFirestoreQuery";
import type { FileArchiveItem } from "../lib/types";

function toFileArchiveItem(kind: "tasks" | "issues", id: string, data: Record<string, any>): FileArchiveItem {
  return {
    kind,
    id,
    sourceTitle: data.title,
    fileName: data.fileName,
    fileType: data.fileType,
    fileUrl: data.fileUrl ?? null,
    createdAt: toIso(data.createdAt),
  };
}

export const useFilesArchiveList = () =>
  useMultiCollectionQuery(
    (["tasks", "issues"] as const).map((kind) => ({
      key: kind,
      buildQuery: () => query(collection(db, kind), where("isDeleted", "==", false), where("hasFile", "==", true)),
      mapDoc: (id: string, data: Record<string, any>) => toFileArchiveItem(kind, id, data),
    })),
    (a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0)
  );
