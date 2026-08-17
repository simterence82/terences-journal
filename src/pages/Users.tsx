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
    await deleteMutation.mutateAsync(
      { id: deleteTarget.target.id, email: deleteTarget.target.email },
      {
        onSuccess: () => toast.success("User deleted"),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete user"),
      }
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-foreground">User Management</h1>
        <p className="mt-1 text-[0.9375rem] text-muted-foreground">Manage who can access this journal</p>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold text-foreground">Pending Requests</h2>
        {pendingQuery.isLoading ? (
          <div className="rounded-lg border border-border bg-card p-6 shadow">
            <Skeleton style={{ height: 100 }} />
          </div>
        ) : pendingUsers.length === 0 ? (
          <div className="rounded-lg border border-border bg-card shadow">
            <EmptyState icon={<UserCheck size={26} />} message="No pending requests." className="py-10" />
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-lg border border-border bg-card shadow md:block">
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
            </div>

            <div className="flex flex-col gap-3 md:hidden">
              {pendingUsers.map((p) => (
                <div key={p.id} className="rounded-lg border border-border bg-card p-4 shadow">
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{p.displayName}</span>
                    <span className="text-xs text-muted-foreground">{p.email}</span>
                    <span className="text-xs text-muted-foreground">
                      Requested {p.requestedAt ? new Date(p.requestedAt).toLocaleDateString("en-SG") : "-"}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                    <Button variant="outline" size="sm" disabled={approveMutation.isPending} onClick={() => handleApprove(p, "member")}>
                      <Check size={14} /> Approve as Member
                    </Button>
                    <Button variant="secondary" size="sm" disabled={approveMutation.isPending} onClick={() => handleApprove(p, "admin")}>
                      <Check size={14} /> Approve as Admin
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => denyTarget.open(p)}>
                      <X size={14} /> Deny
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold text-foreground">Active Users</h2>
        {listQuery.isLoading ? (
          <div className="rounded-lg border border-border bg-card p-6 shadow">
            <Skeleton style={{ height: 200 }} />
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-lg border border-border bg-card shadow">
            <EmptyState icon={<UsersIcon size={28} />} message="No users yet." />
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-lg border border-border bg-card shadow md:block">
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
            </div>

            <div className="flex flex-col gap-3 md:hidden">
              {users.map((u) => (
                <div key={u.id} className="rounded-lg border border-border bg-card p-4 shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium text-foreground">{u.displayName}</span>
                      <span className="truncate text-xs text-muted-foreground">{u.email}</span>
                      <span className="text-xs text-muted-foreground">{u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-SG") : "-"}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant={u.role === "admin" ? "primary" : "secondary"}>{u.role}</Badge>
                      {u.id !== currentUserId && (
                        <Button variant="ghost" size="icon" onClick={() => deleteTarget.open(u)} aria-label="Delete user">
                          <Trash2 size={16} />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget.isOpen}
        onOpenChange={(open) => !open && deleteTarget.close()}
        title="Delete this user?"
        description={`"${deleteTarget.target?.displayName ?? ""}" will lose access immediately. Their login is fully removed within a few minutes, so the same email address can be used to sign up again if needed.`}
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
