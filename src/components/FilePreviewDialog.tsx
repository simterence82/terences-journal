import React, { useEffect, useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "./Dialog";
import { Button } from "./Button";
import { cloudinaryDownloadUrl } from "../lib/cloudinary";

interface FilePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  fileType: string | null;
  /** Cloudinary delivery URL, when available -- used directly, no fetch needed. */
  fileUrl?: string | null;
  /** Legacy fallback for base64 attachments predating the Cloudinary migration. */
  loadBlob?: () => Promise<Blob>;
  /** When provided, shows a destructive delete action in the footer. */
  onDelete?: () => void;
  deleteLabel?: string;
}

export const FilePreviewDialog: React.FC<FilePreviewDialogProps> = ({
  open,
  onOpenChange,
  fileName,
  fileType,
  fileUrl,
  loadBlob,
  onDelete,
  deleteLabel = "Delete Permanently",
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || fileUrl || !loadBlob) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    setBlobUrl(null);
    setError(null);
    loadBlob()
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load this file.");
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, fileUrl, loadBlob]);

  const displayUrl = fileUrl ?? blobUrl;

  const handleDownload = () => {
    if (!displayUrl) return;
    const a = document.createElement("a");
    a.href = fileUrl ? cloudinaryDownloadUrl(fileUrl) : displayUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const isImage = fileType?.startsWith("image/");
  const isPdf = fileType === "application/pdf";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{fileName}</DialogTitle>
      </DialogHeader>
      <div className="flex min-h-[12rem] max-h-[65vh] flex-col items-center justify-center overflow-auto rounded border border-border bg-surface">
        {error ? (
          <p className="p-8 text-center text-sm text-muted-foreground">{error}</p>
        ) : !displayUrl ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Loading...</p>
        ) : isImage ? (
          <img src={displayUrl} alt={fileName} className="max-h-[65vh] w-auto object-contain" />
        ) : isPdf ? (
          <iframe src={displayUrl} title={fileName} className="h-[65vh] w-full" />
        ) : (
          <p className="p-8 text-center text-sm text-muted-foreground">No preview available for this file type.</p>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
        {onDelete && (
          <Button variant="destructive" onClick={onDelete}>
            <Trash2 size={16} /> {deleteLabel}
          </Button>
        )}
        <Button onClick={handleDownload} disabled={!displayUrl}>
          <Download size={16} /> Download
        </Button>
      </DialogFooter>
    </Dialog>
  );
};
