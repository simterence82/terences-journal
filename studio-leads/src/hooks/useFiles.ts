import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { collection, doc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "../lib/firebase";
import { toIso } from "../lib/firestoreUtil";
import { isAdminRole, type ArchivedFile, type FileCategory, type Viewer } from "../lib/types";

const COLLECTION = "files";
const KEY = ["files"] as const;

function toArchivedFile(id: string, data: Record<string, any>): ArchivedFile {
  return {
    id,
    category: data.category,
    fileName: data.fileName,
    contentType: data.contentType,
    sizeBytes: data.sizeBytes ?? 0,
    storagePath: data.storagePath,
    downloadURL: data.downloadURL,
    uploadedBy: data.uploadedBy ?? null,
    uploadedByName: data.uploadedByName ?? null,
    relatedAttendanceId: data.relatedAttendanceId ?? null,
    createdAt: toIso(data.createdAt) ?? new Date(0).toISOString(),
  };
}

/** Either admin tier sees every file; a designer's query is constrained to
    where("uploadedBy","==",uid), matching firestore.rules' list check --
    same "own or admin" visibility tier as attendance itself. */
export const useFilesList = (viewer: Viewer | null) =>
  useQuery({
    queryKey: [...KEY, viewer && isAdminRole(viewer.role) ? "all" : viewer?.id],
    enabled: !!viewer,
    queryFn: async () => {
      const q = isAdminRole(viewer!.role)
        ? collection(db, COLLECTION)
        : query(collection(db, COLLECTION), where("uploadedBy", "==", viewer!.id));
      const snap = await getDocs(q);
      const items = snap.docs.map((d) => toArchivedFile(d.id, d.data()));
      items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
      return items;
    },
  });

export interface UploadFileInput {
  file: File;
  category: FileCategory;
  /** The attendance doc this file backs up ("{designerId}_{date}"), if any. */
  relatedAttendanceId?: string | null;
}

/**
 * Uploads the raw file to Cloud Storage under the uploader's own uid
 * folder (storage.rules only allows writing there, or anywhere for an
 * admin), then writes a matching metadata doc to Firestore so the Files
 * Archive can list/filter without needing Storage's own (auth-unaware)
 * listAll(). Returns the new file's id.
 */
export const useUploadAttendanceFile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, category, relatedAttendanceId }: UploadFileInput) => {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Not signed in");
      const id = doc(collection(db, COLLECTION)).id;
      const storagePath = `attendanceFiles/${currentUser.uid}/${id}-${file.name}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file, { contentType: file.type });
      const downloadURL = await getDownloadURL(storageRef);
      await setDoc(doc(db, COLLECTION, id), {
        category,
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        storagePath,
        downloadURL,
        uploadedBy: currentUser.uid,
        uploadedByName: currentUser.displayName,
        relatedAttendanceId: relatedAttendanceId ?? null,
        createdAt: serverTimestamp(),
      });
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};
