import React, { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "./Dialog";
import { Button } from "./Button";

interface FilePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileId: string;
  fileName: string;
  fileType: string | null;
  fetchBlob: (id: string, fileType: string | null) => Promise<Blob>;
}

export const FilePreviewDialog: React.FC<FilePreviewDialogProps> = ({ open, onOpenChange, fileId, fileName, fileType, fetchBlob }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    setUrl(null);
    setError(null);
    fetchBlob(fileId, fileType)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load this file.");
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, fileId]);

  const handleDownload = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
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
        ) : !url ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Loading...</p>
        ) : isImage ? (
          <img src={url} alt={fileName} className="max-h-[65vh] w-auto object-contain" />
        ) : isPdf ? (
          <iframe src={url} title={fileName} className="h-[65vh] w-full" />
        ) : (
          <p className="p-8 text-center text-sm text-muted-foreground">No preview available for this file type.</p>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
        <Button onClick={handleDownload} disabled={!url}>
          <Download size={16} /> Download
        </Button>
      </DialogFooter>
    </Dialog>
  );
};
