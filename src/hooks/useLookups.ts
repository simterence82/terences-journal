import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";
import type { LookupsResponse } from "../lib/types";

async function distinctField(collectionName: string, field: string, filterByIsDeleted: boolean): Promise<string[]> {
  const q = filterByIsDeleted
    ? query(collection(db, collectionName), where("isDeleted", "==", false))
    : collection(db, collectionName);
  const snap = await getDocs(q);
  const values = new Set<string>();
  snap.docs.forEach((d) => {
    const value = d.data()[field];
    if (typeof value === "string" && value.trim() !== "") values.add(value);
  });
  return Array.from(values).sort((a, b) => a.localeCompare(b));
}

// commissionRecipient and the per-vendor cost breakdown live in
// lightingFinancials now (Super Admin only -- see useLighting.ts), so these
// two lookups only make sense, and are only queried, for a Super Admin.
async function distinctLightingVendors(): Promise<string[]> {
  const snap = await getDocs(collection(db, "lightingFinancials"));
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

export const useLookups = () => {
  const { authState } = useAuth();
  const isSuperAdmin = authState.type === "authenticated" && authState.user.role === "superadmin";

  return useQuery({
    queryKey: ["lookups", isSuperAdmin],
    queryFn: async (): Promise<LookupsResponse> => {
      const [brands, clientNames, addresses, commissionRecipients, lightingVendors, blumOrderNames, taskAssignees] = await Promise.all([
        distinctField("lightingPurchases", "brand", true),
        distinctField("lightingPurchases", "clientName", true),
        distinctField("lightingPurchases", "address", true),
        isSuperAdmin ? distinctField("lightingFinancials", "commissionRecipient", false) : Promise.resolve([]),
        isSuperAdmin ? distinctLightingVendors() : Promise.resolve([]),
        distinctField("blumPurchases", "orderName", true),
        distinctField("tasks", "assignedTo", true),
      ]);
      return { brands, clientNames, addresses, commissionRecipients, lightingVendors, blumOrderNames, taskAssignees };
    },
    staleTime: 30 * 1000,
  });
};
