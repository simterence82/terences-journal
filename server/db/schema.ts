import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").$type<"admin" | "member">().notNull().default("member"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const lightingPurchases = sqliteTable("lighting_purchases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  brand: text("brand").notNull(),
  clientName: text("client_name").notNull(),
  address: text("address").notNull(),
  date: text("date").notNull(),
  commissionGiven: real("commission_given").notNull().default(0),
  commissionRecipient: text("commission_recipient"),
  cost: real("cost").notNull().default(0),
  selling: real("selling").notNull().default(0),
  paidToSeller: integer("paid_to_seller", { mode: "boolean" }).notNull().default(false),
  reimbursed: integer("reimbursed", { mode: "boolean" }).notNull().default(false),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});

export const blumPurchases = sqliteTable("blum_purchases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderName: text("order_name").notNull(),
  amount: real("amount").notNull().default(0),
  date: text("date").notNull(),
  paidToSeller: integer("paid_to_seller", { mode: "boolean" }).notNull().default(false),
  reimbursed: integer("reimbursed", { mode: "boolean" }).notNull().default(false),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});

export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: text("due_date"),
  priority: text("priority").$type<"low" | "medium" | "high">().notNull().default("medium"),
  done: integer("done", { mode: "boolean" }).notNull().default(false),
  assignedTo: text("assigned_to"),
  fileName: text("file_name"),
  fileData: text("file_data"),
  fileType: text("file_type"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});

export const issues = sqliteTable("issues", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description"),
  fileName: text("file_name"),
  fileData: text("file_data"),
  fileType: text("file_type"),
  resolved: integer("resolved", { mode: "boolean" }).notNull().default(false),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});

export const scheduleEvents = sqliteTable("schedule_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  date: text("date").notNull(),
  startTime: text("start_time"),
  endTime: text("end_time"),
  location: text("location"),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});
