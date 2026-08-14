import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, query, where, type Timestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { toIso } from "../lib/firestoreUtil";
import type { FileArchiveItem } from "../lib/types";

async function listFiles(kind: "tasks" | "issues"): Promise<{ kind: "tasks" | "issues"; id: string; sourceTitle: string; fileName: string; fileType: string | null; createdAt: Timestamp }[]> {
  const snap = await getDocs(query(collection(db, kind), where("isDeleted", "==", false), where("hasFile", "==", true)));
  return snap.docs.map((d) => {
    const data = d.data();
    return { kind, id: d.id, sourceTitle: data.title, fileName: data.fileName, fileType: data.fileType, createdAt: data.createdAt };
  });
}

export const useFilesArchiveList = () =>
  useQuery({
    queryKey: ["files-archive"],
    queryFn: async () => {
      const [tasks, issues] = await Promise.all([listFiles("tasks"), listFiles("issues")]);
      const items = [...tasks, ...issues];
      items.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
      return items.map(
        (item): FileArchiveItem => ({
          kind: item.kind,
          id: item.id,
          sourceTitle: item.sourceTitle,
          fileName: item.fileName,
          fileType: item.fileType,
          createdAt: toIso(item.createdAt),
        })
      );
    },
  });
