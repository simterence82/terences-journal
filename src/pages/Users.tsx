import React from "react";
import { Check, Trash2, UserCheck, Users as UsersIcon, X } from "lucide-react";
import { toast } from "sonner";
import { useApproveUser, useDenyUser, useDeleteUser, usePendingUsersList, useUsersList } from "../hooks/useUsers";
import { useAuth } from "../lib/AuthContext";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { ConfirmDialog, useConfirmDialog } from "../components/ConfirmDialog";
import { Skeleton } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import type { PendingUser, User } from "../lib/types";

export const UsersPage: React.FC = () => {
  const { authState } = useAuth();
  const currentUserId = authState.type === "authenticated" ? authState.user.id : null;

  const listQuery = useUsersList();
  const pendingQuery = usePendingUsersList();
  const approveMutation = useApproveUser();
  const denyMutation = useDenyUser();
  const deleteMutation = useDeleteUser();
  const deleteTarget = useConfirmDialog<User>();
  const denyTarget = useConfirmDialog<PendingUser>();

  const users = listQuery.data ?? [];
  const pendingUsers = pendingQuery.data ?? [];

  const handleApprove = (pending: PendingUser, role: "admin" | "member") => {
    approveMutation.mutate(
      { id: pending.id, email: pending.email, displayName: pending.displayName, role },
      {
        onSuccess: () => toast.success("User approved"),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to approve user"),
      }
    );
  };

  const handleDeny = async () => {
    if (!denyTarget.target) return;
    await denyMutation.mutateAsync(denyTarget.target.id, {
      onSuccess: () => toast.success("Request denied"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to deny request"),
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget.target) return;
    await deleteMutation.mutateAsync(deleteTarget.target.id, {
      onSuccess: () => toast.success("User deleted"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete user"),
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-foreground">User Management</h1>
        <p className="mt-1 text-[0.9375rem] text-muted-foreground">Manage who can access this journal</p>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold text-foreground">Pending Requests</h2>
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow">
          {pendingQuery.isLoading ? (
            <div className="p-6">
              <Skeleton style={{ height: 100 }} />
            </div>
          ) : pendingUsers.length === 0 ? (
            <EmptyState icon={<UserCheck size={26} />} message="No pending requests." className="py-10" />
          ) : (
            <table className="w-full text-[0.8125rem]">
              <thead className="bg-surface">
                <tr>
                  {["Display Name", "Username", "Requested", ""].map((h) => (
                    <th key={h} className="border-b border-border px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pendingUsers.map((p) => (
                  <tr key={p.id} className="hover:bg-surface">
                    <td className="border-b border-border px-4 py-3 text-foreground">{p.displayName}</td>
                    <td className="border-b border-border px-4 py-3 text-foreground">{p.email}</td>
                    <td className="border-b border-border px-4 py-3 text-foreground">
                      {p.requestedAt ? new Date(p.requestedAt).toLocaleDateString("en-SG") : "-"}
                    </td>
                    <td className="border-b border-border px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={approveMutation.isPending}
                          onClick={() => handleApprove(p, "member")}
                        >
                          <Check size={14} /> Approve as Member
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={approveMutation.isPending}
                          onClick={() => handleApprove(p, "admin")}
                        >
                          <Check size={14} /> Approve as Admin
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => denyTarget.open(p)}>
                          <X size={14} /> Deny
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold text-foreground">Active Users</h2>
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow">
          {listQuery.isLoading ? (
            <div className="p-6">
              <Skeleton style={{ height: 200 }} />
            </div>
          ) : users.length === 0 ? (
            <EmptyState icon={<UsersIcon size={28} />} message="No users yet." />
          ) : (
            <table className="w-full text-[0.8125rem]">
              <thead className="bg-surface">
                <tr>
                  {["Display Name", "Username", "Role", "Created", ""].map((h) => (
                    <th key={h} className="border-b border-border px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-surface">
                    <td className="border-b border-border px-4 py-3 text-foreground">{u.displayName}</td>
                    <td className="border-b border-border px-4 py-3 text-foreground">{u.email}</td>
                    <td className="border-b border-border px-4 py-3">
                      <Badge variant={u.role === "admin" ? "primary" : "secondary"}>{u.role}</Badge>
                    </td>
                    <td className="border-b border-border px-4 py-3 text-foreground">{u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-SG") : "-"}</td>
                    <td className="border-b border-border px-4 py-3">
                      {u.id !== currentUserId && (
                        <Button variant="ghost" size="icon" onClick={() => deleteTarget.open(u)} aria-label="Delete user">
                          <Trash2 size={16} />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteTarget.isOpen}
        onOpenChange={(open) => !open && deleteTarget.close()}
        title="Delete this user?"
        description={`"${deleteTarget.target?.displayName ?? ""}" will lose access immediately. This only removes their app access — their underlying login still exists and cannot be fully deleted from here, but they'll be stuck on the "awaiting approval" screen with no way back in unless re-added.`}
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={denyTarget.isOpen}
        onOpenChange={(open) => !open && denyTarget.close()}
        title="Deny this request?"
        description={`"${denyTarget.target?.displayName ?? ""}" will not be granted access. They can sign up again to submit a new request.`}
        confirmLabel="Deny"
        onConfirm={handleDeny}
      />
    </div>
  );
};
