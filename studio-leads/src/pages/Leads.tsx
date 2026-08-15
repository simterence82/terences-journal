import React, { useEffect, useMemo, useState } from "react";
import { Plus, Phone, Mail, MapPin, AlertTriangle, Handshake, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLeadsList, useCreateLead, useUpdateLead, useDeleteLead, useClaimLead } from "../hooks/useLeads";
import { useFollowUpsForLead, useCreateFollowUp } from "../hooks/useFollowUps";
import { useDesignersList } from "../hooks/useUsers";
import { useAuth } from "../lib/AuthContext";
import { todayDateString } from "../lib/firestoreUtil";
import { formatSGD } from "../lib/formatCurrency";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import { Select } from "../components/Select";
import { Tabs } from "../components/Tabs";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "../components/Dialog";
import { ConfirmDialog, useConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";
import { StatusBadge } from "../components/StatusBadge";
import { Badge } from "../components/Badge";
import { Checkbox } from "../components/Checkbox";
import {
  CLOSED_LEAD_STATUSES,
  FOLLOW_UP_METHODS,
  LEAD_SOURCES,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  OPEN_TO_DESIGNERS,
  OPEN_TO_DESIGNERS_LABEL,
  PROJECT_TYPES,
  isAdminRole,
  type Lead,
  type LeadStatus,
} from "../lib/types";

const ACTIVE_STATUSES = LEAD_STATUSES.filter((s) => !CLOSED_LEAD_STATUSES.includes(s));

function isOverdue(lead: Lead, today: string): boolean {
  return !CLOSED_LEAD_STATUSES.includes(lead.status) && !!lead.nextFollowUpDate && lead.nextFollowUpDate < today;
}

const EMPTY_ADD_FORM = {
  clientName: "",
  phone: "",
  email: "",
  source: LEAD_SOURCES[0] as string,
  projectType: PROJECT_TYPES[0] as string,
  address: "",
  budget: "",
  notes: "",
  assignedTo: "",
  nextFollowUpDate: "",
};

export const LeadsPage: React.FC = () => {
  const { authState } = useAuth();
  const currentUser = authState.type === "authenticated" ? authState.user : null;
  const isAdmin = !!currentUser && isAdminRole(currentUser.role);

  const leadsQuery = useLeadsList(currentUser ? { id: currentUser.id, role: currentUser.role } : null);
  const designersQuery = useDesignersList();
  const createMutation = useCreateLead();
  const deleteMutation = useDeleteLead();
  const deleteTarget = useConfirmDialog<Lead>();

  const [tab, setTab] = useState<"active" | "signed" | "rejected">("active");
  const [designerFilter, setDesignerFilter] = useState("all");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_ADD_FORM);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const leads = leadsQuery.data ?? [];
  const designers = designersQuery.data ?? [];
  const today = todayDateString();

  const filteredByDesigner =
    designerFilter === "all"
      ? leads
      : designerFilter === OPEN_TO_DESIGNERS
        ? leads.filter((l) => l.assignedTo === null)
        : leads.filter((l) => l.assignedTo === designerFilter);
  const activeLeads = filteredByDesigner.filter((l) => ACTIVE_STATUSES.includes(l.status));
  const signedLeads = filteredByDesigner.filter((l) => l.status === "signed");
  const rejectedLeads = filteredByDesigner.filter((l) => l.status === "rejected");
  const visibleLeads = tab === "active" ? activeLeads : tab === "signed" ? signedLeads : rejectedLeads;

  const selectedLead = useMemo(() => leads.find((l) => l.id === selectedLeadId) ?? null, [leads, selectedLeadId]);

  useEffect(() => {
    if (isAddOpen && designers.length > 0 && !addForm.assignedTo) {
      setAddForm((p) => ({ ...p, assignedTo: designers[0].id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAddOpen, designers.length]);

  const resetAddForm = () => setAddForm(EMPTY_ADD_FORM);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.clientName) {
      toast.error("Client name is required");
      return;
    }
    const isOpen = addForm.assignedTo === OPEN_TO_DESIGNERS;
    const designer = isOpen ? null : designers.find((d) => d.id === addForm.assignedTo);
    if (!isOpen && !designer) {
      toast.error("Select a designer, or Open to Designers");
      return;
    }
    createMutation.mutate(
      {
        clientName: addForm.clientName,
        phone: addForm.phone || null,
        email: addForm.email || null,
        source: addForm.source,
        projectType: addForm.projectType,
        address: addForm.address || null,
        budget: addForm.budget ? Number(addForm.budget) : null,
        notes: addForm.notes || null,
        assignedTo: isOpen ? null : designer!.id,
        assignedToName: isOpen ? OPEN_TO_DESIGNERS_LABEL : designer!.displayName,
        nextFollowUpDate: addForm.nextFollowUpDate || null,
      },
      {
        onSuccess: () => {
          toast.success("Lead added");
          resetAddForm();
          setIsAddOpen(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add lead"),
      }
    );
  };

  const handleDelete = async () => {
    if (!deleteTarget.target) return;
    await deleteMutation.mutateAsync(deleteTarget.target.id, {
      onSuccess: () => {
        toast.success("Lead deleted");
        setSelectedLeadId(null);
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete lead"),
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">Leads</h1>
          <p className="mt-1 text-[0.9375rem] text-faint-ink">
            {activeLeads.length} active · {activeLeads.filter((l) => isOverdue(l, today)).length} overdue for follow-up
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setIsAddOpen(true)}>
            <Plus size={16} /> Add Lead
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as typeof tab)}
          options={[
            { value: "active", label: "Active", count: activeLeads.length },
            { value: "signed", label: "Signed", count: signedLeads.length },
            { value: "rejected", label: "Rejected", count: rejectedLeads.length },
          ]}
        />
        {isAdmin && designers.length > 0 && (
          <Select
            value={designerFilter}
            onValueChange={setDesignerFilter}
            className="w-56"
            options={[
              { value: "all", label: "All Designers" },
              { value: OPEN_TO_DESIGNERS, label: OPEN_TO_DESIGNERS_LABEL },
              ...designers.map((d) => ({ value: d.id, label: d.displayName })),
            ]}
          />
        )}
      </div>

      {leadsQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} style={{ height: 160 }} />
          ))}
        </div>
      ) : visibleLeads.length === 0 ? (
        <EmptyState icon={<Handshake size={28} />} message={`No ${tab} leads.`} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleLeads.map((lead) => {
            const overdue = isOverdue(lead, today);
            const isOpen = lead.assignedTo === null;
            return (
              <button
                key={lead.id}
                type="button"
                onClick={() => setSelectedLeadId(lead.id)}
                className={`flex flex-col gap-3 rounded-xl border bg-panel p-5 text-left shadow-sm transition-shadow hover:shadow-md ${
                  overdue ? "border-bad" : isOpen ? "border-accent" : "border-line"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[0.9375rem] font-semibold text-ink">{lead.clientName}</span>
                  <StatusBadge status={lead.status} />
                </div>
                <div className="flex flex-col gap-1 text-xs text-faint-ink">
                  <span>
                    {lead.projectType} · {lead.source}
                  </span>
                  {lead.phone && (
                    <span className="flex items-center gap-1.5">
                      <Phone size={12} /> {lead.phone}
                    </span>
                  )}
                  {lead.email && (
                    <span className="flex items-center gap-1.5">
                      <Mail size={12} /> {lead.email}
                    </span>
                  )}
                  {lead.address && (
                    <span className="flex items-center gap-1.5">
                      <MapPin size={12} /> {lead.address}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between border-t border-line pt-2 text-xs">
                  {isOpen ? (
                    <Badge variant="accent">{OPEN_TO_DESIGNERS_LABEL}</Badge>
                  ) : (
                    <span className="text-faint-ink">{lead.assignedToName ?? "Unassigned"}</span>
                  )}
                  {lead.nextFollowUpDate && (
                    <span className={`flex items-center gap-1 font-medium ${overdue ? "text-bad" : "text-faint-ink"}`}>
                      {overdue && <AlertTriangle size={12} />}
                      Next: {new Date(`${lead.nextFollowUpDate}T00:00:00`).toLocaleDateString("en-SG", { day: "numeric", month: "short" })}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetAddForm(); }} wide>
        <DialogHeader>
          <DialogTitle>Add Lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleAddSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-[0.8125rem] font-medium text-ink">Client Name *</label>
              <Input value={addForm.clientName} onChange={(e) => setAddForm((p) => ({ ...p, clientName: e.target.value }))} required />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[0.8125rem] font-medium text-ink">Assign To Designer *</label>
              <Select
                value={addForm.assignedTo}
                onValueChange={(v) => setAddForm((p) => ({ ...p, assignedTo: v }))}
                options={
                  designers.length > 0
                    ? [{ value: OPEN_TO_DESIGNERS, label: `${OPEN_TO_DESIGNERS_LABEL} (any can claim)` }, ...designers.map((d) => ({ value: d.id, label: d.displayName }))]
                    : [{ value: "", label: "No designers yet" }]
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-[0.8125rem] font-medium text-ink">Phone</label>
              <Input value={addForm.phone} onChange={(e) => setAddForm((p) => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[0.8125rem] font-medium text-ink">Email</label>
              <Input type="email" value={addForm.email} onChange={(e) => setAddForm((p) => ({ ...p, email: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-[0.8125rem] font-medium text-ink">Source</label>
              <Select value={addForm.source} onValueChange={(v) => setAddForm((p) => ({ ...p, source: v }))} options={LEAD_SOURCES.map((s) => ({ value: s, label: s }))} />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[0.8125rem] font-medium text-ink">Project Type</label>
              <Select value={addForm.projectType} onValueChange={(v) => setAddForm((p) => ({ ...p, projectType: v }))} options={PROJECT_TYPES.map((s) => ({ value: s, label: s }))} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-ink">Address</label>
            <Input value={addForm.address} onChange={(e) => setAddForm((p) => ({ ...p, address: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-[0.8125rem] font-medium text-ink">Budget (S$)</label>
              <Input type="number" min="0" value={addForm.budget} onChange={(e) => setAddForm((p) => ({ ...p, budget: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[0.8125rem] font-medium text-ink">First Follow-up Due</label>
              <Input type="date" value={addForm.nextFollowUpDate} onChange={(e) => setAddForm((p) => ({ ...p, nextFollowUpDate: e.target.value }))} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-ink">Notes</label>
            <Textarea rows={2} value={addForm.notes} onChange={(e) => setAddForm((p) => ({ ...p, notes: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Save Lead"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {selectedLead && (
        <LeadDetailDialog
          lead={selectedLead}
          isAdmin={isAdmin}
          designers={designers}
          onClose={() => setSelectedLeadId(null)}
          onRequestDelete={() => deleteTarget.open(selectedLead)}
        />
      )}

      <ConfirmDialog
        open={deleteTarget.isOpen}
        onOpenChange={(open) => !open && deleteTarget.close()}
        title="Delete this lead?"
        description={`"${deleteTarget.target?.clientName ?? ""}" and its full follow-up history will be permanently removed. This can't be undone.`}
        onConfirm={handleDelete}
      />
    </div>
  );
};

const LeadDetailDialog: React.FC<{
  lead: Lead;
  isAdmin: boolean;
  designers: { id: string; displayName: string }[];
  onClose: () => void;
  onRequestDelete: () => void;
}> = ({ lead, isAdmin, designers, onClose, onRequestDelete }) => {
  // Designers don't own an open-to-designers lead yet -- claiming is the
  // only thing they can do until they do (firestore.rules enforces this
  // too, not just the UI). Once claimed, `lead` refetches with a real
  // assignedTo and this same dialog falls through to the full view below.
  if (lead.assignedTo === null && !isAdmin) {
    return <ClaimLeadDialog lead={lead} onClose={onClose} />;
  }

  return <LeadFullDetailDialog lead={lead} isAdmin={isAdmin} designers={designers} onClose={onClose} onRequestDelete={onRequestDelete} />;
};

const ClaimLeadDialog: React.FC<{ lead: Lead; onClose: () => void }> = ({ lead, onClose }) => {
  const claimMutation = useClaimLead();

  const handleClaim = () => {
    claimMutation.mutate(lead.id, {
      onSuccess: () => toast.success("Lead claimed -- it's yours now"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to claim lead"),
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <DialogTitle>{lead.clientName}</DialogTitle>
          <Badge variant="accent">{OPEN_TO_DESIGNERS_LABEL}</Badge>
        </div>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-xl border border-line bg-surface p-4 text-[0.8125rem] sm:grid-cols-2">
          <div>
            <span className="text-faint-ink">Contact: </span>
            <span className="text-ink">{[lead.phone, lead.email].filter(Boolean).join(" · ") || "—"}</span>
          </div>
          <div>
            <span className="text-faint-ink">Address: </span>
            <span className="text-ink">{lead.address ?? "—"}</span>
          </div>
          <div>
            <span className="text-faint-ink">Source: </span>
            <span className="text-ink">{lead.source}</span>
          </div>
          <div>
            <span className="text-faint-ink">Project Type: </span>
            <span className="text-ink">{lead.projectType}</span>
          </div>
          <div>
            <span className="text-faint-ink">Budget: </span>
            <span className="text-ink">{lead.budget != null ? formatSGD(lead.budget) : "—"}</span>
          </div>
        </div>
        {lead.notes && <p className="text-[0.8125rem] text-faint-ink">{lead.notes}</p>}
        <p className="text-[0.8125rem] text-faint-ink">
          This lead hasn't been claimed yet. Claim it to take ownership -- once you do, it moves to your own leads and no
          other designer can take it.
        </p>
        <DialogFooter>
          <Button onClick={handleClaim} disabled={claimMutation.isPending}>
            {claimMutation.isPending ? "Claiming..." : "Claim This Lead"}
          </Button>
        </DialogFooter>
      </div>
    </Dialog>
  );
};

const LeadFullDetailDialog: React.FC<{
  lead: Lead;
  isAdmin: boolean;
  designers: { id: string; displayName: string }[];
  onClose: () => void;
  onRequestDelete: () => void;
}> = ({ lead, isAdmin, designers, onClose, onRequestDelete }) => {
  const updateMutation = useUpdateLead();
  const followUpsQuery = useFollowUpsForLead(lead.id);
  const createFollowUp = useCreateFollowUp();

  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [quotationAmount, setQuotationAmount] = useState(lead.quotationAmount?.toString() ?? "");
  const [contractAmount, setContractAmount] = useState(lead.contractAmount?.toString() ?? "");
  const [gstApplicable, setGstApplicable] = useState<boolean | null>(lead.gstApplicable ?? null);
  const [nextFollowUpDate, setNextFollowUpDate] = useState(lead.nextFollowUpDate ?? "");
  const [assignedTo, setAssignedTo] = useState(lead.assignedTo ?? OPEN_TO_DESIGNERS);
  const [notes, setNotes] = useState(lead.notes ?? "");
  // Follow-up history is noise once a deal is closed -- collapsed by
  // default for signed/rejected leads, but still one click away.
  const [showFollowUps, setShowFollowUps] = useState(!CLOSED_LEAD_STATUSES.includes(lead.status));

  useEffect(() => {
    setStatus(lead.status);
    setQuotationAmount(lead.quotationAmount?.toString() ?? "");
    setContractAmount(lead.contractAmount?.toString() ?? "");
    setGstApplicable(lead.gstApplicable ?? null);
    setNextFollowUpDate(lead.nextFollowUpDate ?? "");
    setAssignedTo(lead.assignedTo ?? OPEN_TO_DESIGNERS);
    setNotes(lead.notes ?? "");
    setShowFollowUps(!CLOSED_LEAD_STATUSES.includes(lead.status));
  }, [lead]);

  const [fuMethod, setFuMethod] = useState<string>(FOLLOW_UP_METHODS[0]);
  const [fuOutcome, setFuOutcome] = useState("");
  const [fuNextDate, setFuNextDate] = useState("");

  const handleSaveDetails = () => {
    if (status === "signed" && !contractAmount.trim()) {
      toast.error("Contract amount is required once a lead is marked signed");
      return;
    }

    const isOpenSelection = assignedTo === OPEN_TO_DESIGNERS;
    const designer = isOpenSelection ? null : designers.find((d) => d.id === assignedTo);
    const assignmentChanged =
      isAdmin && ((isOpenSelection && lead.assignedTo !== null) || (!isOpenSelection && !!designer && designer.id !== lead.assignedTo));

    updateMutation.mutate(
      {
        id: lead.id,
        status,
        quotationAmount: quotationAmount ? Number(quotationAmount) : null,
        contractAmount: contractAmount ? Number(contractAmount) : null,
        gstApplicable,
        nextFollowUpDate: nextFollowUpDate || null,
        notes: notes || null,
        ...(assignmentChanged
          ? { assignedTo: isOpenSelection ? null : designer!.id, assignedToName: isOpenSelection ? OPEN_TO_DESIGNERS_LABEL : designer!.displayName }
          : {}),
      },
      {
        onSuccess: () => toast.success("Lead updated"),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update lead"),
      }
    );
  };

  const handleLogFollowUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fuOutcome.trim()) {
      toast.error("Describe what happened in this follow-up");
      return;
    }
    createFollowUp.mutate(
      {
        leadId: lead.id,
        method: fuMethod as any,
        outcome: fuOutcome,
        nextFollowUpDate: fuNextDate || null,
      },
      {
        onSuccess: () => {
          toast.success("Follow-up logged");
          setFuOutcome("");
          setFuNextDate("");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to log follow-up"),
      }
    );
  };

  const quickClose = (newStatus: "signed" | "rejected") => {
    if (!fuOutcome.trim()) {
      toast.error("Describe what happened before closing the lead");
      return;
    }
    if (newStatus === "signed" && !contractAmount.trim()) {
      setStatus("signed");
      toast.error("Enter the Contract Amount above before marking this lead signed");
      return;
    }
    createFollowUp.mutate(
      {
        leadId: lead.id,
        method: fuMethod as any,
        outcome: fuOutcome,
        nextFollowUpDate: null,
        newStatus,
        ...(newStatus === "signed" ? { contractAmount: Number(contractAmount), gstApplicable } : {}),
      },
      {
        onSuccess: () => {
          toast.success(newStatus === "signed" ? "Lead marked as signed" : "Lead marked as rejected");
          setFuOutcome("");
          setFuNextDate("");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update lead"),
      }
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} wide>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <DialogTitle>{lead.clientName}</DialogTitle>
          <StatusBadge status={lead.status} />
        </div>
      </DialogHeader>

      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-xl border border-line bg-surface p-4 text-[0.8125rem] sm:grid-cols-2">
          <div>
            <span className="text-faint-ink">Contact: </span>
            <span className="text-ink">{[lead.phone, lead.email].filter(Boolean).join(" · ") || "—"}</span>
          </div>
          <div>
            <span className="text-faint-ink">Address: </span>
            <span className="text-ink">{lead.address ?? "—"}</span>
          </div>
          <div>
            <span className="text-faint-ink">Source: </span>
            <span className="text-ink">{lead.source}</span>
          </div>
          <div>
            <span className="text-faint-ink">Project Type: </span>
            <span className="text-ink">{lead.projectType}</span>
          </div>
          <div>
            <span className="text-faint-ink">Budget: </span>
            <span className="text-ink">{lead.budget != null ? formatSGD(lead.budget) : "—"}</span>
          </div>
          <div>
            <span className="text-faint-ink">Logged: </span>
            <span className="text-ink">
              {new Date(lead.createdAt).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" })}
              {lead.createdByName ? ` by ${lead.createdByName}` : ""}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="font-display text-base font-semibold text-ink">Status &amp; Deal</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-[0.8125rem] font-medium text-ink">Status</label>
              <Select value={status} onValueChange={(v) => setStatus(v as LeadStatus)} options={LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] }))} />
            </div>
            {isAdmin && (
              <div className="flex flex-col gap-2">
                <label className="text-[0.8125rem] font-medium text-ink">Assigned To</label>
                <Select
                  value={assignedTo}
                  onValueChange={setAssignedTo}
                  options={[{ value: OPEN_TO_DESIGNERS, label: OPEN_TO_DESIGNERS_LABEL }, ...designers.map((d) => ({ value: d.id, label: d.displayName }))]}
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-5 text-[0.8125rem]">
            <Checkbox
              className="font-medium text-ink"
              checked={status === "signed"}
              onChange={(checked) => setStatus(checked ? "signed" : "follow_up")}
            >
              Signed
            </Checkbox>
            <Checkbox
              className="font-medium text-ink"
              checked={status === "rejected"}
              onChange={(checked) => setStatus(checked ? "rejected" : "follow_up")}
            >
              Rejected
            </Checkbox>
            <span className="text-faint-ink">Check, then Save Changes -- no follow-up note required.</span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-[0.8125rem] font-medium text-ink">Quotation Amount (S$)</label>
              <Input
                type="number"
                min="0"
                value={quotationAmount}
                onChange={(e) => setQuotationAmount(e.target.value)}
                disabled={status === "signed"}
                className={status === "signed" ? "opacity-60" : ""}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[0.8125rem] font-medium text-ink">Next Follow-up Due</label>
              <Input type="date" value={nextFollowUpDate} onChange={(e) => setNextFollowUpDate(e.target.value)} />
            </div>
          </div>
          {status === "signed" && (
            <div className="flex flex-col gap-2">
              <label className="text-[0.8125rem] font-medium text-ink">Contract Amount Before GST (S$) *</label>
              <Input
                type="number"
                min="0"
                value={contractAmount}
                onChange={(e) => setContractAmount(e.target.value)}
                placeholder="The actual signed contract value"
                required
              />
              <div className="flex items-center gap-5 text-[0.8125rem]">
                <Checkbox
                  className="font-medium text-ink"
                  checked={gstApplicable === true}
                  onChange={(checked) => setGstApplicable(checked ? true : null)}
                >
                  With GST
                </Checkbox>
                <Checkbox
                  className="font-medium text-ink"
                  checked={gstApplicable === false}
                  onChange={(checked) => setGstApplicable(checked ? false : null)}
                >
                  No GST
                </Checkbox>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-ink">Notes</label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="General notes about this client/project" />
          </div>
          <div className="flex items-center justify-between">
            {isAdmin ? (
              <Button variant="ghost" size="sm" onClick={onRequestDelete} className="text-bad">
                <Trash2 size={14} /> Delete Lead
              </Button>
            ) : (
              <span />
            )}
            <Button onClick={handleSaveDetails} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-line pt-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-base font-semibold text-ink">Follow-up Timeline</h3>
            {CLOSED_LEAD_STATUSES.includes(lead.status) && (
              <Button variant="ghost" size="sm" onClick={() => setShowFollowUps((v) => !v)}>
                {showFollowUps ? "Hide" : `Show History${followUpsQuery.data ? ` (${followUpsQuery.data.length})` : ""}`}
              </Button>
            )}
          </div>

          {showFollowUps && (
            <>
              {followUpsQuery.isLoading ? (
                <Skeleton style={{ height: 60 }} />
              ) : (followUpsQuery.data ?? []).length === 0 ? (
                <p className="text-[0.8125rem] text-faint-ink">No follow-ups logged yet.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {followUpsQuery.data!.map((fu) => (
                    <li key={fu.id} className="rounded-xl border border-line bg-panel p-3 text-[0.8125rem]">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <Badge variant="outline">{fu.method}</Badge>
                        <span className="text-xs text-faint-ink">
                          {new Date(fu.loggedAt).toLocaleString("en-SG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {fu.loggedByName}
                        </span>
                      </div>
                      <p className="text-ink">{fu.outcome}</p>
                      {fu.nextFollowUpDate && (
                        <p className="mt-1 text-xs text-faint-ink">
                          Next follow-up set for {new Date(`${fu.nextFollowUpDate}T00:00:00`).toLocaleDateString("en-SG", { day: "numeric", month: "short" })}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {!CLOSED_LEAD_STATUSES.includes(lead.status) && (
                <form onSubmit={handleLogFollowUp} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
                  <h4 className="text-[0.8125rem] font-semibold text-ink">Log a Follow-up</h4>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Select value={fuMethod} onValueChange={setFuMethod} options={FOLLOW_UP_METHODS.map((m) => ({ value: m, label: m }))} />
                    <Input type="date" value={fuNextDate} onChange={(e) => setFuNextDate(e.target.value)} placeholder="Next follow-up date" />
                  </div>
                  <Textarea
                    rows={2}
                    value={fuOutcome}
                    onChange={(e) => setFuOutcome(e.target.value)}
                    placeholder="What happened? Did they respond? Any objections, next steps..."
                    required
                  />
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button type="button" variant="danger" size="sm" onClick={() => quickClose("rejected")} disabled={createFollowUp.isPending}>
                      Log &amp; Mark Rejected
                    </Button>
                    <Button type="button" variant="soft" size="sm" onClick={() => quickClose("signed")} disabled={createFollowUp.isPending}>
                      Log &amp; Mark Signed
                    </Button>
                    <Button type="submit" size="sm" disabled={createFollowUp.isPending}>
                      {createFollowUp.isPending ? "Saving..." : "Log Follow-up"}
                    </Button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
};
