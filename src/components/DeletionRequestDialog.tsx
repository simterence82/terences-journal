import React, { useEffect, useState } from "react";
import { Check, X as XIcon } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { formatSGD } from "../lib/formatCurrency";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "./Dialog";
import { Button } from "./Button";
import type { PendingDeletion, PendingDeletionEntityKind } from "../lib/types";

const COLLECTION: Record<PendingDeletionEntityKind, string> = {
  lighting: "lightingPurchases",
  blum: "blumPurchases",
  tasks: "tasks",
  issues: "issues",
  schedule: "scheduleEvents",
};

type Row = [label: string, value: React.ReactNode];

const yesNo = (v: unknown) => (v ? "Yes" : "No");
const fmtDate = (v: unknown) => (typeof v === "string" && v ? new Date(v).toLocaleDateString("en-SG") : "-");
const text = (v: unknown) => (typeof v === "string" && v.trim() ? v : "-");

function Link({ url, name }: { url?: string | null; name: string }) {
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
      {name}
    </a>
  ) : (
    <span>{name}</span>
  );
}

// Reads the record the request is about, so it can be looked over before deciding.
// The dashboard card is only shown to a Super Admin, who may read lightingFinancials too.
async function loadRows(request: PendingDeletion): Promise<Row[] | null> {
  const snap = await getDoc(doc(db, COLLECTION[request.kind], request.entityId));
  if (!snap.exists()) return null;
  const d = snap.data();

  switch (request.kind) {
    case "tasks": {
      const attachments: { fileName: string; fileUrl: string }[] = Array.isArray(d.attachments) ? d.attachments : [];
      return [
        ["Title", text(d.title)],
        ["Description", text(d.description)],
        ["Due date", fmtDate(d.dueDate)],
        ["Priority", text(d.priority)],
        ["Assigned to", text(d.assignedTo)],
        ["Done", d.done ? "Yes (both ticked)" : "No"],
        [
          "Attachments",
          attachments.length ? (
            <div className="flex flex-col gap-1">
              {attachments.map((a, i) => (
                <Link key={i} url={a.fileUrl} name={a.fileName} />
              ))}
            </div>
          ) : (
            "-"
          ),
        ],
      ];
    }
    case "issues":
      return [
        ["Title", text(d.title)],
        ["Description", text(d.description)],
        ["Resolved", yesNo(d.resolved)],
        ["Attachment", d.fileName ? <Link url={d.fileUrl} name={d.fileName} /> : "-"],
      ];
    case "lighting": {
      const fin = await getDoc(doc(db, "lightingFinancials", request.entityId)).catch(() => null);
      const f = fin?.exists() ? fin.data() : null;
      const rows: Row[] = [
        ["Brand", text(d.brand)],
        ["Client", text(d.clientName)],
        ["Address", text(d.address)],
        ["Date", fmtDate(d.date)],
        ["Notes", text(d.notes)],
        ["Paid", yesNo(d.paidToSeller)],
        ["Claimed", yesNo(d.reimbursed)],
      ];
      if (f) {
        rows.push(
          ["Cost", formatSGD(f.cost ?? 0)],
          ["Selling", formatSGD(f.selling ?? 0)],
          ["Commission", `${formatSGD(f.commissionGiven ?? 0)}${f.commissionRecipient ? ` to ${f.commissionRecipient}` : ""}`]
        );
      }
      return rows;
    }
    case "blum":
      return [
        ["Order", text(d.orderName)],
        ["Amount", formatSGD(d.amount ?? 0)],
        ["Date", fmtDate(d.date)],
        ["Notes", text(d.notes)],
        ["Paid", yesNo(d.paidToSeller)],
        ["Invoice requested", yesNo(d.invoiceRequested)],
        ["Claimed", yesNo(d.reimbursed)],
      ];
    case "schedule":
      return [
        ["Title", text(d.title)],
        ["Date", fmtDate(d.date)],
        ["Time", d.startTime ? `${d.startTime}${d.endTime ? ` - ${d.endTime}` : ""}` : "-"],
        ["Location", text(d.location)],
        ["Notes", text(d.notes)],
      ];
  }
}

interface DeletionRequestDialogProps {
  request: PendingDeletion | null;
  onClose: () => void;
  onApprove: (request: PendingDeletion) => void;
  onReject: (id: string) => void;
}

export const DeletionRequestDialog: React.FC<DeletionRequestDialogProps> = ({ request, onClose, onApprove, onReject }) => {
  const [rows, setRows] = useState<Row[] | null | undefined>(undefined);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!request) return;
    let cancelled = false;
    setRows(undefined);
    setError(false);
    loadRows(request).then(
      (r) => !cancelled && setRows(r),
      () => !cancelled && setError(true)
    );
    return () => {
      cancelled = true;
    };
  }, [request]);

  if (!request) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogHeader>
        <DialogTitle>{request.title}</DialogTitle>
      </DialogHeader>
      <p className="mb-4 text-xs text-muted-foreground">
        {request.subtitle} &middot; {request.action === "permanent" ? "Permanent delete" : "Move to Trash Bin"}
        {request.requestedByName && ` · requested by ${request.requestedByName}`}
        {request.requestedAt && ` on ${new Date(request.requestedAt).toLocaleDateString("en-SG")}`}
      </p>
      {error ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Couldn't load the details.</p>
      ) : rows === undefined ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading...</p>
      ) : rows === null ? (
        <p className="py-6 text-center text-sm text-muted-foreground">This record no longer exists.</p>
      ) : (
        <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 rounded-lg border border-border bg-surface p-4 text-sm">
          {rows.map(([label, value]) => (
            <React.Fragment key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="min-w-0 break-words text-foreground">{value}</dd>
            </React.Fragment>
          ))}
        </dl>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            onReject(request.id);
            onClose();
          }}
        >
          <XIcon size={14} /> Reject
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            onApprove(request);
            onClose();
          }}
        >
          <Check size={14} /> Approve
        </Button>
      </DialogFooter>
    </Dialog>
  );
};
