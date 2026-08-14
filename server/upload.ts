import multer from "multer";

// Firestore caps a document at 1 MiB, and base64 encoding inflates a file's
// size by ~33% -- 700KB raw stays safely under that after encoding.
export const MAX_ATTACHMENT_SIZE_BYTES = 700 * 1024;

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ATTACHMENT_SIZE_BYTES },
});

export interface StoredAttachment {
  fileName: string;
  fileData: string;
  fileType: string;
}

export function encodeAttachment(file: Express.Multer.File): StoredAttachment {
  return {
    fileName: file.originalname,
    fileData: file.buffer.toString("base64"),
    fileType: file.mimetype || "application/octet-stream",
  };
}
