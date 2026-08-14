import { Router } from "express";
import type { Timestamp } from "firebase-admin/firestore";
import { firestoreDb } from "../firebase";
import { toIso } from "../firestoreUtil";
import { requireAuth } from "../auth/middleware";

const router = Router();
router.use(requireAuth);

interface FileDoc {
  title: string;
  fileName: string | null;
  fileType: string | null;
  createdAt: Timestamp;
}

router.get("/", async (_req, res) => {
  const [taskFiles, issueFiles] = await Promise.all([
    firestoreDb.collection("tasks").where("isDeleted", "==", false).where("hasFile", "==", true).get(),
    firestoreDb.collection("issues").where("isDeleted", "==", false).where("hasFile", "==", true).get(),
  ]);

  const items = [
    ...taskFiles.docs.map((doc) => {
      const d = doc.data() as FileDoc;
      return {
        kind: "tasks" as const,
        id: doc.id,
        sourceTitle: d.title,
        fileName: d.fileName as string,
        fileType: d.fileType,
        createdAt: d.createdAt,
        downloadUrl: `/api/tasks/${doc.id}/file`,
      };
    }),
    ...issueFiles.docs.map((doc) => {
      const d = doc.data() as FileDoc;
      return {
        kind: "issues" as const,
        id: doc.id,
        sourceTitle: d.title,
        fileName: d.fileName as string,
        fileType: d.fileType,
        createdAt: d.createdAt,
        downloadUrl: `/api/issues/${doc.id}/file`,
      };
    }),
  ]
    .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
    .map(({ createdAt, ...rest }) => ({ ...rest, createdAt: toIso(createdAt) }));

  res.json(items);
});

export default router;
