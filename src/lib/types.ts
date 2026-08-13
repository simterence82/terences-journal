export type UserRole = "admin" | "member";

export interface User {
  id: number;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt?: string;
}

export interface LightingPurchase {
  id: number;
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
  createdBy: number | null;
  createdAt: string;
}

export interface BlumPurchase {
  id: number;
  orderName: string;
  amount: number;
  date: string;
  paidToSeller: boolean;
  reimbursed: boolean;
  notes: string | null;
  createdBy: number | null;
  createdAt: string;
}

export type TaskPriority = "low" | "medium" | "high";

export interface Task {
  id: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: TaskPriority;
  done: boolean;
  assignedTo: string | null;
  fileName: string | null;
  fileType: string | null;
  createdBy: number | null;
  createdAt: string;
}

export interface Issue {
  id: number;
  title: string;
  description: string | null;
  resolved: boolean;
  fileName: string | null;
  fileType: string | null;
  createdBy: number | null;
  createdAt: string;
}

export interface ScheduleEvent {
  id: number;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  notes: string | null;
  createdBy: number | null;
  createdAt: string;
}

export type TrashKind = "lighting" | "blum" | "tasks" | "issues" | "schedule";

export interface TrashItem {
  kind: TrashKind;
  id: number;
  title: string;
  subtitle: string;
  hasFile: boolean;
  deletedAt: string;
  purgeAt: string;
}

export interface FileArchiveItem {
  kind: "tasks" | "issues";
  id: number;
  sourceTitle: string;
  fileName: string;
  fileType: string | null;
  createdAt: string;
  downloadUrl: string;
}

export interface LookupsResponse {
  brands: string[];
  clientNames: string[];
  addresses: string[];
  commissionRecipients: string[];
  blumOrderNames: string[];
  taskAssignees: string[];
}
