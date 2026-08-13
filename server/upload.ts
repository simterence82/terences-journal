import multer from "multer";

export const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

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
