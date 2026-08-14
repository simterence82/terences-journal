import type { Response } from "express";
import multer from "multer";
import { bucket } from "./firebase";

export const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ATTACHMENT_SIZE_BYTES },
});

export interface StoredAttachment {
  fileName: string;
  fileType: string;
  storagePath: string;
}

export async function uploadAttachment(
  collection: string,
  docId: string,
  file: Express.Multer.File
): Promise<StoredAttachment> {
  const fileType = file.mimetype || "application/octet-stream";
  const storagePath = `attachments/${collection}/${docId}/${file.originalname}`;
  await bucket.file(storagePath).save(file.buffer, { contentType: fileType });
  return { fileName: file.originalname, fileType, storagePath };
}

export async function deleteAttachment(storagePath: string): Promise<void> {
  try {
    await bucket.file(storagePath).delete();
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code !== 404) throw error;
  }
}

export function streamAttachment(
  storagePath: string,
  res: Response,
  fileName: string,
  fileType: string | null
): void {
  res.setHeader("Content-Type", fileType || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
  bucket
    .file(storagePath)
    .createReadStream()
    .on("error", () => {
      if (!res.headersSent) res.status(404).json({ error: "No file attached" });
    })
    .pipe(res);
}
