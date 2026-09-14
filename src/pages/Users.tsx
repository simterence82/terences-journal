import React from "react";
import { Check, ShieldPlus, Trash2, UserCheck, Users as UsersIcon, X } from "lucide-react";
import { toast } from "sonner";
import {
  useApproveUser,
  useBecomeSuperAdmin,
  useDenyUser,
  useDeleteUser,
  useUpdateUserRole,
  usePendingUsersList,
  useUsersList,
} from "../hooks/useUsers";
import { useAuth } from "../lib/AuthContext";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Select } from "../components/Select";
import { ConfirmDialog, useConfirmDialog } from "../components/ConfirmDialog";
import { Skeleton } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import type { PendingUser, User, UserRole } from "../lib/types";

const ROLE_BADGE_VARIANT: Record<UserRole, "destructive" | "primary" | "secondary"> = {
  superadmin: "destructive",
  admin: "primary",
  member: "secondary",
};

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" },
  { value: "superadmin", label: "Super Admin" },
];

export const UsersPage: React.FC = () => {
  const { authState } = useAuth();
  const currentUserId = authState.type === "authenticated" ? authState.user.id : null;
  const isAdmin = authState.type === "authenticated" && (authState.user.role === "admin" || authState.user.role === "superadmin");
  const isSuperAdmin = authState.type === "authenticated" && authState.user.role === "superadmin";

  const listQuery = useUsersList();
  const pendingQuery = usePendingUsersList();
  const approveMutation = useApproveUser();
  const denyMutation = useDenyUser();
  const deleteMutation = useDeleteUser();
  const updateRoleMutation = useUpdateUserRole();
  const becomeSuperAdminMutation = useBecomeSuperAdmin();
  const deleteTarget = useConfirmDialog<User>();
  const denyTarget = useConfirmDialog<PendingUser>();
  const bootstrapConfirm = useConfirmDialog<true>();

  const users = listQuery.data ?? [];
  const pendingUsers = pendingQuery.data ?? [];
  const noSuperAdminYet = !listQuery.isLoading && !users.some((u) => u.role === "superadmin");

  const handleBecomeSuperAdmin = async () => {
    if (!currentUserId) return;
    await becomeSuperAdminMutation.mutateAsync(currentUserId, {
      onSuccess: () => toast.success("You are now a Super Admin"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to become Super Admin"),
    });
  };

  const handleApprove = (pending: PendingUser, role: UserRole) => {
    approveMutation.mutate(
      { id: pending.id, email: pending.email, displayName: pending.displayName, role },
      {
        onSuccess: () => toast.success("User approved"),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to approve user"),
      }
    );
  };

  const handleRoleChange = (user: User, role: UserRole) => {
    if (role === user.role) return;
    updateRoleMutation.mutate(
      { id: user.id, role },
      {
        onSuccess: () => toast.success(`${user.displayName}'s role updated`),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update role"),
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

      {isAdmin && !isSuperAdmin && noSuperAdminYet && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning bg-[var(--warning-tint)] px-6 py-4 shadow">
          <div className="flex items-center gap-3">
            <ShieldPlus size={20} className="shrink-0 text-warning" />
            <div>
              <p className="text-sm font-semibold text-foreground">No Super Admin exists yet</p>
              <p className="text-xs text-muted-foreground">
                A Super Admin must approve every deletion. As the one-time setup step, you can promote yourself.
              </p>
            </div>
          </div>
          <Button variant="destructive" size="sm" onClick={() => bootstrapConfirm.open(true)}>
            <ShieldPlus size={14} /> Become Super Admin
          </Button>
        </div>
      )}

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
                          {isSuperAdmin && (
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={approveMutation.isPending}
                              onClick={() => handleApprove(p, "superadmin")}
                            >
                              <Check size={14} /> Approve as Super Admin
                            </Button>
                          )}
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
                    {isSuperAdmin && (
                      <Button variant="destructive" size="sm" disabled={approveMutation.isPending} onClick={() => handleApprove(p, "superadmin")}>
                        <Check size={14} /> Approve as Super Admin
                      </Button>
                    )}
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
                        {isSuperAdmin && u.id !== currentUserId ? (
                          <Select
                            value={u.role}
                            onValueChange={(v) => handleRoleChange(u, v as UserRole)}
                            options={ROLE_OPTIONS}
                            className="w-40"
                          />
                        ) : (
                          <Badge variant={ROLE_BADGE_VARIANT[u.role]}>{u.role}</Badge>
                        )}
                      </td>
                      <td className="border-b border-border px-4 py-3 text-foreground">{u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-SG") : "-"}</td>
                      <td className="border-b border-border px-4 py-3">
                        {u.id !== currentUserId && (u.role !== "superadmin" || isSuperAdmin) && (
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
                      {u.id !== currentUserId && (u.role !== "superadmin" || isSuperAdmin) && (
                        <Button variant="ghost" size="icon" onClick={() => deleteTarget.open(u)} aria-label="Delete user">
                          <Trash2 size={16} />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 border-t border-border pt-2">
                    {isSuperAdmin && u.id !== currentUserId ? (
                      <Select
                        value={u.role}
                        onValueChange={(v) => handleRoleChange(u, v as UserRole)}
                        options={ROLE_OPTIONS}
                        className="w-40"
                      />
                    ) : (
                      <Badge variant={ROLE_BADGE_VARIANT[u.role]}>{u.role}</Badge>
                    )}
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

      <ConfirmDialog
        open={bootstrapConfirm.isOpen}
        onOpenChange={(open) => !open && bootstrapConfirm.close()}
        title="Become the first Super Admin?"
        description="This is a one-time setup step: once a Super Admin exists, only a Super Admin can grant or revoke that role. You'll also be able to approve or reject deletion requests from other Admins."
        confirmLabel="Become Super Admin"
        onConfirm={handleBecomeSuperAdmin}
      />
    </div>
  );
};
