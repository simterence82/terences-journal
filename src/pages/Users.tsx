import React, { useState } from "react";
import { Plus, Trash2, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { useUsersList, useCreateUser, useDeleteUser } from "../hooks/useUsers";
import { useAuth } from "../lib/AuthContext";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "../components/Dialog";
import { ConfirmDialog, useConfirmDialog } from "../components/ConfirmDialog";
import { Skeleton } from "../components/Skeleton";
import type { User } from "../lib/types";

const EMPTY_FORM = { displayName: "", email: "", password: "", role: "member" as "admin" | "member" };
const ROLE_OPTIONS = [
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" },
];

export const UsersPage: React.FC = () => {
  const { authState } = useAuth();
  const currentUserId = authState.type === "authenticated" ? authState.user.id : null;

  const listQuery = useUsersList();
  const createMutation = useCreateUser();
  const deleteMutation = useDeleteUser();
  const deleteTarget = useConfirmDialog<User>();

  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const users = listQuery.data ?? [];
  const resetForm = () => setForm(EMPTY_FORM);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.displayName || !form.email || form.password.length < 8) {
      toast.error("Display name, email, and an 8+ character password are required");
      return;
    }
    createMutation.mutate(form, {
      onSuccess: () => {
        toast.success("User created");
        resetForm();
        setIsOpen(false);
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to create user"),
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground">User Management</h1>
          <p className="mt-1 text-[0.9375rem] text-muted-foreground">Manage who can access this journal</p>
        </div>
        <Button onClick={() => setIsOpen(true)}>
          <Plus size={16} /> Add User
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
        <DialogHeader>
          <DialogTitle>Add User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-foreground">Display Name *</label>
            <Input value={form.displayName} onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))} required />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-foreground">Username / Email *</label>
            <Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} required />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-foreground">Password *</label>
            <Input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} required />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[0.8125rem] font-medium text-foreground">Role</label>
            <Select value={form.role} onValueChange={(v) => setForm((p) => ({ ...p, role: v as "admin" | "member" }))} options={ROLE_OPTIONS} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow">
        {listQuery.isLoading ? (
          <div className="p-6">
            <Skeleton style={{ height: 200 }} />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <UsersIcon size={32} />
            <p>No users yet.</p>
          </div>
        ) : (
          <table className="w-full text-[0.8125rem]">
            <thead>
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

      <ConfirmDialog
        open={deleteTarget.isOpen}
        onOpenChange={(open) => !open && deleteTarget.close()}
        title="Delete this user?"
        description={`"${deleteTarget.target?.displayName ?? ""}" will lose access immediately. This cannot be undone.`}
        onConfirm={handleDelete}
      />
    </div>
  );
};
