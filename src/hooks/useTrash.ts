import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { collection, deleteDoc, doc, getDocs, query, updateDoc, where, type Timestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { toIso } from "../lib/firestoreUtil";
import type { TrashItem, TrashKind } from "../lib/types";

const KEY = ["trash"] as const;
// Restoring/permanently deleting a trashed item can bring back (or remove for
// good) a row that other pages list -- invalidate everything so those pages
// reflect it immediately.
const AFFECTED_KEYS = [KEY, ["lighting"], ["blum"], ["tasks"], ["issues"], ["schedule"], ["files-archive"]] as const;

const COLLECTION_BY_KIND: Record<TrashKind, string> = {
  lighting: "lightingPurchases",
  blum: "blumPurchases",
  tasks: "tasks",
  issues: "issues",
  schedule: "scheduleEvents",
};

// Soft-deleted docs are purged 120 days after deletion.
const RETENTION_MS = 120 * 24 * 60 * 60 * 1000;

function buildItem(kind: TrashKind, id: string, data: Record<string, any>): { kind: TrashKind; id: string; title: string; subtitle: string; hasFile: boolean; deletedAt: Timestamp } {
  switch (kind) {
    case "lighting":
      return { kind, id, title: `${data.brand} - ${data.clientName}`, subtitle: "Smart Lighting Purchase", hasFile: false, deletedAt: data.deletedAt };
    case "blum":
      return { kind, id, title: data.orderName, subtitle: "Blum Purchase", hasFile: false, deletedAt: data.deletedAt };
    case "tasks":
      return { kind, id, title: data.title, subtitle: "Outstanding Task", hasFile: !!data.hasFile, deletedAt: data.deletedAt };
    case "issues":
      return { kind, id, title: data.title, subtitle: "Outstanding Issue", hasFile: !!data.hasFile, deletedAt: data.deletedAt };
    case "schedule":
      return { kind, id, title: data.title, subtitle: `Schedule - ${data.date}`, hasFile: false, deletedAt: data.deletedAt };
  }
}

export const useTrashList = () =>
  useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const kinds = Object.keys(COLLECTION_BY_KIND) as TrashKind[];
      const snaps = await Promise.all(
        kinds.map((kind) => getDocs(query(collection(db, COLLECTION_BY_KIND[kind]), where("isDeleted", "==", true))))
      );
      const items = kinds.flatMap((kind, i) => snaps[i].docs.map((d) => buildItem(kind, d.id, d.data())));
      items.sort((a, b) => b.deletedAt.toMillis() - a.deletedAt.toMillis());
      return items.map(
        (item): TrashItem => ({
          kind: item.kind,
          id: item.id,
          title: item.title,
          subtitle: item.subtitle,
          hasFile: item.hasFile,
          deletedAt: toIso(item.deletedAt),
          purgeAt: new Date(item.deletedAt.toMillis() + RETENTION_MS).toISOString(),
        })
      );
    },
  });

export const useRestoreTrashItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ kind, id }: { kind: TrashKind; id: string }) => {
      await updateDoc(doc(db, COLLECTION_BY_KIND[kind], id), { isDeleted: false, deletedAt: null });
      return { success: true as const };
    },
    onSuccess: () => AFFECTED_KEYS.forEach((key) => qc.invalidateQueries({ queryKey: key })),
  });
};

export const usePermanentDeleteTrashItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ kind, id }: { kind: TrashKind; id: string }) => {
      await deleteDoc(doc(db, COLLECTION_BY_KIND[kind], id));
      if (kind === "tasks") await deleteDoc(doc(db, "taskFiles", id));
      if (kind === "issues") await deleteDoc(doc(db, "issueFiles", id));
      return { success: true as const };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};
