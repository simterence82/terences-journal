import React from "react";
import { useLeadsList } from "../hooks/useLeads";
import { useAuth } from "../lib/AuthContext";
import { Skeleton } from "../components/Skeleton";
import { SalesTargetPanel } from "../components/SalesTargetPanel";

/**
 * A designer's own read-only mirror of the KPI page's Sales Target panel --
 * same actual-vs-target numbers admin/super admin see there, scoped to just
 * this one designer, with no ability to edit/delete/change anything
 * (SalesTargetPanel itself gates editing to admin roles, so this holds even
 * if someone tampers with the page).
 */
export const PersonalSalesFigurePage: React.FC = () => {
  const { authState } = useAuth();
  const currentUser = authState.type === "authenticated" ? authState.user : null;

  const leadsQuery = useLeadsList(currentUser ? { id: currentUser.id, role: currentUser.role } : null);
  const leads = leadsQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Personal Sales Figure</h1>
        <p className="mt-1 text-[0.9375rem] text-faint-ink">Your own signed sales vs. target -- view only</p>
      </div>

      {leadsQuery.isLoading || !currentUser ? (
        <Skeleton style={{ height: 320 }} />
      ) : (
        <SalesTargetPanel leads={leads} designers={[{ id: currentUser.id, displayName: currentUser.displayName }]} />
      )}
    </div>
  );
};
