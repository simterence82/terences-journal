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
import { USER_ROLE_LABELS, type PendingUser, type User, type UserRole } from "../lib/types";

const ROLE_BADGE_VARIANT: Record<UserRole, "brand" | "ok" | "accent"> = {
  super_admin: "brand",
  admin: "ok",
  designer: "accent",
};

export const UsersPage: React.FC = () => {
  const { authState } = useAuth();
  const currentUser = authState.type === "authenticated" ? authState.user : null;
  const isSuperAdmin = currentUser?.role === "super_admin";

  const listQuery = useUsersList();
  const pendingQuery = usePendingUsersList();
  const approveMutation = useApproveUser();
  const denyMutation = useDenyUser();
  const deleteMutation = useDeleteUser();
  const deleteTarget = useConfirmDialog<User>();
  const denyTarget = useConfirmDialog<PendingUser>();

  const users = listQuery.data ?? [];
  const pendingUsers = pendingQuery.data ?? [];

  const handleApprove = (pending: PendingUser, role: UserRole) => {
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

  // A plain admin can only remove designer accounts; a super admin can
  // remove anyone but themselves. Mirrors firestore.rules' users/{id} delete.
  const canDelete = (u: User) =>
    u.id !== currentUser?.id && (isSuperAdmin || u.role === "designer");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">User Management</h1>
        <p className="mt-1 text-[0.9375rem] text-faint-ink">
          {isSuperAdmin
            ? "Manage who can access Studio Leads, including other admins."
            : "Manage designer access to Studio Leads. Only a super admin can grant admin access."}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold text-ink">Pending Requests</h2>
        <div className="overflow-x-auto rounded-xl border border-line bg-panel shadow-sm">
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
                    <th key={h} className="border-b border-line px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-faint-ink">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pendingUsers.map((p) => (
                  <tr key={p.id} className="hover:bg-surface">
                    <td className="border-b border-line px-4 py-3 text-ink">{p.displayName}</td>
                    <td className="border-b border-line px-4 py-3 text-ink">{p.email}</td>
                    <td className="border-b border-line px-4 py-3 text-ink">
                      {p.requestedAt ? new Date(p.requestedAt).toLocaleDateString("en-SG") : "-"}
                    </td>
                    <td className="border-b border-line px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={approveMutation.isPending}
                          onClick={() => handleApprove(p, "designer")}
                        >
                          <Check size={14} /> Approve as Designer
                        </Button>
                        {isSuperAdmin && (
                          <>
                            <Button
                              variant="soft"
                              size="sm"
                              disabled={approveMutation.isPending}
                              onClick={() => handleApprove(p, "admin")}
                            >
                              <Check size={14} /> Approve as Admin
                            </Button>
                            <Button
                              variant="soft"
                              size="sm"
                              disabled={approveMutation.isPending}
                              onClick={() => handleApprove(p, "super_admin")}
                            >
                              <Check size={14} /> Approve as Super Admin
                            </Button>
                          </>
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
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold text-ink">Active Users</h2>
        <div className="overflow-x-auto rounded-xl border border-line bg-panel shadow-sm">
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
                    <th key={h} className="border-b border-line px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-faint-ink">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-surface">
                    <td className="border-b border-line px-4 py-3 text-ink">{u.displayName}</td>
                    <td className="border-b border-line px-4 py-3 text-ink">{u.email}</td>
                    <td className="border-b border-line px-4 py-3">
                      <Badge variant={ROLE_BADGE_VARIANT[u.role]}>{USER_ROLE_LABELS[u.role]}</Badge>
                    </td>
                    <td className="border-b border-line px-4 py-3 text-ink">{u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-SG") : "-"}</td>
                    <td className="border-b border-line px-4 py-3">
                      {canDelete(u) && (
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
