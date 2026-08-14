export type UserRole = "admin" | "member";

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt?: string;
}

export interface PendingUser {
  id: string;
  email: string;
  displayName: string;
  requestedAt: string;
}

export interface LightingPurchase {
  id: string;
  brand: string;
  clientName: string;
  address: string;
  date: string;
  commissionGiven: number;
  commissionRecipient: string | null;
  cost: number;
  selling: number;
  paidToSeller: boolean;
  reimbursed: boolean;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface BlumPurchase {
  id: string;
  orderName: string;
  amount: number;
  date: string;
  paidToSeller: boolean;
  reimbursed: boolean;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}

export type TaskPriority = "low" | "medium" | "high";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: TaskPriority;
  done: boolean;
  assignedTo: string | null;
  fileName: string | null;
  fileType: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface Issue {
  id: string;
  title: string;
  description: string | null;
  resolved: boolean;
  fileName: string | null;
  fileType: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface ScheduleEvent {
  id: string;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}

export type TrashKind = "lighting" | "blum" | "tasks" | "issues" | "schedule";

export interface TrashItem {
  kind: TrashKind;
  id: string;
  title: string;
  subtitle: string;
  hasFile: boolean;
  deletedAt: string;
  purgeAt: string;
}

export interface FileArchiveItem {
  kind: "tasks" | "issues";
  id: string;
  sourceTitle: string;
  fileName: string;
  fileType: string | null;
  createdAt: string;
}

export interface LookupsResponse {
  brands: string[];
  clientNames: string[];
  addresses: string[];
  commissionRecipients: string[];
  blumOrderNames: string[];
  taskAssignees: string[];
}
