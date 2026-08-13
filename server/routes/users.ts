import { Router } from "express";
import { z } from "zod";
import { firebaseAuth } from "../firebase";
import { requireAuth, requireAdmin } from "../auth/middleware";

const router = Router();
router.use(requireAuth, requireAdmin);

router.get("/", async (_req, res) => {
  try {
    const result = await firebaseAuth.listUsers(1000);
    const users = result.users
      .map((u) => ({
        id: u.uid,
        email: u.email ?? "",
        displayName: u.displayName ?? u.email ?? "",
        role: u.customClaims?.role === "admin" ? ("admin" as const) : ("member" as const),
        createdAt: u.metadata.creationTime,
      }))
      .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list users" });
  }
});

const createSchema = z.object({
  displayName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["admin", "member"]),
});

router.post("/", async (req, res) => {
  try {
    const input = createSchema.parse(req.body);

    const userRecord = await firebaseAuth.createUser({
      email: input.email.toLowerCase(),
      password: input.password,
      displayName: input.displayName,
    });

    await firebaseAuth.setCustomUserClaims(userRecord.uid, { role: input.role });

    res.json({
      id: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
      role: input.role,
      createdAt: userRecord.metadata.creationTime,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create user";
    const status = message.includes("already exists") ? 409 : 400;
    res.status(status).json({ error: message });
  }
});

router.delete("/:id", async (req, res) => {
  const uid = req.params.id;
  if (uid === req.user!.id) {
    res.status(400).json({ error: "You cannot delete your own account" });
    return;
  }
  try {
    await firebaseAuth.deleteUser(uid);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete user" });
  }
});

export default router;
