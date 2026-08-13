import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../lib/apiClient";
import type { FileArchiveItem } from "../lib/types";

export const useFilesArchiveList = () =>
  useQuery({ queryKey: ["files-archive"], queryFn: () => apiGet<FileArchiveItem[]>("/files-archive") });
