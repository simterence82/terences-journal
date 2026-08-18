import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { LookupsResponse } from "../lib/types";

async function distinctField(collectionName: string, field: string): Promise<string[]> {
  const snap = await getDocs(query(collection(db, collectionName), where("isDeleted", "==", false)));
  const values = new Set<string>();
  snap.docs.forEach((d) => {
    const value = d.data()[field];
    if (typeof value === "string" && value.trim() !== "") values.add(value);
  });
  return Array.from(values).sort((a, b) => a.localeCompare(b));
}

async function distinctLightingVendors(): Promise<string[]> {
  const snap = await getDocs(query(collection(db, "lightingPurchases"), where("isDeleted", "==", false)));
  const values = new Set<string>();
  snap.docs.forEach((d) => {
    const costs = d.data().costs;
    if (Array.isArray(costs)) {
      costs.forEach((c: any) => {
        if (typeof c?.vendor === "string" && c.vendor.trim() !== "") values.add(c.vendor);
      });
    }
  });
  return Array.from(values).sort((a, b) => a.localeCompare(b));
}

export const useLookups = () =>
  useQuery({
    queryKey: ["lookups"],
    queryFn: async (): Promise<LookupsResponse> => {
      const [brands, clientNames, addresses, commissionRecipients, lightingVendors, blumOrderNames, taskAssignees] = await Promise.all([
        distinctField("lightingPurchases", "brand"),
        distinctField("lightingPurchases", "clientName"),
        distinctField("lightingPurchases", "address"),
        distinctField("lightingPurchases", "commissionRecipient"),
        distinctLightingVendors(),
        distinctField("blumPurchases", "orderName"),
        distinctField("tasks", "assignedTo"),
      ]);
      return { brands, clientNames, addresses, commissionRecipients, lightingVendors, blumOrderNames, taskAssignees };
    },
    staleTime: 30 * 1000,
  });
