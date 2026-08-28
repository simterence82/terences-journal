import { useMutation } from "@tanstack/react-query";
import { collection, deleteDoc, doc, query, updateDoc, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { toIso } from "../lib/firestoreUtil";
import { useMultiCollectionQuery } from "../lib/useFirestoreQuery";
import type { TrashItem, TrashKind } from "../lib/types";

const COLLECTION_BY_KIND: Record<TrashKind, string> = {
  lighting: "lightingPurchases",
  blum: "blumPurchases",
  tasks: "tasks",
  issues: "issues",
  schedule: "scheduleEvents",
};

// Soft-deleted docs are purged 60 days after deletion.
const RETENTION_MS = 60 * 24 * 60 * 60 * 1000;

function buildItem(kind: TrashKind, id: string, data: Record<string, any>): TrashItem {
  const deletedAt = toIso(data.deletedAt);
  const purgeAt = new Date(new Date(deletedAt).getTime() + RETENTION_MS).toISOString();
  const noFile = { hasFile: false, fileName: null, fileType: null, fileUrl: null };
  switch (kind) {
    case "lighting":
      return { kind, id, title: `${data.brand} - ${data.clientName}`, subtitle: "Smart Lighting Purchase", ...noFile, deletedAt, purgeAt };
    case "blum":
      return { kind, id, title: data.orderName, subtitle: "Blum Purchase", ...noFile, deletedAt, purgeAt };
    case "tasks":
      return {
        kind,
        id,
        title: data.title,
        subtitle: "Outstanding Task",
        hasFile: !!data.hasFile,
        fileName: data.fileName ?? null,
        fileType: data.fileType ?? null,
        fileUrl: data.fileUrl ?? null,
        deletedAt,
        purgeAt,
      };
    case "issues":
      return {
        kind,
        id,
        title: data.title,
        subtitle: "Outstanding Issue",
        hasFile: !!data.hasFile,
        fileName: data.fileName ?? null,
        fileType: data.fileType ?? null,
        fileUrl: data.fileUrl ?? null,
        deletedAt,
        purgeAt,
      };
    case "schedule":
      return { kind, id, title: data.title, subtitle: `Schedule - ${data.date}`, ...noFile, deletedAt, purgeAt };
  }
}

export const useTrashList = () =>
  useMultiCollectionQuery(
    (Object.keys(COLLECTION_BY_KIND) as TrashKind[]).map((kind) => ({
      key: kind,
      buildQuery: () => query(collection(db, COLLECTION_BY_KIND[kind]), where("isDeleted", "==", true)),
      mapDoc: (id: string, data: Record<string, any>) => buildItem(kind, id, data),
    })),
    (a, b) => (a.deletedAt < b.deletedAt ? 1 : a.deletedAt > b.deletedAt ? -1 : 0)
  );

export const useRestoreTrashItem = () =>
  useMutation({
    mutationFn: async ({ kind, id }: { kind: TrashKind; id: string }) => {
      await updateDoc(doc(db, COLLECTION_BY_KIND[kind], id), { isDeleted: false, deletedAt: null });
      return { success: true as const };
    },
  });

export const usePermanentDeleteTrashItem = () =>
  useMutation({
    mutationFn: async ({ kind, id }: { kind: TrashKind; id: string }) => {
      await deleteDoc(doc(db, COLLECTION_BY_KIND[kind], id));
      if (kind === "tasks") await deleteDoc(doc(db, "taskFiles", id));
      if (kind === "issues") await deleteDoc(doc(db, "issueFiles", id));
      return { success: true as const };
    },
  });
