import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../lib/apiClient";
import type { LookupsResponse } from "../lib/types";

export const useLookups = () =>
  useQuery({ queryKey: ["lookups"], queryFn: () => apiGet<LookupsResponse>("/lookups"), staleTime: 30 * 1000 });
