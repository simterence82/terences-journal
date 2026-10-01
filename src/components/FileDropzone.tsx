import React, { useCallback, useState } from "react";
import { Upload } from "lucide-react";

interface FileDropzoneProps {
  accept?: string;
  multiple?: boolean;
  onFilesSelected: (files: File[]) => void;
  className?: string;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({ accept, multiple = false, onFilesSelected, className = "" }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent, dragging: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(dragging);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files ?? []);
      if (files.length > 0) onFilesSelected(multiple ? files : [files[0]]);
    },
    [onFilesSelected, multiple]
  );

  return (
    <label
      onDragEnter={(e) => handleDrag(e, true)}
      onDragOver={(e) => handleDrag(e, true)}
      onDragLeave={(e) => handleDrag(e, false)}
      onDrop={handleDrop}
      className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors ${
        isDragging ? "border-primary bg-[var(--primary-tint)]" : "border-border bg-surface hover:bg-muted"
      } ${className}`}
    >
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) onFilesSelected(multiple ? files : [files[0]]);
          e.target.value = "";
        }}
      />
      <Upload size={28} className="text-muted-foreground" />
      <span className="text-sm text-foreground">Click to upload or drag and drop{multiple ? " (multiple files allowed)" : ""}</span>
      {accept && <span className="text-xs text-muted-foreground">Accepted: {accept}</span>}
    </label>
  );
};
