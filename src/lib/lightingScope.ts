// Smart Lighting and Miscellaneous Claims are the same page with the same
// fields and the same Admin / Super Admin rules -- only the name and the
// Firestore collections differ. Everything that touches either one takes a
// scope so the two stay in step and never share records.
export type LightingScope = "lighting" | "misc";

export interface LightingScopeConfig {
  /** The operational document (Admin can read it): brand/client/address/date/notes/paid/claimed/selling. */
  purchases: string;
  /** The Super Admin only document: cost breakdown, profit, commission. */
  financials: string;
  /** Matches PendingDeletionEntityKind / TrashKind. */
  kind: LightingScope;
  pageTitle: string;
  pageSubtitle: string;
  /** Singular label used on deletion requests and in the Trash Bin. */
  recordLabel: string;
  /** What a single entry is called in toasts and empty states. */
  entryNoun: string;
  addDialogTitle: string;
  editDialogTitle: string;
  summaryTitle: string;
}

export const LIGHTING_SCOPES: Record<LightingScope, LightingScopeConfig> = {
  lighting: {
    purchases: "lightingPurchases",
    financials: "lightingFinancials",
    kind: "lighting",
    pageTitle: "Smart Lighting Purchases",
    pageSubtitle: "Track lighting jobs, commissions, and claims",
    recordLabel: "Smart Lighting Purchase",
    entryNoun: "lighting purchase",
    addDialogTitle: "Add Smart Product Purchase",
    editDialogTitle: "Edit Smart Product Purchase",
    summaryTitle: "Smart Lighting Summary",
  },
  misc: {
    purchases: "miscPurchases",
    financials: "miscFinancials",
    kind: "misc",
    pageTitle: "Miscellaneous Claims",
    pageSubtitle: "Track miscellaneous jobs, commissions, and claims",
    recordLabel: "Miscellaneous Claim",
    entryNoun: "miscellaneous claim",
    addDialogTitle: "Add Miscellaneous Claim",
    editDialogTitle: "Edit Miscellaneous Claim",
    summaryTitle: "Miscellaneous Claims Summary",
  },
};
